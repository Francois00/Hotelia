import { randomUUID } from 'crypto';
import { CanalSync, TipoEventoSync, EstadoSync } from '@prisma/client';
import { prisma } from '../lib/prisma';

const CANALES_ACTIVOS: CanalSync[] = [
  CanalSync.BOOKING_COM,
  CanalSync.EXPEDIA,
  CanalSync.AIRBNB,
];

/**
 * Notifies all configured OTA channels to block or release a room for a date range.
 * Currently runs as a stub — logs the would-be request instead of making real HTTP calls.
 * To go live: replace the STUB block with the real HTTP call for each canal.
 */
export async function sincronizarEnTodosLosCanales(
  habitacion_id: string,
  fecha_entrada: Date,
  fecha_salida: Date,
  disponible: boolean,
  reserva_id?: string,
): Promise<Array<{ canal: string; exito: boolean }>> {
  const tipo_evento = disponible ? TipoEventoSync.DISPONIBILIDAD : TipoEventoSync.RESERVA_NUEVA;

  const resultados = await Promise.allSettled(
    CANALES_ACTIVOS.map(async (canal) => {
      const payload_enviado = {
        habitacion_id,
        fecha_entrada: fecha_entrada.toISOString().slice(0, 10),
        fecha_salida:  fecha_salida.toISOString().slice(0, 10),
        disponible,
        modo: 'STUB_MODE',
      };

      // ── STUB ────────────────────────────────────────────────────────────────
      // In production, replace with a real push call, e.g.:
      //   await axios.post(OTA_PUSH_URLS[canal], payload_enviado, {
      //     headers: { Authorization: `Bearer ${process.env[`${canal}_API_KEY`]}` },
      //     timeout: 10_000,
      //   });
      // ────────────────────────────────────────────────────────────────────────

      await prisma.canalSyncLog.create({
        data: {
          canal,
          tipo_evento,
          payload_entrada: payload_enviado,
          payload_salida:  { respuesta: 'STUB_MODE', exito: true },
          reserva_id:      reserva_id ?? null,
          estado:          EstadoSync.PROCESADO,
          idempotency_key: `out:${canal}:${habitacion_id}:${randomUUID()}`,
        },
      });

      return { canal: canal.toLowerCase(), exito: true };
    }),
  );

  return resultados.map((r, i) =>
    r.status === 'fulfilled'
      ? r.value
      : { canal: CANALES_ACTIVOS[i].toLowerCase(), exito: false },
  );
}
