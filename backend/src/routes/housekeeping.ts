import { Router, Request, Response } from 'express';
import { EstadoHabitacion } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { authenticate } from '../middleware/auth';
import { requirePermiso } from '../middleware/permisos';

const router = Router();
router.use(authenticate);

// ─── GET /api/v1/housekeeping/plan-dia ───────────────────────────────────────

router.get('/housekeeping/plan-dia', requirePermiso('housekeeping.gestionar'), async (_req: Request, res: Response) => {
  try {
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);
    const finHoy = new Date();
    finHoy.setHours(23, 59, 59, 999);

    // Habitaciones en LIMPIEZA o con checkout hoy (aún OCUPADA pero necesitarán limpieza)
    const rows = await prisma.$queryRaw<Array<{
      id: string;
      numero: string;
      piso: number;
      tipo: string;
      estado: string;
      estado_desde: Date | null;
      // Reserva activa (huesped saliente)
      reserva_activa_id: string | null;
      huesped_saliente: string | null;
      fecha_salida_activa: Date | null;
      // Próxima reserva hoy (huesped entrante)
      reserva_proxima_id: string | null;
      huesped_entrante: string | null;
      hora_checkin_estimada: Date | null;
      // Mantenimiento pendiente
      notas_mantenimiento: string | null;
    }>>`
      SELECT
        h.id,
        h.numero,
        h.piso,
        h.tipo::text                                          AS tipo,
        h.estado::text                                        AS estado,
        h.updated_at                                          AS estado_desde,
        -- Reserva activa (quién está/estaba)
        ra.id                                                 AS reserva_activa_id,
        CONCAT(hsa.nombre, ' ', hsa.apellido)                AS huesped_saliente,
        ra.fecha_salida                                       AS fecha_salida_activa,
        -- Próxima reserva hoy (quién entra)
        rp.id                                                 AS reserva_proxima_id,
        CONCAT(hpe.nombre, ' ', hpe.apellido)                AS huesped_entrante,
        rp.fecha_entrada                                      AS hora_checkin_estimada,
        -- Mantenimiento activo
        (SELECT descripcion FROM mantenimiento_registros
         WHERE habitacion_id = h.id AND estado IN ('pendiente','en_proceso')
         ORDER BY created_at DESC LIMIT 1)                   AS notas_mantenimiento
      FROM habitaciones h
      -- Reserva activa (checkout hoy o ya fue checkout y hab en LIMPIEZA)
      LEFT JOIN reservas ra ON ra.habitacion_id = h.id
        AND (
          (ra.estado = 'CHECKIN_REALIZADO' AND ra.fecha_salida >= ${hoy} AND ra.fecha_salida <= ${finHoy})
          OR
          (ra.estado = 'CHECKOUT_REALIZADO' AND ra.fecha_salida >= ${hoy} AND ra.fecha_salida <= ${finHoy})
        )
      LEFT JOIN huespedes hsa ON hsa.id = ra.huesped_id
      -- Próxima reserva confirmada para hoy
      LEFT JOIN reservas rp ON rp.habitacion_id = h.id
        AND rp.estado = 'CONFIRMADA'
        AND rp.fecha_entrada >= ${hoy}
        AND rp.fecha_entrada <= ${finHoy}
      LEFT JOIN huespedes hpe ON hpe.id = rp.huesped_id
      WHERE h.estado != 'FUERA_DE_SERVICIO'::"EstadoHabitacion"
        AND (
          h.estado = 'LIMPIEZA'::"EstadoHabitacion"
          OR (h.estado = 'OCUPADA'::"EstadoHabitacion" AND ra.fecha_salida >= ${hoy} AND ra.fecha_salida <= ${finHoy})
          OR (h.estado = 'DISPONIBLE'::"EstadoHabitacion" AND rp.id IS NOT NULL)
        )
      ORDER BY h.piso, h.numero
    `;

    const ahora = new Date();

    type Hab = {
      id: string; numero: string; piso: number; tipo: string; estado: string;
      estado_desde: Date | null; reserva_activa_id: string | null; huesped_saliente: string | null;
      fecha_salida_activa: Date | null; reserva_proxima_id: string | null; huesped_entrante: string | null;
      hora_checkin_estimada: Date | null; notas_mantenimiento: string | null;
    };

    const calcularPrioridad = (h: Hab): 'urgente' | 'alta' | 'normal' => {
      const minEnLimpieza = h.estado_desde
        ? Math.floor((ahora.getTime() - new Date(h.estado_desde).getTime()) / 60_000)
        : 0;

      if (h.hora_checkin_estimada) {
        const minHastaCheckin = Math.floor((new Date(h.hora_checkin_estimada).getTime() - ahora.getTime()) / 60_000);
        if (minHastaCheckin < 120) return 'urgente'; // check-in en menos de 2h
        return 'alta';
      }
      if (h.estado === 'LIMPIEZA' && minEnLimpieza > 120) return 'alta';
      return 'normal';
    };

    const calcularRazon = (h: Hab): string => {
      if (h.hora_checkin_estimada) {
        const minHastaCheckin = Math.floor((new Date(h.hora_checkin_estimada).getTime() - ahora.getTime()) / 60_000);
        if (minHastaCheckin < 0) return `Check-in hace ${Math.abs(minHastaCheckin)} min`;
        if (minHastaCheckin < 60) return `Check-in en ${minHastaCheckin} min`;
        return `Check-in a las ${new Date(h.hora_checkin_estimada).toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' })}`;
      }
      if (h.fecha_salida_activa) {
        const minDesdeCheckout = Math.floor((ahora.getTime() - new Date(h.fecha_salida_activa).getTime()) / 60_000);
        return `Checkout hace ${minDesdeCheckout > 60 ? `${Math.floor(minDesdeCheckout / 60)}h ${minDesdeCheckout % 60}min` : `${minDesdeCheckout} min`}`;
      }
      if (h.estado === 'OCUPADA') return 'Checkout pendiente hoy';
      return 'Limpieza de rutina';
    };

    const habitaciones = rows.map(h => {
      const minEnEstado = h.estado_desde
        ? Math.floor((ahora.getTime() - new Date(h.estado_desde).getTime()) / 60_000)
        : 0;

      return {
        id: h.id,
        numero: h.numero,
        piso: h.piso,
        tipo: h.tipo,
        estado_actual: h.estado,
        prioridad: calcularPrioridad(h),
        razon_prioridad: calcularRazon(h),
        huesped_saliente: h.huesped_saliente?.trim() || null,
        huesped_entrante: h.huesped_entrante?.trim() || null,
        hora_checkin_estimada: h.hora_checkin_estimada
          ? new Date(h.hora_checkin_estimada).toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' })
          : null,
        tiempo_en_estado: minEnEstado,
        notas_mantenimiento: h.notas_mantenimiento || null,
      };
    });

    // Ordenar: urgente > alta > normal, dentro de cada grupo por tiempo en estado DESC
    const orden = { urgente: 0, alta: 1, normal: 2 };
    habitaciones.sort((a, b) => {
      const diff = orden[a.prioridad] - orden[b.prioridad];
      if (diff !== 0) return diff;
      return b.tiempo_en_estado - a.tiempo_en_estado;
    });

    const resumen = {
      total: habitaciones.length,
      urgentes: habitaciones.filter(h => h.prioridad === 'urgente').length,
      alta: habitaciones.filter(h => h.prioridad === 'alta').length,
      pendientes: habitaciones.filter(h => h.estado_actual === 'LIMPIEZA' || h.estado_actual === 'OCUPADA').length,
      en_proceso: 0, // se trackea en el frontend via timer
      listas: 0,
    };

    res.json({ resumen, habitaciones });
  } catch (e: unknown) {
    res.status(500).json({ error: e instanceof Error ? e.message : 'Error' });
  }
});

// ─── PATCH /api/v1/housekeeping/habitaciones/:numero/estado ──────────────────

router.patch('/housekeeping/habitaciones/:numero/estado', requirePermiso('housekeeping.gestionar'), async (req: Request, res: Response) => {
  const { numero } = req.params;
  const { estado, notas } = req.body as { estado: string; notas?: string };

  const estadosPermitidos = ['LIMPIEZA', 'DISPONIBLE', 'INSPECCION'];
  if (!estado || !estadosPermitidos.includes(estado.toUpperCase())) {
    res.status(400).json({ error: `estado debe ser uno de: ${estadosPermitidos.join(', ')}` });
    return;
  }

  try {
    const hab = await prisma.$queryRaw<Array<{ id: string; estado: string }>>`
      SELECT id, estado::text AS estado FROM habitaciones WHERE numero = ${numero}
    `;
    if (!hab.length) { res.status(404).json({ error: 'Habitación no encontrada' }); return; }

    const estadoNuevo = estado.toUpperCase() as EstadoHabitacion;

    // INSPECCION no es un estado del enum — usamos LIMPIEZA como estado intermedio
    // y lo marcamos en el audit_log con acción específica
    const estadoFinal = estadoNuevo === ('INSPECCION' as EstadoHabitacion) ? EstadoHabitacion.LIMPIEZA : estadoNuevo;

    await prisma.habitacion.update({
      where: { id: hab[0].id },
      data: { estado: estadoFinal },
    });

    await prisma.auditLog.create({
      data: {
        entidad:           'habitacion',
        entidad_id:        hab[0].id,
        accion:            `housekeeping_${estado.toLowerCase()}`,
        campos_modificados: { estado_anterior: hab[0].estado, estado_nuevo: estadoFinal, notas: notas ?? null },
        actor_email:       req.user!.email,
      },
    }).catch(() => { /* non-fatal */ });

    res.json({ ok: true, numero, estado: estadoFinal });
  } catch (e: unknown) {
    res.status(500).json({ error: e instanceof Error ? e.message : 'Error' });
  }
});

// ─── GET /api/v1/housekeeping/habitaciones/:numero/detalle ───────────────────

router.get('/housekeeping/habitaciones/:numero/detalle', requirePermiso('housekeeping.gestionar'), async (req: Request, res: Response) => {
  const { numero } = req.params;

  try {
    const hab = await prisma.habitacion.findFirst({
      where: { numero },
      include: {
        tipo_custom: true,
        reservas: {
          orderBy: { fecha_salida: 'desc' },
          take: 2,
          include: {
            huesped: { select: { nombre: true, apellido: true, telefono: true, email: true } },
          },
        },
      },
    });

    if (!hab) { res.status(404).json({ error: 'Habitación no encontrada' }); return; }

    const mantenimiento = await prisma.$queryRaw<Array<{ estado: string; descripcion: string; prioridad: string; created_at: Date }>>`
      SELECT estado, descripcion, prioridad, created_at
      FROM mantenimiento_registros
      WHERE habitacion_id = ${hab.id}::uuid
        AND estado IN ('pendiente', 'en_proceso')
      ORDER BY created_at DESC
      LIMIT 3
    `;

    res.json({ ...hab, mantenimiento_activo: mantenimiento });
  } catch (e: unknown) {
    res.status(500).json({ error: e instanceof Error ? e.message : 'Error' });
  }
});

export default router;
