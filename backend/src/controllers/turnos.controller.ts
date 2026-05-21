import type { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { TipoTurno } from '@prisma/client';
import * as service from '../services/turnos.service';
import { RolPersonal } from '@prisma/client';

// ─── Schemas ──────────────────────────────────────────────────────────────────

const abrirTurnoSchema = z.object({
  tipo:          z.nativeEnum(TipoTurno),
  saldo_inicial: z.number().min(0),
});

const registrarGastoSchema = z.object({
  concepto:              z.string().min(1).max(200),
  monto:                 z.number().positive(),
  comprobante_proveedor: z.string().max(50).optional(),
});

const cerrarTurnoSchema = z.object({
  pin: z.string().min(1, 'Se requiere el PIN o contraseña'),
});

const listarQuerySchema = z.object({
  fecha:            z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  tipo:             z.nativeEnum(TipoTurno).optional(),
  recepcionista_id: z.string().uuid().optional(),
  page:             z.coerce.number().int().min(1).default(1),
  limit:            z.coerce.number().int().min(1).max(100).default(20),
});

// ─── Handlers ─────────────────────────────────────────────────────────────────

// POST /api/v1/turnos/abrir
export async function abrir(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const data  = abrirTurnoSchema.parse(req.body);
    const turno = await service.abrirTurno({
      tipo:          data.tipo,
      saldo_inicial: data.saldo_inicial,
      personal_id:   req.user!.sub,
    });
    res.status(201).json(turno);
  } catch (err) { next(err); }
}

// GET /api/v1/turnos/activo
export async function activo(_req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const resultado = await service.obtenerTurnoActivo();
    res.json(resultado);
  } catch (err) { next(err); }
}

// POST /api/v1/turnos/:id/gastos
export async function registrarGasto(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const data  = registrarGastoSchema.parse(req.body);
    const gasto = await service.registrarGasto({
      turno_id:              req.params.id,
      concepto:              data.concepto,
      monto:                 data.monto,
      comprobante_proveedor: data.comprobante_proveedor,
      registrado_por_id:     req.user!.sub,
    });
    res.status(201).json(gasto);
  } catch (err) { next(err); }
}

// GET /api/v1/turnos/:id/gastos
export async function listarGastos(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const gastos = await service.listarGastos(req.params.id);
    res.json({ data: gastos, total: gastos.length });
  } catch (err) { next(err); }
}

// POST /api/v1/turnos/:id/cerrar
export async function cerrar(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { pin } = cerrarTurnoSchema.parse(req.body);
    const result  = await service.cerrarTurno(req.params.id, pin);
    res.json(result);
  } catch (err) { next(err); }
}

// GET /api/v1/turnos/:id/reporte
export async function reporte(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const data = await service.obtenerReporte(req.params.id);
    res.json(data);
  } catch (err) { next(err); }
}

// GET /api/v1/turnos/:id/reporte/pdf
export async function reportePDF(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const pdfBuffer = await service.obtenerPDF(req.params.id);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="reporte-turno-${req.params.id}.pdf"`);
    res.send(pdfBuffer);
  } catch (err) { next(err); }
}

// GET /api/v1/turnos
export async function listar(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const query = listarQuerySchema.parse(req.query);
    const esGerente =
      req.user?.rol === RolPersonal.GERENTE || req.user?.rol === RolPersonal.ADMIN;

    const resultado = await service.listarTurnos({
      ...query,
      solo_propios: !esGerente,
      personal_id:  req.user?.sub,
    });
    res.json(resultado);
  } catch (err) { next(err); }
}
