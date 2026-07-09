import cron from 'node-cron';
import { prisma } from '../lib/prisma';

// ─── JOB: VERIFICAR SUSCRIPCIONES SAAS — cada día a las 06:00 ────────────────
// 1. Empresas que vencen en ≤3 días: log de aviso.
// 2. Empresas vencidas fuera del período de gracia: suspender automáticamente.
cron.schedule('0 6 * * *', async () => {
  console.log('[CRON] Verificando suscripciones de empresas...');
  try {
    const en3dias = new Date(Date.now() + 3 * 86_400_000);
    const porVencer = await prisma.empresa.findMany({
      where: { estado: 'activa', fecha_proximo_pago: { gte: new Date(), lte: en3dias } },
    });
    for (const e of porVencer) {
      const dias = Math.ceil((e.fecha_proximo_pago.getTime() - Date.now()) / 86_400_000);
      console.log(`[SUSCRIPCION] ⚠️ ${e.nombre_comercial} vence en ${dias} días`);
    }

    const vencidas = await prisma.$queryRaw<{ id: string; nombre_comercial: string }[]>`
      SELECT id, nombre_comercial
      FROM empresas
      WHERE estado = 'activa'
        AND fecha_proximo_pago + (dias_gracia || ' days')::interval < NOW()
    `;
    for (const e of vencidas) {
      await prisma.empresa.update({
        where: { id: e.id },
        data: {
          estado: 'suspendida',
          ultima_suspension_at: new Date(),
          motivo_suspension: 'Pago no registrado dentro del período de gracia',
        },
      });
      console.log(`[SUSCRIPCION] 🔴 SUSPENDIDA: ${e.nombre_comercial}`);
    }
  } catch (e: unknown) {
    console.error('[CRON] Error verificarSuscripciones:', e instanceof Error ? e.message : e);
  }
});

export default {};
