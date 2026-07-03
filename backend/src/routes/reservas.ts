import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { resolverLocal, requirePermiso } from '../middleware/permisos';
import * as ctrl from '../controllers/reservas.controller';
import folioRouter from './folio';

const router = Router();

router.use(authenticate, resolverLocal);

router.post(
  '/',
  requirePermiso('reservas.gestionar'),
  ctrl.crear,
);

router.get('/', ctrl.listar);

router.get('/:id', ctrl.obtener);

router.patch(
  '/:id/estado',
  requirePermiso('reservas.gestionar'),
  ctrl.cambiarEstado,
);

// Soft-delete: solo ADMIN y GERENTE pueden cancelar vía DELETE
router.delete(
  '/:id',
  requirePermiso('reservas.anular'),
  ctrl.eliminar,
);

// Modificar reserva con auditoría — recepción + gerente (precio solo gerente)
router.patch(
  '/:id/modificar',
  requirePermiso('reservas.gestionar'),
  ctrl.modificar,
);

// Bitácora de cambios — solo gerente
router.get(
  '/:id/auditoria',
  requirePermiso('reservas.anular'),
  ctrl.auditoria,
);

// Folio (cargos y pagos) anidado bajo /:id/folio
router.use('/:id/folio', folioRouter);

export default router;
