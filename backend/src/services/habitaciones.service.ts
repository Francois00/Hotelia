import path from 'path';
import fs from 'fs';
import axios from 'axios';
import {
  Prisma,
  EstadoHabitacion,
  EstadoReserva,
  TipoHabitacion,
} from '@prisma/client';
import { prisma } from '../lib/prisma';
import { AppError } from '../lib/errors';
import { emitMulti } from './socket.service';

// Estados que el personal puede asignar manualmente.
// OCUPADA es exclusivo del sistema (lo asigna el check-in).
export const ESTADOS_MANUALES: EstadoHabitacion[] = [
  EstadoHabitacion.DISPONIBLE,
  EstadoHabitacion.LIMPIEZA,
  EstadoHabitacion.MANTENIMIENTO,
  EstadoHabitacion.FUERA_DE_SERVICIO,
];

// ─── Interfaces ───────────────────────────────────────────────────────────────

export interface ListarHabitacionesQuery {
  estado?:        EstadoHabitacion;
  tipo?:          TipoHabitacion;
  piso?:          number;
  capacidad?:     number;
  visible_otas?:  boolean;
  incluir_huesped?: boolean;
  page?:          number;
  limit?:         number;
}

export interface DisponiblesQuery {
  fecha_entrada: string;
  fecha_salida:  string;
}

export interface CrearHabitacionInput {
  numero:            string;
  tipo:              TipoHabitacion;
  piso:              number;
  capacidad:         number;
  capacidad_adultos?: number;
  capacidad_ninos?:  number;
  tarifa_base:       number;
  tarifa_minima?:    number;
  tarifa_maxima?:    number;
  moneda_tarifa?:    string;
  descripcion?:      string;
  amenidades?:       unknown;
  visible_otas?:     boolean;
  tipo_custom_id?:   string;
}

export interface ActualizarHabitacionInput extends Partial<CrearHabitacionInput> {}

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function obtenerTarifaSugerida(id: string, fechaHoy: string): Promise<number | null> {
  const iaUrl = process.env.IA_SERVICE_URL ?? 'http://localhost:8001';
  try {
    const resp = await axios.get<{ tarifa_sugerida?: number }>(
      `${iaUrl}/pricing/sugerido`,
      { params: { habitacion_id: id, fecha: fechaHoy }, timeout: 2000 },
    );
    return resp.data?.tarifa_sugerida ?? null;
  } catch {
    return null;
  }
}

function normalizeAmenidades(raw: unknown): string[] {
  if (raw == null) return []
  if (Array.isArray(raw)) return (raw as unknown[]).map(String)
  if (typeof raw === 'string') return raw.replace(/^\{|\}$/g, '').split(',').filter(Boolean)
  if (typeof raw === 'object') {
    return Object.entries(raw as Record<string, unknown>)
      .filter(([, v]) => v === true)
      .map(([k]) => k)
  }
  return []
}

function validarTarifas(base: number, minima?: number, maxima?: number): void {
  if (minima !== undefined && minima >= base) {
    throw new AppError('TARIFA_INVALIDA', 400, 'tarifa_minima debe ser menor que tarifa_base');
  }
  if (maxima !== undefined && maxima <= base) {
    throw new AppError('TARIFA_INVALIDA', 400, 'tarifa_maxima debe ser mayor que tarifa_base');
  }
}

// ─── Operaciones ──────────────────────────────────────────────────────────────

// Sync room state with active check-ins and ensure no ghost OCUPADA rooms
export async function sincronizarEstadosHabitaciones(): Promise<void> {
  await prisma.$executeRaw`
    UPDATE habitaciones
    SET estado = 'OCUPADA'
    WHERE id IN (
      SELECT habitacion_id FROM reservas WHERE estado = 'CHECKIN_REALIZADO'
    )
    AND estado != 'OCUPADA'
  `;
  await prisma.$executeRaw`
    UPDATE habitaciones
    SET estado = 'DISPONIBLE'
    WHERE estado = 'OCUPADA'
    AND id NOT IN (
      SELECT habitacion_id FROM reservas WHERE estado = 'CHECKIN_REALIZADO'
    )
  `;
}

export async function listarHabitaciones(query: ListarHabitacionesQuery) {
  const page  = query.page  ?? 1;
  const limit = Math.min(query.limit ?? 20, 100);
  const hoy   = new Date().toISOString().slice(0, 10);

  const where: Prisma.HabitacionWhereInput = {};
  if (query.estado)                       where.estado       = query.estado;
  if (query.tipo)                         where.tipo         = query.tipo;
  if (query.piso !== undefined)           where.piso         = query.piso;
  if (query.capacidad !== undefined)      where.capacidad    = { gte: query.capacidad };
  if (query.visible_otas !== undefined)   where.visible_otas = query.visible_otas;

  // Auto-fix any state desync before returning
  if (query.incluir_huesped) {
    await sincronizarEstadosHabitaciones();
  }

  const [total, habitaciones] = await Promise.all([
    prisma.habitacion.count({ where }),
    prisma.habitacion.findMany({
      where,
      include: {
        tipo_custom: { select: { id: true, nombre: true, color_mapa: true } },
        ...(query.incluir_huesped && {
          reservas: {
            where: { estado: EstadoReserva.CHECKIN_REALIZADO },
            take: 1,
            include: {
              huesped: {
                select: { nombre: true, apellido: true, numero_documento: true },
              },
            },
          },
        }),
      },
      orderBy: [{ piso: 'asc' }, { numero: 'asc' }],
      skip:    (page - 1) * limit,
      take:    limit,
    }),
  ]);

  const hoyDate = new Date();
  hoyDate.setHours(0, 0, 0, 0);

  // Enriquecer con tarifa sugerida por IA (con fallback silencioso)
  const data = await Promise.all(
    habitaciones.map(async (h) => {
      const tarifa_sugerida_hoy = (await obtenerTarifaSugerida(h.id, hoy)) ?? Number(h.tarifa_base);

      // Build huesped_actual from the first active check-in reservation
      let huesped_actual: {
        nombre: string; apellido: string; documento: string;
        reserva_id: string; fecha_entrada: string; fecha_salida: string;
        dias_restantes: number;
      } | null = null;

      if (query.incluir_huesped && 'reservas' in h && Array.isArray(h.reservas) && h.reservas.length > 0) {
        const r = h.reservas[0] as unknown as {
          id: string; fecha_entrada: Date; fecha_salida: Date;
          huesped: { nombre: string; apellido: string; numero_documento: string };
        };
        const salidaDate = new Date(r.fecha_salida);
        salidaDate.setHours(0, 0, 0, 0);
        const diasRestantes = Math.ceil((salidaDate.getTime() - hoyDate.getTime()) / 86_400_000);
        huesped_actual = {
          nombre:          r.huesped.nombre,
          apellido:        r.huesped.apellido,
          documento:       r.huesped.numero_documento,
          reserva_id:      r.id,
          fecha_entrada:   r.fecha_entrada.toISOString().split('T')[0],
          fecha_salida:    r.fecha_salida.toISOString().split('T')[0],
          dias_restantes:  diasRestantes,
        };
      }

      const base = { ...h, tarifa_base: Number(h.tarifa_base), tarifa_sugerida_hoy, amenidades: normalizeAmenidades(h.amenidades) };
      if (query.incluir_huesped) {
        return { ...base, huesped_actual };
      }
      return base;
    }),
  );

  return { data, meta: { total, page, limit, pages: Math.ceil(total / limit) } };
}

export async function obtenerHabitacion(id: string) {
  const h = await prisma.habitacion.findUnique({
    where:   { id },
    include: { tipo_custom: { select: { id: true, nombre: true, color_mapa: true } } },
  });
  if (!h) throw new AppError('HABITACION_NO_ENCONTRADA', 404, 'Habitación no encontrada');

  const hoy = new Date().toISOString().slice(0, 10);
  const tarifa_sugerida_hoy = (await obtenerTarifaSugerida(id, hoy)) ?? Number(h.tarifa_base);

  // Historial de precios últimos 30 días
  const hace30 = new Date();
  hace30.setDate(hace30.getDate() - 30);
  const historial = await prisma.tarifaHistorial.findMany({
    where:   { habitacion_id: id, fecha: { gte: hace30 } },
    orderBy: { fecha: 'desc' },
    select:  { fecha: true, tarifa_aplicada: true, fuente: true },
  });

  return { ...h, tarifa_sugerida_hoy, historial_precios: historial, amenidades: normalizeAmenidades(h.amenidades) };
}

export async function crearHabitacion(data: CrearHabitacionInput) {
  validarTarifas(data.tarifa_base, data.tarifa_minima, data.tarifa_maxima);
  if ((data.capacidad_adultos ?? 1) < 1) {
    throw new AppError('CAPACIDAD_INVALIDA', 400, 'capacidad_adultos debe ser al menos 1');
  }
  if (data.piso < 0) {
    throw new AppError('PISO_INVALIDO', 400, 'piso debe ser 0 o mayor');
  }

  try {
    const h = await prisma.habitacion.create({
      data: {
        numero:            data.numero,
        tipo:              data.tipo,
        piso:              data.piso,
        capacidad:         data.capacidad,
        capacidad_adultos: data.capacidad_adultos ?? null,
        capacidad_ninos:   data.capacidad_ninos   ?? 0,
        tarifa_base:       data.tarifa_base,
        tarifa_minima:     data.tarifa_minima     ?? null,
        tarifa_maxima:     data.tarifa_maxima     ?? null,
        moneda_tarifa:     data.moneda_tarifa     ?? 'PEN',
        descripcion:       data.descripcion       ?? null,
        amenidades:        data.amenidades != null
          ? (data.amenidades as Prisma.InputJsonValue)
          : Prisma.DbNull,
        visible_otas:      data.visible_otas      ?? true,
        tipo_custom_id:    data.tipo_custom_id     ?? null,
      },
      include: { tipo_custom: { select: { id: true, nombre: true } } },
    });
    return h;
  } catch (err) {
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === 'P2002'
    ) {
      throw new AppError('NUMERO_DUPLICADO', 409, `Ya existe una habitación con el número ${data.numero}`);
    }
    throw err;
  }
}

export async function actualizarHabitacion(id: string, data: ActualizarHabitacionInput) {
  const actual = await prisma.habitacion.findUnique({
    where:  { id },
    select: { id: true, tarifa_base: true, tarifa_minima: true, tarifa_maxima: true },
  });
  if (!actual) throw new AppError('HABITACION_NO_ENCONTRADA', 404, 'Habitación no encontrada');

  const nuevaBase   = data.tarifa_base   ?? Number(actual.tarifa_base);
  const nuevaMinima = data.tarifa_minima ?? (actual.tarifa_minima != null ? Number(actual.tarifa_minima) : undefined);
  const nuevaMaxima = data.tarifa_maxima ?? (actual.tarifa_maxima != null ? Number(actual.tarifa_maxima) : undefined);
  validarTarifas(nuevaBase, nuevaMinima, nuevaMaxima);

  try {
    return await prisma.habitacion.update({
      where: { id },
      data: {
        ...(data.numero            !== undefined && { numero:            data.numero }),
        ...(data.tipo              !== undefined && { tipo:              data.tipo }),
        ...(data.piso              !== undefined && { piso:              data.piso }),
        ...(data.capacidad         !== undefined && { capacidad:         data.capacidad }),
        ...(data.capacidad_adultos !== undefined && { capacidad_adultos: data.capacidad_adultos }),
        ...(data.capacidad_ninos   !== undefined && { capacidad_ninos:   data.capacidad_ninos }),
        ...(data.tarifa_base       !== undefined && { tarifa_base:       data.tarifa_base }),
        ...(data.tarifa_minima     !== undefined && { tarifa_minima:     data.tarifa_minima }),
        ...(data.tarifa_maxima     !== undefined && { tarifa_maxima:     data.tarifa_maxima }),
        ...(data.moneda_tarifa     !== undefined && { moneda_tarifa:     data.moneda_tarifa }),
        ...(data.descripcion       !== undefined && { descripcion:       data.descripcion }),
        ...(data.visible_otas      !== undefined && { visible_otas:      data.visible_otas }),
        ...(data.tipo_custom_id    !== undefined && { tipo_custom_id:    data.tipo_custom_id }),
        ...(data.amenidades !== undefined && {
          amenidades: data.amenidades != null
            ? (data.amenidades as Prisma.InputJsonValue)
            : Prisma.DbNull,
        }),
      },
      include: { tipo_custom: { select: { id: true, nombre: true } } },
    });
  } catch (err) {
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === 'P2002'
    ) {
      throw new AppError('NUMERO_DUPLICADO', 409, `Ya existe una habitación con el número ${data.numero}`);
    }
    throw err;
  }
}

export async function eliminarHabitacion(id: string) {
  const h = await prisma.habitacion.findUnique({
    where: { id },
    select: { id: true, numero: true },
  });
  if (!h) throw new AppError('HABITACION_NO_ENCONTRADA', 404, 'Habitación no encontrada');

  const reservasActivas = await prisma.reserva.count({
    where: {
      habitacion_id: id,
      estado: { in: [EstadoReserva.CONFIRMADA, EstadoReserva.CHECKIN_REALIZADO] },
      fecha_salida: { gte: new Date() },
    },
  });

  if (reservasActivas > 0) {
    throw new AppError(
      'HABITACION_CON_RESERVAS_ACTIVAS',
      409,
      'No se puede eliminar una habitación con reservas activas',
    );
  }

  await prisma.habitacion.delete({ where: { id } });
  return { deleted: true, numero: h.numero };
}

export async function darDeBajaHabitacion(id: string) {
  const h = await prisma.habitacion.findUnique({
    where:  { id },
    select: { id: true, estado: true },
  });
  if (!h) throw new AppError('HABITACION_NO_ENCONTRADA', 404, 'Habitación no encontrada');

  const reservasActivas = await prisma.reserva.count({
    where: {
      habitacion_id: id,
      estado: { in: [EstadoReserva.CONFIRMADA, EstadoReserva.CHECKIN_REALIZADO] },
      fecha_salida: { gte: new Date() },
    },
  });

  if (reservasActivas > 0) {
    throw new AppError(
      'HABITACION_CON_RESERVAS_ACTIVAS',
      409,
      'No se puede dar de baja una habitación con reservas activas',
    );
  }

  return prisma.habitacion.update({
    where: { id },
    data:  { estado: EstadoHabitacion.FUERA_DE_SERVICIO },
  });
}

export async function subirFotos(id: string, archivos: Express.Multer.File[]): Promise<string[]> {
  const h = await prisma.habitacion.findUnique({ where: { id }, select: { id: true, fotos: true } });
  if (!h) throw new AppError('HABITACION_NO_ENCONTRADA', 404, 'Habitación no encontrada');

  const fotosActuales = (Array.isArray(h.fotos) ? h.fotos : []) as string[];
  if (fotosActuales.length + archivos.length > 10) {
    throw new AppError('LIMITE_FOTOS', 400, 'El máximo de fotos por habitación es 10');
  }

  const dirBase = path.join(process.cwd(), 'uploads', 'habitaciones', id);
  fs.mkdirSync(dirBase, { recursive: true });

  const nuevasFotos = archivos.map((f) => {
    const destino = path.join(dirBase, f.originalname);
    fs.writeFileSync(destino, f.buffer);
    return `/uploads/habitaciones/${id}/${f.originalname}`;
  });

  const todasFotos = [...fotosActuales, ...nuevasFotos];
  await prisma.habitacion.update({
    where: { id },
    data:  { fotos: todasFotos as Prisma.InputJsonValue },
  });

  return todasFotos;
}

export async function reordenarFotos(id: string, fotos: string[]): Promise<string[]> {
  const h = await prisma.habitacion.findUnique({ where: { id }, select: { id: true } });
  if (!h) throw new AppError('HABITACION_NO_ENCONTRADA', 404, 'Habitación no encontrada');

  await prisma.habitacion.update({
    where: { id },
    data:  { fotos: fotos as Prisma.InputJsonValue },
  });
  return fotos;
}

export async function habitacionesDisponibles(query: DisponiblesQuery) {
  const entrada = new Date(query.fecha_entrada);
  const salida  = new Date(query.fecha_salida);

  const reservasConflicto = await prisma.reserva.findMany({
    where: {
      estado:        { notIn: [EstadoReserva.CANCELADA, EstadoReserva.NO_SHOW] },
      fecha_entrada: { lt: salida },
      fecha_salida:  { gt: entrada },
    },
    select: { habitacion_id: true },
  });

  const idsOcupadas = reservasConflicto.map((r) => r.habitacion_id);

  const rows = await prisma.habitacion.findMany({
    where: {
      estado: { notIn: [EstadoHabitacion.FUERA_DE_SERVICIO, EstadoHabitacion.MANTENIMIENTO] },
      id:     { notIn: idsOcupadas },
    },
    select: {
      id: true, numero: true, tipo: true, piso: true,
      capacidad: true, tarifa_base: true, descripcion: true,
      amenidades: true, fotos: true,
    },
    orderBy: [{ tipo: 'asc' }, { piso: 'asc' }, { numero: 'asc' }],
  });
  return rows.map(r => ({ ...r, amenidades: normalizeAmenidades(r.amenidades) }));
}

export async function cambiarEstadoHabitacion(id: string, nuevoEstado: EstadoHabitacion) {
  const habitacion = await prisma.habitacion.findUnique({
    where:  { id },
    select: { id: true, estado: true, numero: true },
  });

  if (!habitacion) {
    throw new AppError('HABITACION_NO_ENCONTRADA', 404, 'Habitación no encontrada');
  }

  if (!ESTADOS_MANUALES.includes(nuevoEstado)) {
    throw new AppError(
      'ESTADO_NO_PERMITIDO',
      422,
      `El estado ${nuevoEstado} no puede asignarse manualmente. ` +
        `Estados permitidos: ${ESTADOS_MANUALES.join(', ')}`,
    );
  }

  const updated = await prisma.habitacion.update({
    where: { id },
    data:  { estado: nuevoEstado },
  });

  emitMulti('habitacion:estado_cambio', {
    habitacion_id:   id,
    numero:          updated.numero,
    estado_anterior: habitacion.estado,
    estado_nuevo:    nuevoEstado,
  }, ['dashboard', 'recepcion', 'housekeeping']);

  return updated;
}
