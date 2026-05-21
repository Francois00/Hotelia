import type { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { consultarDNI, consultarRUC } from '../services/reniec.service';

const dniParamSchema   = z.string().regex(/^\d{8}$/,  'El DNI debe tener exactamente 8 dígitos');
const rucParamSchema   = z.string().regex(/^\d{11}$/, 'El RUC debe tener exactamente 11 dígitos');

// GET /api/v1/clientes/reniec/:dni
export async function porDNI(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const dni = dniParamSchema.parse(req.params.dni);
    const datos = await consultarDNI(dni);
    if (datos) {
      res.json({ encontrado: true, ...datos });
    } else {
      res.json({ encontrado: false, nombres: null, apellidos: null, fecha_nacimiento: null, direccion: null });
    }
  } catch (err) { next(err); }
}

// GET /api/v1/clientes/sunat/:ruc
export async function porRUC(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const ruc = rucParamSchema.parse(req.params.ruc);
    const datos = await consultarRUC(ruc);
    if (datos) {
      res.json({ encontrado: true, ...datos });
    } else {
      res.json({ encontrado: false, razon_social: null, estado: null, condicion: null, direccion: null, ubigeo: null });
    }
  } catch (err) { next(err); }
}
