import { CanalSync, EstadoSync, TipoEventoSync, TipoDocumento, SegmentoHuesped, EstadoReserva } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { AppError } from '../lib/errors';
import { normalize, NormalizedReservation } from './otaNormalizer.service';
import { crearReserva, cambiarEstado } from './reservas.service';

// ─── Canal mapping ────────────────────────────────────────────────────────────

const CANAL_SYNC: Record<string, CanalSync> = {
  booking: CanalSync.BOOKING_COM,
  expedia: CanalSync.EXPEDIA,
  airbnb:  CanalSync.AIRBNB,
};

// ─── Guest upsert ─────────────────────────────────────────────────────────────

async function upsertHuesped(
  huesped: NormalizedReservation['huesped'],
  canalExternoId: string,
): Promise<string> {
  const existente = await prisma.huesped.findFirst({
    where:  { email: huesped.email },
    select: { id: true },
  });
  if (existente) return existente.id;

  const nuevo = await prisma.huesped.create({
    data: {
      nombre:           huesped.nombre,
      apellido:         huesped.apellido ?? '',
      email:            huesped.email,
      telefono:         huesped.telefono ?? null,
      nacionalidad:     huesped.nacionalidad ?? null,
      tipo_documento:   TipoDocumento.PASAPORTE,
      numero_documento: `OTA-${canalExternoId}`,
      segmento:         SegmentoHuesped.NUEVO,
      activo:           true,
    },
    select: { id: true },
  });
  return nuevo.id;
}

// ─── Event handlers ───────────────────────────────────────────────────────────

type WebhookResult = {
  estado:          string;
  reserva_id?:     string;
  codigo_reserva?: string;
  motivo?:         string;
};

async function procesarCreacion(
  normalizado: NormalizedReservation,
  canalSync: CanalSync,
): Promise<WebhookResult> {
  const huesped_id = await upsertHuesped(normalizado.huesped, normalizado.canal_externo_id);

  const habitacion = await prisma.habitacion.findUnique({
    where:  { numero: normalizado.habitacion_numero },
    select: { id: true },
  });
  if (!habitacion) {
    return { estado: 'rechazado', motivo: 'HABITACION_NO_ENCONTRADA' };
  }

  const idempotencyKey = `${canalSync}:${normalizado.canal_externo_id}`;

  try {
    const reserva = await crearReserva({
      huesped_id:      huesped_id,
      habitacion_id:   habitacion.id,
      fecha_entrada:   normalizado.fecha_entrada,
      fecha_salida:    normalizado.fecha_salida,
      canal_origen:    normalizado.canal_origen,
      num_huespedes:   normalizado.num_huespedes,
      idempotency_key: idempotencyKey,
    });

    return {
      estado:         'procesado',
      reserva_id:     reserva?.id as string,
      codigo_reserva: reserva?.codigo as string,
    };
  } catch (err) {
    if (err instanceof AppError && err.code === 'HABITACION_NO_DISPONIBLE') {
      return { estado: 'rechazado', motivo: 'HABITACION_NO_DISPONIBLE' };
    }
    throw err;
  }
}

async function procesarCancelacion(
  normalizado: NormalizedReservation,
  canalSync: CanalSync,
): Promise<WebhookResult> {
  const idempotencyKey = `${canalSync}:${normalizado.canal_externo_id}`;

  const reservaExistente = await prisma.reserva.findUnique({
    where:  { idempotency_key: idempotencyKey },
    select: { id: true, estado: true },
  });
  if (!reservaExistente) {
    return { estado: 'rechazado', motivo: 'RESERVA_NO_ENCONTRADA' };
  }
  if (reservaExistente.estado === EstadoReserva.CANCELADA) {
    return { estado: 'procesado', reserva_id: reservaExistente.id };
  }

  await cambiarEstado(reservaExistente.id, EstadoReserva.CANCELADA);
  return { estado: 'procesado', reserva_id: reservaExistente.id };
}

async function ejecutarEvento(
  evento: string,
  normalizado: NormalizedReservation,
  canalSync: CanalSync,
): Promise<WebhookResult> {
  switch (evento) {
    case 'reservation.created':
      return procesarCreacion(normalizado, canalSync);
    case 'reservation.cancelled':
      return procesarCancelacion(normalizado, canalSync);
    case 'reservation.modified': {
      await procesarCancelacion(normalizado, canalSync).catch(() => null);
      return procesarCreacion(normalizado, canalSync);
    }
    default:
      throw new AppError('EVENTO_NO_SOPORTADO', 400, `Evento no soportado: ${evento}`);
  }
}

// ─── Main webhook processor ───────────────────────────────────────────────────

export async function procesarWebhook(
  canalParam: string,
  evento: string,
  payload: unknown,
): Promise<WebhookResult> {
  const canalSync = CANAL_SYNC[canalParam];

  let normalizado: NormalizedReservation;
  try {
    normalizado = normalize(canalParam, payload);
  } catch (err) {
    throw new AppError('EVENTO_NO_SOPORTADO', 400, `Error normalizando payload: ${String(err)}`);
  }

  const idempotencyKey = `in:${canalSync}:${normalizado.canal_externo_id}:${evento}`;

  // Return cached result for duplicate webhook
  const yaExiste = await prisma.canalSyncLog.findUnique({
    where:  { idempotency_key: idempotencyKey },
    select: { id: true, estado: true, payload_salida: true },
  });
  if (yaExiste?.estado === EstadoSync.PROCESADO && yaExiste.payload_salida) {
    return yaExiste.payload_salida as WebhookResult;
  }

  // Create pending log entry (handle race/duplicate with try-catch)
  let logId: string;
  try {
    const log = await prisma.canalSyncLog.create({
      data: {
        canal:           canalSync,
        tipo_evento:     mapEvento(evento),
        payload_entrada: payload as never,
        reserva_id:      null,
        estado:          EstadoSync.PENDIENTE,
        idempotency_key: idempotencyKey,
      },
      select: { id: true },
    });
    logId = log.id;
  } catch (err: unknown) {
    const prismaErr = err as { code?: string };
    if (prismaErr?.code === 'P2002') {
      const existing = await prisma.canalSyncLog.findUnique({
        where:  { idempotency_key: idempotencyKey },
        select: { payload_salida: true },
      });
      return (existing?.payload_salida as WebhookResult) ?? { estado: 'rechazado', motivo: 'DUPLICADO' };
    }
    throw err;
  }

  let resultado: WebhookResult;
  try {
    resultado = await ejecutarEvento(evento, normalizado, canalSync);
  } catch (err) {
    await prisma.canalSyncLog.update({
      where: { id: logId },
      data:  {
        estado:         EstadoSync.ERROR,
        error_mensaje:  err instanceof Error ? err.message : String(err),
        payload_salida: { error: String(err) },
      },
    });
    throw err;
  }

  await prisma.canalSyncLog.update({
    where: { id: logId },
    data:  {
      estado:         EstadoSync.PROCESADO,
      reserva_id:     resultado.reserva_id ?? null,
      payload_salida: resultado as never,
    },
  });

  return resultado;
}

// ─── Sync log query ───────────────────────────────────────────────────────────

export async function listarSyncLog(query: {
  canal?:      string;
  exito?:      string;
  desde?:      string;
  reserva_id?: string;
  page?:       number;
  limit?:      number;
}) {
  const page  = query.page  ?? 1;
  const limit = Math.min(query.limit ?? 20, 100);

  const where: Record<string, unknown> = {};
  if (query.canal)      where.canal      = query.canal.toUpperCase();
  if (query.reserva_id) where.reserva_id = query.reserva_id;
  if (query.desde)      where.created_at = { gte: new Date(query.desde) };
  if (query.exito !== undefined) {
    where.estado = query.exito === 'true' ? EstadoSync.PROCESADO : EstadoSync.ERROR;
  }

  const [total, data] = await Promise.all([
    prisma.canalSyncLog.count({ where }),
    prisma.canalSyncLog.findMany({
      where,
      orderBy: { created_at: 'desc' },
      skip:    (page - 1) * limit,
      take:    limit,
    }),
  ]);

  return { data, meta: { total, page, limit, totalPages: Math.ceil(total / limit) } };
}

// ─── Helper ───────────────────────────────────────────────────────────────────

function mapEvento(evento: string): TipoEventoSync {
  switch (evento) {
    case 'reservation.created':   return TipoEventoSync.RESERVA_NUEVA;
    case 'reservation.cancelled': return TipoEventoSync.CANCELACION;
    case 'reservation.modified':  return TipoEventoSync.MODIFICACION;
    default:                      return TipoEventoSync.RESERVA_NUEVA;
  }
}
