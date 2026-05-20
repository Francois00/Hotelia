import type { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { TipoDocumento, IdiomaPreferido, SegmentoHuesped } from '@prisma/client';
import * as service from '../services/huespedes.service';

// ─── Schemas de validación ────────────────────────────────────────────────────

const camposBase = {
  nombre:           z.string().min(2).max(100),
  apellido:         z.string().max(100).optional(),
  email:            z.string().email('email inválido'),
  telefono:         z.string().max(20).optional(),
  documento_tipo:   z.nativeEnum(TipoDocumento),
  documento_numero: z.string().min(5).max(20),
  nacionalidad:     z.string().max(60).optional(),
  idioma_preferido: z.nativeEnum(IdiomaPreferido).optional(),
  fecha_nacimiento: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Formato YYYY-MM-DD')
    .refine((d) => new Date(d) < new Date(), { message: 'Debe ser una fecha en el pasado' })
    .optional(),
  notas_internas: z.string().max(1000).optional(),
  preferencias:   z.record(z.unknown()).optional(),
};

const crearSchema = z.object({
  ...camposBase,
  nombre:           camposBase.nombre,
  email:            camposBase.email,
  documento_tipo:   camposBase.documento_tipo,
  documento_numero: camposBase.documento_numero,
});

const actualizarSchema = z.object({
  nombre:           camposBase.nombre.optional(),
  apellido:         camposBase.apellido,
  email:            camposBase.email.optional(),
  telefono:         camposBase.telefono,
  documento_tipo:   camposBase.documento_tipo.optional(),
  documento_numero: camposBase.documento_numero.optional(),
  nacionalidad:     camposBase.nacionalidad,
  idioma_preferido: camposBase.idioma_preferido,
  fecha_nacimiento: camposBase.fecha_nacimiento,
  notas_internas:   camposBase.notas_internas,
  preferencias:     camposBase.preferencias,
}).refine(
  (d) => Object.keys(d).length > 0,
  { message: 'Debe enviar al menos un campo para actualizar' },
);

const listarQuerySchema = z.object({
  nombre:       z.string().optional(),
  email:        z.string().optional(),
  documento:    z.string().optional(),
  segmento_crm: z.nativeEnum(SegmentoHuesped).optional(),
  page:         z.coerce.number().int().min(1).default(1),
  limit:        z.coerce.number().int().min(1).max(300).default(20),
});

// ─── Handlers ─────────────────────────────────────────────────────────────────

export async function crear(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const data    = crearSchema.parse(req.body);
    const huesped = await service.crearHuesped(data);
    res.status(201).json(huesped);
  } catch (err) {
    next(err);
  }
}

export async function listar(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const query     = listarQuerySchema.parse(req.query);
    const resultado = await service.listarHuespedes(query);
    res.json(resultado);
  } catch (err) {
    next(err);
  }
}

export async function obtener(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const huesped = await service.obtenerHuesped(req.params.id);
    res.json(huesped);
  } catch (err) {
    next(err);
  }
}

export async function historial(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const resultado = await service.obtenerHistorial(req.params.id);
    res.json(resultado);
  } catch (err) {
    next(err);
  }
}

export async function actualizar(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const data    = actualizarSchema.parse(req.body);
    const huesped = await service.actualizarHuesped(req.params.id, data);
    res.json(huesped);
  } catch (err) {
    next(err);
  }
}

export async function eliminar(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const huesped = await service.desactivarHuesped(req.params.id);
    res.json(huesped);
  } catch (err) {
    next(err);
  }
}
