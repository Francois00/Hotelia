import { Router, Request, Response, NextFunction } from 'express';
import { procesarQRCheckin } from '../services/qrcheckin.service';

const router = Router();

// POST /checkin/qr — no JWT, uses QR token
router.post('/qr', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { token } = req.body as { token: string };
    if (!token) {
      res.status(400).json({ code: 'TOKEN_REQUERIDO', message: 'Se requiere token QR' });
      return;
    }
    const data = await procesarQRCheckin(token);
    res.json({ data });
  } catch (err) { next(err); }
});

export default router;
