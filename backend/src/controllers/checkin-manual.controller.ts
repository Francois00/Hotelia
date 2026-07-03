import type { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { MetodoPago, TipoComprobante } from '@prisma/client';
import { ejecutarCheckinManual, listarDisponiblesParaCheckin, upsertHuesped } from '../services/checkin-manual.service';

// ─── Schemas ──────────────────────────────────────────────────────────────────

const itemPagoSchema = z.object({
  metodo:     z.nativeEnum(MetodoPago),
  monto:      z.number().positive(),
  referencia: z.string().max(100).optional(),
});

const checkinManualSchema = z.object({
  huesped_id:              z.string().uuid(),
  habitacion_id:           z.string().uuid(),
  fecha_entrada:           z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  numero_noches:           z.number().int().min(1),
  numero_personas:         z.number().int().min(1),
  precio_por_noche:        z.number().positive(),
  pagos:                   z.array(itemPagoSchema).min(1),
  tipo_comprobante:        z.nativeEnum(TipoComprobante),
  datos_facturacion:       z.object({
    ruc:          z.string(),
    razon_social: z.string(),
    direccion:    z.string().optional(),
    email:        z.string().email().optional(),
  }).optional().nullable(),
  canal_envio_comprobante: z.enum(['whatsapp', 'email', 'ambos', 'ninguno']).default('whatsapp'),
});

const disponiblesQuerySchema = z
  .object({
    fecha_entrada: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    fecha_salida:  z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    personas:      z.coerce.number().int().min(1).default(1),
  })
  .refine((d) => new Date(d.fecha_salida) > new Date(d.fecha_entrada), {
    message: 'fecha_salida debe ser posterior a fecha_entrada',
    path:    ['fecha_salida'],
  });

const upsertHuespedSchema = z.object({
  tipo_documento:           z.string(),
  numero_documento:         z.string().min(5).max(20),
  nombres:                  z.string().min(1).max(100),
  apellidos:                z.string().min(1).max(100),
  email:                    z.string().email().optional(),
  telefono:                 z.string().max(20).optional(),
  nacionalidad:             z.string().max(50).optional(),
  notas_internas:           z.string().max(1000).optional(),
  fecha_vencimiento_doc:    z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

// ─── Handlers ─────────────────────────────────────────────────────────────────

// POST /api/v1/reservas/checkin-manual
export async function checkinManual(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const data   = checkinManualSchema.parse(req.body);
    const result = await ejecutarCheckinManual({
      ...data,
      datos_facturacion: data.datos_facturacion ?? null,
      personal_id:       req.user?.sub,
    }, req.localId);
    res.status(201).json(result);
  } catch (err) { next(err); }
}

// GET /api/v1/reservas/checkin-manual/disponibles
export async function disponibles(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const q    = disponiblesQuerySchema.parse(req.query);
    const data = await listarDisponiblesParaCheckin(q.fecha_entrada, q.fecha_salida, q.personas, req.localId);
    res.json({ data, total: data.length });
  } catch (err) { next(err); }
}

// POST /api/v1/huespedes/upsert
export async function upsertHuespedHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const data   = upsertHuespedSchema.parse(req.body);
    const result = await upsertHuesped(data);
    res.status(result.is_returning ? 200 : 201).json(result);
  } catch (err) { next(err); }
}
