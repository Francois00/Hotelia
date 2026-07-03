import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { requirePermiso } from '../middleware/permisos';
import * as ctrl from '../controllers/canales.controller';

const router = Router();

// Webhook endpoint: authenticated via HMAC, NOT via JWT
router.post('/webhook/:canal', ctrl.webhook);

// Sync log: internal — JWT + role required
router.get(
  '/sync-log',
  authenticate,
  requirePermiso('channel_manager.gestionar'),
  ctrl.syncLog,
);

export default router;
