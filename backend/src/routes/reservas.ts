import { Router } from 'express';
import { RolPersonal } from '@prisma/client';
import { authenticate, authorize } from '../middleware/auth';
import * as ctrl from '../controllers/reservas.controller';
import folioRouter from './folio';

const router = Router();

router.use(authenticate);

router.post(
  '/',
  authorize(RolPersonal.ADMIN, RolPersonal.GERENTE, RolPersonal.RECEPCIONISTA),
  ctrl.crear,
);

router.get('/', ctrl.listar);

router.get('/:id', ctrl.obtener);

router.patch(
  '/:id/estado',
  authorize(RolPersonal.ADMIN, RolPersonal.GERENTE, RolPersonal.RECEPCIONISTA),
  ctrl.cambiarEstado,
);

// Soft-delete: solo ADMIN y GERENTE pueden cancelar vía DELETE
router.delete(
  '/:id',
  authorize(RolPersonal.ADMIN, RolPersonal.GERENTE),
  ctrl.eliminar,
);

// Modificar reserva con auditoría — recepción + gerente (precio solo gerente)
router.patch(
  '/:id/modificar',
  authorize(RolPersonal.ADMIN, RolPersonal.GERENTE, RolPersonal.RECEPCIONISTA),
  ctrl.modificar,
);

// Bitácora de cambios — solo gerente
router.get(
  '/:id/auditoria',
  authorize(RolPersonal.ADMIN, RolPersonal.GERENTE),
  ctrl.auditoria,
);

// Folio (cargos y pagos) anidado bajo /:id/folio
router.use('/:id/folio', folioRouter);

export default router;
