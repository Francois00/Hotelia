import type { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { EstadoReserva, CanalReserva, RolPersonal } from '@prisma/client';
import * as service from '../services/reservas.service';

// ─── Schemas de validación ────────────────────────────────────────────────────

const crearSchema = z
  .object({
    huesped_id:    z.string().uuid('huesped_id debe ser UUID'),
    habitacion_id: z.string().uuid('habitacion_id debe ser UUID'),
    fecha_entrada: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, 'Formato requerido: YYYY-MM-DD')
      .refine((d) => new Date(d) >= new Date(new Date().toISOString().slice(0, 10)), {
        message: 'fecha_entrada no puede ser en el pasado',
      }),
    fecha_salida: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, 'Formato requerido: YYYY-MM-DD'),
    canal_origen:    z.nativeEnum(CanalReserva),
    num_huespedes:   z.number({ required_error: 'num_huespedes es requerido' }).int().min(1),
    observaciones:   z.string().max(500).optional(),
    idempotency_key: z.string().max(100).optional(),
  })
  .refine((d) => new Date(d.fecha_salida) > new Date(d.fecha_entrada), {
    message: 'fecha_salida debe ser posterior a fecha_entrada',
    path: ['fecha_salida'],
  });

const listarQuerySchema = z.object({
  page:           z.coerce.number().int().min(1).default(1),
  limit:          z.coerce.number().int().min(1).max(100).default(20),
  estado:         z.nativeEnum(EstadoReserva).optional(),
  habitacion_id:  z.string().uuid().optional(),
  huesped_id:     z.string().uuid().optional(),
  huesped_nombre: z.string().max(100).optional(),
  codigo:         z.string().max(30).optional(),
  canal_origen:   z.nativeEnum(CanalReserva).optional(),
  fecha_entrada:  z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  fecha_salida:   z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  tab:            z.enum(['activos', 'historico']).optional(),
});

const modificarSchema = z.object({
  fecha_entrada:   z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  fecha_salida:    z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  habitacion_id:   z.string().uuid().optional(),
  canal:           z.nativeEnum(CanalReserva).optional(),
  tarifa_acordada: z.number().positive().optional(),
  adultos:         z.number().int().min(1).optional(),
  notas:           z.string().max(500).optional(),
  motivo:          z.string().min(5).max(300),
});

const cambiarEstadoSchema = z.object({
  estado:       z.nativeEnum(EstadoReserva, { required_error: 'estado es requerido' }),
  observaciones: z.string().max(500).optional(),
});

// ─── Handlers ─────────────────────────────────────────────────────────────────

export async function crear(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const data  = crearSchema.parse(req.body);
    const reserva = await service.crearReserva(data, req.user?.sub);
    res.status(201).json(reserva);
  } catch (err) {
    next(err);
  }
}

export async function listar(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const query    = listarQuerySchema.parse(req.query);
    const resultado = await service.listarReservas(query);
    res.json(resultado);
  } catch (err) {
    next(err);
  }
}

export async function obtener(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const reserva = await service.obtenerReserva(req.params.id);
    res.json(reserva);
  } catch (err) {
    next(err);
  }
}

export async function cambiarEstado(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { estado, observaciones } = cambiarEstadoSchema.parse(req.body);
    const reserva = await service.cambiarEstado(req.params.id, estado, observaciones);
    res.json(reserva);
  } catch (err) {
    next(err);
  }
}

export async function eliminar(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const reserva = await service.cancelarReserva(req.params.id);
    res.json(reserva);
  } catch (err) {
    next(err);
  }
}

export async function modificar(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const data = modificarSchema.parse(req.body);
    // Recepcionistas no pueden modificar precio
    if (
      data.tarifa_acordada !== undefined &&
      req.user?.rol === RolPersonal.RECEPCIONISTA
    ) {
      res.status(403).json({ code: 'SIN_PERMISO', message: 'Recepcionistas no pueden modificar la tarifa' });
      return;
    }
    const reserva = await service.modificarReserva(
      req.params.id,
      data,
      req.user?.sub ?? '',
      req.user?.email ?? '',
    );
    res.json(reserva);
  } catch (err) {
    next(err);
  }
}

export async function auditoria(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const logs = await service.obtenerAuditoria(req.params.id);
    res.json(logs);
  } catch (err) {
    next(err);
  }
}
