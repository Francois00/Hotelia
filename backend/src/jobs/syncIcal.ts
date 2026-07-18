import cron from 'node-cron';
import { sincronizarTodasLasConexiones } from '../services/ical.service';

// ─── JOB: SYNC ICAL — cada 15 min ──────────────────────────────────────────────
// Importa la disponibilidad publicada por Booking.com/Expedia y la aplica como
// ical_bloqueos, para que el motor de reservas no permita overbooking sobre
// fechas ya vendidas en esos canales.
cron.schedule('*/15 * * * *', async () => {
  try {
    await sincronizarTodasLasConexiones();
  } catch (e: unknown) {
    console.error('[CRON] Error sync iCal:', e instanceof Error ? e.message : e);
  }
});

export default {};
