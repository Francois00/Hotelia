import { randomUUID } from 'crypto';
import axios from 'axios';
import {
  Prisma,
  EstadoHabitacion,
  EstadoReserva,
  CanalReserva,
  MetodoPago,
  EstadoPago,
  TipoFolioItem,
  TipoComprobante,
} from '@prisma/client';
import { prisma } from '../lib/prisma';
import { redis } from '../lib/redis';
import { AppError } from '../lib/errors';
import { emitirComprobante } from './sunat.service';
import { enviarMensaje } from './whatsapp.service';

// ─── Tipos ────────────────────────────────────────────────────────────────────

export interface ItemPago {
  metodo:     MetodoPago;
  monto:      number;
  referencia?: string;
}

export interface CheckinManualInput {
  huesped_id:              string;
  habitacion_id:           string;
  fecha_entrada:           string;   // YYYY-MM-DD
  numero_noches:           number;
  numero_personas:         number;
  precio_por_noche:        number;
  pagos:                   ItemPago[];
  tipo_comprobante:        TipoComprobante;
  datos_facturacion?:      Record<string, string> | null;
  canal_envio_comprobante: string;
  personal_id?:            string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function generarCodigo(): string {
  const fecha  = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const sufijo = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `CHK-${fecha}-${sufijo}`;
}

function calcFechaSalida(fechaEntrada: string, noches: number): Date {
  const d = new Date(fechaEntrada);
  d.setDate(d.getDate() + noches);
  return d;
}

async function notificarGrupoCheckin(
  reservaId: string,
  huesped:   { nombres?: string; apellidos?: string; tipo_documento?: string; numero_documento?: string },
  hab:       { numero?: string; tipo?: string },
  noches:    number,
  precioNoche: number,
  total:     number,
  recepcionista: string,
  fechaEntrada: Date,
  fechaSalida:  Date,
): Promise<void> {
  const url = process.env.N8N_WEBHOOK_URL;
  if (!url) return;
  try {
    await axios.post(
      `${url}/webhook/checkin-completado`,
      {
        evento:        'checkin_completado',
        reserva_id:    reservaId,
        cliente:       `${huesped.nombres ?? ''} ${huesped.apellidos ?? ''}`.trim(),
        doc:           `${huesped.tipo_documento ?? ''} ${huesped.numero_documento ?? ''}`.trim(),
        habitacion:    `${hab.numero ?? ''} - ${hab.tipo ?? ''}`,
        noches,
        fecha_entrada: fechaEntrada.toISOString().slice(0, 10),
        fecha_salida:  fechaSalida.toISOString().slice(0, 10),
        precio_noche:  precioNoche,
        total,
        recepcionista,
      },
      { timeout: 5000 },
    );
  } catch {
    // Non-fatal — no interrumpir el check-in
  }
}

// ─── Operación principal ──────────────────────────────────────────────────────

export async function ejecutarCheckinManual(input: CheckinManualInput, localId?: string | null) {
  const fechaEntrada = new Date(input.fecha_entrada);
  const fechaSalida  = calcFechaSalida(input.fecha_entrada, input.numero_noches);

  if (fechaSalida <= fechaEntrada) {
    throw new AppError('FECHAS_INVALIDAS', 422, 'La fecha de salida debe ser posterior a la de entrada');
  }

  const total = Math.round(input.precio_por_noche * input.numero_noches * 100) / 100;
  const sumaPagos = Math.round(input.pagos.reduce((s, p) => s + p.monto, 0) * 100) / 100;

  if (Math.abs(sumaPagos - total) > 0.01) {
    throw new AppError(
      'PAGOS_NO_COINCIDEN',
      422,
      `La suma de pagos (${sumaPagos}) no coincide con el total (${total})`,
    );
  }

  const lockKey   = `habitacion:${input.habitacion_id}:lock`;
  const lockValue = randomUUID();
  const acquired  = await redis.set(lockKey, lockValue, 'EX', 30, 'NX');

  if (!acquired) {
    throw new AppError('LOCK_TIMEOUT', 503, 'La habitación está siendo procesada, reintente en unos segundos');
  }

  let reservaId: string | undefined;

  try {
    const reserva = await prisma.$transaction(async (tx) => {
      // Bloquear la fila de habitación para evitar overbooking
      const rows = await tx.$queryRaw<Array<{
        id: string; numero: string; tipo: string; estado: string; capacidad: number; local_id: string;
      }>>`
        SELECT id, numero, tipo::text, estado::text, capacidad, local_id::text
        FROM habitaciones
        WHERE id = ${input.habitacion_id}::uuid
        FOR UPDATE NOWAIT
      `;

      if (rows.length === 0) {
        throw new AppError('HABITACION_NOT_FOUND', 404, 'Habitación no encontrada');
      }

      const hab = rows[0];

      // Verificación de local — no cambia el lock, comprobación adicional dentro de la tx.
      if (localId && hab.local_id !== localId) {
        throw new AppError('HABITACION_NOT_FOUND', 404, 'Habitación no encontrada');
      }

      if (
        hab.estado === EstadoHabitacion.MANTENIMIENTO ||
        hab.estado === EstadoHabitacion.FUERA_DE_SERVICIO ||
        hab.estado === EstadoHabitacion.OCUPADA
      ) {
        throw new AppError('HABITACION_NO_DISPONIBLE', 409, `La habitación está en estado ${hab.estado}`);
      }

      if (input.numero_personas > hab.capacidad) {
        throw new AppError(
          'CAPACIDAD_EXCEDIDA',
          409,
          `La habitación tiene capacidad para ${hab.capacidad} personas`,
        );
      }

      // Verificar solapamiento de fechas
      const conflicto = await tx.reserva.findFirst({
        where: {
          habitacion_id: input.habitacion_id,
          estado:        { notIn: [EstadoReserva.CANCELADA, EstadoReserva.NO_SHOW] },
          fecha_entrada: { lt: fechaSalida },
          fecha_salida:  { gt: fechaEntrada },
        },
        select: { id: true },
      });

      if (conflicto) {
        throw new AppError('HABITACION_NO_DISPONIBLE', 409, 'La habitación no está disponible en esas fechas');
      }

      // Verificar que el huésped existe
      const huesped = await tx.huesped.findUnique({
        where:  { id: input.huesped_id },
        select: { id: true, activo: true, nombre: true, apellido: true, telefono: true },
      });
      if (!huesped) throw new AppError('HUESPED_NOT_FOUND', 404, 'Huésped no encontrado');
      if (!huesped.activo) throw new AppError('HUESPED_INACTIVO', 422, 'El huésped está desactivado');

      // Crear la reserva
      const nuevaReserva = await tx.reserva.create({
        data: {
          codigo:                 generarCodigo(),
          huesped_id:             input.huesped_id,
          habitacion_id:          input.habitacion_id,
          fecha_entrada:          fechaEntrada,
          fecha_salida:           fechaSalida,
          estado:                 EstadoReserva.CHECKIN_REALIZADO,
          canal:                  CanalReserva.DIRECTO,
          tarifa_acordada:        input.precio_por_noche,
          adultos:                input.numero_personas,
          ninos:                  0,
          tipo_comprobante:       input.tipo_comprobante,
          datos_facturacion:      input.datos_facturacion != null
            ? (input.datos_facturacion as Prisma.InputJsonValue)
            : Prisma.DbNull,
          canal_envio_comprobante: input.canal_envio_comprobante,
          personal_id:            input.personal_id ?? null,
        },
      });

      // Crear los pagos
      await tx.pago.createMany({
        data: input.pagos.map((p) => ({
          reserva_id:          nuevaReserva.id,
          monto:               p.monto,
          moneda:              'PEN',
          metodo:              p.metodo,
          estado:              EstadoPago.COMPLETADO,
          referencia_externa:  p.referencia ?? null,
          personal_id:         input.personal_id ?? null,
        })),
      });

      // Cambiar estado de la habitación a OCUPADA
      await tx.habitacion.update({
        where: { id: input.habitacion_id },
        data:  { estado: EstadoHabitacion.OCUPADA },
      });

      // Crear ítem de folio — cargo base de habitación
      await tx.folioItem.create({
        data: {
          reserva_id:      nuevaReserva.id,
          tipo:            TipoFolioItem.HABITACION,
          descripcion:     `Habitación ${hab.numero} — ${input.numero_noches} noche${input.numero_noches !== 1 ? 's' : ''}`,
          cantidad:        input.numero_noches,
          precio_unitario: input.precio_por_noche,
          fecha:           fechaEntrada,
          personal_id:     input.personal_id ?? null,
        },
      });

      return {
        reserva:  nuevaReserva,
        huesped,
        hab,
        total,
      };
    });

    reservaId = reserva.reserva.id;

    // Actualizar Redis con estado de la habitación
    const cacheKey = `habitacion:estado:${input.habitacion_id}`;
    redis.set(cacheKey, EstadoHabitacion.OCUPADA, 'EX', 3600).catch(() => null);

    // ── Fire-and-forget asíncronos (no bloquean la respuesta) ────────────────

    // SUNAT: emitir comprobante
    emitirComprobante(reserva.reserva.id).catch((err: unknown) => {
      console.error('[sunat] error emitiendo comprobante:', err);
      // Encolar para reintento
      redis.lpush(
        'sunat_pendiente',
        JSON.stringify({ reserva_id: reserva.reserva.id, intentos: 0 }),
      ).catch(() => null);
    });

    // WhatsApp: notificación al huésped
    if (reserva.huesped.telefono && input.canal_envio_comprobante !== 'ninguno') {
      enviarMensaje(reserva.huesped.telefono, 'checkin_bienvenida', {
        nombre:        reserva.huesped.nombre,
        habitacion:    reserva.hab.numero,
        wifi_password: process.env.WIFI_PASSWORD ?? 'hotel2024',
        checkout_hora: '12:00',
      }).catch(() => null);
    }

    // n8n: notificar al grupo WPP del hotel
    const recepcionista = input.personal_id
      ? await prisma.personal.findUnique({
          where:  { id: input.personal_id },
          select: { nombre: true, apellido: true },
        }).then((p) => p ? `${p.nombre} ${p.apellido}`.trim() : 'Sistema')
      : 'Sistema';

    notificarGrupoCheckin(
      reserva.reserva.id,
      { nombres: reserva.huesped.nombre, apellidos: reserva.huesped.apellido },
      { numero: reserva.hab.numero, tipo: reserva.hab.tipo },
      input.numero_noches,
      input.precio_por_noche,
      total,
      recepcionista,
      fechaEntrada,
      fechaSalida,
    ).catch(() => null);

    return {
      reserva_id:         reserva.reserva.id,
      codigo_reserva:     reserva.reserva.codigo,
      habitacion_numero:  reserva.hab.numero,
      huesped_nombre:     `${reserva.huesped.nombre} ${reserva.huesped.apellido}`.trim(),
      fecha_entrada:      fechaEntrada,
      fecha_salida:       fechaSalida,
      numero_noches:      input.numero_noches,
      total,
      comprobante_estado: 'emitiendo',
    };
  } catch (err) {
    if (err instanceof AppError) throw err;
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      (err.meta as Record<string, unknown>)?.code === '55P03'
    ) {
      throw new AppError('HABITACION_NO_DISPONIBLE', 409, 'La habitación no está disponible (conflicto de concurrencia)');
    }
    throw err;
  } finally {
    // Liberar el lock via Lua para evitar borrar un lock de otro proceso
    const RELEASE = `
      if redis.call("get", KEYS[1]) == ARGV[1] then
        return redis.call("del", KEYS[1])
      else
        return 0
      end
    `;
    redis.eval(RELEASE, 1, lockKey, lockValue).catch(() => null);
  }
}

// ─── Habitaciones disponibles para check-in ───────────────────────────────────

export async function listarDisponiblesParaCheckin(
  fechaEntrada: string,
  fechaSalida:  string,
  personas:     number,
  localId?:     string | null,
) {
  const entrada = new Date(fechaEntrada);
  const salida  = new Date(fechaSalida);

  const reservasConflicto = await prisma.reserva.findMany({
    where: {
      estado:        { notIn: [EstadoReserva.CANCELADA, EstadoReserva.NO_SHOW] },
      fecha_entrada: { lt: salida },
      fecha_salida:  { gt: entrada },
    },
    select: { habitacion_id: true },
  });

  const idsOcupadas = reservasConflicto.map((r) => r.habitacion_id);

  const habitaciones = await prisma.habitacion.findMany({
    where: {
      ...(localId ? { local_id: localId } : {}),
      estado:    { notIn: [EstadoHabitacion.FUERA_DE_SERVICIO, EstadoHabitacion.MANTENIMIENTO, EstadoHabitacion.OCUPADA] },
      id:        { notIn: idsOcupadas },
      capacidad: { gte: personas },
    },
    include: { tipo_custom: { select: { nombre: true, color_mapa: true } } },
    orderBy: [{ tipo: 'asc' }, { piso: 'asc' }, { numero: 'asc' }],
  });

  // Agregar tarifa sugerida por IA
  const iaUrl = process.env.IA_SERVICE_URL ?? 'http://localhost:8001';
  const hoy   = new Date().toISOString().slice(0, 10);

  const data = await Promise.all(
    habitaciones.map(async (h) => {
      let tarifa_sugerida = Number(h.tarifa_base);
      try {
        const resp = await axios.get<{ tarifa_sugerida?: number }>(
          `${iaUrl}/pricing/sugerido`,
          { params: { habitacion_id: h.id, fecha: hoy }, timeout: 2000 },
        );
        tarifa_sugerida = resp.data?.tarifa_sugerida ?? tarifa_sugerida;
      } catch { /* usar tarifa_base como fallback */ }
      return { ...h, tarifa_sugerida };
    }),
  );

  return data;
}

// ─── Upsert de huésped ────────────────────────────────────────────────────────

export interface UpsertHuespedInput {
  tipo_documento:       string;
  numero_documento:     string;
  nombres:              string;
  apellidos:            string;
  email?:               string;
  telefono?:            string;
  nacionalidad?:        string;
  notas_internas?:      string;
  fecha_vencimiento_doc?: string;
}

export async function upsertHuesped(input: UpsertHuespedInput) {
  // Validar que el tipo_documento sea uno de los permitidos
  const tiposValidos = ['DNI', 'PASAPORTE', 'CE', 'RUC', 'DOC_EXTRANJERO'];
  if (!tiposValidos.includes(input.tipo_documento)) {
    throw new AppError('TIPO_DOC_INVALIDO', 400, `tipo_documento debe ser uno de: ${tiposValidos.join(', ')}`);
  }

  const existente = await prisma.huesped.findFirst({
    where: { numero_documento: input.numero_documento },
  });

  if (existente) {
    // Actualizar datos y retornar
    const updated = await prisma.huesped.update({
      where: { id: existente.id },
      data:  {
        nombre:   input.nombres,
        apellido: input.apellidos,
        ...(input.email     !== undefined && { email:    input.email }),
        ...(input.telefono  !== undefined && { telefono: input.telefono }),
        ...(input.nacionalidad !== undefined && { nacionalidad: input.nacionalidad }),
        ...(input.notas_internas !== undefined && { notas: input.notas_internas }),
        ...(input.fecha_vencimiento_doc !== undefined && {
          fecha_vencimiento_doc: new Date(input.fecha_vencimiento_doc),
        }),
      },
    });
    return { ...updated, is_returning: true };
  }

  // Crear nuevo
  const nuevo = await prisma.huesped.create({
    data: {
      tipo_documento:       input.tipo_documento as import('@prisma/client').TipoDocumento,
      numero_documento:     input.numero_documento,
      nombre:               input.nombres,
      apellido:             input.apellidos,
      email:                input.email     ?? null,
      telefono:             input.telefono  ?? null,
      nacionalidad:         input.nacionalidad ?? null,
      notas:                input.notas_internas ?? null,
      fecha_vencimiento_doc: input.fecha_vencimiento_doc
        ? new Date(input.fecha_vencimiento_doc)
        : null,
    },
  });
  return { ...nuevo, is_returning: false };
}
