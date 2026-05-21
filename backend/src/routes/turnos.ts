import { Router } from 'express';
import { RolPersonal } from '@prisma/client';
import { authenticate, authorize } from '../middleware/auth';
import * as ctrl from '../controllers/turnos.controller';

const router = Router();

router.use(authenticate);

// Historial de turnos cerrados
router.get(
  '/',
  authorize(RolPersonal.GERENTE, RolPersonal.RECEPCIONISTA, RolPersonal.ADMIN),
  ctrl.listar,
);

// Abrir turno
router.post(
  '/abrir',
  authorize(RolPersonal.GERENTE, RolPersonal.RECEPCIONISTA, RolPersonal.ADMIN),
  ctrl.abrir,
);

// Turno activo con resumen en tiempo real — ANTES de /:id para evitar colisión
router.get(
  '/activo',
  authorize(RolPersonal.GERENTE, RolPersonal.RECEPCIONISTA, RolPersonal.ADMIN),
  ctrl.activo,
);

// Reporte del turno — ANTES de /:id/gastos y /:id/cerrar
router.get(
  '/:id/reporte/pdf',
  authorize(RolPersonal.GERENTE, RolPersonal.RECEPCIONISTA, RolPersonal.ADMIN),
  ctrl.reportePDF,
);

router.get(
  '/:id/reporte',
  authorize(RolPersonal.GERENTE, RolPersonal.RECEPCIONISTA, RolPersonal.ADMIN),
  ctrl.reporte,
);

// Gastos de caja
router.post(
  '/:id/gastos',
  authorize(RolPersonal.GERENTE, RolPersonal.RECEPCIONISTA, RolPersonal.ADMIN),
  ctrl.registrarGasto,
);

router.get(
  '/:id/gastos',
  authorize(RolPersonal.GERENTE, RolPersonal.RECEPCIONISTA, RolPersonal.ADMIN),
  ctrl.listarGastos,
);

// Cerrar turno
router.post(
  '/:id/cerrar',
  authorize(RolPersonal.GERENTE, RolPersonal.RECEPCIONISTA, RolPersonal.ADMIN),
  ctrl.cerrar,
);

export default router;
