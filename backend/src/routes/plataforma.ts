import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { authenticate } from '../middleware/auth';
import { requireSuperadminPlataforma } from '../middleware/plataforma';
import * as service from '../services/plataforma.service';

const router = Router();

// ─── POST /plataforma/salir-impersonacion ──────────────────────────────────────
// Debe registrarse ANTES del gate de requireSuperadminPlataforma: durante una
// impersonación el JWT activo es el de un admin_empresa (esSuperadminPlataforma:
// false), así que esta ruta solo exige estar autenticado y valida el flag
// `impersonando` internamente.
router.post('/plataforma/salir-impersonacion', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    res.json(await service.salirImpersonacion(req.user!));
  } catch (err) { next(err); }
});

router.use(authenticate, requireSuperadminPlataforma);

const crearEmpresaSchema = z.object({
  nombre_comercial: z.string().min(1).max(150),
  razon_social:     z.string().max(200).optional(),
  ruc:              z.string().max(11).optional(),
  email_contacto:   z.string().email(),
  telefono_contacto: z.string().max(20).optional(),
  subdominio:       z.string().min(2).max(50).regex(/^[a-z0-9-]+$/, 'Subdominio: solo minúsculas, números y guiones'),
  nombre_sistema:   z.string().max(100).optional(),
  plan:             z.enum(['basico', 'estandar', 'premium', 'empresa']),
  precio_mensual:   z.number().min(0),
  max_locales:      z.number().int().min(1),
  max_usuarios:     z.number().int().min(1),
  max_habitaciones_por_local: z.number().int().min(1),
  admin_nombre:     z.string().min(1).max(150),
  admin_email:      z.string().email(),
  admin_password:   z.string().min(8, 'La contraseña debe tener al menos 8 caracteres'),
});

const actualizarEmpresaSchema = z.object({
  nombre_comercial: z.string().min(1).max(150).optional(),
  razon_social:     z.string().max(200).optional(),
  ruc:              z.string().max(11).optional(),
  email_contacto:   z.string().email().optional(),
  telefono_contacto: z.string().max(20).optional(),
  nombre_sistema:   z.string().max(100).optional(),
  logo_url:         z.string().url().optional(),
  color_primario:   z.string().max(7).optional(),
  plan:             z.enum(['basico', 'estandar', 'premium', 'empresa']).optional(),
  precio_mensual:   z.number().min(0).optional(),
  max_locales:      z.number().int().min(1).optional(),
  max_usuarios:     z.number().int().min(1).optional(),
  max_habitaciones_por_local: z.number().int().min(1).optional(),
});

const cambiarEstadoSchema = z.object({
  estado: z.enum(['activa', 'suspendida', 'cancelada', 'prueba']),
  motivo: z.string().max(500).optional(),
});

const registrarPagoSchema = z.object({
  monto:      z.number().min(0),
  periodo:    z.string().regex(/^\d{4}-\d{2}$/, 'periodo debe tener formato YYYY-MM'),
  fecha_pago: z.string().optional(),
  metodo:     z.string().max(30).optional(),
  referencia: z.string().max(100).optional(),
});

// ─── GET /plataforma/dashboard ─────────────────────────────────────────────────

router.get('/plataforma/dashboard', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    res.json(await service.dashboard());
  } catch (err) { next(err); }
});

// ─── GET /plataforma/empresas ───────────────────────────────────────────────────

router.get('/plataforma/empresas', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    res.json({ data: await service.listarEmpresas() });
  } catch (err) { next(err); }
});

// ─── POST /plataforma/empresas ──────────────────────────────────────────────────

router.post('/plataforma/empresas', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = crearEmpresaSchema.parse(req.body);
    res.status(201).json(await service.crearEmpresa(data));
  } catch (err) { next(err); }
});

// ─── PUT /plataforma/empresas/:id ───────────────────────────────────────────────

router.put('/plataforma/empresas/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = actualizarEmpresaSchema.parse(req.body);
    res.json(await service.actualizarEmpresa(req.params.id, data));
  } catch (err) { next(err); }
});

// ─── PATCH /plataforma/empresas/:id/estado ─────────────────────────────────────

router.patch('/plataforma/empresas/:id/estado', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { estado, motivo } = cambiarEstadoSchema.parse(req.body);
    res.json(await service.cambiarEstadoEmpresa(req.params.id, estado, motivo));
  } catch (err) { next(err); }
});

// ─── GET /plataforma/empresas/:id/pagos ────────────────────────────────────────

router.get('/plataforma/empresas/:id/pagos', async (req: Request, res: Response, next: NextFunction) => {
  try {
    res.json({ data: await service.listarPagos(req.params.id) });
  } catch (err) { next(err); }
});

// ─── POST /plataforma/empresas/:id/pagos ───────────────────────────────────────

router.post('/plataforma/empresas/:id/pagos', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = registrarPagoSchema.parse(req.body);
    res.status(201).json(await service.registrarPago(req.params.id, data));
  } catch (err) { next(err); }
});

// ─── POST /plataforma/empresas/:empresaId/impersonar ───────────────────────────

router.post('/plataforma/empresas/:empresaId/impersonar', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const resultado = await service.impersonarEmpresa(req.params.empresaId, {
      id: req.user!.sub,
      email: req.user!.email,
    });
    res.json(resultado);
  } catch (err) { next(err); }
});

export default router;
