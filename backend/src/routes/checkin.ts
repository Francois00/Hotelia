import { Router, Request, Response, NextFunction } from 'express';
import { authenticate } from '../middleware/auth';
import { generarQRCheckin, procesarQRCheckin } from '../services/qrcheckin.service';

const router = Router();

// GET /reservas/:id/qr-checkin — authenticated
router.get('/:id/qr-checkin', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await generarQRCheckin(req.params.id);
    res.json({ data });
  } catch (err) { next(err); }
});

export default router;
