import type { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { AppError } from '../lib/errors';

const crearSchema = z.object({
  nombre:      z.string().min(1).max(50),
  descripcion: z.string().max(1000).optional(),
  color_mapa:  z.string().regex(/^#[0-9a-fA-F]{6}$/, 'color_mapa debe ser formato #RRGGBB').default('#3B82F6'),
});

const actualizarSchema = crearSchema.partial();

// GET /api/v1/tipos-habitacion
export async function listar(_req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const tipos = await prisma.tipoHabitacionCustom.findMany({
      where:   { activo: true },
      orderBy: { nombre: 'asc' },
    });
    // Incluir también los tipos predefinidos del enum como referencia
    const predefinidos = ['SIMPLE', 'DOBLE', 'SUITE', 'FAMILIAR'].map((t) => ({
      id:          null,
      nombre:      t,
      descripcion: null,
      color_mapa:  '#6B7280',
      activo:      true,
      predefinido: true,
    }));
    res.json({ predefinidos, personalizados: tipos });
  } catch (err) { next(err); }
}

// POST /api/v1/tipos-habitacion
export async function crear(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const data = crearSchema.parse(req.body);
    const tipo = await prisma.tipoHabitacionCustom.create({ data });
    res.status(201).json(tipo);
  } catch (err) { next(err); }
}

// PUT /api/v1/tipos-habitacion/:id
export async function actualizar(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const existe = await prisma.tipoHabitacionCustom.findUnique({ where: { id: req.params.id } });
    if (!existe) throw new AppError('TIPO_NO_ENCONTRADO', 404, 'Tipo de habitación no encontrado');

    const data  = actualizarSchema.parse(req.body);
    const tipo  = await prisma.tipoHabitacionCustom.update({ where: { id: req.params.id }, data });
    res.json(tipo);
  } catch (err) { next(err); }
}

// DELETE /api/v1/tipos-habitacion/:id — desactivar (baja lógica)
export async function desactivar(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const existe = await prisma.tipoHabitacionCustom.findUnique({ where: { id: req.params.id } });
    if (!existe) throw new AppError('TIPO_NO_ENCONTRADO', 404, 'Tipo de habitación no encontrado');

    const tipo = await prisma.tipoHabitacionCustom.update({
      where: { id: req.params.id },
      data:  { activo: false },
    });
    res.json(tipo);
  } catch (err) { next(err); }
}
