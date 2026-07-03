import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { resolverLocal, requirePermiso } from '../middleware/permisos';
import * as ctrl from '../controllers/turnos.controller';

const router = Router();

router.use(authenticate, resolverLocal);

// Historial de turnos cerrados — el controller filtra por permiso 'turnos.ver_todos'
router.get(
  '/',
  ctrl.listar,
);

// Abrir turno
router.post(
  '/abrir',
  requirePermiso('turnos.gestionar'),
  ctrl.abrir,
);

// Turno activo con resumen en tiempo real — ANTES de /:id para evitar colisión
router.get(
  '/activo',
  requirePermiso('turnos.gestionar'),
  ctrl.activo,
);

// Reporte del turno — ANTES de /:id/gastos y /:id/cerrar
router.get(
  '/:id/reporte/pdf',
  requirePermiso('turnos.gestionar'),
  ctrl.reportePDF,
);

router.get(
  '/:id/reporte',
  requirePermiso('turnos.gestionar'),
  ctrl.reporte,
);

// Gastos de caja
router.post(
  '/:id/gastos',
  requirePermiso('turnos.gestionar'),
  ctrl.registrarGasto,
);

router.get(
  '/:id/gastos',
  requirePermiso('turnos.gestionar'),
  ctrl.listarGastos,
);

// Cerrar turno
router.post(
  '/:id/cerrar',
  requirePermiso('turnos.gestionar'),
  ctrl.cerrar,
);

export default router;
