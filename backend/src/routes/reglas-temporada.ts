import { Router } from 'express';
import { RolPersonal } from '@prisma/client';
import { authenticate, authorize } from '../middleware/auth';
import * as ctrl from '../controllers/reglas-temporada.controller';

const router = Router();

router.use(authenticate);

router.get('/', ctrl.listar);

router.post(
  '/',
  authorize(RolPersonal.GERENTE, RolPersonal.ADMIN),
  ctrl.crear,
);

router.put(
  '/:id',
  authorize(RolPersonal.GERENTE, RolPersonal.ADMIN),
  ctrl.actualizar,
);

router.delete(
  '/:id',
  authorize(RolPersonal.GERENTE, RolPersonal.ADMIN),
  ctrl.desactivar,
);

export default router;
