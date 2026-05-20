import { randomUUID } from 'crypto';
import { Prisma, EstadoReserva, EstadoHabitacion, CanalReserva, TipoFolioItem } from '@prisma/client';
import { sincronizarEnTodosLosCanales } from './sync.service';
import { prisma } from '../lib/prisma';
import { redis } from '../lib/redis';
import { AppError } from '../lib/errors';
import { enviarMensaje } from './whatsapp.service';
import { emitirComprobante } from './sunat.service';

// ─── Redis lock (atómico via Lua) ────────────────────────────────────────────

const RELEASE_LOCK = `
  if redis.call("get", KEYS[1]) == ARGV[1] then
    return redis.call("del", KEYS[1])
  else
    return 0
  end
`;

async function liberarLock(key: string, value: string): Promise<void> {
  await redis.eval(RELEASE_LOCK, 1, key, value);
}

// ─── Transiciones válidas ─────────────────────────────────────────────────────
// CANCELADA solo desde CONFIRMADA (no se puede cancelar un check-in ya realizado).
// NO_SHOW solo desde CHECKIN_REALIZADO (edge case: huésped nunca retiró la llave).

const TRANSICIONES: Record<EstadoReserva, EstadoReserva[]> = {
  CONFIRMADA:        [EstadoReserva.CHECKIN_REALIZADO, EstadoReserva.CANCELADA],
  CHECKIN_REALIZADO: [EstadoReserva.CHECKOUT_REALIZADO, EstadoReserva.NO_SHOW],
  CHECKOUT_REALIZADO: [],
  CANCELADA:          [],
  NO_SHOW:            [],
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function generarCodigo(): string {
  const fecha = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const sufijo = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `RES-${fecha}-${sufijo}`;
}

const UUID_RE = /^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i;
function isValidUuid(s: string | undefined): s is string {
  return !!s && UUID_RE.test(s);
}

function calcNumNoches(entrada: Date, salida: Date): number {
  return Math.round((salida.getTime() - entrada.getTime()) / 86_400_000);
}

function esErrorLock(err: unknown): boolean {
  if (!(err instanceof Prisma.PrismaClientKnownRequestError)) return false;
  const meta = err.meta as Record<string, unknown> | undefined;
  return meta?.code === '55P03'; // lock_not_available (FOR UPDATE NOWAIT)
}

function esErrorExclusion(err: unknown): boolean {
  if (!(err instanceof Prisma.PrismaClientKnownRequestError)) return false;
  const meta = err.meta as Record<string, unknown> | undefined;
  return meta?.code === '23P01'; // exclusion_violation (GIST constraint)
}

// ─── Include estándar para respuestas ─────────────────────────────────────────

const INCLUDE_BASE = {
  huesped:    { select: { id: true, nombre: true, apellido: true, email: true } },
  habitacion: { select: { id: true, numero: true, tipo: true, piso: true, tarifa_base: true } },
} satisfies Prisma.ReservaInclude;

// Tipo derivado del include para tipado estricto en el formatter
type ReservaRow = Prisma.ReservaGetPayload<{ include: typeof INCLUDE_BASE }> & {
  folio_items?: unknown[];
  pagos?:       unknown[];
  personal?:    unknown;
};

function formatReserva(r: ReservaRow) {
  const numNoches = calcNumNoches(r.fecha_entrada, r.fecha_salida);
  const base = {
    id:            r.id,
    codigo:        r.codigo,
    estado:        r.estado,
    fecha_entrada: r.fecha_entrada,
    fecha_salida:  r.fecha_salida,
    num_noches:    numNoches,
    canal_origen:  r.canal,
    num_huespedes: r.adultos,
    observaciones: r.notas ?? null,
    huesped:           r.huesped,
    habitacion:        r.habitacion,
    huesped_nombre:    `${r.huesped.nombre} ${r.huesped.apellido}`.trim(),
    habitacion_numero: r.habitacion.numero,
    habitacion_id:     r.habitacion.id,
    tarifa_acordada:   Number(r.tarifa_acordada ?? 0),
    total_estimado:    Number(r.habitacion.tarifa_base) * numNoches,
    created_at:        r.created_at,
    updated_at:        r.updated_at,
  };
  // Campos adicionales presentes solo en el detalle individual
  return {
    ...base,
    ...(r.folio_items !== undefined && { folio_items: r.folio_items }),
    ...(r.pagos       !== undefined && { pagos: r.pagos }),
    ...(r.personal    !== undefined && { personal: r.personal }),
  };
}

// ─── Interfaces de entrada ────────────────────────────────────────────────────

export interface CrearReservaInput {
  huesped_id:     string;
  habitacion_id:  string;
  fecha_entrada:  string;        // YYYY-MM-DD
  fecha_salida:   string;        // YYYY-MM-DD
  canal_origen:   CanalReserva;
  num_huespedes:  number;
  observaciones?: string;
  idempotency_key?: string;
}

export interface ListarReservasQuery {
  page?:           number;
  limit?:          number;
  estado?:         EstadoReserva;
  habitacion_id?:  string;
  huesped_id?:     string;
  huesped_nombre?: string;
  codigo?:         string;
  fecha_entrada?:  string;        // reservas con check-in >= esta fecha
  fecha_salida?:   string;        // reservas con check-out <= esta fecha
  canal_origen?:   CanalReserva;
  tab?:            'activos' | 'historico';
}

export interface ModificarReservaInput {
  fecha_entrada?:  string;
  fecha_salida?:   string;
  habitacion_id?:  string;
  canal?:          CanalReserva;
  tarifa_acordada?: number;
  adultos?:        number;
  notas?:          string;
  motivo:          string;
}

// ─── Operaciones ──────────────────────────────────────────────────────────────

export async function crearReserva(data: CrearReservaInput, personalId?: string) {
  // Idempotencia: misma key → mismo resultado
  if (data.idempotency_key) {
    const existente = await prisma.reserva.findUnique({
      where:   { idempotency_key: data.idempotency_key },
      include: INCLUDE_BASE,
    });
    if (existente) return formatReserva(existente as ReservaRow);
  }

  // El huésped debe existir y estar activo antes de adquirir el lock
  const huesped = await prisma.huesped.findUnique({
    where:  { id: data.huesped_id },
    select: { id: true, activo: true },
  });
  if (!huesped) throw new AppError('HUESPED_NOT_FOUND', 404, 'Huésped no encontrado');
  if (!huesped.activo) throw new AppError('HUESPED_INACTIVO', 422, 'El huésped está desactivado y no puede hacer nuevas reservas');

  const lockKey   = `habitacion:${data.habitacion_id}:lock`;
  const lockValue = randomUUID();

  const acquired = await redis.set(lockKey, lockValue, 'EX', 30, 'NX');
  if (!acquired) {
    throw new AppError('LOCK_TIMEOUT', 503, 'La habitación está siendo procesada, reintente en unos segundos');
  }

  try {
    const reserva = await prisma.$transaction(async (tx) => {
      // FOR UPDATE NOWAIT bloquea la fila; si hay otra TX concurrente → 55P03 inmediato
      const rows = await tx.$queryRaw<Array<{ id: string; numero: string; estado: string; tarifa_base: string }>>`
        SELECT id, numero, estado::text, tarifa_base::text
        FROM habitaciones
        WHERE id = ${data.habitacion_id}::uuid
        FOR UPDATE NOWAIT
      `;

      if (rows.length === 0) {
        throw new AppError('HABITACION_NOT_FOUND', 404, 'Habitación no encontrada');
      }

      const hab = rows[0];

      // La habitación no puede estar en estado que bloquee nuevas reservas
      if (
        hab.estado === EstadoHabitacion.MANTENIMIENTO ||
        hab.estado === EstadoHabitacion.FUERA_DE_SERVICIO
      ) {
        throw new AppError(
          'HABITACION_NO_DISPONIBLE',
          409,
          `La habitación está en estado ${hab.estado} y no acepta reservas`,
        );
      }

      // Verificación explícita de solapamiento (capa de negocio, antes del GIST EXCLUDE)
      const conflicto = await tx.reserva.findFirst({
        where: {
          habitacion_id: data.habitacion_id,
          estado:        { notIn: [EstadoReserva.CANCELADA, EstadoReserva.NO_SHOW] },
          fecha_entrada: { lt: new Date(data.fecha_salida) },
          fecha_salida:  { gt: new Date(data.fecha_entrada) },
        },
        select: { id: true },
      });
      if (conflicto) {
        throw new AppError('HABITACION_NO_DISPONIBLE', 409, 'La habitación no está disponible en esas fechas');
      }

      const fechaEntrada = new Date(data.fecha_entrada);
      const fechaSalida  = new Date(data.fecha_salida);
      const numNoches    = calcNumNoches(fechaEntrada, fechaSalida);
      const tarifaAcordada = parseFloat(hab.tarifa_base) * numNoches;

      // Si el check-in es en menos de 24 h, marcar la habitación como RESERVADA
      // para que el staff sepa que debe prepararla con urgencia.
      const horasHastaCheckin = (fechaEntrada.getTime() - Date.now()) / 3_600_000;
      if (horasHastaCheckin <= 24) {
        await tx.habitacion.update({
          where: { id: data.habitacion_id },
          data:  { estado: EstadoHabitacion.RESERVADA },
        });
      }

      const reserva = await tx.reserva.create({
        data: {
          codigo:          generarCodigo(),
          huesped_id:      data.huesped_id,
          habitacion_id:   data.habitacion_id,
          fecha_entrada:   fechaEntrada,
          fecha_salida:    fechaSalida,
          canal:           data.canal_origen,
          tarifa_acordada: tarifaAcordada,
          adultos:         data.num_huespedes,
          ninos:           0,
          notas:           data.observaciones ?? null,
          idempotency_key: data.idempotency_key ?? null,
          personal_id:     isValidUuid(personalId) ? personalId : null,
        },
        include: INCLUDE_BASE,
      });

      // Auto-crear cargo base de habitación en el folio
      await tx.folioItem.create({
        data: {
          reserva_id:      reserva.id,
          tipo:            TipoFolioItem.HABITACION,
          descripcion:     `Habitación ${hab.numero} — ${numNoches} noche${numNoches !== 1 ? 's' : ''}`,
          cantidad:        numNoches,
          precio_unitario: parseFloat(hab.tarifa_base),
          fecha:           fechaEntrada,
          personal_id:     isValidUuid(personalId) ? personalId : null,
        },
      });

      return reserva;
    });

    const resultado = formatReserva(reserva as ReservaRow);

    // Fire-and-forget: notify all OTA channels to block these dates
    sincronizarEnTodosLosCanales(
      data.habitacion_id,
      reserva.fecha_entrada,
      reserva.fecha_salida,
      false,
      reserva.id,
    ).catch((err: unknown) => console.error('[sync] crearReserva outbound error:', err));

    // Fire-and-forget: WhatsApp confirmation to guest
    if (reserva.huesped) {
      const h = reserva.huesped as { nombre?: string; email?: string };
      const tel = await prisma.huesped
        .findUnique({ where: { id: data.huesped_id }, select: { telefono: true } })
        .then((r) => r?.telefono ?? null);
      if (tel) {
        enviarMensaje(tel, 'confirmacion_reserva', {
          nombre:         h.nombre ?? '',
          codigo_reserva: resultado.codigo,
          habitacion:     resultado.habitacion.numero,
          fecha_entrada:  resultado.fecha_entrada.toISOString().slice(0, 10),
          fecha_salida:   resultado.fecha_salida.toISOString().slice(0, 10),
        }).catch(() => null);
      }
    }

    return resultado;
  } catch (err) {
    if (err instanceof AppError) throw err;
    if (esErrorLock(err) || esErrorExclusion(err)) {
      throw new AppError('HABITACION_NO_DISPONIBLE', 409, 'La habitación no está disponible (conflicto de concurrencia)');
    }
    throw err;
  } finally {
    await liberarLock(lockKey, lockValue);
  }
}

export async function listarReservas(query: ListarReservasQuery) {
  const page  = query.page  ?? 1;
  const limit = Math.min(query.limit ?? 20, 100);

  const where: Prisma.ReservaWhereInput = {};

  // Tab filter takes effect only if no explicit estado filter is set
  if (query.estado) {
    where.estado = query.estado;
  } else if (query.tab === 'activos') {
    where.estado = { in: [EstadoReserva.CONFIRMADA, EstadoReserva.CHECKIN_REALIZADO] };
  } else if (query.tab === 'historico') {
    where.estado = { in: [EstadoReserva.CHECKOUT_REALIZADO, EstadoReserva.CANCELADA, EstadoReserva.NO_SHOW] };
  }

  if (query.habitacion_id) where.habitacion_id = query.habitacion_id;
  if (query.huesped_id)    where.huesped_id    = query.huesped_id;
  if (query.canal_origen)  where.canal         = query.canal_origen;
  if (query.fecha_entrada) where.fecha_entrada = { gte: new Date(query.fecha_entrada) };
  if (query.fecha_salida)  where.fecha_salida  = { lte: new Date(query.fecha_salida) };
  if (query.codigo) {
    where.codigo = { contains: query.codigo, mode: 'insensitive' };
  }
  if (query.huesped_nombre) {
    const q = query.huesped_nombre;
    where.huesped = {
      OR: [
        { nombre:   { contains: q, mode: 'insensitive' } },
        { apellido: { contains: q, mode: 'insensitive' } },
      ],
    };
  }

  const [total, reservas] = await Promise.all([
    prisma.reserva.count({ where }),
    prisma.reserva.findMany({
      where,
      include:  INCLUDE_BASE,
      orderBy:  { created_at: 'desc' },
      skip:     (page - 1) * limit,
      take:     limit,
    }),
  ]);

  return {
    data: reservas.map((r) => formatReserva(r as ReservaRow)),
    meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
  };
}

export async function obtenerReserva(id: string) {
  const reserva = await prisma.reserva.findUnique({
    where:   { id },
    include: {
      ...INCLUDE_BASE,
      folio_items: { orderBy: { fecha: 'asc' } },
      pagos:       { orderBy: { created_at: 'desc' } },
      personal:    { select: { nombre: true, apellido: true, rol: true } },
    },
  });
  if (!reserva) throw new AppError('RESERVA_NOT_FOUND', 404, 'Reserva no encontrada');
  return formatReserva(reserva as unknown as ReservaRow);
}

export async function cambiarEstado(
  id: string,
  nuevoEstado: EstadoReserva,
  observaciones?: string,
) {
  // Captured inside tx, used for fire-and-forget sync after commit
  let habitacionIdCapture: string | undefined;
  let fechaEntradaCapture: Date | undefined;
  let fechaSalidaCapture:  Date | undefined;

  const result = await prisma.$transaction(async (tx) => {
    const reserva = await tx.reserva.findUnique({
      where:  { id },
      select: { estado: true, habitacion_id: true, fecha_entrada: true, fecha_salida: true },
    });
    habitacionIdCapture = reserva?.habitacion_id;
    fechaEntradaCapture = reserva?.fecha_entrada;
    fechaSalidaCapture  = reserva?.fecha_salida;
    if (!reserva) throw new AppError('RESERVA_NOT_FOUND', 404, 'Reserva no encontrada');

    const permitidos = TRANSICIONES[reserva.estado];
    if (!permitidos.includes(nuevoEstado)) {
      throw new AppError(
        'TRANSICION_INVALIDA',
        422,
        `No se puede pasar de ${reserva.estado} a ${nuevoEstado}. ` +
          `Transiciones válidas: ${permitidos.join(', ') || 'ninguna'}`,
      );
    }

    // ── Efectos secundarios en la habitación ─────────────────────────────────
    if (nuevoEstado === EstadoReserva.CHECKIN_REALIZADO) {
      // Huésped en habitación → OCUPADA
      await tx.habitacion.update({
        where: { id: reserva.habitacion_id },
        data:  { estado: EstadoHabitacion.OCUPADA },
      });
    } else if (nuevoEstado === EstadoReserva.CHECKOUT_REALIZADO) {
      // Huésped se fue → necesita limpieza
      await tx.habitacion.update({
        where: { id: reserva.habitacion_id },
        data:  { estado: EstadoHabitacion.LIMPIEZA },
      });
    } else if (
      nuevoEstado === EstadoReserva.CANCELADA ||
      nuevoEstado === EstadoReserva.NO_SHOW
    ) {
      // Solo liberar la habitación si no hay otra reserva activa que la reclame
      const otraActiva = await tx.reserva.findFirst({
        where: {
          habitacion_id: reserva.habitacion_id,
          id:     { not: id },
          estado: { notIn: [EstadoReserva.CANCELADA, EstadoReserva.NO_SHOW, EstadoReserva.CHECKOUT_REALIZADO] },
        },
        select: { id: true },
      });
      if (!otraActiva) {
        await tx.habitacion.update({
          where: { id: reserva.habitacion_id },
          data:  { estado: EstadoHabitacion.DISPONIBLE },
        });
      }
    }

    const updated = await tx.reserva.update({
      where:   { id },
      data:    {
        estado: nuevoEstado,
        ...(observaciones !== undefined && { notas: observaciones }),
      },
      include: INCLUDE_BASE,
    });

    return formatReserva(updated as ReservaRow);
  });

  // Fire-and-forget: notify OTAs that the room is available again after cancellation
  if (
    (nuevoEstado === EstadoReserva.CANCELADA || nuevoEstado === EstadoReserva.NO_SHOW) &&
    habitacionIdCapture && fechaEntradaCapture && fechaSalidaCapture
  ) {
    sincronizarEnTodosLosCanales(
      habitacionIdCapture,
      fechaEntradaCapture,
      fechaSalidaCapture,
      true,
      id,
    ).catch((err: unknown) => console.error('[sync] cambiarEstado outbound error:', err));
  }

  // Fire-and-forget: WhatsApp + SUNAT hooks on key transitions
  if (nuevoEstado === EstadoReserva.CHECKIN_REALIZADO) {
    prisma.reserva.findUnique({
      where:  { id },
      select: {
        huesped:    { select: { telefono: true, nombre: true } },
        habitacion: { select: { numero: true } },
      },
    }).then((r) => {
      if (r?.huesped?.telefono) {
        enviarMensaje(r.huesped.telefono, 'checkin_bienvenida', {
          nombre:        r.huesped.nombre,
          habitacion:    r.habitacion.numero,
          wifi_password: process.env.WIFI_PASSWORD ?? 'hotel2024',
          checkout_hora: '12:00',
        }).catch(() => null);
      }
    }).catch(() => null);
  }

  if (nuevoEstado === EstadoReserva.CHECKOUT_REALIZADO) {
    emitirComprobante(id).catch((err: unknown) =>
      console.error('[sunat] emitirComprobante fire-and-forget error:', err),
    );
  }

  return result;
}

// Soft-delete: reutiliza la transición a CANCELADA con todos sus efectos secundarios
export async function cancelarReserva(id: string) {
  return cambiarEstado(id, EstadoReserva.CANCELADA);
}

// ─── Modificar reserva (solo CONFIRMADA) ─────────────────────────────────────

export async function modificarReserva(
  id: string,
  data: ModificarReservaInput,
  actorId: string,
  actorEmail: string,
) {
  const reserva = await prisma.reserva.findUnique({ where: { id }, include: INCLUDE_BASE });
  if (!reserva) throw new AppError('RESERVA_NO_ENCONTRADA', 404, 'Reserva no encontrada');
  if (reserva.estado !== EstadoReserva.CONFIRMADA) {
    throw new AppError(
      'MODIFICACION_NO_PERMITIDA', 422,
      'Solo se pueden modificar reservas en estado CONFIRMADA',
    );
  }

  const updates: Prisma.ReservaUpdateInput = {};
  const cambios: Array<{ campo: string; anterior: string; nuevo: string }> = [];

  if (data.fecha_entrada !== undefined) {
    const anterior = reserva.fecha_entrada.toISOString().slice(0, 10);
    if (data.fecha_entrada !== anterior) {
      updates.fecha_entrada = new Date(data.fecha_entrada);
      cambios.push({ campo: 'fecha_entrada', anterior, nuevo: data.fecha_entrada });
    }
  }
  if (data.fecha_salida !== undefined) {
    const anterior = reserva.fecha_salida.toISOString().slice(0, 10);
    if (data.fecha_salida !== anterior) {
      updates.fecha_salida = new Date(data.fecha_salida);
      cambios.push({ campo: 'fecha_salida', anterior, nuevo: data.fecha_salida });
    }
  }
  if (data.habitacion_id !== undefined && data.habitacion_id !== reserva.habitacion_id) {
    updates.habitacion = { connect: { id: data.habitacion_id } };
    cambios.push({ campo: 'habitacion_id', anterior: reserva.habitacion_id, nuevo: data.habitacion_id });
  }
  if (data.canal !== undefined && data.canal !== reserva.canal) {
    updates.canal = data.canal;
    cambios.push({ campo: 'canal', anterior: reserva.canal, nuevo: data.canal });
  }
  if (data.tarifa_acordada !== undefined) {
    const anterior = Number(reserva.tarifa_acordada);
    if (data.tarifa_acordada !== anterior) {
      updates.tarifa_acordada = data.tarifa_acordada;
      cambios.push({ campo: 'tarifa_acordada', anterior: String(anterior), nuevo: String(data.tarifa_acordada) });
    }
  }
  if (data.adultos !== undefined && data.adultos !== reserva.adultos) {
    updates.adultos = data.adultos;
    cambios.push({ campo: 'adultos', anterior: String(reserva.adultos), nuevo: String(data.adultos) });
  }
  if (data.notas !== undefined && data.notas !== (reserva.notas ?? '')) {
    updates.notas = data.notas;
    cambios.push({ campo: 'notas', anterior: reserva.notas ?? '', nuevo: data.notas });
  }

  if (cambios.length === 0) return formatReserva(reserva as ReservaRow);

  const updated = await prisma.$transaction(async (tx) => {
    const r = await tx.reserva.update({ where: { id }, data: updates, include: INCLUDE_BASE });
    await tx.$executeRaw`
      INSERT INTO audit_log (entidad, entidad_id, accion, campos_modificados, actor_id, actor_email, motivo)
      VALUES ('reserva', ${id}::uuid, 'MODIFICACION', ${JSON.stringify(cambios)}::jsonb,
              ${actorId}::uuid, ${actorEmail}, ${data.motivo})
    `;
    return r;
  });

  return formatReserva(updated as ReservaRow);
}

// ─── Bitácora de auditoría ───────────────────────────────────────────────────

interface AuditEntry {
  id: string;
  accion: string;
  campos_modificados: unknown;
  actor_email: string | null;
  motivo: string | null;
  created_at: Date;
}

export async function obtenerAuditoria(reservaId: string): Promise<AuditEntry[]> {
  const rows = await prisma.$queryRaw<AuditEntry[]>`
    SELECT id, accion, campos_modificados, actor_email, motivo, created_at
    FROM audit_log
    WHERE entidad = 'reserva' AND entidad_id = ${reservaId}::uuid
    ORDER BY created_at DESC
    LIMIT 50
  `;
  return rows;
}
