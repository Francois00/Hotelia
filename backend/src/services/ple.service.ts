import { prisma } from '../lib/prisma';
import { AppError } from '../lib/errors';

// ─── PLE (Programa de Libros Electrónicos) — SUNAT ────────────────────────────
//
// ⚠️  MEJOR ESFUERZO, NO VALIDADO CONTRA EL SPEC OFICIAL DE SUNAT.
// Esta exportación genera un archivo de texto delimitado por "|" siguiendo la
// estructura general de los libros PLE (Registro de Ventas / Registro de
// Compras), pero NO garantiza cumplir exactamente el layout de campos vigente
// de SUNAT (que cambia de versión periódicamente). Antes de presentar estos
// archivos ante SUNAT, un contador debe validarlos contra el Anexo técnico
// vigente o contra el validador oficial de SUNAT (PLE Cóndor / Validador PLE).
// No usar en producción sin esa validación.

interface FilaVentas {
  fecha_emision:   string;
  tipo_comprobante: string; // 03=boleta, 01=factura (código catálogo 10 SUNAT)
  serie:           string;
  correlativo:     string;
  tipo_doc_cliente: string;
  num_doc_cliente: string;
  razon_social:    string;
  valor_venta:     number;
  igv:             number;
  importe_total:   number;
  estado:          string;
}

function formatearFilaVentas(f: FilaVentas): string {
  // Estructura simplificada tipo Registro de Ventas (campos más comunes del layout 14.1):
  // Periodo|CUO|FechaEmision||TipoComprobante|Serie|Correlativo||TipoDocCliente|NumDocCliente|RazonSocial|
  // BaseImponible|IGV||||ImporteTotal||||||||Moneda|TipoCambio|Estado
  const campos = [
    f.fecha_emision.replace(/-/g, '').slice(0, 6), // periodo YYYYMM
    '',                                             // CUO (correlativo único de operación) — no generado
    f.fecha_emision,
    '',
    f.tipo_comprobante,
    f.serie,
    f.correlativo,
    '',
    f.tipo_doc_cliente,
    f.num_doc_cliente,
    f.razon_social,
    f.valor_venta.toFixed(2),
    f.igv.toFixed(2),
    '', '', '',
    f.importe_total.toFixed(2),
    '', '', '', '', '', '', '',
    'PEN',
    '1.000',
    f.estado,
  ];
  return campos.join('|') + '|';
}

const TIPO_DOC_MAP: Record<string, string> = { DNI: '1', PASAPORTE: '7', CE: '4', RUC: '6', DOC_EXTRANJERO: '0' };

export async function generarRegistroVentas(localId: string | null | undefined, mes: string): Promise<string> {
  if (!localId) {
    throw new AppError('LOCAL_REQUERIDO', 400, 'El PLE se genera por local — especifique X-Local-Id');
  }
  if (!/^\d{4}-\d{2}$/.test(mes)) {
    throw new AppError('MES_INVALIDO', 400, 'Formato esperado: YYYY-MM');
  }
  const [anio, mm] = mes.split('-');
  const inicio = `${anio}-${mm}-01`;
  const lastDay = new Date(Number(anio), Number(mm), 0).getDate();
  const fin = `${anio}-${mm}-${String(lastDay).padStart(2, '0')}`;

  const comprobantes = await prisma.comprobante.findMany({
    where: {
      fecha_emision: { gte: new Date(inicio), lte: new Date(fin) },
      reserva: { habitacion: { local_id: localId } },
    },
    include: {
      reserva: { include: { huesped: true } },
    },
    orderBy: { fecha_emision: 'asc' },
  });

  const filas = comprobantes.map((c): FilaVentas => {
    const total = Number(c.total);
    const valorVenta = Number((total / 1.18).toFixed(2));
    const igv = Number((total - valorVenta).toFixed(2));
    const h = c.reserva.huesped;
    return {
      fecha_emision:    c.fecha_emision.toISOString().slice(0, 10),
      tipo_comprobante: c.tipo === 'FACTURA' ? '01' : '03',
      serie:            c.serie,
      correlativo:      c.correlativo,
      tipo_doc_cliente: TIPO_DOC_MAP[h.tipo_documento] ?? '0',
      num_doc_cliente:  h.numero_documento,
      razon_social:     `${h.nombre} ${h.apellido}`.trim(),
      valor_venta:      valorVenta,
      igv,
      importe_total:    total,
      estado:           c.estado === 'EMITIDO' ? '1' : '2',
    };
  });

  const encabezado = `# PLE Registro de Ventas — Local ${localId} — Periodo ${mes} — GENERADO SIN VALIDAR (ver comentario en ple.service.ts)`;
  return [encabezado, ...filas.map(formatearFilaVentas)].join('\n');
}

export async function generarRegistroCompras(localId: string | null | undefined, mes: string): Promise<string> {
  if (!localId) {
    throw new AppError('LOCAL_REQUERIDO', 400, 'El PLE se genera por local — especifique X-Local-Id');
  }
  if (!/^\d{4}-\d{2}$/.test(mes)) {
    throw new AppError('MES_INVALIDO', 400, 'Formato esperado: YYYY-MM');
  }
  const [anio, mm] = mes.split('-');
  const inicio = `${anio}-${mm}-01`;
  const lastDay = new Date(Number(anio), Number(mm), 0).getDate();
  const fin = `${anio}-${mm}-${String(lastDay).padStart(2, '0')}`;

  // Registro de compras: gastos de caja del local en el periodo (no hay proveedor/RUC
  // estructurado en gastos_caja hoy — se exporta con los campos disponibles).
  const gastos = await prisma.gastoCaja.findMany({
    where: {
      created_at: { gte: new Date(inicio), lte: new Date(fin) },
      turno: { local_id: localId },
    },
    orderBy: { created_at: 'asc' },
  });

  const encabezado = `# PLE Registro de Compras — Local ${localId} — Periodo ${mes} — GENERADO SIN VALIDAR (ver comentario en ple.service.ts)`;
  const filas = gastos.map((g) => {
    const monto = Number(g.monto);
    const valorCompra = Number((monto / 1.18).toFixed(2));
    const igv = Number((monto - valorCompra).toFixed(2));
    const campos = [
      mm ? `${anio}${mm}` : '',
      '',
      g.created_at.toISOString().slice(0, 10),
      '',
      g.comprobante_proveedor ?? '',
      '',
      '',
      '',
      g.concepto,
      valorCompra.toFixed(2),
      igv.toFixed(2),
      '',
      monto.toFixed(2),
      'PEN', '1.000',
    ];
    return campos.join('|') + '|';
  });

  return [encabezado, ...filas].join('\n');
}
