import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { TipoFolioItem, MetodoPago, TipoComprobante } from '@prisma/client';
import * as folio from '../services/folio.service';

// ─── Schemas de validación ────────────────────────────────────────────────────

const CargoSchema = z.object({
  tipo:            z.nativeEnum(TipoFolioItem),
  descripcion:     z.string().min(1).max(255),
  cantidad:        z.number().int().min(1),
  precio_unitario: z.number().positive(),
  fecha:           z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Formato YYYY-MM-DD requerido'),
  notas:           z.string().max(500).optional(),
});

const PagoSchema = z.object({
  metodo:              z.nativeEnum(MetodoPago),
  monto:               z.number().positive(),
  moneda:              z.string().length(3).optional(),
  referencia_externa:  z.string().max(255).optional(),
  tipo_comprobante:    z.nativeEnum(TipoComprobante).optional(),
  notas:               z.string().max(500).optional(),
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

function personalId(req: Request): string | undefined {
  return req.user?.sub;
}

// ─── Handlers ────────────────────────────────────────────────────────────────

export async function obtenerFolio(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await folio.obtenerFolio(req.params.id, req.localId);
    res.json(result);
  } catch (err) {
    next(err);
  }
}

export async function agregarCargo(req: Request, res: Response, next: NextFunction) {
  try {
    const parsed = CargoSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'VALIDACION', details: parsed.error.flatten() });
      return;
    }
    const result = await folio.agregarCargo(req.params.id, parsed.data, personalId(req), req.localId);
    res.status(201).json(result);
  } catch (err) {
    next(err);
  }
}

export async function anularCargo(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await folio.anularCargo(req.params.id, req.params.itemId, personalId(req), req.localId);
    res.json(result);
  } catch (err) {
    next(err);
  }
}

export async function registrarPago(req: Request, res: Response, next: NextFunction) {
  try {
    const parsed = PagoSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'VALIDACION', details: parsed.error.flatten() });
      return;
    }
    const result = await folio.registrarPago(req.params.id, parsed.data, personalId(req), req.localId);
    res.status(201).json(result);
  } catch (err) {
    next(err);
  }
}
