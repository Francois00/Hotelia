import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { resolverLocal, requirePermiso } from '../middleware/permisos';
import * as ctrl from '../controllers/tipos-habitacion.controller';

const router = Router();

router.use(authenticate, resolverLocal);

router.get('/', ctrl.listar);

router.post(
  '/',
  requirePermiso('habitaciones.tipos.gestionar'),
  ctrl.crear,
);

router.put(
  '/:id',
  requirePermiso('habitaciones.tipos.gestionar'),
  ctrl.actualizar,
);

router.delete(
  '/:id',
  requirePermiso('habitaciones.tipos.gestionar'),
  ctrl.desactivar,
);

export default router;
