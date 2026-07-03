import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { resolverLocal, requirePermiso } from '../middleware/permisos';
import * as ctrl from '../controllers/alertas.controller';

const router = Router();

router.use(authenticate, resolverLocal);

// All active alerts (admin/gerente)
router.get(
  '/',
  requirePermiso('alertas.gestionar'),
  ctrl.listar,
);

// Alerts for a specific room
router.get(
  '/habitacion/:id',
  requirePermiso('alertas.resolver'),
  ctrl.listarPorHabitacion,
);

// Resolve an alert
router.patch(
  '/:id/resolver',
  requirePermiso('alertas.resolver'),
  ctrl.resolver,
);

export default router;
