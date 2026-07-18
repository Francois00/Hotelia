import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { authenticate } from '../middleware/auth';
import { procesarMensaje, getEstadoPaso, limpiarConversacion } from '../services/concierge.service';

const router = Router();

router.use(authenticate);

const chatSchema = z.object({
  mensaje:    z.string().min(1).max(1000),
  session_id: z.string().optional(),
  telefono:   z.string().optional(),
});

// POST /api/v1/concierge/chat
router.post('/chat', async (req: Request, res: Response) => {
  try {
    const { mensaje, session_id, telefono } = chatSchema.parse(req.body);
    const t0 = Date.now();

    // session_id > telefono > user-scoped stable key (never Date.now() — breaks state)
    const sessionKey = session_id ?? telefono ?? `web_${(req as unknown as { user?: { id?: string } }).user?.id ?? 'anon'}`;

    if (!process.env.OPENAI_API_KEY) {
      res.json({
        respuesta: '⚠️ Concierge IA no configurado. Falta OPENAI_API_KEY en el servidor.',
        modelo: 'gpt-4o-mini',
        tiempo_ms: Date.now() - t0,
        paso_actual: 'error',
        session_id: sessionKey,
      });
      return;
    }

    console.log(`[CHAT] session:${sessionKey} paso:${getEstadoPaso(sessionKey)} msg:${mensaje}`);

    const respuesta = await procesarMensaje(sessionKey, mensaje);

    res.json({
      respuesta:   respuesta || 'Sin respuesta',
      modelo:      'gpt-4o-mini',
      tiempo_ms:   Date.now() - t0,
      paso_actual: getEstadoPaso(sessionKey),
      session_id:  sessionKey,
    });
  } catch (err) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ error: err.errors });
      return;
    }
    console.error('[concierge/chat]', err);
    res.status(500).json({ error: 'Error procesando mensaje' });
  }
});

// DELETE /api/v1/concierge/chat/:session_id — reset conversation
router.delete('/chat/:session_id', (req: Request, res: Response) => {
  const { session_id } = req.params;
  limpiarConversacion(session_id);
  console.log(`[CHAT] sesión reseteada: ${session_id}`);
  res.json({ ok: true });
});

export default router;
