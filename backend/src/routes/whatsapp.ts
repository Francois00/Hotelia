import { Router, Request, Response } from 'express';
import { procesarMensaje, enviarWPP } from '../services/concierge.service';

const router = Router();

// GET — Meta webhook verification challenge
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

// POST — incoming WhatsApp messages → state machine → reply
router.post('/', (req: Request, res: Response) => {
  // Respond 200 immediately so Meta doesn't retry
  res.sendStatus(200);

  void (async () => {
    try {
      const mensaje = req.body?.entry?.[0]?.changes?.[0]?.value?.messages?.[0];
      if (!mensaje || mensaje.type !== 'text') return;

      const telefono = String(mensaje.from);
      const texto    = String(mensaje.text?.body ?? '').trim();
      if (!texto) return;

      const respuesta = await procesarMensaje(telefono, texto);
      await enviarWPP(telefono, respuesta);
    } catch (err) {
      console.error('[WPP WEBHOOK ERROR]', err);
    }
  })();
});

export default router;
