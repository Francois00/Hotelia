import { Router } from 'express';
import { RolPersonal } from '@prisma/client';
import { authenticate, authorize } from '../middleware/auth';
import * as ctrl from '../controllers/checkin-manual.controller';

const router = Router();

router.use(authenticate);

// Habitaciones disponibles para check-in manual — debe ir ANTES de la ruta con body
// GET /api/v1/reservas/checkin-manual/disponibles
router.get(
  '/disponibles',
  authorize(RolPersonal.GERENTE, RolPersonal.RECEPCIONISTA, RolPersonal.ADMIN),
  ctrl.disponibles,
);

// Ejecutar check-in manual
// POST /api/v1/reservas/checkin-manual
router.post(
  '/',
  authorize(RolPersonal.GERENTE, RolPersonal.RECEPCIONISTA, RolPersonal.ADMIN),
  ctrl.checkinManual,
);

export default router;
