import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth';
import { RolPersonal } from '@prisma/client';
import { iniciar, confirmar, reembolso, porReserva } from '../controllers/pagos.controller';

const router = Router();
const staff  = [RolPersonal.RECEPCIONISTA, RolPersonal.GERENTE, RolPersonal.ADMIN];
const mgmt   = [RolPersonal.GERENTE, RolPersonal.ADMIN];

router.post('/iniciar',               authenticate, authorize(...staff),  iniciar);
router.post('/confirmar',             authenticate, authorize(...staff),  confirmar);
router.post('/:id/reembolso',         authenticate, authorize(...mgmt),   reembolso);
router.get('/reserva/:reserva_id',    authenticate,                       porReserva);

export default router;
