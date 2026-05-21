import type { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { TipoTemporada, Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { AppError } from '../lib/errors';

// Base object without refinements so we can call .partial() on it
const baseSchema = z.object({
  nombre:                z.string().min(1).max(100),
  tipo:                  z.nativeEnum(TipoTemporada),
  fecha_inicio:          z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  fecha_fin:             z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  ajuste_porcentaje:     z.number().min(-99).max(999),
  estadia_minima_noches: z.number().int().min(1).optional(),
  aplica_a_tipos:        z.array(z.string()).default([]),
});

const crearSchema = baseSchema
  .refine(
    (d) => {
      if (d.tipo === TipoTemporada.FIN_DE_SEMANA || d.tipo === TipoTemporada.ESTADIA_LARGA) return true;
      return d.fecha_inicio !== undefined && d.fecha_fin !== undefined;
    },
    { message: 'fecha_inicio y fecha_fin son requeridos para este tipo de regla', path: ['fecha_inicio'] },
  )
  .refine(
    (d) => {
      if (d.tipo !== TipoTemporada.ESTADIA_LARGA) return true;
      return d.estadia_minima_noches !== undefined;
    },
    { message: 'estadia_minima_noches es requerido para el tipo ESTADIA_LARGA', path: ['estadia_minima_noches'] },
  );

const actualizarSchema = baseSchema.partial();

// GET /api/v1/reglas-temporada
export async function listar(_req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const reglas = await prisma.reglaTemporada.findMany({
      orderBy: [{ activo: 'desc' }, { created_at: 'desc' }],
    });
    res.json({ data: reglas, total: reglas.length });
  } catch (err) { next(err); }
}

// POST /api/v1/reglas-temporada
export async function crear(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const d = crearSchema.parse(req.body);
    const regla = await prisma.reglaTemporada.create({
      data: {
        nombre:                d.nombre,
        tipo:                  d.tipo,
        fecha_inicio:          d.fecha_inicio ? new Date(d.fecha_inicio) : null,
        fecha_fin:             d.fecha_fin    ? new Date(d.fecha_fin)    : null,
        ajuste_porcentaje:     d.ajuste_porcentaje,
        estadia_minima_noches: d.estadia_minima_noches ?? null,
        aplica_a_tipos:        d.aplica_a_tipos as Prisma.InputJsonValue,
      },
    });
    res.status(201).json(regla);
  } catch (err) { next(err); }
}

// PUT /api/v1/reglas-temporada/:id
export async function actualizar(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const existe = await prisma.reglaTemporada.findUnique({ where: { id: req.params.id } });
    if (!existe) throw new AppError('REGLA_NO_ENCONTRADA', 404, 'Regla de temporada no encontrada');

    const d = actualizarSchema.parse(req.body);
    const regla = await prisma.reglaTemporada.update({
      where: { id: req.params.id },
      data:  {
        ...(d.nombre                !== undefined && { nombre:                d.nombre }),
        ...(d.tipo                  !== undefined && { tipo:                  d.tipo }),
        ...(d.ajuste_porcentaje     !== undefined && { ajuste_porcentaje:     d.ajuste_porcentaje }),
        ...(d.estadia_minima_noches !== undefined && { estadia_minima_noches: d.estadia_minima_noches }),
        ...(d.aplica_a_tipos        !== undefined && {
          aplica_a_tipos: d.aplica_a_tipos as Prisma.InputJsonValue,
        }),
        ...(d.fecha_inicio !== undefined && {
          fecha_inicio: d.fecha_inicio ? new Date(d.fecha_inicio) : null,
        }),
        ...(d.fecha_fin !== undefined && {
          fecha_fin: d.fecha_fin ? new Date(d.fecha_fin) : null,
        }),
      },
    });
    res.json(regla);
  } catch (err) { next(err); }
}

// DELETE /api/v1/reglas-temporada/:id — desactivar
export async function desactivar(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const existe = await prisma.reglaTemporada.findUnique({ where: { id: req.params.id } });
    if (!existe) throw new AppError('REGLA_NO_ENCONTRADA', 404, 'Regla de temporada no encontrada');

    const regla = await prisma.reglaTemporada.update({
      where: { id: req.params.id },
      data:  { activo: false },
    });
    res.json(regla);
  } catch (err) { next(err); }
}
