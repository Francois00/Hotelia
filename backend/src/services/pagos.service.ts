import Stripe from 'stripe';
import { MetodoPago } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { AppError } from '../lib/errors';
import { obtenerFolio, registrarPago } from './folio.service';
import { obtenerToken, crearSesionPago, procesarPago as niubizProcesar } from './niubiz.service';
import axios from 'axios';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function stripeClient(): InstanceType<typeof Stripe> {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new AppError('STRIPE_NO_CONFIGURADO', 503, 'Stripe no está configurado');
  return new Stripe(key, { apiVersion: '2026-04-22.dahlia' });
}

async function getSaldoPendiente(reserva_id: string, localId?: string | null): Promise<number> {
  const folio = await obtenerFolio(reserva_id, localId);
  return folio.balance;
}

async function notificarN8N(reserva_id: string): Promise<void> {
  const url = process.env.N8N_WEBHOOK_URL;
  if (!url) return;
  try {
    await axios.post(
      `${url}/webhook/pago-confirmado`,
      { reserva_id },
      { timeout: 5000 },
    );
  } catch {
    // Non-fatal
  }
}

// ─── Interfaces ─────��───────────────────────────────���─────────────────────────

export interface IniciarPagoResult {
  sessionKey?:   string;
  client_secret?: string;
  monto:         number;
  transaccion_id: string;
  proveedor:     'niubiz' | 'stripe';
}

export interface ConfirmarPagoResult {
  pago_id:              string;
  estado:               string;
  comprobante_pendiente: boolean;
}

// ─── Operaciones ──────────────────────────────────────────────────────────────

export async function iniciarPagoReserva(
  reserva_id: string,
  metodo_pago: MetodoPago,
  localId?: string | null,
): Promise<IniciarPagoResult> {
  const saldo = await getSaldoPendiente(reserva_id, localId);
  if (saldo <= 0) throw new AppError('FOLIO_SALDADO', 422, 'El folio ya está saldado');

  if (metodo_pago === MetodoPago.NIUBIZ) {
    await obtenerToken(); // warm cache
    const montoCentimos = Math.round(saldo * 100);
    const { sessionKey, expirationTime } = await crearSesionPago(montoCentimos, reserva_id);
    return { sessionKey, monto: saldo, transaccion_id: reserva_id, proveedor: 'niubiz' };
  }

  if (metodo_pago === MetodoPago.STRIPE) {
    const stripe = stripeClient();
    const intent = await stripe.paymentIntents.create({
      amount:   Math.round(saldo * 100),
      currency: 'pen',
      metadata: { reserva_id },
    });
    return {
      client_secret:  intent.client_secret ?? undefined,
      monto:          saldo,
      transaccion_id: reserva_id,
      proveedor:      'stripe',
    };
  }

  throw new AppError(
    'METODO_INVALIDO',
    400,
    `El método ${metodo_pago} no requiere inicialización. Use POST /folio/pagos directamente.`,
  );
}

export async function confirmarPago(
  reserva_id: string,
  session_key?: string,
  payment_intent_id?: string,
  localId?: string | null,
): Promise<ConfirmarPagoResult> {
  const saldo = await getSaldoPendiente(reserva_id, localId);
  if (saldo <= 0) throw new AppError('FOLIO_SALDADO', 422, 'El folio ya está saldado');

  const huesped = await prisma.reserva.findUnique({
    where:  { id: reserva_id },
    select: { huesped: { select: { email: true } } },
  });
  const email = huesped?.huesped.email ?? 'sin@email.com';

  let referencia: string;
  let metodo: MetodoPago;

  if (session_key) {
    const montoCentimos = Math.round(saldo * 100);
    const result = await niubizProcesar(session_key, reserva_id, montoCentimos, email);
    referencia = result.transactionId;
    metodo     = MetodoPago.NIUBIZ;
  } else if (payment_intent_id) {
    const stripe = stripeClient();
    const intent = await stripe.paymentIntents.retrieve(payment_intent_id);
    if (intent.status !== 'succeeded') {
      throw new AppError('PAGO_NO_COMPLETADO', 422, `Stripe PaymentIntent en estado: ${intent.status}`);
    }
    referencia = intent.id;
    metodo     = MetodoPago.STRIPE;
  } else {
    throw new AppError('PARAMETROS_FALTANTES', 400, 'Se requiere session_key (Niubiz) o payment_intent_id (Stripe)');
  }

  const pago = await registrarPago(reserva_id, {
    metodo,
    monto:              saldo,
    referencia_externa: referencia,
  }, undefined, localId);

  // Fire-and-forget: trigger n8n if folio now balanced
  const nuevoFolio = await obtenerFolio(reserva_id, localId);
  if (nuevoFolio.balance <= 0) {
    notificarN8N(reserva_id).catch(() => null);
  }

  return { pago_id: pago.id, estado: 'aprobado', comprobante_pendiente: true };
}

export async function procesarReembolso(
  pago_id: string,
  motivo: string,
  localId?: string | null,
): Promise<{ reembolso_id: string; estado: string; motivo: string }> {
  const pago = await prisma.pago.findUnique({
    where: { id: pago_id },
    include: { reserva: { select: { habitacion: { select: { local_id: true } } } } },
  });
  if (!pago || (localId && pago.reserva.habitacion.local_id !== localId)) {
    throw new AppError('PAGO_NOT_FOUND', 404, 'Pago no encontrado');
  }

  // Stub: in production call Niubiz/Stripe refund API
  const updated = await prisma.pago.update({
    where: { id: pago_id },
    data:  { estado: 'REEMBOLSADO' as never, notas: motivo },
    select: { id: true },
  });

  return { reembolso_id: updated.id, estado: 'procesado', motivo };
}

export async function listarPagosPorReserva(reserva_id: string, localId?: string | null) {
  if (localId) {
    const reserva = await prisma.reserva.findUnique({
      where: { id: reserva_id },
      select: { habitacion: { select: { local_id: true } } },
    });
    if (!reserva || reserva.habitacion.local_id !== localId) {
      throw new AppError('RESERVA_NOT_FOUND', 404, 'Reserva no encontrada');
    }
  }

  const pagos = await prisma.pago.findMany({
    where:   { reserva_id },
    orderBy: { created_at: 'desc' },
    select: {
      id:                 true,
      monto:              true,
      moneda:             true,
      metodo:             true,
      estado:             true,
      referencia_externa: true,
      tipo_comprobante:   true,
      notas:              true,
      created_at:         true,
    },
  });
  return pagos.map((p) => ({ ...p, monto: Number(p.monto) }));
}
