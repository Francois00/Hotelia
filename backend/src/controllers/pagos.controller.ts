import { Request, Response, NextFunction } from 'express';
import { MetodoPago } from '@prisma/client';
import {
  iniciarPagoReserva,
  confirmarPago,
  procesarReembolso,
  listarPagosPorReserva,
} from '../services/pagos.service';

export async function iniciar(req: Request, res: Response, next: NextFunction) {
  try {
    const { reserva_id, metodo_pago } = req.body as { reserva_id?: string; metodo_pago?: MetodoPago };
    if (!reserva_id || !metodo_pago) {
      res.status(400).json({ code: 'PARAMS_FALTANTES', message: 'Se requieren reserva_id y metodo_pago' });
      return;
    }
    const result = await iniciarPagoReserva(reserva_id, metodo_pago);
    res.json({ data: result });
  } catch (err) { next(err); }
}

export async function confirmar(req: Request, res: Response, next: NextFunction) {
  try {
    const { reserva_id, session_key, payment_intent_id } = req.body as {
      reserva_id: string; session_key?: string; payment_intent_id?: string;
    };
    const result = await confirmarPago(reserva_id, session_key, payment_intent_id);
    res.json({ data: result });
  } catch (err) { next(err); }
}

export async function reembolso(req: Request, res: Response, next: NextFunction) {
  try {
    const { id }     = req.params;
    const { motivo } = req.body as { motivo: string };
    const result     = await procesarReembolso(id, motivo);
    res.json({ data: result });
  } catch (err) { next(err); }
}

export async function porReserva(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await listarPagosPorReserva(req.params.reserva_id);
    res.json({ data });
  } catch (err) { next(err); }
}
