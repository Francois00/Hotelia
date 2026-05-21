import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { authenticate } from '../middleware/auth';
import { procesarMensaje, getEstadoPaso } from '../services/concierge.service';

const router = Router();

router.use(authenticate);

const chatSchema = z.object({
  mensaje:  z.string().min(1).max(1000),
  telefono: z.string().optional(),
});

// POST /api/v1/concierge/chat — prueba directa del flujo sin WPP real
router.post('/chat', async (req: Request, res: Response) => {
  try {
    const { mensaje, telefono = `test_${Date.now()}` } = chatSchema.parse(req.body);
    const t0 = Date.now();

    // Capture the outbound message instead of sending it via WPP
    let respuesta = '';
    const capturar = async (_tel: string, texto: string): Promise<void> => {
      respuesta = texto;
    };

    await procesarMensaje(telefono, mensaje, capturar);

    res.json({
      respuesta,
      modelo:      'llama3',
      tiempo_ms:   Date.now() - t0,
      paso_actual: getEstadoPaso(telefono),
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

export default router;
