import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { resolverLocal, requirePermiso } from '../middleware/permisos';
import { iniciar, confirmar, reembolso, porReserva } from '../controllers/pagos.controller';

const router = Router();
router.use(authenticate, resolverLocal);

router.post('/iniciar',               requirePermiso('pagos.procesar'),    iniciar);
router.post('/confirmar',             requirePermiso('pagos.procesar'),    confirmar);
router.post('/:id/reembolso',         requirePermiso('pagos.reembolsar'),  reembolso);
router.get('/reserva/:reserva_id',                                         porReserva);

export default router;
