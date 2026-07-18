import { Router, Request, Response, NextFunction } from 'express';
import { authenticate } from '../middleware/auth';
import { requireNivelEmpresa } from '../middleware/plataforma';
import * as service from '../services/pronostico.service';

const router = Router();
// Con path explícito: este router se monta en app.use('/api/v1', empresaRouter) junto
// a muchos otros — un router.use(...) sin path intercepta TODA request bajo /api/v1,
// no solo las de este router (bloquearía p.ej. /api/v1/habitaciones con 403).
router.use('/empresa', authenticate, requireNivelEmpresa);

// ─── GET /empresa/pronostico-ocupacion ─────────────────────────────────────────

router.get('/empresa/pronostico-ocupacion', async (req: Request, res: Response, next: NextFunction) => {
  try {
    res.json(await service.pronosticoOcupacion(req.user!.empresaId!));
  } catch (err) { next(err); }
});

export default router;
