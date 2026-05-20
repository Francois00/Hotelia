import type { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { EstadoHabitacion, TipoHabitacion } from '@prisma/client';
import * as service from '../services/habitaciones.service';

// ─── Schemas ──────────────────────────────────────────────────────────────────

const listarQuerySchema = z.object({
  estado:       z.nativeEnum(EstadoHabitacion).optional(),
  tipo:         z.nativeEnum(TipoHabitacion).optional(),
  piso:         z.coerce.number().int().min(0).optional(),
  capacidad:    z.coerce.number().int().min(1).optional(),
  visible_otas: z.enum(['true', 'false']).transform((v) => v === 'true').optional(),
  page:         z.coerce.number().int().min(1).default(1),
  limit:        z.coerce.number().int().min(1).max(100).default(20),
});

const disponiblesQuerySchema = z
  .object({
    fecha_entrada: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Formato requerido: YYYY-MM-DD'),
    fecha_salida:  z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Formato requerido: YYYY-MM-DD'),
  })
  .refine((d) => new Date(d.fecha_salida) > new Date(d.fecha_entrada), {
    message: 'fecha_salida debe ser posterior a fecha_entrada',
    path:    ['fecha_salida'],
  });

const crearSchema = z.object({
  numero:            z.string().min(1).max(10),
  tipo:              z.nativeEnum(TipoHabitacion),
  piso:              z.number().int().min(0),
  capacidad:         z.number().int().min(1),
  capacidad_adultos: z.number().int().min(1).optional(),
  capacidad_ninos:   z.number().int().min(0).optional(),
  tarifa_base:       z.number().positive(),
  tarifa_minima:     z.number().positive().optional(),
  tarifa_maxima:     z.number().positive().optional(),
  moneda_tarifa:     z.string().length(3).default('PEN'),
  descripcion:       z.string().max(2000).optional(),
  amenidades:        z.unknown().optional(),
  visible_otas:      z.boolean().default(true),
  tipo_custom_id:    z.string().uuid().optional(),
});

const actualizarSchema = crearSchema.partial();

const cambiarEstadoSchema = z.object({
  estado: z.nativeEnum(EstadoHabitacion, { required_error: 'estado es requerido' }),
});

const reordenarFotosSchema = z.object({
  fotos: z.array(z.string()).max(10),
});

// ─── Handlers ─────────────────────────────────────────────────────────────────

export async function listar(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const query = listarQuerySchema.parse(req.query);
    const resultado = await service.listarHabitaciones(query);
    res.json(resultado);
  } catch (err) { next(err); }
}

export async function obtener(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const h = await service.obtenerHabitacion(req.params.id);
    res.json(h);
  } catch (err) { next(err); }
}

export async function crear(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const data = crearSchema.parse(req.body);
    const h = await service.crearHabitacion(data);
    res.status(201).json(h);
  } catch (err) { next(err); }
}

export async function actualizar(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const data = actualizarSchema.parse(req.body);
    const h = await service.actualizarHabitacion(req.params.id, data);
    res.json(h);
  } catch (err) { next(err); }
}

export async function darDeBaja(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const h = await service.darDeBajaHabitacion(req.params.id);
    res.json(h);
  } catch (err) { next(err); }
}

export async function eliminar(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const result = await service.eliminarHabitacion(req.params.id);
    res.json(result);
  } catch (err) { next(err); }
}

export async function subirFotos(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const archivos = (req.files as Express.Multer.File[] | undefined) ?? [];
    if (archivos.length === 0) {
      res.status(400).json({ code: 'SIN_ARCHIVOS', message: 'Se requiere al menos un archivo' });
      return;
    }
    const fotos = await service.subirFotos(req.params.id, archivos);
    res.json({ fotos });
  } catch (err) { next(err); }
}

export async function reordenarFotos(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { fotos } = reordenarFotosSchema.parse(req.body);
    const resultado = await service.reordenarFotos(req.params.id, fotos);
    res.json({ fotos: resultado });
  } catch (err) { next(err); }
}

export async function disponibles(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const query = disponiblesQuerySchema.parse(req.query);
    const habitaciones = await service.habitacionesDisponibles(query);
    res.json({ data: habitaciones, total: habitaciones.length });
  } catch (err) { next(err); }
}

export async function cambiarEstado(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { estado } = cambiarEstadoSchema.parse(req.body);
    const habitacion = await service.cambiarEstadoHabitacion(req.params.id, estado);
    res.json(habitacion);
  } catch (err) { next(err); }
}
