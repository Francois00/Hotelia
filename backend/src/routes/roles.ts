import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { authenticate } from '../middleware/auth';
import { requirePermiso } from '../middleware/permisos';
import * as service from '../services/roles.service';

const router = Router();
router.use(authenticate);

// ─── GET /roles, GET /permisos ─────────────────────────────────────────────────
// Catálogo estático — cualquier usuario autenticado puede leerlo (lo necesita el
// wizard de gestión de personal para armar los checkboxes de permisos).

router.get('/roles', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    res.json({ data: await service.listarRoles() });
  } catch (err) { next(err); }
});

router.get('/permisos', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    res.json({ data: await service.listarPermisos() });
  } catch (err) { next(err); }
});

// ─── GET /personal ──────────────────────────────────────────────────────────────

router.get('/personal', requirePermiso('personal.gestionar'), async (_req: Request, res: Response, next: NextFunction) => {
  try {
    res.json({ data: await service.listarPersonal() });
  } catch (err) { next(err); }
});

const crearPersonalSchema = z.object({
  nombre:     z.string().min(1).max(100),
  apellido:   z.string().min(1).max(100),
  email:      z.string().email(),
  password:   z.string().min(8, 'La contraseña debe tener al menos 8 caracteres'),
  local_id:   z.string().uuid(),
  rol_codigo: z.string().min(1),
});

router.post('/personal', requirePermiso('personal.gestionar'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = crearPersonalSchema.parse(req.body);
    const personal = await service.crearPersonal(data);
    res.status(201).json(personal);
  } catch (err) { next(err); }
});

const accesosSchema = z.object({
  locales: z.array(z.object({
    local_id:     z.string().uuid(),
    rol_codigo:   z.string().min(1),
    puede_operar: z.boolean().optional(),
  })).min(1),
});

router.put('/personal/:id/accesos', requirePermiso('personal.gestionar'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { locales } = accesosSchema.parse(req.body);
    const resultado = await service.actualizarAccesos(req.params.id, locales);
    res.json({ data: resultado });
  } catch (err) { next(err); }
});

export default router;
