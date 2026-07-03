import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { resolverLocal, requirePermiso } from '../middleware/permisos';
import * as ctrl from '../controllers/clientes.controller';

const router = Router();

router.use(authenticate, resolverLocal);

// Consulta DNI en RENIEC
router.get(
  '/reniec/:dni',
  requirePermiso('huespedes.gestionar'),
  ctrl.porDNI,
);

// Consulta RUC en SUNAT
router.get(
  '/sunat/:ruc',
  requirePermiso('huespedes.gestionar'),
  ctrl.porRUC,
);

export default router;
