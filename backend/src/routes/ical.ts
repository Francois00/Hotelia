import { Router, Request, Response, NextFunction } from 'express';
import { generarICSExportacion } from '../services/ical.service';

const router = Router();

// Público — sin autenticación, lo consume directamente Booking.com/Expedia.
// El token en la URL actúa como credencial (igual que un feed RSS/iCal privado).
router.get('/ical/:token.ics', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const ics = await generarICSExportacion(req.params.token);
    res.set('Content-Type', 'text/calendar; charset=utf-8');
    res.send(ics);
  } catch (err) { next(err); }
});

export default router;
