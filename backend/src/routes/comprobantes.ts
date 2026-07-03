import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { resolverLocal, requirePermiso } from '../middleware/permisos';
import { emitir, porReserva, listar } from '../controllers/comprobantes.controller';

const router = Router();
router.use(authenticate, resolverLocal);

router.post('/emitir',              requirePermiso('comprobantes.emitir'), emitir);
router.get('/reserva/:reserva_id',                                        porReserva);
router.get('/',                     requirePermiso('comprobantes.ver'),    listar);

export default router;
