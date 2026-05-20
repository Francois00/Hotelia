import path from 'path';
import { Router } from 'express';
import multer from 'multer';
import { RolPersonal } from '@prisma/client';
import { authenticate, authorize } from '../middleware/auth';
import * as ctrl from '../controllers/habitaciones.controller';

const router = Router();

// Fotos: guardar en memoria, el service escribe al disco
const upload = multer({
  storage: multer.memoryStorage(),
  limits:  { fileSize: 5 * 1024 * 1024 }, // 5 MB por foto
  fileFilter: (_req, file, cb) => {
    const allowed = ['.jpg', '.jpeg', '.png', '.webp'];
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, allowed.includes(ext));
  },
});

router.use(authenticate);

// Consultas — cualquier rol autenticado
router.get('/',            ctrl.listar);
router.get('/disponibles', ctrl.disponibles);
router.get('/:id',         ctrl.obtener);

// CRUD completo — solo gerente / admin
router.post(
  '/',
  authorize(RolPersonal.GERENTE, RolPersonal.ADMIN),
  ctrl.crear,
);

router.put(
  '/:id',
  authorize(RolPersonal.GERENTE, RolPersonal.ADMIN),
  ctrl.actualizar,
);

// Eliminación física — solo gerente
router.delete(
  '/:id/permanente',
  authorize(RolPersonal.GERENTE, RolPersonal.ADMIN),
  ctrl.eliminar,
);

// Baja lógica (fuera_de_servicio) — solo gerente
router.delete(
  '/:id',
  authorize(RolPersonal.GERENTE, RolPersonal.ADMIN),
  ctrl.darDeBaja,
);

// Fotos
router.post(
  '/:id/fotos',
  authorize(RolPersonal.GERENTE, RolPersonal.ADMIN),
  upload.array('fotos', 10),
  ctrl.subirFotos,
);

router.patch(
  '/:id/fotos',
  authorize(RolPersonal.GERENTE, RolPersonal.ADMIN),
  ctrl.reordenarFotos,
);

// Cambiar estado — operativo (housekeeping, mantenimiento, gerente)
router.patch(
  '/:id/estado',
  authorize(
    RolPersonal.ADMIN,
    RolPersonal.GERENTE,
    RolPersonal.HOUSEKEEPING,
    RolPersonal.MANTENIMIENTO,
  ),
  ctrl.cambiarEstado,
);

export default router;
