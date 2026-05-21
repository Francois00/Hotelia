import axios from 'axios';
import { EstadoReserva } from '@prisma/client';
import { prisma } from '../lib/prisma';

const IA_SERVICE_URL  = process.env.IA_SERVICE_URL  ?? 'http://localhost:8001';
const IA_SECRET_KEY   = process.env.IA_SECRET_KEY   ?? '';

// ─── Types ────────────────────────────────────────────────────────────────────

interface KPIPeriodo {
  ocupacion_pct:       number;
  adr:                 number;
  revpar:              number;
  ingresos_totales:    number;
  num_reservas:        number;
  num_noches_vendidas: number;
  tasa_cancelacion_pct: number;
  canal_principal:     string | null;
}

// ─── Core KPI calculator ──────────────────────────────────────────────────────

async function calcularKPIs(desde: Date, hasta: Date): Promise<KPIPeriodo> {
  const hastaP1 = new Date(hasta.getTime() + 86_400_000);
  const numDias = Math.round((hastaP1.getTime() - desde.getTime()) / 86_400_000);

  const [
    totalHabitaciones,
    reservasActivas,
    ingresoAgg,
    numReservas,
    totalReservas,
    totalCanceladas,
    porCanal,
  ] = await Promise.all([
    // Total rooms (all, no activo field on habitaciones)
    prisma.habitacion.count(),

    // Reservas that overlap [desde, hasta] for noches_vendidas
    prisma.reserva.findMany({
      where: {
        estado:        { in: [EstadoReserva.CHECKIN_REALIZADO, EstadoReserva.CHECKOUT_REALIZADO, EstadoReserva.CONFIRMADA] },
        fecha_entrada: { lte: hasta },
        fecha_salida:  { gte: desde },
      },
      select: { fecha_entrada: true, fecha_salida: true },
    }),

    // Ingresos: confirmed/completed stays that ended in the window
    prisma.reserva.aggregate({
      where: {
        estado:       { in: [EstadoReserva.CHECKIN_REALIZADO, EstadoReserva.CHECKOUT_REALIZADO] },
        fecha_salida: { gte: desde, lt: hastaP1 },
      },
      _sum: { tarifa_acordada: true },
    }),

    // Active reservations with check-in in window
    prisma.reserva.count({
      where: {
        fecha_entrada: { gte: desde, lt: hastaP1 },
        estado:        { notIn: [EstadoReserva.CANCELADA, EstadoReserva.NO_SHOW] },
      },
    }),

    // All reservations for cancellation rate
    prisma.reserva.count({
      where: { fecha_entrada: { gte: desde, lt: hastaP1 } },
    }),

    // Cancelled for cancellation rate
    prisma.reserva.count({
      where: {
        fecha_entrada: { gte: desde, lt: hastaP1 },
        estado:        EstadoReserva.CANCELADA,
      },
    }),

    // Canal with highest revenue
    prisma.reserva.groupBy({
      by:      ['canal'],
      where: {
        fecha_entrada: { gte: desde, lt: hastaP1 },
        estado:        { notIn: [EstadoReserva.CANCELADA, EstadoReserva.NO_SHOW] },
      },
      _sum:    { tarifa_acordada: true },
      orderBy: { _sum: { tarifa_acordada: 'desc' } },
      take: 1,
    }),
  ]);

  // Clip reserva dates to window for noches_vendidas
  let nochesVendidas = 0;
  for (const r of reservasActivas) {
    const efectivaEntrada = r.fecha_entrada > desde    ? r.fecha_entrada : desde;
    const efectivaSalida  = r.fecha_salida  < hastaP1  ? r.fecha_salida  : hastaP1;
    const noches = Math.round((efectivaSalida.getTime() - efectivaEntrada.getTime()) / 86_400_000);
    if (noches > 0) nochesVendidas += noches;
  }

  const nochesDisponibles = totalHabitaciones * numDias;
  const ingresosTotales   = Number(ingresoAgg._sum.tarifa_acordada ?? 0);
  const ocupacionPct      = nochesDisponibles > 0
    ? Math.round((nochesVendidas / nochesDisponibles) * 10_000) / 100
    : 0;
  const adr               = nochesVendidas > 0
    ? Math.round((ingresosTotales / nochesVendidas) * 100) / 100
    : 0;
  const revpar            = nochesDisponibles > 0
    ? Math.round((ingresosTotales / nochesDisponibles) * 100) / 100
    : 0;
  const tasaCancelacion   = totalReservas > 0
    ? Math.round((totalCanceladas / totalReservas) * 10_000) / 100
    : 0;
  const canalPrincipal    = porCanal[0]?.canal ?? null;

  return {
    ocupacion_pct:        ocupacionPct,
    adr,
    revpar,
    ingresos_totales:     ingresosTotales,
    num_reservas:         numReservas,
    num_noches_vendidas:  nochesVendidas,
    tasa_cancelacion_pct: tasaCancelacion,
    canal_principal:      canalPrincipal,
  };
}

// ─── Public API ───────────────────────────────────────────────────────────────

export async function obtenerKPIs(desdeStr?: string, hastaStr?: string) {
  const hoy   = new Date();
  const desde = desdeStr
    ? new Date(desdeStr)
    : new Date(hoy.getFullYear(), hoy.getMonth(), 1);
  const hasta = hastaStr ? new Date(hastaStr) : hoy;

  const actual = await calcularKPIs(desde, hasta);

  // Prior calendar month
  const primerActual  = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
  const primerAnterior = new Date(primerActual.getFullYear(), primerActual.getMonth() - 1, 1);
  const ultimoAnterior = new Date(primerActual.getTime() - 86_400_000);
  const anterior = await calcularKPIs(primerAnterior, ultimoAnterior);

  const delta = (curr: number, prev: number) =>
    prev !== 0 ? Math.round(((curr - prev) / prev) * 10_000) / 100 : 0;

  return {
    periodo: {
      desde: desde.toISOString().slice(0, 10),
      hasta: hasta.toISOString().slice(0, 10),
    },
    ...actual,
    comparativa_mes_anterior: {
      ocupacion_delta: delta(actual.ocupacion_pct,    anterior.ocupacion_pct),
      revpar_delta:    delta(actual.revpar,            anterior.revpar),
      ingresos_delta:  delta(actual.ingresos_totales,  anterior.ingresos_totales),
    },
  };
}

export async function obtenerForecast(dias: number) {
  const hoy = new Date();

  // ── Try real Prophet ia-service ──────────────────────────────────────────
  try {
    const resp = await axios.get<{
      dias:         number;
      predicciones: unknown[];
      total:        number;
    }>(
      `${IA_SERVICE_URL}/ia/v1/forecast`,
      {
        params:  { dias },
        headers: { 'X-IA-Key': IA_SECRET_KEY },
        timeout: 15_000,
      },
    );

    return {
      generado_en:    hoy.toISOString(),
      modelo_version: 'prophet-1.1.5',
      predicciones:   resp.data.predicciones,
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn('[revenue] ia-service unreachable, using stub fallback:', msg);
  }

  // ── Fallback stub (ia-service down) ──────────────────────────────────────
  const hace30 = new Date(hoy.getTime() - 30 * 86_400_000);

  const [totalHabitaciones, reservasRecientes] = await Promise.all([
    prisma.habitacion.count(),
    prisma.reserva.findMany({
      where: {
        estado:        { in: [EstadoReserva.CHECKIN_REALIZADO, EstadoReserva.CHECKOUT_REALIZADO, EstadoReserva.CONFIRMADA] },
        fecha_entrada: { lte: hoy },
        fecha_salida:  { gte: hace30 },
      },
      select: { fecha_entrada: true, fecha_salida: true },
    }),
  ]);

  let nochesVendidasRecientes = 0;
  for (const r of reservasRecientes) {
    const entrada = r.fecha_entrada > hace30 ? r.fecha_entrada : hace30;
    const salida  = r.fecha_salida  < hoy    ? r.fecha_salida  : hoy;
    const noches  = Math.round((salida.getTime() - entrada.getTime()) / 86_400_000);
    if (noches > 0) nochesVendidasRecientes += noches;
  }

  const nochesDisp30 = (totalHabitaciones || 1) * 30;
  const avgOcupacion = Math.min(100, (nochesVendidasRecientes / nochesDisp30) * 100) || 50;

  const DOW_FACTOR: Record<number, number> = {
    0: -0.02, 1: -0.05, 2: 0, 3: 0, 4: 0, 5: 0.05, 6: 0.08,
  };

  const predicciones = Array.from({ length: dias }, (_, i) => {
    const fecha   = new Date(hoy.getTime() + (i + 1) * 86_400_000);
    const factor  = DOW_FACTOR[fecha.getDay()] ?? 0;
    const noise   = (Math.random() - 0.5) * 0.06;
    const pred    = Math.max(0, Math.min(100, avgOcupacion * (1 + factor) + noise * 100));
    const rounded = Math.round(pred * 100) / 100;
    return {
      fecha:               fecha.toISOString().slice(0, 10),
      ocupacion_predicha:  rounded,
      intervalo_inferior:  Math.max(0,   Math.round((pred - 10) * 100) / 100),
      intervalo_superior:  Math.min(100, Math.round((pred + 10) * 100) / 100),
      alerta:              pred < 40 ? 'baja_ocupacion' : pred > 85 ? 'alta_demanda' : null,
    };
  });

  return {
    generado_en:    hoy.toISOString(),
    modelo_version: 'stub-v1',
    advertencia:    'ia-service no disponible — usando proyección simplificada',
    predicciones,
  };
}
