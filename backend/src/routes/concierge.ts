import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { authenticate } from '../middleware/auth';
import { preguntarLlama3, obtenerDisponibilidad } from '../services/concierge.service';

const router = Router();

router.use(authenticate);

const chatSchema = z.object({
  mensaje:  z.string().min(1).max(1000),
  telefono: z.string().optional(),
});

// POST /api/v1/concierge/chat — prueba directa sin formato WPP
router.post('/chat', async (req: Request, res: Response) => {
  try {
    const { mensaje } = chatSchema.parse(req.body);
    const t0 = Date.now();

    let contextoExtra = '';
    if (/reserv|habitaci|disponib|cuarto|room/i.test(mensaje)) {
      const hoy    = new Date().toISOString().split('T')[0];
      const manana = new Date(Date.now() + 86_400_000).toISOString().split('T')[0];
      const disponibles = await obtenerDisponibilidad(hoy, manana);
      if (disponibles.length > 0) {
        contextoExtra = '\nHabitaciones disponibles HOY:\n' +
          disponibles.slice(0, 5).map(h =>
            `- Hab. ${h.numero} (${h.tipo}): S/ ${h.tarifa_base}/noche, cap. ${h.capacidad_adultos ?? '?'} personas`,
          ).join('\n');
      }
    }

    const respuesta = await preguntarLlama3(mensaje, contextoExtra);
    const tiempo_ms = Date.now() - t0;

    res.json({ respuesta, modelo: 'llama3', tiempo_ms });
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
