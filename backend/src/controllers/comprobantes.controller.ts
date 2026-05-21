import { Request, Response, NextFunction } from 'express';
import {
  emitirComprobante,
  obtenerComprobantePorReserva,
  listarComprobantes,
} from '../services/sunat.service';

export async function emitir(req: Request, res: Response, next: NextFunction) {
  try {
    const { reserva_id } = req.body as { reserva_id?: string };
    if (!reserva_id) {
      res.status(400).json({ code: 'PARAMS_FALTANTES', message: 'Se requiere reserva_id' });
      return;
    }
    const result = await emitirComprobante(reserva_id);
    res.status(201).json({ data: result });
  } catch (err) { next(err); }
}

export async function porReserva(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await obtenerComprobantePorReserva(req.params.reserva_id);
    res.json({ data });
  } catch (err) { next(err); }
}

export async function listar(req: Request, res: Response, next: NextFunction) {
  try {
    const { tipo, estado, desde, hasta, page, limit } = req.query as Record<string, string | undefined>;
    const result = await listarComprobantes({
      tipo,
      estado,
      desde,
      hasta,
      page:  page  ? parseInt(page,  10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
    });
    res.json(result);
  } catch (err) { next(err); }
}
