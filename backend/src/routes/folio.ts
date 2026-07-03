import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { resolverLocal, requirePermiso } from '../middleware/permisos';
import * as ctrl from '../controllers/folio.controller';

const router = Router({ mergeParams: true });

router.use(authenticate, resolverLocal);

router.get('/', ctrl.obtenerFolio);

router.post(
  '/items',
  requirePermiso('folio.gestionar'),
  ctrl.agregarCargo,
);

router.delete(
  '/items/:itemId',
  requirePermiso('folio.gestionar'),
  ctrl.anularCargo,
);

router.post(
  '/pagos',
  requirePermiso('folio.gestionar'),
  ctrl.registrarPago,
);

export default router;
