import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { authenticate } from '../middleware/auth';
import { resolverLocal, requirePermiso } from '../middleware/permisos';
import * as service from '../services/ical.service';
import { sincronizarTodasLasConexiones } from '../services/ical.service';

const router = Router();

router.use('/channel-manager/ical', authenticate, resolverLocal);

const crearSchema = z.object({
  habitacion_id: z.string().uuid(),
  canal: z.enum(['BOOKING_COM', 'EXPEDIA']),
  ical_url_externa: z.string().url().optional().nullable(),
});

const actualizarSchema = z.object({
  ical_url_externa: z.string().url().optional().nullable(),
  activo: z.boolean().optional(),
});

// ─── GET /channel-manager/ical — listar conexiones del local activo ────────────

router.get('/channel-manager/ical', async (req: Request, res: Response, next: NextFunction) => {
  try {
    res.json({ data: await service.listarConexiones(req.localId, req.empresaId) });
  } catch (err) { next(err); }
});

// ─── POST /channel-manager/ical — crear conexión ───────────────────────────────

router.post(
  '/channel-manager/ical',
  requirePermiso('channel_manager.gestionar'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = crearSchema.parse(req.body);
      res.status(201).json(await service.crearConexion(data, req.localId));
    } catch (err) { next(err); }
  },
);

// ─── PATCH /channel-manager/ical/:id ────────────────────────────────────────────

router.patch(
  '/channel-manager/ical/:id',
  requirePermiso('channel_manager.gestionar'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = actualizarSchema.parse(req.body);
      res.json(await service.actualizarConexion(req.params.id, data, req.localId));
    } catch (err) { next(err); }
  },
);

// ─── DELETE /channel-manager/ical/:id ───────────────────────────────────────────

router.delete(
  '/channel-manager/ical/:id',
  requirePermiso('channel_manager.gestionar'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      res.json(await service.eliminarConexion(req.params.id, req.localId));
    } catch (err) { next(err); }
  },
);

// ─── POST /channel-manager/ical/sync-ahora — forzar sync manual ───────────────

router.post(
  '/channel-manager/ical/sync-ahora',
  requirePermiso('channel_manager.gestionar'),
  async (_req: Request, res: Response, next: NextFunction) => {
    try {
      await sincronizarTodasLasConexiones();
      res.json({ ok: true, mensaje: 'Sincronización ejecutada' });
    } catch (err) { next(err); }
  },
);

export default router;
