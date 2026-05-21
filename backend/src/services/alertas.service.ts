import { prisma } from '../lib/prisma';
import { emitMulti } from './socket.service';

export interface UpsertAlertaInput {
  habitacion_id: string;
  tipo:          string;
  descripcion:   string;
  nivel_alerta:  string;
  frecuencia?:   number;
}

export async function upsertAlerta(input: UpsertAlertaInput) {
  const existing = await prisma.alertaMantenimiento.findFirst({
    where: {
      habitacion_id: input.habitacion_id,
      tipo:          input.tipo,
      descripcion:   input.descripcion,
      activa:        true,
    },
    select: { id: true, frecuencia: true, habitacion: { select: { numero: true } } },
  });

  let alerta: { id: string; habitacion_id: string; tipo: string; descripcion: string; nivel_alerta: string; frecuencia: number; activa: boolean };
  let accion: 'creada' | 'actualizada';

  if (existing) {
    alerta = await prisma.alertaMantenimiento.update({
      where: { id: existing.id },
      data: {
        frecuencia:  existing.frecuencia + (input.frecuencia ?? 1),
        nivel_alerta: input.nivel_alerta,
        updated_at:  new Date(),
      },
    });
    accion = 'actualizada';
  } else {
    alerta = await prisma.alertaMantenimiento.create({
      data: {
        habitacion_id: input.habitacion_id,
        tipo:          input.tipo,
        descripcion:   input.descripcion,
        frecuencia:    input.frecuencia ?? 1,
        nivel_alerta:  input.nivel_alerta,
        activa:        true,
      },
    });
    accion = 'creada';
  }

  // Emit WebSocket event
  const habitacion = await prisma.habitacion.findUnique({
    where:  { id: input.habitacion_id },
    select: { numero: true },
  });

  emitMulti('alerta:nueva', {
    alerta_id:          alerta.id,
    habitacion_numero:  habitacion?.numero ?? '?',
    tipo:               alerta.tipo,
    nivel:              alerta.nivel_alerta,
    descripcion:        alerta.descripcion,
  }, ['dashboard', 'mantenimiento']);

  return { alerta_id: alerta.id, accion };
}

export async function listarAlertas(query: {
  activa?:        string;
  nivel?:         string;
  tipo?:          string;
  habitacion_id?: string;
  page?:          number;
  limit?:         number;
}) {
  const page  = Math.max(1, query.page  ?? 1);
  const limit = Math.min(100, query.limit ?? 20);

  const where: Record<string, unknown> = {};
  if (query.activa !== undefined) where.activa = query.activa === 'true';
  if (query.nivel)         where.nivel_alerta  = query.nivel;
  if (query.tipo)          where.tipo          = query.tipo;
  if (query.habitacion_id) where.habitacion_id = query.habitacion_id;

  const [total, alertas] = await Promise.all([
    prisma.alertaMantenimiento.count({ where }),
    prisma.alertaMantenimiento.findMany({
      where,
      include: { habitacion: { select: { numero: true, tipo: true, piso: true } } },
      orderBy: { created_at: 'desc' },
      skip:    (page - 1) * limit,
      take:    limit,
    }),
  ]);

  return { data: alertas, meta: { total, page, limit, pages: Math.ceil(total / limit) } };
}

export async function resolverAlerta(id: string) {
  const alerta = await prisma.alertaMantenimiento.findUnique({ where: { id } });
  if (!alerta) return null;
  return prisma.alertaMantenimiento.update({
    where: { id },
    data: { activa: false, resuelta_en: new Date() },
  });
}
