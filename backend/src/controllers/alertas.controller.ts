import type { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import * as service from '../services/alertas.service';

const upsertSchema = z.object({
  habitacion_id: z.string().uuid(),
  tipo:          z.string().min(1).max(50),
  descripcion:   z.string().min(1),
  nivel_alerta:  z.string().min(1).max(10),
  frecuencia:    z.number().int().positive().optional(),
});

const listQuerySchema = z.object({
  activa:        z.string().optional(),
  nivel:         z.string().optional(),
  tipo:          z.string().optional(),
  habitacion_id: z.string().uuid().optional(),
  page:          z.coerce.number().int().min(1).default(1),
  limit:         z.coerce.number().int().min(1).max(100).default(20),
});

export async function internalUpsert(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const data = upsertSchema.parse(req.body);
    const result = await service.upsertAlerta(data);
    res.status(201).json(result);
  } catch (err) {
    next(err);
  }
}

export async function listar(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const query = listQuerySchema.parse(req.query);
    const result = await service.listarAlertas(query);
    res.json(result);
  } catch (err) {
    next(err);
  }
}

export async function listarPorHabitacion(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const result = await service.listarAlertas({
      habitacion_id: req.params.id,
      activa:        'true',
      page:          1,
      limit:         50,
    });
    res.json(result.data);
  } catch (err) {
    next(err);
  }
}

export async function resolver(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const alerta = await service.resolverAlerta(req.params.id);
    if (!alerta) {
      res.status(404).json({ code: 'ALERTA_NO_ENCONTRADA', message: 'Alerta no encontrada' });
      return;
    }
    res.json(alerta);
  } catch (err) {
    next(err);
  }
}
