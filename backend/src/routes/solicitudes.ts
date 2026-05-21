import { Router, Request, Response } from 'express';
import { RolPersonal } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { authenticate, authorize } from '../middleware/auth';

const router = Router();
router.use(authenticate);

// GET /api/v1/solicitudes
router.get('/solicitudes', async (req: Request, res: Response) => {
  const { estado } = req.query as Record<string, string>;

  try {
    const whereEst = estado ? `AND s.estado = '${estado}'` : '';

    const rows = await prisma.$queryRawUnsafe<Array<{
      id: string; habitacion_numero: string; reserva_id: string | null;
      tipo: string; descripcion: string; estado: string;
      atendido_por_nombre: string | null; created_at: string; atendido_at: string | null;
    }>>(`
      SELECT
        s.id, s.habitacion_numero, s.reserva_id,
        s.tipo, s.descripcion, s.estado,
        CONCAT(p.nombre, ' ', p.apellido) AS atendido_por_nombre,
        s.created_at, s.atendido_at
      FROM solicitudes_huesped s
      LEFT JOIN personal p ON p.id = s.atendido_por
      WHERE 1=1 ${whereEst}
      ORDER BY
        CASE s.estado WHEN 'pendiente' THEN 0 WHEN 'atendiendo' THEN 1 ELSE 2 END,
        s.created_at DESC
      LIMIT 100
    `);

    res.json(rows);
  } catch (e: unknown) {
    res.status(500).json({ error: e instanceof Error ? e.message : 'Error' });
  }
});

// POST /api/v1/solicitudes
router.post(
  '/solicitudes',
  authorize(RolPersonal.ADMIN, RolPersonal.GERENTE, RolPersonal.RECEPCIONISTA),
  async (req: Request, res: Response) => {
    const { habitacion_numero, reserva_id, tipo, descripcion } = req.body as {
      habitacion_numero: string; reserva_id?: string; tipo: string; descripcion: string;
    };

    if (!habitacion_numero || !tipo || !descripcion) {
      res.status(400).json({ error: 'habitacion_numero, tipo y descripcion son requeridos' });
      return;
    }

    try {
      const rows = await prisma.$queryRaw<Array<{ id: string }>>`
        INSERT INTO solicitudes_huesped (habitacion_numero, reserva_id, tipo, descripcion)
        VALUES (${habitacion_numero}, ${reserva_id ?? null}, ${tipo}, ${descripcion})
        RETURNING id
      `;
      res.status(201).json({ id: rows[0].id });
    } catch (e: unknown) {
      res.status(500).json({ error: e instanceof Error ? e.message : 'Error' });
    }
  },
);

// PATCH /api/v1/solicitudes/:id
router.patch(
  '/solicitudes/:id',
  authorize(RolPersonal.ADMIN, RolPersonal.GERENTE, RolPersonal.RECEPCIONISTA, RolPersonal.HOUSEKEEPING),
  async (req: Request, res: Response) => {
    const { id } = req.params;
    const { estado } = req.body as { estado: 'atendiendo' | 'resuelto' };

    if (!estado) { res.status(400).json({ error: 'estado requerido (atendiendo|resuelto)' }); return; }

    try {
      await prisma.$executeRaw`
        UPDATE solicitudes_huesped
        SET estado       = ${estado},
            atendido_por = ${req.user!.sub}::uuid,
            atendido_at  = CASE WHEN ${estado} = 'resuelto' THEN NOW() ELSE atendido_at END
        WHERE id = ${id}::uuid
      `;
      res.json({ ok: true });
    } catch (e: unknown) {
      res.status(500).json({ error: e instanceof Error ? e.message : 'Error' });
    }
  },
);

export default router;
