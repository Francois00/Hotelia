import jwt from 'jsonwebtoken';
import QRCode from 'qrcode';
import { prisma } from '../lib/prisma';
import { AppError } from '../lib/errors';
import { EstadoReserva } from '@prisma/client';
import { cambiarEstado } from './reservas.service';

function qrSecret(): string {
  return process.env.QR_SECRET ?? 'default_qr_secret_change_me';
}

function frontendUrl(): string {
  return process.env.FRONTEND_URL ?? 'http://localhost:5173';
}

export async function generarQRCheckin(reserva_id: string) {
  const reserva = await prisma.reserva.findUnique({
    where:  { id: reserva_id },
    select: {
      id:            true,
      estado:        true,
      fecha_entrada: true,
      habitacion:    { select: { numero: true } },
      huesped:       { select: { nombre: true } },
    },
  });
  if (!reserva) throw new AppError('RESERVA_NOT_FOUND', 404, 'Reserva no encontrada');
  if (reserva.estado !== EstadoReserva.CONFIRMADA) {
    throw new AppError('ESTADO_INVALIDO', 422, 'Solo se puede generar QR para reservas CONFIRMADAS');
  }

  // Token expires 2 days after fecha_entrada
  const expDate = new Date(reserva.fecha_entrada);
  expDate.setDate(expDate.getDate() + 2);
  const expSeconds = Math.floor(expDate.getTime() / 1000);

  const payload = { reserva_id, tipo: 'qr_checkin' };
  const token   = jwt.sign(payload, qrSecret(), { expiresIn: expSeconds - Math.floor(Date.now() / 1000) });

  const url      = `${frontendUrl()}/checkin?token=${token}`;
  const qrBase64 = await QRCode.toDataURL(url, { errorCorrectionLevel: 'M' });

  await prisma.reserva.update({
    where: { id: reserva_id },
    data:  { qr_token: token, qr_generado_en: new Date() },
  });

  return {
    qr_base64: qrBase64,
    url,
    token,
    expira_en: expDate.toISOString(),
  };
}

export async function procesarQRCheckin(token: string) {
  let payload: { reserva_id: string; tipo: string };

  try {
    payload = jwt.verify(token, qrSecret()) as typeof payload;
  } catch (err) {
    const isExpired = err instanceof jwt.TokenExpiredError;
    throw new AppError(
      isExpired ? 'TOKEN_EXPIRADO' : 'TOKEN_INVALIDO',
      401,
      isExpired ? 'El token QR ha expirado' : 'Token QR inválido',
    );
  }

  if (payload.tipo !== 'qr_checkin') {
    throw new AppError('TOKEN_INVALIDO', 401, 'Token QR inválido (tipo incorrecto)');
  }

  const reserva = await prisma.reserva.findUnique({
    where:  { id: payload.reserva_id },
    select: {
      id:         true,
      qr_token:   true,
      estado:     true,
      habitacion: { select: { numero: true } },
    },
  });
  if (!reserva) throw new AppError('RESERVA_NOT_FOUND', 404, 'Reserva no encontrada');

  if (reserva.qr_token !== token) {
    throw new AppError('TOKEN_INVALIDO', 401, 'Token QR no coincide (ya fue reemplazado)');
  }

  await cambiarEstado(payload.reserva_id, EstadoReserva.CHECKIN_REALIZADO);

  const wifi = process.env.WIFI_PASSWORD ?? 'hotel2024';

  return {
    reserva_id:        payload.reserva_id,
    habitacion_numero: reserva.habitacion.numero,
    mensaje_bienvenida: `¡Bienvenido! Su habitación ${reserva.habitacion.numero} está lista.`,
    wifi_password:     wifi,
  };
}
