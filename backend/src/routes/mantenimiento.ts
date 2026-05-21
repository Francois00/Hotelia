import { Router } from 'express';
import { RolPersonal } from '@prisma/client';
import { authenticate, authorize } from '../middleware/auth';
import * as ctrl from '../controllers/mantenimiento.controller';

const router = Router();

router.use(authenticate);

// GET  /api/v1/habitaciones/:id/mantenimiento
router.get(
  '/habitaciones/:id/mantenimiento',
  ctrl.listar,
);

// POST /api/v1/habitaciones/:id/mantenimiento
router.post(
  '/habitaciones/:id/mantenimiento',
  authorize(RolPersonal.ADMIN, RolPersonal.GERENTE, RolPersonal.RECEPCIONISTA, RolPersonal.MANTENIMIENTO),
  ctrl.crear,
);

// PATCH /api/v1/mantenimiento/:id
router.patch(
  '/mantenimiento/:id',
  authorize(RolPersonal.ADMIN, RolPersonal.GERENTE, RolPersonal.RECEPCIONISTA, RolPersonal.MANTENIMIENTO),
  ctrl.actualizar,
);

export default router;
