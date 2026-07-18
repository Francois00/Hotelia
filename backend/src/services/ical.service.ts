import ical, { VEvent } from 'node-ical';
import icalGenerator from 'ical-generator';
import { CanalSync, EstadoReserva } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { AppError } from '../lib/errors';

const CANALES_VALIDOS: CanalSync[] = [CanalSync.BOOKING_COM, CanalSync.EXPEDIA];

function publicBaseUrl(): string {
  return process.env.PUBLIC_URL ?? process.env.BACKEND_INTERNAL_URL ?? 'http://localhost:3000';
}

function conUrlExportar<T extends { ical_token_propio: string }>(conexion: T) {
  return { ...conexion, url_exportar: `${publicBaseUrl()}/api/v1/ical/${conexion.ical_token_propio}.ics` };
}

async function verificarHabitacionDelLocal(habitacionId: string, localId?: string | null) {
  const hab = await prisma.habitacion.findUnique({
    where: { id: habitacionId },
    select: { id: true, local_id: true, numero: true },
  });
  if (!hab || (localId && hab.local_id !== localId)) {
    throw new AppError('HABITACION_NO_ENCONTRADA', 404, 'Habitación no encontrada');
  }
  return hab;
}

// ─── CRUD (autenticado, acotado por local) ─────────────────────────────────────

export async function listarConexiones(localId?: string | null, empresaId?: string | null) {
  const conexiones = await prisma.icalConexion.findMany({
    where: {
      habitacion: localId
        ? { local_id: localId }
        : empresaId
          ? { local: { empresa_id: empresaId } }
          : {},
    },
    include: { habitacion: { select: { numero: true, tipo: true } } },
    orderBy: { created_at: 'desc' },
  });
  return conexiones.map(conUrlExportar);
}

export interface CrearConexionInput {
  habitacion_id: string;
  canal: string;
  ical_url_externa?: string | null;
}

export async function crearConexion(data: CrearConexionInput, localId?: string | null) {
  if (!CANALES_VALIDOS.includes(data.canal as CanalSync)) {
    throw new AppError('CANAL_INVALIDO', 400, `canal debe ser uno de: ${CANALES_VALIDOS.join(', ')}`);
  }
  await verificarHabitacionDelLocal(data.habitacion_id, localId);

  const conexion = await prisma.icalConexion.create({
    data: {
      habitacion_id: data.habitacion_id,
      canal: data.canal as CanalSync,
      ical_url_externa: data.ical_url_externa ?? null,
    },
  });
  return conUrlExportar(conexion);
}

export interface ActualizarConexionInput {
  ical_url_externa?: string | null;
  activo?: boolean;
}

export async function actualizarConexion(id: string, data: ActualizarConexionInput, localId?: string | null) {
  const existente = await prisma.icalConexion.findUnique({
    where: { id },
    include: { habitacion: { select: { local_id: true } } },
  });
  if (!existente || (localId && existente.habitacion.local_id !== localId)) {
    throw new AppError('CONEXION_NO_ENCONTRADA', 404, 'Conexión iCal no encontrada');
  }

  const conexion = await prisma.icalConexion.update({
    where: { id },
    data: {
      ...(data.ical_url_externa !== undefined && { ical_url_externa: data.ical_url_externa }),
      ...(data.activo !== undefined && { activo: data.activo }),
    },
  });
  return conUrlExportar(conexion);
}

export async function eliminarConexion(id: string, localId?: string | null) {
  const existente = await prisma.icalConexion.findUnique({
    where: { id },
    include: { habitacion: { select: { local_id: true } } },
  });
  if (!existente || (localId && existente.habitacion.local_id !== localId)) {
    throw new AppError('CONEXION_NO_ENCONTRADA', 404, 'Conexión iCal no encontrada');
  }
  await prisma.icalConexion.delete({ where: { id } });
  return { ok: true };
}

// ─── Export público — GET /ical/:token.ics (sin auth, lo consume Booking/Expedia) ──

export async function generarICSExportacion(token: string): Promise<string> {
  const conexion = await prisma.icalConexion.findFirst({
    where: { ical_token_propio: token, activo: true },
    include: { habitacion: { select: { numero: true } } },
  });
  if (!conexion) throw new AppError('TOKEN_INVALIDO', 404, 'Calendario no encontrado');

  const reservas = await prisma.reserva.findMany({
    where: {
      habitacion_id: conexion.habitacion_id,
      estado: { in: [EstadoReserva.CONFIRMADA, EstadoReserva.CHECKIN_REALIZADO] },
    },
    select: { codigo: true, fecha_entrada: true, fecha_salida: true },
  });

  const cal = icalGenerator({ name: 'Hotelia - Disponibilidad' });
  for (const r of reservas) {
    cal.createEvent({
      start: r.fecha_entrada,
      end: r.fecha_salida,
      summary: 'Ocupado',
      description: `Reserva ${r.codigo}`,
    });
  }
  return cal.toString();
}

// ─── Import periódico — job cron cada 15 min ───────────────────────────────────

export async function sincronizarTodasLasConexiones(): Promise<void> {
  const conexiones = await prisma.icalConexion.findMany({
    where: { activo: true, ical_url_externa: { not: null } },
  });

  for (const conn of conexiones) {
    try {
      const eventos = await ical.async.fromURL(conn.ical_url_externa!);
      const vevents = Object.values(eventos).filter(
        (e): e is VEvent => e?.type === 'VEVENT' && !!e.start && !!e.end,
      );

      for (const ev of vevents) {
        const inicio = new Date(ev.start!);
        const fin = new Date(ev.end!);
        const uidExterno = ev.uid ?? `${inicio.toISOString()}-${fin.toISOString()}`;
        await prisma.icalBloqueo.upsert({
          where: {
            habitacion_id_canal_uid_externo: {
              habitacion_id: conn.habitacion_id,
              canal: conn.canal,
              uid_externo: uidExterno,
            },
          },
          create: {
            habitacion_id: conn.habitacion_id,
            canal: conn.canal,
            fecha_entrada: inicio,
            fecha_salida: fin,
            uid_externo: uidExterno,
          },
          update: { fecha_entrada: inicio, fecha_salida: fin },
        });
      }

      await prisma.icalConexion.update({
        where: { id: conn.id },
        data: { ultima_sync: new Date(), ultimo_error: null },
      });
    } catch (err: unknown) {
      const mensaje = err instanceof Error ? err.message : 'Error desconocido';
      await prisma.icalConexion.update({
        where: { id: conn.id },
        data: { ultimo_error: mensaje },
      });
      console.error(`[ICAL SYNC] Error en conexión ${conn.id} (${conn.canal}):`, mensaje);
    }
  }
}
