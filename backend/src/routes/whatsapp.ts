import { Router, Request, Response } from 'express';
import {
  obtenerDisponibilidad,
  preguntarLlama3,
  enviarMensajeWPP,
} from '../services/concierge.service';

const router = Router();

// GET — Meta webhook verification challenge
// URL: GET /api/v1/webhooks/whatsapp
router.get('/', (req: Request, res: Response) => {
  const mode      = req.query['hub.mode'];
  const token     = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode === 'subscribe' && token === (process.env.WHATSAPP_VERIFY_TOKEN ?? '')) {
    res.status(200).send(String(challenge));
  } else {
    res.status(403).json({ error: 'Token inválido' });
  }
});

// POST — incoming WhatsApp messages → Llama3 → reply
// URL: POST /api/v1/webhooks/whatsapp
router.post('/', (req: Request, res: Response) => {
  // Always respond 200 immediately to Meta (< 20 ms)
  res.sendStatus(200);

  void (async () => {
    try {
      const entry   = req.body?.entry?.[0];
      const changes = entry?.changes?.[0]?.value;
      const mensaje = changes?.messages?.[0];
      if (!mensaje || mensaje.type !== 'text') return;

      const telefono = String(mensaje.from);
      const texto    = String(mensaje.text?.body ?? '').trim();
      if (!texto) return;

      console.log(`[WPP IN] ${telefono}: ${texto}`);

      // If the message mentions rooms/availability, fetch real data
      let contextoExtra = '';
      if (/reserv|habitaci|disponib|cuarto|room/i.test(texto)) {
        const hoy     = new Date().toISOString().split('T')[0];
        const manana  = new Date(Date.now() + 86_400_000).toISOString().split('T')[0];
        const disponibles = await obtenerDisponibilidad(hoy, manana);
        if (disponibles.length > 0) {
          contextoExtra = '\nHabitaciones disponibles HOY:\n' +
            disponibles.slice(0, 5).map(h =>
              `- Hab. ${h.numero} (${h.tipo}): S/ ${h.tarifa_base}/noche, cap. ${h.capacidad_adultos ?? '?'} personas`,
            ).join('\n');
        }
      }

      const respuesta = await preguntarLlama3(texto, contextoExtra);
      console.log(`[WPP OUT] ${telefono}: ${respuesta}`);
      await enviarMensajeWPP(telefono, respuesta);
    } catch (err) {
      console.error('[WPP WEBHOOK ERROR]', err);
    }
  })();
});

export default router;
