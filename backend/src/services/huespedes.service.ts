import { Prisma, SegmentoHuesped, TipoDocumento, IdiomaPreferido, EstadoReserva } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { AppError } from '../lib/errors';

// ─── Helpers de unicidad ──────────────────────────────────────────────────────

function manejarErrorUnicidad(err: unknown): never {
  if (
    err instanceof Prisma.PrismaClientKnownRequestError &&
    err.code === 'P2002'
  ) {
    const target = err.meta?.target;
    const fields = Array.isArray(target) ? target.join(',') : String(target ?? '');
    if (fields.includes('email')) {
      throw new AppError('EMAIL_DUPLICADO', 409, 'El email ya está registrado');
    }
    if (fields.includes('numero_documento')) {
      throw new AppError('DOCUMENTO_DUPLICADO', 409, 'El número de documento ya está registrado');
    }
  }
  throw err;
}

// ─── Include y formato ────────────────────────────────────────────────────────

// Proyección mínima para el formatter (no incluye relaciones)
const SELECT_BASE = {
  id:               true,
  nombre:           true,
  apellido:         true,
  email:            true,
  telefono:         true,
  tipo_documento:   true,
  numero_documento: true,
  nacionalidad:     true,
  idioma_preferido: true,
  fecha_nacimiento: true,
  ltv:              true,
  segmento:         true,
  notas:            true,
  preferencias:     true,
  activo:           true,
  created_at:       true,
  updated_at:       true,
} satisfies Prisma.HuespedSelect;

type HuespedBase = Prisma.HuespedGetPayload<{ select: typeof SELECT_BASE }>;

function formatHuesped(
  h: HuespedBase,
  extras: {
    total_estancias?: number;
    ultima_estancia?: Date | null;
    proxima_reserva?: Date | null;
  } = {},
) {
  const out: Record<string, unknown> = {
    id:               h.id,
    nombre:           h.nombre,
    apellido:         h.apellido,
    email:            h.email ?? null,
    telefono:         h.telefono ?? null,
    documento_tipo:   h.tipo_documento,
    documento_numero: h.numero_documento,
    nacionalidad:     h.nacionalidad ?? null,
    idioma_preferido: h.idioma_preferido,
    fecha_nacimiento: h.fecha_nacimiento ?? null,
    segmento_crm:     h.segmento,
    ltv_calculado:    Number(h.ltv),
    preferencias:     h.preferencias ?? null,
    notas_internas:   h.notas ?? null,
    activo:           h.activo,
    created_at:       h.created_at,
    updated_at:       h.updated_at,
  };
  if (extras.total_estancias !== undefined) out.total_estancias = extras.total_estancias;
  if ('ultima_estancia' in extras)          out.ultima_estancia = extras.ultima_estancia ?? null;
  if ('proxima_reserva' in extras)          out.proxima_reserva = extras.proxima_reserva ?? null;
  return out;
}

// ─── Interfaces de entrada ────────────────────────────────────────────────────

export interface CrearHuespedInput {
  nombre:            string;
  apellido?:         string;
  email:             string;
  telefono?:         string;
  documento_tipo:    TipoDocumento;
  documento_numero:  string;
  nacionalidad?:     string;
  idioma_preferido?: IdiomaPreferido;
  fecha_nacimiento?: string;         // YYYY-MM-DD
  notas_internas?:   string;
  preferencias?:     Record<string, unknown>;
}

export interface ActualizarHuespedInput {
  nombre?:            string;
  apellido?:          string;
  email?:             string;
  telefono?:          string;
  documento_tipo?:    TipoDocumento;
  documento_numero?:  string;
  nacionalidad?:      string;
  idioma_preferido?:  IdiomaPreferido;
  fecha_nacimiento?:  string;
  notas_internas?:    string;
  preferencias?:      Record<string, unknown>;
}

export interface ListarHuespedesQuery {
  nombre?:       string;
  email?:        string;
  documento?:    string;
  segmento_crm?: SegmentoHuesped;
  page?:         number;
  limit?:        number;
}

// ─── Operaciones ──────────────────────────────────────────────────────────────

export async function crearHuesped(data: CrearHuespedInput) {
  try {
    const huesped = await prisma.huesped.create({
      data: {
        nombre:           data.nombre,
        apellido:         data.apellido ?? '',
        email:            data.email,
        telefono:         data.telefono ?? null,
        tipo_documento:   data.documento_tipo,
        numero_documento: data.documento_numero,
        nacionalidad:     data.nacionalidad ?? null,
        idioma_preferido: data.idioma_preferido ?? IdiomaPreferido.ES,
        fecha_nacimiento: data.fecha_nacimiento ? new Date(data.fecha_nacimiento) : null,
        notas:        data.notas_internas ?? null,
        preferencias: data.preferencias != null
          ? (data.preferencias as Prisma.InputJsonValue)
          : Prisma.DbNull,
        segmento:     SegmentoHuesped.NUEVO,
        activo:           true,
      },
      select: SELECT_BASE,
    });
    return formatHuesped(huesped, { total_estancias: 0 });
  } catch (err) {
    manejarErrorUnicidad(err);
  }
}

export async function listarHuespedes(query: ListarHuespedesQuery) {
  const page  = query.page  ?? 1;
  const limit = Math.min(query.limit ?? 20, 300);

  const where: Prisma.HuespedWhereInput = {};

  if (query.nombre) {
    where.OR = [
      { nombre:   { contains: query.nombre, mode: 'insensitive' } },
      { apellido: { contains: query.nombre, mode: 'insensitive' } },
    ];
  }
  if (query.email)        where.email            = { contains: query.email,    mode: 'insensitive' };
  if (query.documento)    where.numero_documento = { contains: query.documento, mode: 'insensitive' };
  if (query.segmento_crm) where.segmento         = query.segmento_crm;

  const [total, huespedes] = await Promise.all([
    prisma.huesped.count({ where }),
    prisma.huesped.findMany({
      where,
      select: {
        ...SELECT_BASE,
        _count: {
          select: {
            reservas: {
              where: { estado: { notIn: [EstadoReserva.CANCELADA, EstadoReserva.NO_SHOW] } },
            },
          },
        },
      },
      orderBy: { created_at: 'desc' },
      skip:    (page - 1) * limit,
      take:    limit,
    }),
  ]);

  return {
    data: huespedes.map((h) => {
      const { _count, ...rest } = h;
      return formatHuesped(rest as HuespedBase, { total_estancias: _count.reservas });
    }),
    meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
  };
}

export async function obtenerHuesped(id: string) {
  const [huesped, totalRows, ultima, proxima] = await Promise.all([
    prisma.huesped.findUnique({ where: { id }, select: SELECT_BASE }),

    prisma.reserva.count({
      where: {
        huesped_id: id,
        estado: { notIn: [EstadoReserva.CANCELADA, EstadoReserva.NO_SHOW] },
      },
    }),

    prisma.reserva.findFirst({
      where:   { huesped_id: id, estado: EstadoReserva.CHECKOUT_REALIZADO },
      orderBy: { fecha_salida: 'desc' },
      select:  { fecha_salida: true },
    }),

    prisma.reserva.findFirst({
      where: {
        huesped_id: id,
        estado:     { in: [EstadoReserva.CONFIRMADA, EstadoReserva.CHECKIN_REALIZADO] },
        fecha_entrada: { gte: new Date() },
      },
      orderBy: { fecha_entrada: 'asc' },
      select:  { fecha_entrada: true },
    }),
  ]);

  if (!huesped) throw new AppError('HUESPED_NOT_FOUND', 404, 'Huésped no encontrado');

  return formatHuesped(huesped, {
    total_estancias: totalRows,
    ultima_estancia: ultima?.fecha_salida ?? null,
    proxima_reserva: proxima?.fecha_entrada ?? null,
  });
}

export async function obtenerHistorial(id: string) {
  const huesped = await prisma.huesped.findUnique({
    where:  { id },
    select: { id: true, nombre: true, apellido: true },
  });
  if (!huesped) throw new AppError('HUESPED_NOT_FOUND', 404, 'Huésped no encontrado');

  const reservas = await prisma.reserva.findMany({
    where:   { huesped_id: id },
    include: { habitacion: { select: { numero: true, tipo: true } } },
    orderBy: { fecha_entrada: 'desc' },
  });

  const activas = reservas.filter(
    (r) => r.estado !== EstadoReserva.CANCELADA && r.estado !== EstadoReserva.NO_SHOW,
  );
  const gastoTotal = activas.reduce((sum, r) => sum + Number(r.tarifa_acordada), 0);

  return {
    huesped:         { id: huesped.id, nombre: `${huesped.nombre} ${huesped.apellido}`.trim() },
    total_estancias: activas.length,
    gasto_total:     gastoTotal,
    reservas: reservas.map((r) => {
      const noches = Math.round(
        (r.fecha_salida.getTime() - r.fecha_entrada.getTime()) / 86_400_000,
      );
      return {
        id:            r.id,
        codigo_reserva: r.codigo,
        estado:        r.estado,
        fecha_entrada: r.fecha_entrada,
        fecha_salida:  r.fecha_salida,
        num_noches:    noches,
        habitacion:    r.habitacion,
        canal_origen:  r.canal,
        tarifa_acordada: Number(r.tarifa_acordada),
        created_at:    r.created_at,
      };
    }),
  };
}

export async function actualizarHuesped(id: string, data: ActualizarHuespedInput) {
  const existe = await prisma.huesped.findUnique({ where: { id }, select: { id: true } });
  if (!existe) throw new AppError('HUESPED_NOT_FOUND', 404, 'Huésped no encontrado');

  try {
    const updated = await prisma.huesped.update({
      where: { id },
      data: {
        ...(data.nombre           !== undefined && { nombre:           data.nombre }),
        ...(data.apellido         !== undefined && { apellido:         data.apellido }),
        ...(data.email            !== undefined && { email:            data.email }),
        ...(data.telefono         !== undefined && { telefono:         data.telefono }),
        ...(data.documento_tipo   !== undefined && { tipo_documento:   data.documento_tipo }),
        ...(data.documento_numero !== undefined && { numero_documento: data.documento_numero }),
        ...(data.nacionalidad     !== undefined && { nacionalidad:     data.nacionalidad }),
        ...(data.idioma_preferido !== undefined && { idioma_preferido: data.idioma_preferido }),
        ...(data.notas_internas   !== undefined && { notas:            data.notas_internas }),
        ...(data.preferencias     !== undefined && {
          preferencias: data.preferencias != null
            ? (data.preferencias as Prisma.InputJsonValue)
            : Prisma.DbNull,
        }),
        ...(data.fecha_nacimiento !== undefined && {
          fecha_nacimiento: data.fecha_nacimiento ? new Date(data.fecha_nacimiento) : null,
        }),
      },
      select: SELECT_BASE,
    });
    return formatHuesped(updated);
  } catch (err) {
    manejarErrorUnicidad(err);
  }
}

export async function desactivarHuesped(id: string) {
  const huesped = await prisma.huesped.findUnique({ where: { id }, select: { id: true, activo: true } });
  if (!huesped) throw new AppError('HUESPED_NOT_FOUND', 404, 'Huésped no encontrado');

  const updated = await prisma.huesped.update({
    where: { id },
    data:  { activo: false },
    select: SELECT_BASE,
  });
  return formatHuesped(updated);
}
