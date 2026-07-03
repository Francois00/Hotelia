import { prisma } from '../lib/prisma';
import { AppError } from '../lib/errors';
import type { AuthPayload } from '../middleware/auth';

export interface CrearLocalInput {
  codigo:       string;
  nombre:       string;
  ruc?:         string;
  razon_social?: string;
  direccion?:   string;
  ciudad?:      string;
  color_tema?:  string;
  telefono?:    string;
  email?:       string;
}

export async function listarLocales(user: AuthPayload, incluirTodos: boolean) {
  const where = incluirTodos ? {} : { activo: true };

  const locales = user.esGlobal
    ? await prisma.local.findMany({ where, orderBy: { nombre: 'asc' } })
    : await prisma.local.findMany({
        where: { ...where, id: { in: user.locales.map((l) => l.local_id) } },
        orderBy: { nombre: 'asc' },
      });

  const conteos = await Promise.all(
    locales.map(async (l) => {
      const [habitaciones, personal] = await Promise.all([
        prisma.habitacion.count({ where: { local_id: l.id } }),
        prisma.usuarioLocal.count({ where: { local_id: l.id, activo: true } }),
      ]);
      return { ...l, total_habitaciones: habitaciones, total_personal: personal };
    }),
  );

  return conteos;
}

export async function crearLocal(data: CrearLocalInput) {
  try {
    return await prisma.local.create({
      data: {
        codigo:       data.codigo,
        nombre:       data.nombre,
        ruc:          data.ruc ?? null,
        razon_social: data.razon_social ?? null,
        direccion:    data.direccion ?? null,
        ciudad:       data.ciudad ?? null,
        color_tema:   data.color_tema ?? '#1B3A6B',
        telefono:     data.telefono ?? null,
        email:        data.email ?? null,
      },
    });
  } catch (err) {
    if (err instanceof Error && 'code' in err && (err as { code: string }).code === 'P2002') {
      throw new AppError('CODIGO_DUPLICADO', 409, `Ya existe un local con el código ${data.codigo}`);
    }
    throw err;
  }
}

export async function actualizarLocal(id: string, data: Partial<CrearLocalInput>) {
  const local = await prisma.local.findUnique({ where: { id } });
  if (!local) throw new AppError('LOCAL_NO_ENCONTRADO', 404, 'Local no encontrado');

  return prisma.local.update({
    where: { id },
    data: {
      ...(data.nombre       !== undefined && { nombre: data.nombre }),
      ...(data.ruc          !== undefined && { ruc: data.ruc }),
      ...(data.razon_social !== undefined && { razon_social: data.razon_social }),
      ...(data.direccion    !== undefined && { direccion: data.direccion }),
      ...(data.ciudad       !== undefined && { ciudad: data.ciudad }),
      ...(data.color_tema   !== undefined && { color_tema: data.color_tema }),
      ...(data.telefono     !== undefined && { telefono: data.telefono }),
      ...(data.email        !== undefined && { email: data.email }),
    },
  });
}

const ESTADOS_VALIDOS = ['activo', 'pausado', 'remodelacion', 'inactivo'];

export async function cambiarEstadoLocal(id: string, estado: string, razonPausa?: string) {
  if (!ESTADOS_VALIDOS.includes(estado)) {
    throw new AppError('ESTADO_INVALIDO', 400, `estado debe ser uno de: ${ESTADOS_VALIDOS.join(', ')}`);
  }
  const local = await prisma.local.findUnique({ where: { id } });
  if (!local) throw new AppError('LOCAL_NO_ENCONTRADO', 404, 'Local no encontrado');

  return prisma.local.update({
    where: { id },
    data: {
      estado,
      activo: estado === 'activo',
      razon_pausa: estado === 'activo' ? null : (razonPausa ?? null),
    },
  });
}

async function kpisDelDia(localId: string) {
  const hoy = new Date().toISOString().slice(0, 10);

  const [ocupadas, totalHab, ingresosHoy, checkinsHoy, checkoutsHoy] = await Promise.all([
    prisma.habitacion.count({ where: { local_id: localId, estado: 'OCUPADA' } }),
    prisma.habitacion.count({ where: { local_id: localId } }),
    prisma.$queryRaw<Array<{ total: string }>>`
      SELECT COALESCE(SUM(p.monto), 0)::text AS total
      FROM pagos p
      JOIN reservas r     ON r.id = p.reserva_id
      JOIN habitaciones h ON h.id = r.habitacion_id
      WHERE h.local_id = ${localId}::uuid AND p.estado = 'COMPLETADO'
        AND p.created_at >= ${hoy}::date AND p.created_at < (${hoy}::date + INTERVAL '1 day')
    `,
    prisma.reserva.count({
      where: { habitacion: { local_id: localId }, fecha_entrada: { gte: new Date(hoy) }, estado: { in: ['CONFIRMADA', 'CHECKIN_REALIZADO'] } },
    }),
    prisma.reserva.count({
      where: { habitacion: { local_id: localId }, fecha_salida: { gte: new Date(hoy) }, estado: 'CHECKIN_REALIZADO' },
    }),
  ]);

  return {
    ocupacion_pct: totalHab > 0 ? Math.round((ocupadas / totalHab) * 1000) / 10 : 0,
    ingresos_hoy:  Number(ingresosHoy[0]?.total ?? 0),
    checkins_hoy:  checkinsHoy,
    checkouts_hoy: checkoutsHoy,
  };
}

export async function dashboardConsolidado() {
  const locales = await prisma.local.findMany({ where: { activo: true }, orderBy: { nombre: 'asc' } });
  const porLocal = await Promise.all(
    locales.map(async (l) => ({ local_id: l.id, local_nombre: l.nombre, estado: l.estado, ...(await kpisDelDia(l.id)) })),
  );

  const totales = porLocal.reduce(
    (acc, l) => ({
      ingresos_hoy:      acc.ingresos_hoy + l.ingresos_hoy,
      reservas_activas:  acc.reservas_activas + l.checkins_hoy,
      ocupacion_suma:    acc.ocupacion_suma + l.ocupacion_pct,
    }),
    { ingresos_hoy: 0, reservas_activas: 0, ocupacion_suma: 0 },
  );

  return {
    locales: porLocal,
    consolidado: {
      total_ingresos_hoy:  totales.ingresos_hoy,
      ocupacion_media_pct: porLocal.length > 0 ? Math.round((totales.ocupacion_suma / porLocal.length) * 10) / 10 : 0,
      total_reservas_activas_hoy: totales.reservas_activas,
    },
  };
}
