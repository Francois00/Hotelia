import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { resolverLocal, requirePermiso } from '../middleware/permisos';
import * as ctrl from '../controllers/reglas-temporada.controller';

const router = Router();

router.use(authenticate, resolverLocal);

router.get('/', ctrl.listar);

router.post(
  '/',
  requirePermiso('tarifas.reglas.gestionar'),
  ctrl.crear,
);

router.put(
  '/:id',
  requirePermiso('tarifas.reglas.gestionar'),
  ctrl.actualizar,
);

router.delete(
  '/:id',
  requirePermiso('tarifas.reglas.gestionar'),
  ctrl.desactivar,
);

export default router;
