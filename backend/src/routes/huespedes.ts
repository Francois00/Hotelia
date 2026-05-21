import { Router } from 'express';
import { RolPersonal } from '@prisma/client';
import { authenticate, authorize } from '../middleware/auth';
import * as ctrl from '../controllers/huespedes.controller';

const router = Router();

router.use(authenticate);

router.post(
  '/',
  authorize(RolPersonal.ADMIN, RolPersonal.GERENTE, RolPersonal.RECEPCIONISTA),
  ctrl.crear,
);

router.get('/', ctrl.listar);

// /historial must be registered before /:id to avoid Express treating it as a param
router.get('/:id/historial', ctrl.historial);

router.get('/:id', ctrl.obtener);

router.patch(
  '/:id',
  authorize(RolPersonal.ADMIN, RolPersonal.GERENTE, RolPersonal.RECEPCIONISTA),
  ctrl.actualizar,
);

router.delete(
  '/:id',
  authorize(RolPersonal.ADMIN, RolPersonal.GERENTE),
  ctrl.eliminar,
);

export default router;
