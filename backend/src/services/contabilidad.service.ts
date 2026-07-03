import { TipoAsientoContable } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { AppError } from '../lib/errors';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function requerirLocal(localId: string | null | undefined): string {
  if (!localId) {
    throw new AppError('LOCAL_REQUERIDO', 400, 'La contabilidad se consulta por local — especifique X-Local-Id');
  }
  return localId;
}

// ─── Resumen de ventas ────────────────────────────────────────────────────────

export async function resumenVentas(localId: string | null | undefined, mes: string) {
  const local = requerirLocal(localId);
  if (!/^\d{4}-\d{2}$/.test(mes)) {
    throw new AppError('MES_INVALIDO', 400, 'Formato esperado: YYYY-MM');
  }
  const [anio, mm] = mes.split('-');
  const inicio = `${anio}-${mm}-01`;
  const lastDay = new Date(Number(anio), Number(mm), 0).getDate();
  const fin = `${anio}-${mm}-${String(lastDay).padStart(2, '0')}`;

  const [porMetodo, porTipo, porCanal, totales] = await Promise.all([
    prisma.$queryRaw<Array<{ metodo: string; total: string; cantidad: bigint }>>`
      SELECT p.metodo::text AS metodo, COALESCE(SUM(p.monto), 0)::text AS total, COUNT(*) AS cantidad
      FROM pagos p
      JOIN reservas r     ON r.id = p.reserva_id
      JOIN habitaciones h ON h.id = r.habitacion_id
      WHERE h.local_id = ${local}::uuid
        AND p.estado = 'COMPLETADO'
        AND p.created_at BETWEEN ${inicio}::date AND (${fin}::date + INTERVAL '1 day')
      GROUP BY p.metodo
      ORDER BY total DESC
    `,
    prisma.$queryRaw<Array<{ tipo: string; total: string; cantidad: bigint }>>`
      SELECT h.tipo::text AS tipo, COALESCE(SUM(r.tarifa_acordada), 0)::text AS total, COUNT(*) AS cantidad
      FROM reservas r
      JOIN habitaciones h ON h.id = r.habitacion_id
      WHERE h.local_id = ${local}::uuid
        AND r.estado NOT IN ('CANCELADA', 'NO_SHOW')
        AND r.fecha_entrada BETWEEN ${inicio}::date AND ${fin}::date
      GROUP BY h.tipo
      ORDER BY total DESC
    `,
    prisma.$queryRaw<Array<{ canal: string; total: string; cantidad: bigint }>>`
      SELECT r.canal::text AS canal, COALESCE(SUM(r.tarifa_acordada), 0)::text AS total, COUNT(*) AS cantidad
      FROM reservas r
      JOIN habitaciones h ON h.id = r.habitacion_id
      WHERE h.local_id = ${local}::uuid
        AND r.estado NOT IN ('CANCELADA', 'NO_SHOW')
        AND r.fecha_entrada BETWEEN ${inicio}::date AND ${fin}::date
      GROUP BY r.canal
      ORDER BY total DESC
    `,
    prisma.$queryRaw<Array<{ total_ingresos: string; total_reservas: bigint }>>`
      SELECT COALESCE(SUM(p.monto), 0)::text AS total_ingresos, COUNT(DISTINCT p.id) AS total_reservas
      FROM pagos p
      JOIN reservas r     ON r.id = p.reserva_id
      JOIN habitaciones h ON h.id = r.habitacion_id
      WHERE h.local_id = ${local}::uuid
        AND p.estado = 'COMPLETADO'
        AND p.created_at BETWEEN ${inicio}::date AND (${fin}::date + INTERVAL '1 day')
    `,
  ]);

  const totalIngresos = Number(totales[0]?.total_ingresos ?? 0);
  const totalReservas = Number(totales[0]?.total_reservas ?? 0);

  return {
    mes,
    total_ingresos:   totalIngresos,
    total_reservas:   totalReservas,
    ticket_promedio:  totalReservas > 0 ? totalIngresos / totalReservas : 0,
    por_metodo: porMetodo.map((r) => ({ metodo: r.metodo, total: Number(r.total), cantidad: Number(r.cantidad) })),
    por_tipo:   porTipo.map((r) => ({ tipo: r.tipo, total: Number(r.total), cantidad: Number(r.cantidad) })),
    por_canal:  porCanal.map((r) => ({ canal: r.canal, total: Number(r.total), cantidad: Number(r.cantidad) })),
  };
}

// ─── Libro diario ─────────────────────────────────────────────────────────────
// Simplificación: cada movimiento (pago o gasto de caja) genera UNA fila con
// debe/haber, no partida doble de dos líneas — suficiente para el resumen
// operativo del hotel, no reemplaza un sistema contable formal.

async function generarAsientosFaltantes(localId: string, fechaInicio: string, fechaFin: string): Promise<void> {
  const [pagosPendientes, gastosPendientes] = await Promise.all([
    prisma.$queryRaw<Array<{ id: string; monto: string; metodo: string; created_at: Date; codigo: string }>>`
      SELECT p.id, p.monto::text, p.metodo::text, p.created_at, r.codigo
      FROM pagos p
      JOIN reservas r     ON r.id = p.reserva_id
      JOIN habitaciones h ON h.id = r.habitacion_id
      WHERE h.local_id = ${localId}::uuid
        AND p.estado = 'COMPLETADO'
        AND p.created_at BETWEEN ${fechaInicio}::date AND (${fechaFin}::date + INTERVAL '1 day')
        AND NOT EXISTS (
          SELECT 1 FROM contabilidad_asientos a
          WHERE a.referencia_tipo = 'pago' AND a.referencia_id = p.id
        )
    `,
    prisma.$queryRaw<Array<{ id: string; monto: string; concepto: string; created_at: Date }>>`
      SELECT g.id, g.monto::text, g.concepto, g.created_at
      FROM gastos_caja g
      JOIN turnos t ON t.id = g.turno_id
      WHERE t.local_id = ${localId}::uuid
        AND g.created_at BETWEEN ${fechaInicio}::date AND (${fechaFin}::date + INTERVAL '1 day')
        AND NOT EXISTS (
          SELECT 1 FROM contabilidad_asientos a
          WHERE a.referencia_tipo = 'gasto_caja' AND a.referencia_id = g.id
        )
    `,
  ]);

  if (pagosPendientes.length > 0) {
    await prisma.contabilidadAsiento.createMany({
      data: pagosPendientes.map((p) => ({
        local_id:        localId,
        fecha:           p.created_at,
        tipo:            TipoAsientoContable.ingreso,
        concepto:        `Pago reserva ${p.codigo} — ${p.metodo}`,
        debe:            0,
        haber:           p.monto,
        referencia_id:   p.id,
        referencia_tipo: 'pago',
      })),
    });
  }

  if (gastosPendientes.length > 0) {
    await prisma.contabilidadAsiento.createMany({
      data: gastosPendientes.map((g) => ({
        local_id:        localId,
        fecha:           g.created_at,
        tipo:            TipoAsientoContable.egreso,
        concepto:        `Gasto de caja — ${g.concepto}`,
        debe:            g.monto,
        haber:           0,
        referencia_id:   g.id,
        referencia_tipo: 'gasto_caja',
      })),
    });
  }
}

export async function libroDiario(localId: string | null | undefined, fechaInicio: string, fechaFin: string) {
  const local = requerirLocal(localId);

  await generarAsientosFaltantes(local, fechaInicio, fechaFin);

  const asientos = await prisma.contabilidadAsiento.findMany({
    where: {
      local_id: local,
      fecha: { gte: new Date(fechaInicio), lte: new Date(fechaFin) },
    },
    orderBy: [{ fecha: 'asc' }, { created_at: 'asc' }],
  });

  let saldo = 0;
  const filas = asientos.map((a) => {
    saldo += Number(a.haber) - Number(a.debe);
    return {
      id:              a.id,
      fecha:           a.fecha,
      numero_asiento:  a.numero_asiento,
      tipo:            a.tipo,
      cuenta_contable: a.cuenta_contable,
      concepto:        a.concepto,
      debe:            Number(a.debe),
      haber:           Number(a.haber),
      saldo,
    };
  });

  return {
    fecha_inicio: fechaInicio,
    fecha_fin:    fechaFin,
    total_debe:   filas.reduce((s, f) => s + f.debe, 0),
    total_haber:  filas.reduce((s, f) => s + f.haber, 0),
    saldo_final:  saldo,
    asientos:     filas,
  };
}

export interface CrearAsientoInput {
  fecha:           string;
  tipo:            TipoAsientoContable;
  concepto:        string;
  debe?:           number;
  haber?:          number;
  cuenta_contable?: string;
}

export async function crearAsientoManual(
  localId: string | null | undefined,
  data: CrearAsientoInput,
  creadoPorId?: string,
) {
  const local = requerirLocal(localId);

  return prisma.contabilidadAsiento.create({
    data: {
      local_id:        local,
      fecha:           new Date(data.fecha),
      tipo:            data.tipo,
      concepto:        data.concepto,
      debe:            data.debe  ?? 0,
      haber:           data.haber ?? 0,
      cuenta_contable: data.cuenta_contable ?? null,
      creado_por_id:   creadoPorId ?? null,
    },
  });
}
