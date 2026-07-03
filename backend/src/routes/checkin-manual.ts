import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { resolverLocal, requirePermiso } from '../middleware/permisos';
import * as ctrl from '../controllers/checkin-manual.controller';

const router = Router();

router.use(authenticate, resolverLocal);

// Habitaciones disponibles para check-in manual — debe ir ANTES de la ruta con body
// GET /api/v1/reservas/checkin-manual/disponibles
router.get(
  '/disponibles',
  requirePermiso('checkin.ejecutar'),
  ctrl.disponibles,
);

// Ejecutar check-in manual
// POST /api/v1/reservas/checkin-manual
router.post(
  '/',
  requirePermiso('checkin.ejecutar'),
  ctrl.checkinManual,
);

export default router;
