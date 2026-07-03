import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { requirePermiso } from '../middleware/permisos';
import * as ctrl from '../controllers/revenue.controller';

const router = Router();

router.use(authenticate, requirePermiso('revenue.ver'));

router.get('/kpis',     ctrl.kpis);
router.get('/forecast', ctrl.forecast);

export default router;
