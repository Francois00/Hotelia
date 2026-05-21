import { Request, Response, NextFunction } from 'express';
import { obtenerKPIs, obtenerForecast } from '../services/revenue.service';

export async function kpis(req: Request, res: Response, next: NextFunction) {
  try {
    const { desde, hasta } = req.query as Record<string, string | undefined>;
    const result = await obtenerKPIs(desde, hasta);
    res.json(result);
  } catch (err) {
    next(err);
  }
}

export async function forecast(req: Request, res: Response, next: NextFunction) {
  try {
    const rawDias = parseInt(String(req.query.dias ?? '14'), 10);
    const dias    = Number.isNaN(rawDias) ? 14 : Math.min(Math.max(rawDias, 1), 90);
    const result  = await obtenerForecast(dias);
    res.json(result);
  } catch (err) {
    next(err);
  }
}
