import { Router } from 'express';
import { rateLimitMiddleware } from '../middleware/rate-limit';
import * as ctrl from '../controllers/auth.controller';

const router = Router();

// 5 intentos por IP cada 15 minutos (900 s)
const loginRateLimit = rateLimitMiddleware({
  max: 5,
  windowSec: 900,
  keyPrefix: 'ratelimit:login',
});

router.post('/login', loginRateLimit, ctrl.login);

export default router;
