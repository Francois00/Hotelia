import { Router } from 'express';
import { RolPersonal } from '@prisma/client';
import { authenticate, authorize } from '../middleware/auth';
import * as ctrl from '../controllers/canales.controller';

const router = Router();

// Webhook endpoint: authenticated via HMAC, NOT via JWT
router.post('/webhook/:canal', ctrl.webhook);

// Sync log: internal — JWT + role required
router.get(
  '/sync-log',
  authenticate,
  authorize(RolPersonal.ADMIN, RolPersonal.GERENTE),
  ctrl.syncLog,
);

export default router;
