import { Router } from 'express';
import { RolPersonal } from '@prisma/client';
import { authenticate, authorize } from '../middleware/auth';
import * as ctrl from '../controllers/revenue.controller';

const router = Router();

router.use(authenticate, authorize(RolPersonal.ADMIN, RolPersonal.GERENTE));

router.get('/kpis',     ctrl.kpis);
router.get('/forecast', ctrl.forecast);

export default router;
