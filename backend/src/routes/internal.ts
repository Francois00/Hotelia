import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { serviceAuth } from '../middleware/serviceAuth';
import { upsertAlerta } from '../services/alertas.service';
import { emitMulti } from '../services/socket.service';

const router = Router();

router.use(serviceAuth);

// ─── POST /alertas ────────────────────────────────────────────────────────────
const alertaSchema = z.object({
  habitacion_id: z.string().uuid().optional(),
  tipo:          z.string().default('GENERAL'),
  descripcion:   z.string().min(1),
  nivel_alerta:  z.string().default('media'),
  frecuencia:    z.number().int().positive().optional(),
});

router.post('/alertas', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = alertaSchema.parse(req.body);

    if (data.habitacion_id) {
      const result = await upsertAlerta({
        habitacion_id: data.habitacion_id,
        tipo:          data.tipo,
        descripcion:   data.descripcion,
        nivel_alerta:  data.nivel_alerta,
        frecuencia:    data.frecuencia,
      });
      res.status(201).json(result);
      return;
    }

    // No habitacion_id — just emit socket event (e.g. queja formal, concierge)
    emitMulti('alerta:nueva', {
      tipo:        data.tipo,
      descripcion: data.descripcion,
      nivel:       data.nivel_alerta,
    }, ['dashboard', 'recepcion']);

    res.status(201).json({ accion: 'emitida' });
  } catch (err) {
    next(err);
  }
});

// ─── POST /notificaciones ─────────────────────────────────────────────────────
const notifSchema = z.object({
  tipo:    z.string(),
}).passthrough();

router.post('/notificaciones', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = notifSchema.parse(req.body);
    const { tipo, ...payload } = data;

    const routingMap: Record<string, string[]> = {
      CHECKIN_COMPLETADO:  ['dashboard', 'recepcion'],
      CHECKOUT_COMPLETADO: ['dashboard', 'recepcion'],
      ALERTA_MANTENIMIENTO:['dashboard', 'mantenimiento'],
      HOUSEKEEPING:        ['dashboard', 'housekeeping'],
      CONCIERGE:           ['recepcion', 'dashboard'],
    };

    const rooms = routingMap[tipo] ?? ['dashboard'];
    emitMulti(`notificacion:${tipo.toLowerCase()}`, payload, rooms);

    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

export default router;
