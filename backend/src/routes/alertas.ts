import { Router } from 'express';
import { RolPersonal } from '@prisma/client';
import { authenticate, authorize } from '../middleware/auth';
import * as ctrl from '../controllers/alertas.controller';

const router = Router();

router.use(authenticate);

// All active alerts (admin/gerente)
router.get(
  '/',
  authorize(RolPersonal.ADMIN, RolPersonal.GERENTE),
  ctrl.listar,
);

// Alerts for a specific room
router.get(
  '/habitacion/:id',
  authorize(RolPersonal.ADMIN, RolPersonal.GERENTE, RolPersonal.MANTENIMIENTO),
  ctrl.listarPorHabitacion,
);

// Resolve an alert
router.patch(
  '/:id/resolver',
  authorize(RolPersonal.ADMIN, RolPersonal.GERENTE, RolPersonal.MANTENIMIENTO),
  ctrl.resolver,
);

export default router;
