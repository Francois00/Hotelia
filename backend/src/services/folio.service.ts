import { Prisma, TipoFolioItem, MetodoPago, EstadoReserva, EstadoPago, TipoComprobante } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { AppError } from '../lib/errors';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const UUID_RE = /^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i;
function isValidUuid(s: string | undefined): s is string {
  return !!s && UUID_RE.test(s);
}

const ESTADOS_CARGO: EstadoReserva[] = [
  EstadoReserva.CONFIRMADA,
  EstadoReserva.CHECKIN_REALIZADO,
];

const ESTADOS_PAGO: EstadoReserva[] = [
  EstadoReserva.CHECKIN_REALIZADO,
  EstadoReserva.CHECKOUT_REALIZADO,
];

async function verificarReserva(id: string, estadosPermitidos?: EstadoReserva[], localId?: string | null) {
  const reserva = await prisma.reserva.findUnique({
    where:  { id },
    select: { id: true, estado: true, habitacion: { select: { local_id: true } } },
  });
  if (!reserva || (localId && reserva.habitacion.local_id !== localId)) {
    throw new AppError('RESERVA_NOT_FOUND', 404, 'Reserva no encontrada');
  }
  if (estadosPermitidos && !estadosPermitidos.includes(reserva.estado)) {
    throw new AppError(
      'ESTADO_INVALIDO',
      422,
      `Operación no permitida en estado ${reserva.estado}`,
    );
  }
  return reserva;
}

// ─── Interfaces de entrada ────────────────────────────────────────────────────

export interface AgregarCargoInput {
  tipo:            TipoFolioItem;
  descripcion:     string;
  cantidad:        number;
  precio_unitario: number;
  fecha:           string;   // YYYY-MM-DD
  notas?:          string;
}

export interface RegistrarPagoInput {
  metodo:              MetodoPago;
  monto:               number;
  moneda?:             string;
  referencia_externa?: string;
  tipo_comprobante?:   TipoComprobante;
  notas?:              string;
}

// ─── Folio summary ────────────────────────────────────────────────────────────

export async function obtenerFolio(reservaId: string, localId?: string | null) {
  await verificarReserva(reservaId, undefined, localId);

  const [items, pagos] = await Promise.all([
    prisma.folioItem.findMany({
      where:   { reserva_id: reservaId },
      orderBy: { fecha: 'asc' },
      select: {
        id:              true,
        tipo:            true,
        descripcion:     true,
        cantidad:        true,
        precio_unitario: true,
        fecha:           true,
        anulado:         true,
        notas:           true,
        created_at:      true,
        personal:        { select: { id: true, nombre: true, apellido: true } },
      },
    }),
    prisma.pago.findMany({
      where:   { reserva_id: reservaId },
      orderBy: { created_at: 'desc' },
      select: {
        id:                 true,
        monto:              true,
        moneda:             true,
        metodo:             true,
        estado:             true,
        referencia_externa: true,
        numero_comprobante: true,
        tipo_comprobante:   true,
        notas:              true,
        created_at:         true,
        personal:           { select: { id: true, nombre: true, apellido: true } },
      },
    }),
  ]);

  const totalCargos = items
    .filter((i) => !i.anulado)
    .reduce((sum, i) => sum + i.cantidad * Number(i.precio_unitario), 0);

  const totalPagado = pagos
    .filter((p) => p.estado === EstadoPago.COMPLETADO)
    .reduce((sum, p) => sum + Number(p.monto), 0);

  return {
    reserva_id:   reservaId,
    total_cargos: totalCargos,
    total_pagado: totalPagado,
    balance:      totalCargos - totalPagado,
    items:        items.map((i) => ({
      ...i,
      precio_unitario: Number(i.precio_unitario),
      subtotal:        i.anulado ? 0 : i.cantidad * Number(i.precio_unitario),
    })),
    pagos: pagos.map((p) => ({ ...p, monto: Number(p.monto) })),
  };
}

// ─── Cargos ───────────────────────────────────────────────────────────────────

export async function agregarCargo(
  reservaId: string,
  data: AgregarCargoInput,
  personalId?: string,
  localId?: string | null,
) {
  await verificarReserva(reservaId, ESTADOS_CARGO, localId);

  const item = await prisma.folioItem.create({
    data: {
      reserva_id:      reservaId,
      tipo:            data.tipo,
      descripcion:     data.descripcion,
      cantidad:        data.cantidad,
      precio_unitario: data.precio_unitario,
      fecha:           new Date(data.fecha),
      notas:           data.notas ?? null,
      personal_id:     isValidUuid(personalId) ? personalId : null,
    },
    select: {
      id:              true,
      tipo:            true,
      descripcion:     true,
      cantidad:        true,
      precio_unitario: true,
      fecha:           true,
      anulado:         true,
      notas:           true,
      created_at:      true,
    },
  });

  return {
    ...item,
    precio_unitario: Number(item.precio_unitario),
    subtotal:        item.cantidad * Number(item.precio_unitario),
  };
}

export async function anularCargo(
  reservaId: string,
  itemId: string,
  personalId?: string,
  localId?: string | null,
) {
  await verificarReserva(reservaId, undefined, localId);

  const item = await prisma.folioItem.findUnique({
    where:  { id: itemId },
    select: { id: true, reserva_id: true, anulado: true },
  });
  if (!item) throw new AppError('FOLIO_ITEM_NOT_FOUND', 404, 'Cargo no encontrado');
  if (item.reserva_id !== reservaId) {
    throw new AppError('FOLIO_ITEM_NOT_FOUND', 404, 'Cargo no pertenece a esta reserva');
  }
  if (item.anulado) throw new AppError('CARGO_YA_ANULADO', 422, 'El cargo ya fue anulado');

  const updated = await prisma.folioItem.update({
    where: { id: itemId },
    data:  {
      anulado:    true,
      personal_id: isValidUuid(personalId) ? personalId : null,
    },
    select: {
      id:         true,
      anulado:    true,
      created_at: true,
    },
  });

  return updated;
}

// ─── Pagos ────────────────────────────────────────────────────────────────────

export async function registrarPago(
  reservaId: string,
  data: RegistrarPagoInput,
  personalId?: string,
  localId?: string | null,
) {
  await verificarReserva(reservaId, ESTADOS_PAGO, localId);

  const pago = await prisma.pago.create({
    data: {
      reserva_id:         reservaId,
      monto:              data.monto,
      moneda:             data.moneda ?? 'PEN',
      metodo:             data.metodo,
      estado:             EstadoPago.COMPLETADO,
      referencia_externa: data.referencia_externa ?? null,
      tipo_comprobante:   data.tipo_comprobante ?? null,
      notas:              data.notas ?? null,
      personal_id:        isValidUuid(personalId) ? personalId : null,
    },
    select: {
      id:                 true,
      monto:              true,
      moneda:             true,
      metodo:             true,
      estado:             true,
      referencia_externa: true,
      numero_comprobante: true,
      tipo_comprobante:   true,
      notas:              true,
      created_at:         true,
    },
  });

  return { ...pago, monto: Number(pago.monto) };
}
