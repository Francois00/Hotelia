import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { resolverLocal, requirePermiso } from '../middleware/permisos';
import * as ctrl from '../controllers/mantenimiento.controller';

const router = Router();

router.use(authenticate);

// GET  /api/v1/habitaciones/:id/mantenimiento
router.get(
  '/habitaciones/:id/mantenimiento',
  resolverLocal,
  ctrl.listar,
);

// POST /api/v1/habitaciones/:id/mantenimiento
router.post(
  '/habitaciones/:id/mantenimiento',
  requirePermiso('mantenimiento.gestionar'),
  ctrl.crear,
);

// PATCH /api/v1/mantenimiento/:id
router.patch(
  '/mantenimiento/:id',
  requirePermiso('mantenimiento.gestionar'),
  ctrl.actualizar,
);

export default router;
