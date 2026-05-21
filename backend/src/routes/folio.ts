import { Router } from 'express';
import { RolPersonal } from '@prisma/client';
import { authenticate, authorize } from '../middleware/auth';
import * as ctrl from '../controllers/folio.controller';

const router = Router({ mergeParams: true });

router.use(authenticate);

router.get('/', ctrl.obtenerFolio);

router.post(
  '/items',
  authorize(RolPersonal.ADMIN, RolPersonal.GERENTE, RolPersonal.RECEPCIONISTA),
  ctrl.agregarCargo,
);

router.delete(
  '/items/:itemId',
  authorize(RolPersonal.ADMIN, RolPersonal.GERENTE, RolPersonal.RECEPCIONISTA),
  ctrl.anularCargo,
);

router.post(
  '/pagos',
  authorize(RolPersonal.ADMIN, RolPersonal.GERENTE, RolPersonal.RECEPCIONISTA),
  ctrl.registrarPago,
);

export default router;
