import { Router } from 'express';
import { RolPersonal } from '@prisma/client';
import { authenticate, authorize } from '../middleware/auth';
import * as ctrl from '../controllers/clientes.controller';

const router = Router();

router.use(authenticate);

// Consulta DNI en RENIEC
router.get(
  '/reniec/:dni',
  authorize(RolPersonal.GERENTE, RolPersonal.RECEPCIONISTA, RolPersonal.ADMIN),
  ctrl.porDNI,
);

// Consulta RUC en SUNAT
router.get(
  '/sunat/:ruc',
  authorize(RolPersonal.GERENTE, RolPersonal.RECEPCIONISTA, RolPersonal.ADMIN),
  ctrl.porRUC,
);

export default router;
