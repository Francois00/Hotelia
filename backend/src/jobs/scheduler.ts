import cron from 'node-cron';
import { prisma } from '../lib/prisma';
import { EstadoReserva, EstadoHabitacion, SegmentoHuesped } from '@prisma/client';

// ─── JOB 1: NO-SHOW — cada día a las 02:00 ────────────────────────────────────
// Marca como NO_SHOW las reservas CONFIRMADAS cuya fecha_entrada fue ayer
// y no realizaron check-in.
cron.schedule('0 2 * * *', async () => {
  console.log('[CRON] Ejecutando job NO-SHOW...');
  const ayer = new Date();
  ayer.setDate(ayer.getDate() - 1);
  ayer.setHours(0, 0, 0, 0);
  const finAyer = new Date(ayer);
  finAyer.setHours(23, 59, 59, 999);

  try {
    const resultado = await prisma.reserva.updateMany({
      where: {
        estado:         EstadoReserva.CONFIRMADA,
        fecha_entrada:  { gte: ayer, lte: finAyer },
      },
      data: { estado: EstadoReserva.NO_SHOW },
    });
    console.log(`[CRON] NO-SHOW: ${resultado.count} reservas marcadas`);
  } catch (e: unknown) {
    console.error('[CRON] Error job NO-SHOW:', e instanceof Error ? e.message : e);
  }
});

// ─── JOB 2: SINCRONIZAR ESTADOS DE HABITACIONES — cada 15 min ─────────────────
// Corrige habitaciones cuyo estado no refleja la realidad según las reservas activas.
cron.schedule('*/15 * * * *', async () => {
  try {
    // Hab con checkin activo que no están en OCUPADA → forzar OCUPADA
    const syncOcupadas = await prisma.$executeRaw`
      UPDATE habitaciones h
      SET estado = ${EstadoHabitacion.OCUPADA}::"EstadoHabitacion", updated_at = NOW()
      FROM reservas r
      WHERE r.habitacion_id = h.id
        AND r.estado = ${EstadoReserva.CHECKIN_REALIZADO}::"EstadoReserva"
        AND h.estado NOT IN (
          ${EstadoHabitacion.OCUPADA}::"EstadoHabitacion",
          ${EstadoHabitacion.MANTENIMIENTO}::"EstadoHabitacion",
          ${EstadoHabitacion.FUERA_DE_SERVICIO}::"EstadoHabitacion"
        )
    `;

    // Hab que figuran como OCUPADA pero no tienen checkin activo → forzar DISPONIBLE
    const syncDisponibles = await prisma.$executeRaw`
      UPDATE habitaciones h
      SET estado = ${EstadoHabitacion.DISPONIBLE}::"EstadoHabitacion", updated_at = NOW()
      WHERE h.estado = ${EstadoHabitacion.OCUPADA}::"EstadoHabitacion"
        AND NOT EXISTS (
          SELECT 1 FROM reservas r
          WHERE r.habitacion_id = h.id
            AND r.estado = ${EstadoReserva.CHECKIN_REALIZADO}::"EstadoReserva"
        )
    `;

    if (Number(syncOcupadas) > 0 || Number(syncDisponibles) > 0) {
      console.log(`[CRON] Sync habitaciones: ${Number(syncOcupadas)} → OCUPADA, ${Number(syncDisponibles)} → DISPONIBLE`);
    }
  } catch (e: unknown) {
    console.error('[CRON] Error sync habitaciones:', e instanceof Error ? e.message : e);
  }
});

// ─── JOB 3: RECALCULAR SEGMENTOS CRM — cada domingo a las 03:00 ───────────────
// Reclasifica huéspedes según historial real de reservas y LTV.
cron.schedule('0 3 * * 0', async () => {
  console.log('[CRON] Recalculando segmentos CRM...');
  try {
    // VIP: 5+ reservas completadas Y ltv >= 1000
    await prisma.$executeRaw`
      UPDATE huespedes SET segmento = ${SegmentoHuesped.VIP}::"SegmentoHuesped", updated_at = NOW()
      WHERE id IN (
        SELECT huesped_id FROM reservas
        WHERE estado = ${EstadoReserva.CHECKOUT_REALIZADO}::"EstadoReserva"
        GROUP BY huesped_id
        HAVING COUNT(*) >= 5
      ) AND ltv >= 1000
    `;

    // RECURRENTE: 3+ reservas completadas
    await prisma.$executeRaw`
      UPDATE huespedes SET segmento = ${SegmentoHuesped.RECURRENTE}::"SegmentoHuesped", updated_at = NOW()
      WHERE segmento != ${SegmentoHuesped.VIP}::"SegmentoHuesped"
        AND id IN (
          SELECT huesped_id FROM reservas
          WHERE estado = ${EstadoReserva.CHECKOUT_REALIZADO}::"EstadoReserva"
          GROUP BY huesped_id
          HAVING COUNT(*) >= 3
        )
    `;

    // OCASIONAL: 2 reservas completadas
    await prisma.$executeRaw`
      UPDATE huespedes SET segmento = ${SegmentoHuesped.OCASIONAL}::"SegmentoHuesped", updated_at = NOW()
      WHERE segmento NOT IN (
        ${SegmentoHuesped.VIP}::"SegmentoHuesped",
        ${SegmentoHuesped.RECURRENTE}::"SegmentoHuesped"
      )
      AND id IN (
        SELECT huesped_id FROM reservas
        WHERE estado = ${EstadoReserva.CHECKOUT_REALIZADO}::"EstadoReserva"
        GROUP BY huesped_id
        HAVING COUNT(*) = 2
      )
    `;

    // INACTIVO: 1 sola reserva completada, y fue hace más de 90 días
    await prisma.$executeRaw`
      UPDATE huespedes SET segmento = ${SegmentoHuesped.INACTIVO}::"SegmentoHuesped", updated_at = NOW()
      WHERE segmento NOT IN (
        ${SegmentoHuesped.VIP}::"SegmentoHuesped",
        ${SegmentoHuesped.RECURRENTE}::"SegmentoHuesped",
        ${SegmentoHuesped.OCASIONAL}::"SegmentoHuesped",
        ${SegmentoHuesped.CORPORATIVO}::"SegmentoHuesped"
      )
      AND id IN (
        SELECT huesped_id FROM reservas
        WHERE estado = ${EstadoReserva.CHECKOUT_REALIZADO}::"EstadoReserva"
        GROUP BY huesped_id
        HAVING COUNT(*) = 1
          AND MAX(fecha_salida) < NOW() - INTERVAL '90 days'
      )
    `;

    console.log('[CRON] Segmentos CRM actualizados');
  } catch (e: unknown) {
    console.error('[CRON] Error CRM:', e instanceof Error ? e.message : e);
  }
});

// ─── JOB 4: ALERTA CHECKOUTS DEL DÍA — cada día a las 08:00 ──────────────────
// Prepara a recepción con resumen de checkouts pendientes.
cron.schedule('0 8 * * *', async () => {
  try {
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);
    const finHoy = new Date();
    finHoy.setHours(23, 59, 59, 999);

    const checkouts = await prisma.reserva.findMany({
      where: {
        estado:       EstadoReserva.CHECKIN_REALIZADO,
        fecha_salida: { gte: hoy, lte: finHoy },
      },
      include: {
        habitacion: { select: { numero: true } },
        huesped:    { select: { nombre: true, apellido: true } },
      },
    });

    if (!checkouts.length) return;

    const fecha = hoy.toLocaleDateString('es-PE', { weekday: 'long', day: 'numeric', month: 'long' });
    let msg = `📋 *PLAN DEL DÍA — ${fecha.toUpperCase()}*\n\n`;
    msg += `🏁 *Checkouts hoy: ${checkouts.length}*\n`;
    checkouts.forEach(r => {
      msg += `  • Hab. ${r.habitacion?.numero ?? '?'} — ${r.huesped?.nombre} ${r.huesped?.apellido}\n`;
    });
    msg += `\n🧹 Recuerden revisar el plan de housekeeping.`;

    const backendUrl = process.env.BACKEND_INTERNAL_URL ?? 'http://localhost:3000';
    const serviceToken = process.env.BACKEND_SERVICE_TOKEN ?? '';

    await fetch(`${backendUrl}/api/v1/notificaciones/grupo/alerta`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-service-token': serviceToken },
      body: JSON.stringify({ nivel: 'INFO', mensaje: msg, accion: 'Preparar checkouts del día' }),
    }).catch((e: unknown) => console.error('[CRON] Error notif WPP:', e instanceof Error ? e.message : e));

    console.log(`[CRON] Alerta checkouts: ${checkouts.length} hab. notificadas`);
  } catch (e: unknown) {
    console.error('[CRON] Error alerta checkouts:', e instanceof Error ? e.message : e);
  }
});

console.log('[CRON] Jobs programados: NO-SHOW(02:00) | Sync-habs(*/15min) | CRM(dom 03:00) | Alertas(08:00)');

export default {};
