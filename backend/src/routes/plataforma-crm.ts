import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { authenticate } from '../middleware/auth';
import { requireSuperadminPlataforma } from '../middleware/plataforma';
import * as service from '../services/plataforma-crm.service';

const router = Router();
// Con path explícito — ver el mismo comentario en routes/empresa.ts: este router se
// monta en app.use('/api/v1', ...) junto a muchos otros, así que un router.use(...)
// sin path bloquearía cualquier request bajo /api/v1 que no sea superadmin.
router.use('/plataforma/crm', authenticate, requireSuperadminPlataforma);

const crearLeadSchema = z.object({
  nombre_contacto: z.string().min(1).max(150),
  nombre_empresa: z.string().max(150).optional(),
  telefono: z.string().max(20).optional(),
  email: z.string().email().optional(),
  origen: z.enum(['referido', 'redes_sociales', 'web', 'llamada_fria', 'otro']).optional(),
  valor_estimado: z.number().min(0).optional(),
  notas: z.string().optional(),
  proxima_accion: z.string().optional(),
  proxima_accion_fecha: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

const actualizarLeadSchema = crearLeadSchema.partial().extend({
  empresa_id: z.string().uuid().optional(),
});

const cambiarEstadoSchema = z.object({
  estado: z.enum(['nuevo', 'contactado', 'demo_agendada', 'en_prueba', 'negociacion', 'convertido', 'perdido']),
});

const interaccionSchema = z.object({
  tipo: z.enum(['llamada', 'email', 'whatsapp', 'reunion', 'nota']),
  descripcion: z.string().min(1),
});

// ─── GET /plataforma/crm/dashboard ──────────────────────────────────────────────

router.get('/plataforma/crm/dashboard', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    res.json(await service.dashboardCrm());
  } catch (err) { next(err); }
});

// ─── GET /plataforma/crm/leads ───────────────────────────────────────────────────

router.get('/plataforma/crm/leads', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    res.json({ data: await service.listarLeads() });
  } catch (err) { next(err); }
});

// ─── POST /plataforma/crm/leads ──────────────────────────────────────────────────

router.post('/plataforma/crm/leads', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = crearLeadSchema.parse(req.body);
    res.status(201).json(await service.crearLead(data));
  } catch (err) { next(err); }
});

// ─── PUT /plataforma/crm/leads/:id ───────────────────────────────────────────────

router.put('/plataforma/crm/leads/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = actualizarLeadSchema.parse(req.body);
    res.json(await service.actualizarLead(req.params.id, data));
  } catch (err) { next(err); }
});

// ─── PATCH /plataforma/crm/leads/:id/estado ──────────────────────────────────────

router.patch('/plataforma/crm/leads/:id/estado', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { estado } = cambiarEstadoSchema.parse(req.body);
    res.json(await service.cambiarEstadoLead(req.params.id, estado));
  } catch (err) { next(err); }
});

// ─── POST /plataforma/crm/leads/:id/interacciones ────────────────────────────────

router.post('/plataforma/crm/leads/:id/interacciones', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { tipo, descripcion } = interaccionSchema.parse(req.body);
    res.status(201).json(await service.registrarInteraccion(req.params.id, tipo, descripcion));
  } catch (err) { next(err); }
});

// ─── GET /plataforma/crm/leads/:id/interacciones ─────────────────────────────────

router.get('/plataforma/crm/leads/:id/interacciones', async (req: Request, res: Response, next: NextFunction) => {
  try {
    res.json({ data: await service.listarInteracciones(req.params.id) });
  } catch (err) { next(err); }
});

export default router;
