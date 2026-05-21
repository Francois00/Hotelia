import crypto from 'crypto';
import { Request, Response, NextFunction } from 'express';
import { procesarWebhook, listarSyncLog } from '../services/channelManager.service';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const CANALES_VALIDOS = new Set(['booking', 'expedia', 'airbnb']);

const EVENTOS_VALIDOS = new Set([
  'reservation.created',
  'reservation.cancelled',
  'reservation.modified',
]);

const CANAL_SECRET_KEY: Record<string, string> = {
  booking: 'WEBHOOK_SECRET_BOOKING',
  expedia: 'WEBHOOK_SECRET_EXPEDIA',
  airbnb:  'WEBHOOK_SECRET_AIRBNB',
};

function verificarFirma(rawBody: Buffer, secret: string, received: string | undefined): boolean {
  const expected = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
  if (!received || received.length !== expected.length) return false;
  try {
    return crypto.timingSafeEqual(Buffer.from(received), Buffer.from(expected));
  } catch {
    return false;
  }
}

// ─── Handlers ─────────────────────────────────────────────────────────────────

export async function webhook(req: Request, res: Response, next: NextFunction) {
  try {
    const canal = (req.params.canal ?? '').toLowerCase();

    if (!CANALES_VALIDOS.has(canal)) {
      res.status(400).json({ code: 'CANAL_NO_CONFIGURADO', message: `Canal no soportado: ${canal}` });
      return;
    }

    const envKey = CANAL_SECRET_KEY[canal];
    const secret = process.env[envKey];
    if (!secret) {
      res.status(400).json({
        code:    'CANAL_NO_CONFIGURADO',
        message: `Canal ${canal} no está configurado (falta ${envKey})`,
      });
      return;
    }

    const rawBody = (req as Request & { rawBody?: Buffer }).rawBody;
    if (!rawBody) {
      res.status(400).json({ code: 'BODY_REQUERIDO', message: 'Raw body no disponible' });
      return;
    }

    const receivedSig = req.headers['x-webhook-signature'] as string | undefined;
    if (!verificarFirma(rawBody, secret, receivedSig)) {
      res.status(401).json({ code: 'FIRMA_INVALIDA', message: 'Firma HMAC inválida o ausente' });
      return;
    }

    const evento = req.headers['x-webhook-event'] as string | undefined;
    if (!evento || !EVENTOS_VALIDOS.has(evento)) {
      res.status(400).json({
        code:    'EVENTO_NO_SOPORTADO',
        message: `Evento no soportado: ${evento ?? '(ausente)'}`,
      });
      return;
    }

    // req.body is already parsed by express.json() — use it directly
    const resultado = await procesarWebhook(canal, evento, req.body);
    res.status(200).json(resultado);
  } catch (err) {
    next(err);
  }
}

export async function syncLog(req: Request, res: Response, next: NextFunction) {
  try {
    const { canal, exito, desde, reserva_id, page, limit } = req.query as Record<string, string | undefined>;
    const result = await listarSyncLog({
      canal,
      exito,
      desde,
      reserva_id,
      page:  page  ? parseInt(page,  10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
    });
    res.json(result);
  } catch (err) {
    next(err);
  }
}
