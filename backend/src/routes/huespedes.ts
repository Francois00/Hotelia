import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { resolverLocal, requirePermiso } from '../middleware/permisos';
import * as ctrl from '../controllers/huespedes.controller';

const router = Router();

router.use(authenticate, resolverLocal);

router.post(
  '/',
  requirePermiso('huespedes.gestionar'),
  ctrl.crear,
);

router.get('/', ctrl.listar);

// /historial must be registered before /:id to avoid Express treating it as a param
router.get('/:id/historial', ctrl.historial);

router.get('/:id', ctrl.obtener);

router.patch(
  '/:id',
  requirePermiso('huespedes.gestionar'),
  ctrl.actualizar,
);

router.delete(
  '/:id',
  requirePermiso('huespedes.eliminar'),
  ctrl.eliminar,
);

export default router;
