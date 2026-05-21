import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth';
import { RolPersonal } from '@prisma/client';
import { emitir, porReserva, listar } from '../controllers/comprobantes.controller';

const router = Router();
const staff  = [RolPersonal.RECEPCIONISTA, RolPersonal.GERENTE, RolPersonal.ADMIN];
const mgmt   = [RolPersonal.GERENTE, RolPersonal.ADMIN];

router.post('/emitir',              authenticate, authorize(...staff), emitir);
router.get('/reserva/:reserva_id', authenticate,                     porReserva);
router.get('/',                    authenticate, authorize(...mgmt),  listar);

export default router;
