import path from 'path';
import { Router } from 'express';
import multer from 'multer';
import { authenticate } from '../middleware/auth';
import { resolverLocal, requirePermiso } from '../middleware/permisos';
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

router.use(authenticate, resolverLocal);

// Consultas — cualquier rol autenticado con acceso al local
router.get('/',            ctrl.listar);
router.get('/disponibles', ctrl.disponibles);
router.get('/:id',         ctrl.obtener);

// CRUD completo — solo gerente / admin
router.post(
  '/',
  requirePermiso('habitaciones.administrar'),
  ctrl.crear,
);

router.put(
  '/:id',
  requirePermiso('habitaciones.administrar'),
  ctrl.actualizar,
);

// Eliminación física — solo gerente
router.delete(
  '/:id/permanente',
  requirePermiso('habitaciones.administrar'),
  ctrl.eliminar,
);

// Baja lógica (fuera_de_servicio) — solo gerente
router.delete(
  '/:id',
  requirePermiso('habitaciones.administrar'),
  ctrl.darDeBaja,
);

// Fotos
router.post(
  '/:id/fotos',
  requirePermiso('habitaciones.administrar'),
  upload.array('fotos', 10),
  ctrl.subirFotos,
);

router.patch(
  '/:id/fotos',
  requirePermiso('habitaciones.administrar'),
  ctrl.reordenarFotos,
);

// Cambiar estado — operativo (housekeeping, mantenimiento, gerente)
router.patch(
  '/:id/estado',
  requirePermiso('habitaciones.estado.cambiar'),
  ctrl.cambiarEstado,
);

export default router;
