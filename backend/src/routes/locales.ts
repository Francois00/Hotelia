import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { authenticate } from '../middleware/auth';
import { requirePermiso } from '../middleware/permisos';
import * as service from '../services/locales.service';

const router = Router();
router.use(authenticate);

const crearLocalSchema = z.object({
  codigo:       z.string().min(1).max(30),
  nombre:       z.string().min(1).max(150),
  ruc:          z.string().max(11).optional(),
  razon_social: z.string().max(200).optional(),
  direccion:    z.string().max(500).optional(),
  ciudad:       z.string().max(100).optional(),
  color_tema:   z.string().max(7).optional(),
  telefono:     z.string().max(20).optional(),
  email:        z.string().email().optional(),
});

const actualizarLocalSchema = crearLocalSchema.partial().omit({ codigo: true });

const cambiarEstadoSchema = z.object({
  estado:      z.enum(['activo', 'pausado', 'remodelacion', 'inactivo']),
  razon_pausa: z.string().max(500).optional(),
});

// ─── GET /locales ─────────────────────────────────────────────────────────────
// Cualquier usuario autenticado ve los locales a los que tiene acceso
// (todos si es de alcance global). ?todos=true incluye los pausados/inactivos.

router.get('/locales', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const incluirTodos = req.query.todos === 'true';
    const locales = await service.listarLocales(req.user!, incluirTodos);
    res.json({ data: locales });
  } catch (err) { next(err); }
});

// ─── GET /locales/dashboard-consolidado ───────────────────────────────────────

router.get(
  '/locales/dashboard-consolidado',
  requirePermiso('dashboard.consolidado.ver'),
  async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await service.dashboardConsolidado();
      res.json(data);
    } catch (err) { next(err); }
  },
);

// ─── POST /locales ─────────────────────────────────────────────────────────────

router.post('/locales', requirePermiso('locales.gestionar'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = crearLocalSchema.parse(req.body);
    const local = await service.crearLocal(data);
    res.status(201).json(local);
  } catch (err) { next(err); }
});

// ─── PUT /locales/:id ──────────────────────────────────────────────────────────

router.put('/locales/:id', requirePermiso('locales.gestionar'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = actualizarLocalSchema.parse(req.body);
    const local = await service.actualizarLocal(req.params.id, data);
    res.json(local);
  } catch (err) { next(err); }
});

// ─── PATCH /locales/:id/estado ─────────────────────────────────────────────────

router.patch('/locales/:id/estado', requirePermiso('locales.gestionar'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { estado, razon_pausa } = cambiarEstadoSchema.parse(req.body);
    const local = await service.cambiarEstadoLocal(req.params.id, estado, razon_pausa);
    res.json(local);
  } catch (err) { next(err); }
});

export default router;
