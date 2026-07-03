import { Router, Request, Response } from 'express';
import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { authenticate } from '../middleware/auth';
import { requirePermiso } from '../middleware/permisos';
import PDFDocument from 'pdfkit';
import ExcelJS from 'exceljs';
import { AZUL as AZUL_XLSX, BLANCO as BLANCO_XLSX, GRIS as GRIS_XLSX, headerStyle, autoWidth } from '../lib/exceljsHelpers';

const router = Router();
router.use(authenticate);

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Fragmento SQL condicional para filtrar por local a través de un JOIN a `habitaciones`.
 * `alias` es siempre un literal fijo (nunca input de usuario) — seguro para Prisma.raw.
 */
function filtroLocal(alias: string, localId: string | null | undefined) {
  return localId ? Prisma.sql`AND ${Prisma.raw(alias)}.local_id = ${localId}::uuid` : Prisma.empty;
}

function parseMes(mesParam: unknown): { inicio: string; fin: string; label: string } | null {
  const mes = typeof mesParam === 'string' ? mesParam : '';
  if (!/^\d{4}-\d{2}$/.test(mes)) return null;
  const [anio, mm] = mes.split('-');
  const inicio = `${anio}-${mm}-01`;
  const lastDay = new Date(Number(anio), Number(mm), 0).getDate();
  const fin = `${anio}-${mm}-${String(lastDay).padStart(2, '0')}`;
  const nombres = ['enero','febrero','marzo','abril','mayo','junio',
                   'julio','agosto','septiembre','octubre','noviembre','diciembre'];
  const label = `${nombres[Number(mm) - 1].toUpperCase()} ${anio}`;
  return { inicio, fin, label };
}

function num(v: unknown): number {
  return typeof v === 'bigint' ? Number(v) : Number(v ?? 0);
}

function fmt(v: unknown): string {
  return `S/ ${num(v).toFixed(2)}`;
}

// ─── Cálculo de datos ─────────────────────────────────────────────────────────

async function calcularReporte(inicio: string, fin: string, localId: string | null | undefined) {
  type ResumenRow = {
    total_reservas: bigint; cancelaciones: bigint; no_shows: bigint; checkins: bigint;
    ingresos: string; noches: string;
  };
  const [resumen] = await prisma.$queryRaw<ResumenRow[]>`
    SELECT
      COUNT(*) FILTER (WHERE r.estado != 'CANCELADA' AND r.estado != 'NO_SHOW') AS total_reservas,
      COUNT(*) FILTER (WHERE r.estado = 'CANCELADA')  AS cancelaciones,
      COUNT(*) FILTER (WHERE r.estado = 'NO_SHOW')    AS no_shows,
      COUNT(*) FILTER (WHERE r.estado IN ('CHECKIN_REALIZADO','CHECKOUT_REALIZADO')) AS checkins,
      COALESCE(SUM(r.tarifa_acordada) FILTER (WHERE r.estado != 'CANCELADA' AND r.estado != 'NO_SHOW'), 0)::text AS ingresos,
      COALESCE(SUM(r.fecha_salida - r.fecha_entrada)   FILTER (WHERE r.estado != 'CANCELADA' AND r.estado != 'NO_SHOW'), 0)::text AS noches
    FROM reservas r
    JOIN habitaciones h ON h.id = r.habitacion_id
    WHERE r.fecha_entrada BETWEEN ${inicio}::date AND ${fin}::date
      ${filtroLocal('h', localId)}
  `;

  const noches = Number(resumen.noches ?? 0);
  const ingresos = Number(resumen.ingresos ?? 0);
  const dias_mes = (new Date(fin).getDate());
  const ocupacion_pct = noches > 0
    ? Math.min(100, (noches / (33 * dias_mes)) * 100)
    : 0;

  type MetodoRow = { metodo: string; total: string; cantidad: bigint };
  const por_metodo = await prisma.$queryRaw<MetodoRow[]>`
    SELECT p.metodo::text, COALESCE(SUM(p.monto),0)::text AS total, COUNT(*) AS cantidad
    FROM pagos p
    JOIN reservas r ON r.id = p.reserva_id
    JOIN habitaciones h ON h.id = r.habitacion_id
    WHERE r.fecha_entrada BETWEEN ${inicio}::date AND ${fin}::date
      AND p.estado = 'COMPLETADO'
      ${filtroLocal('h', localId)}
    GROUP BY p.metodo
    ORDER BY SUM(p.monto) DESC
  `;

  type CanalRow = { canal: string; total: string; cantidad: bigint };
  const por_canal = await prisma.$queryRaw<CanalRow[]>`
    SELECT r.canal::text, COALESCE(SUM(r.tarifa_acordada),0)::text AS total, COUNT(*) AS cantidad
    FROM reservas r
    JOIN habitaciones h ON h.id = r.habitacion_id
    WHERE r.fecha_entrada BETWEEN ${inicio}::date AND ${fin}::date
      AND r.estado != 'CANCELADA' AND r.estado != 'NO_SHOW'
      ${filtroLocal('h', localId)}
    GROUP BY r.canal
    ORDER BY SUM(r.tarifa_acordada) DESC
  `;

  type TipoRow = { tipo: string; total: string; noches: string; cantidad: bigint };
  const por_tipo = await prisma.$queryRaw<TipoRow[]>`
    SELECT h.tipo::text, COALESCE(SUM(r.tarifa_acordada),0)::text AS total,
           COALESCE(SUM(r.fecha_salida - r.fecha_entrada),0)::text AS noches,
           COUNT(*) AS cantidad
    FROM reservas r
    JOIN habitaciones h ON h.id = r.habitacion_id
    WHERE r.fecha_entrada BETWEEN ${inicio}::date AND ${fin}::date
      AND r.estado != 'CANCELADA' AND r.estado != 'NO_SHOW'
      ${filtroLocal('h', localId)}
    GROUP BY h.tipo
    ORDER BY SUM(r.tarifa_acordada) DESC
  `;

  type HabRow = { numero: string; tipo: string; ingresos: string; noches: string };
  const top_habitaciones = await prisma.$queryRaw<HabRow[]>`
    SELECT h.numero, h.tipo::text, COALESCE(SUM(r.tarifa_acordada),0)::text AS ingresos,
           COALESCE(SUM(r.fecha_salida - r.fecha_entrada),0)::text AS noches
    FROM reservas r
    JOIN habitaciones h ON h.id = r.habitacion_id
    WHERE r.fecha_entrada BETWEEN ${inicio}::date AND ${fin}::date
      AND r.estado != 'CANCELADA' AND r.estado != 'NO_SHOW'
      ${filtroLocal('h', localId)}
    GROUP BY h.numero, h.tipo
    ORDER BY SUM(r.tarifa_acordada) DESC
    LIMIT 5
  `;

  type HueRow = { nombre: string; num_doc: string; visitas: bigint; gasto: string };
  const top_huespedes = await prisma.$queryRaw<HueRow[]>`
    SELECT hue.nombre || ' ' || hue.apellido AS nombre,
           hue.numero_documento AS num_doc,
           COUNT(r.id) AS visitas,
           COALESCE(SUM(r.tarifa_acordada),0)::text AS gasto
    FROM reservas r
    JOIN huespedes hue ON hue.id = r.huesped_id
    JOIN habitaciones h ON h.id = r.habitacion_id
    WHERE r.fecha_entrada BETWEEN ${inicio}::date AND ${fin}::date
      AND r.estado != 'CANCELADA' AND r.estado != 'NO_SHOW'
      ${filtroLocal('h', localId)}
    GROUP BY hue.id, hue.nombre, hue.apellido, hue.numero_documento
    ORDER BY SUM(r.tarifa_acordada) DESC
    LIMIT 5
  `;

  type DetalleRow = {
    codigo: string; huesped: string; habitacion: string; tipo: string;
    entrada: Date; salida: Date; noches: string; tarifa: string;
    estado: string; canal: string;
  };
  const detalle = await prisma.$queryRaw<DetalleRow[]>`
    SELECT r.codigo,
           hue.nombre || ' ' || hue.apellido AS huesped,
           h.numero AS habitacion, h.tipo::text,
           r.fecha_entrada AS entrada, r.fecha_salida AS salida,
           (r.fecha_salida - r.fecha_entrada)::text AS noches,
           r.tarifa_acordada::text AS tarifa,
           r.estado::text, r.canal::text
    FROM reservas r
    JOIN huespedes hue ON hue.id = r.huesped_id
    JOIN habitaciones h ON h.id = r.habitacion_id
    WHERE r.fecha_entrada BETWEEN ${inicio}::date AND ${fin}::date
      ${filtroLocal('h', localId)}
    ORDER BY r.fecha_entrada, r.codigo
  `;

  return {
    resumen: {
      total_reservas: num(resumen.total_reservas),
      cancelaciones:  num(resumen.cancelaciones),
      no_shows:       num(resumen.no_shows),
      checkins:       num(resumen.checkins),
      ingresos_totales: ingresos,
      total_noches:   noches,
      promedio_por_noche: noches > 0 ? ingresos / noches : 0,
      ocupacion_promedio_pct: Math.round(ocupacion_pct * 100) / 100,
    },
    por_metodo: por_metodo.map(r => ({ metodo: r.metodo, total: Number(r.total), cantidad: num(r.cantidad) })),
    por_canal:  por_canal.map(r  => ({ canal: r.canal,   total: Number(r.total), cantidad: num(r.cantidad) })),
    por_tipo:   por_tipo.map(r   => ({ tipo: r.tipo, total: Number(r.total), noches: Number(r.noches), cantidad: num(r.cantidad) })),
    top_habitaciones: top_habitaciones.map(r => ({ numero: r.numero, tipo: r.tipo, ingresos: Number(r.ingresos), noches: Number(r.noches) })),
    top_huespedes: top_huespedes.map(r => ({ nombre: r.nombre, num_doc: r.num_doc, visitas: num(r.visitas), gasto: Number(r.gasto) })),
    detalle: detalle.map(r => ({
      codigo: r.codigo, huesped: r.huesped, habitacion: r.habitacion, tipo: r.tipo,
      entrada: r.entrada ? new Date(r.entrada).toISOString().slice(0,10) : '',
      salida:  r.salida  ? new Date(r.salida).toISOString().slice(0,10)  : '',
      noches: Number(r.noches), tarifa: Number(r.tarifa),
      estado: r.estado, canal: r.canal,
    })),
  };
}

// ─── GET /reportes/mensual ────────────────────────────────────────────────────

router.get('/reportes/mensual', requirePermiso('reportes.ver'), async (req: Request, res: Response) => {
  const rango = parseMes(req.query.mes);
  if (!rango) {
    res.status(400).json({ code: 'MES_INVALIDO', message: 'Formato esperado: YYYY-MM' });
    return;
  }
  try {
    const data = await calcularReporte(rango.inicio, rango.fin, req.localId);
    res.json({ mes: req.query.mes, periodo: rango, ...data });
  } catch (err) {
    console.error('[reportes] mensual error', err);
    res.status(500).json({ code: 'ERROR_INTERNO', message: 'Error generando reporte' });
  }
});

// ─── GET /reportes/mensual/pdf ────────────────────────────────────────────────

router.get('/reportes/mensual/pdf', requirePermiso('reportes.ver'), async (req: Request, res: Response) => {
  const rango = parseMes(req.query.mes);
  if (!rango) {
    res.status(400).json({ code: 'MES_INVALIDO', message: 'Formato esperado: YYYY-MM' });
    return;
  }
  try {
    const data = await calcularReporte(rango.inicio, rango.fin, req.localId);
    const { resumen, por_metodo, por_tipo, top_habitaciones, top_huespedes, detalle } = data;

    const buffers: Buffer[] = [];
    const doc = new PDFDocument({ size: 'A4', margin: 40 });
    doc.on('data', (c: Buffer) => buffers.push(c));

    await new Promise<void>((resolve, reject) => {
      doc.on('end', resolve);
      doc.on('error', reject);

      const W = doc.page.width - 80;
      const AZUL = '#1B3A6B';

      // ── Portada ──
      doc.rect(40, 40, W, 70).fill(AZUL);
      doc.fillColor('white').fontSize(18).font('Helvetica-Bold')
         .text('Hotel Hotelia', 50, 55, { width: W - 20, align: 'center' });
      doc.fontSize(10).font('Helvetica')
         .text(`RUC: ${process.env.SUNAT_RUC ?? '20600000001'}`, 50, 78, { width: W - 20, align: 'center' });
      doc.fontSize(13).font('Helvetica-Bold')
         .text(`REPORTE MENSUAL — ${rango.label}`, 50, 93, { width: W - 20, align: 'center' });
      doc.fillColor('black').moveDown(4);

      const now = new Date().toLocaleString('es-PE', { timeZone: 'America/Lima' });
      doc.fontSize(8).font('Helvetica').fillColor('#666')
         .text(`Generado: ${now}`, { align: 'right' });
      doc.moveDown(1);

      // ── Resumen ejecutivo ──
      doc.fontSize(12).font('Helvetica-Bold').fillColor(AZUL).text('RESUMEN EJECUTIVO');
      doc.moveDown(0.3);
      const kpis = [
        ['Total ingresos',     fmt(resumen.ingresos_totales)],
        ['Reservas activas',   String(resumen.total_reservas)],
        ['Noches vendidas',    String(resumen.total_noches)],
        ['Ocupación media',    `${resumen.ocupacion_promedio_pct.toFixed(1)}%`],
        ['ADR (promedio/noche)', fmt(resumen.promedio_por_noche)],
        ['Check-ins',         String(resumen.checkins)],
        ['Cancelaciones',     String(resumen.cancelaciones)],
        ['No-shows',          String(resumen.no_shows)],
      ];
      const COL2 = W / 2 - 5;
      kpis.forEach(([k, v], i) => {
        const x = i % 2 === 0 ? 40 : 40 + COL2 + 10;
        if (i % 2 === 0 && i > 0) doc.moveDown(0.3);
        const y = doc.y;
        doc.fontSize(9).font('Helvetica').fillColor('#333').text(k + ':', x, y, { width: COL2 / 2, continued: true });
        doc.font('Helvetica-Bold').fillColor('black').text(' ' + v);
      });
      doc.moveDown(1.2);

      // ── Helper tabla ──
      const tabla = (headers: string[], rows: string[][], colWidths: number[]) => {
        const rowH = 16;
        const startX = 40;
        let y = doc.y;

        // Header
        let x = startX;
        doc.rect(startX, y, W, rowH).fill(AZUL);
        headers.forEach((h, i) => {
          doc.fillColor('white').fontSize(8).font('Helvetica-Bold').text(h, x + 3, y + 4, { width: colWidths[i], align: 'left' });
          x += colWidths[i];
        });
        y += rowH;

        rows.forEach((row, ri) => {
          if (doc.y > doc.page.height - 80) {
            doc.addPage();
            y = doc.y;
          }
          doc.rect(startX, y, W, rowH).fill(ri % 2 === 0 ? '#F5F5F5' : 'white');
          x = startX;
          row.forEach((cell, i) => {
            doc.fillColor('#222').fontSize(8).font('Helvetica').text(cell, x + 3, y + 4, { width: colWidths[i] - 4, align: 'left' });
            x += colWidths[i];
          });
          y += rowH;
        });
        doc.y = y + 4;
      };

      // ── Por método de pago ──
      if (por_metodo.length > 0) {
        doc.fontSize(12).font('Helvetica-Bold').fillColor(AZUL).text('INGRESOS POR MÉTODO DE PAGO');
        doc.moveDown(0.3);
        tabla(
          ['Método', 'Ingresos', 'Operaciones'],
          por_metodo.map(r => [r.metodo, fmt(r.total), String(r.cantidad)]),
          [W * 0.5, W * 0.3, W * 0.2],
        );
        doc.moveDown(1);
      }

      // ── Por tipo habitación ──
      if (por_tipo.length > 0) {
        doc.fontSize(12).font('Helvetica-Bold').fillColor(AZUL).text('RENDIMIENTO POR TIPO DE HABITACIÓN');
        doc.moveDown(0.3);
        tabla(
          ['Tipo', 'Ingresos', 'Noches', 'Reservas'],
          por_tipo.map(r => [r.tipo, fmt(r.total), String(r.noches), String(r.cantidad)]),
          [W * 0.35, W * 0.25, W * 0.2, W * 0.2],
        );
        doc.moveDown(1);
      }

      // ── Top habitaciones ──
      if (top_habitaciones.length > 0) {
        doc.fontSize(12).font('Helvetica-Bold').fillColor(AZUL).text('TOP 5 HABITACIONES');
        doc.moveDown(0.3);
        tabla(
          ['Nro', 'Tipo', 'Ingresos', 'Noches'],
          top_habitaciones.map(r => [r.numero, r.tipo, fmt(r.ingresos), String(r.noches)]),
          [W * 0.15, W * 0.3, W * 0.3, W * 0.25],
        );
        doc.moveDown(1);
      }

      // ── Top huéspedes ──
      if (top_huespedes.length > 0) {
        doc.fontSize(12).font('Helvetica-Bold').fillColor(AZUL).text('TOP 5 HUÉSPEDES');
        doc.moveDown(0.3);
        tabla(
          ['Nombre', 'Documento', 'Visitas', 'Gasto total'],
          top_huespedes.map(r => [r.nombre, r.num_doc, String(r.visitas), fmt(r.gasto)]),
          [W * 0.4, W * 0.2, W * 0.1, W * 0.3],
        );
        doc.moveDown(1);
      }

      // ── Detalle reservas ──
      if (detalle.length > 0) {
        doc.addPage();
        doc.fontSize(12).font('Helvetica-Bold').fillColor(AZUL).text('DETALLE DE RESERVAS');
        doc.moveDown(0.3);
        tabla(
          ['Código', 'Huésped', 'Hab', 'Entrada', 'Salida', 'Noches', 'Tarifa', 'Estado'],
          detalle.map(r => [r.codigo, r.huesped.substring(0,20), r.habitacion, r.entrada, r.salida, String(r.noches), fmt(r.tarifa), r.estado]),
          [W*0.1, W*0.22, W*0.06, W*0.1, W*0.1, W*0.07, W*0.1, W*0.14],
        );
      }

      doc.end();
    });

    const pdf = Buffer.concat(buffers);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="reporte-${req.query.mes}.pdf"`);
    res.send(pdf);
  } catch (err) {
    console.error('[reportes] pdf error', err);
    res.status(500).json({ code: 'ERROR_INTERNO', message: 'Error generando PDF' });
  }
});

// ─── GET /reportes/mensual/excel ──────────────────────────────────────────────

router.get('/reportes/mensual/excel', requirePermiso('reportes.ver'), async (req: Request, res: Response) => {
  const rango = parseMes(req.query.mes);
  if (!rango) {
    res.status(400).json({ code: 'MES_INVALIDO', message: 'Formato esperado: YYYY-MM' });
    return;
  }
  try {
    const data = await calcularReporte(rango.inicio, rango.fin, req.localId);
    const { resumen, por_metodo, por_canal, por_tipo, top_habitaciones, top_huespedes, detalle } = data;

    const wb = new ExcelJS.Workbook();
    wb.creator = 'Hotel Hotelia PMS';
    wb.created = new Date();

    const AZUL = AZUL_XLSX, BLANCO = BLANCO_XLSX, GRIS = GRIS_XLSX;

    // ── Hoja Resumen ──
    const wsR = wb.addWorksheet('Resumen');
    wsR.mergeCells('A1:C1');
    wsR.getCell('A1').value = `Reporte Mensual — ${rango.label}`;
    wsR.getCell('A1').font = { bold: true, size: 14, color: BLANCO };
    wsR.getCell('A1').fill = { type: 'pattern', pattern: 'solid', fgColor: AZUL };
    wsR.getCell('A1').alignment = { horizontal: 'center' };
    wsR.getRow(1).height = 28;
    wsR.addRow([]);

    const kpis: [string, string | number][] = [
      ['Total ingresos',         resumen.ingresos_totales],
      ['Reservas activas',       resumen.total_reservas],
      ['Noches vendidas',        resumen.total_noches],
      ['Ocupación media (%)',    resumen.ocupacion_promedio_pct],
      ['ADR (promedio/noche)',   resumen.promedio_por_noche],
      ['Check-ins',             resumen.checkins],
      ['Cancelaciones',         resumen.cancelaciones],
      ['No-shows',              resumen.no_shows],
    ];
    kpis.forEach(([k, v]) => {
      const r = wsR.addRow([k, v]);
      r.getCell(1).font = { bold: true };
    });
    autoWidth(wsR);

    // ── Hoja Por método de pago ──
    const wsM = wb.addWorksheet('Por método pago');
    const hM = wsM.addRow(['Método', 'Ingresos (S/)', 'Operaciones']);
    headerStyle(wsM, hM);
    por_metodo.forEach((r, i) => {
      const row = wsM.addRow([r.metodo, r.total, r.cantidad]);
      if (i % 2 === 0) row.eachCell(c => { c.fill = { type: 'pattern', pattern: 'solid', fgColor: GRIS }; });
    });
    autoWidth(wsM);

    // ── Hoja Por canal ──
    const wsC = wb.addWorksheet('Por canal');
    const hC = wsC.addRow(['Canal', 'Ingresos (S/)', 'Reservas']);
    headerStyle(wsC, hC);
    por_canal.forEach((r, i) => {
      const row = wsC.addRow([r.canal, r.total, r.cantidad]);
      if (i % 2 === 0) row.eachCell(c => { c.fill = { type: 'pattern', pattern: 'solid', fgColor: GRIS }; });
    });
    autoWidth(wsC);

    // ── Hoja Por habitación ──
    const wsH = wb.addWorksheet('Por habitación');
    const hH = wsH.addRow(['Tipo', 'Ingresos (S/)', 'Noches', 'Reservas']);
    headerStyle(wsH, hH);
    por_tipo.forEach((r, i) => {
      const row = wsH.addRow([r.tipo, r.total, r.noches, r.cantidad]);
      if (i % 2 === 0) row.eachCell(c => { c.fill = { type: 'pattern', pattern: 'solid', fgColor: GRIS }; });
    });
    autoWidth(wsH);

    // ── Hoja Top habitaciones ──
    const wsTH = wb.addWorksheet('Top habitaciones');
    const hTH = wsTH.addRow(['Nro', 'Tipo', 'Ingresos (S/)', 'Noches']);
    headerStyle(wsTH, hTH);
    top_habitaciones.forEach((r, i) => {
      const row = wsTH.addRow([r.numero, r.tipo, r.ingresos, r.noches]);
      if (i % 2 === 0) row.eachCell(c => { c.fill = { type: 'pattern', pattern: 'solid', fgColor: GRIS }; });
    });
    autoWidth(wsTH);

    // ── Hoja Top huéspedes ──
    const wsTHu = wb.addWorksheet('Top huéspedes');
    const hTHu = wsTHu.addRow(['Nombre', 'Documento', 'Visitas', 'Gasto total (S/)']);
    headerStyle(wsTHu, hTHu);
    top_huespedes.forEach((r, i) => {
      const row = wsTHu.addRow([r.nombre, r.num_doc, r.visitas, r.gasto]);
      if (i % 2 === 0) row.eachCell(c => { c.fill = { type: 'pattern', pattern: 'solid', fgColor: GRIS }; });
    });
    autoWidth(wsTHu);

    // ── Hoja Detalle reservas ──
    const wsD = wb.addWorksheet('Detalle reservas');
    const hD = wsD.addRow(['Código', 'Huésped', 'Hab', 'Tipo', 'Entrada', 'Salida', 'Noches', 'Tarifa (S/)', 'Estado', 'Canal']);
    headerStyle(wsD, hD);
    detalle.forEach((r, i) => {
      const row = wsD.addRow([r.codigo, r.huesped, r.habitacion, r.tipo, r.entrada, r.salida, r.noches, r.tarifa, r.estado, r.canal]);
      if (i % 2 === 0) row.eachCell(c => { c.fill = { type: 'pattern', pattern: 'solid', fgColor: GRIS }; });
    });
    autoWidth(wsD);

    const buf = await wb.xlsx.writeBuffer();
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="reporte-${req.query.mes}.xlsx"`);
    res.send(buf);
  } catch (err) {
    console.error('[reportes] excel error', err);
    res.status(500).json({ code: 'ERROR_INTERNO', message: 'Error generando Excel' });
  }
});

// ─── GET /reportes/comparativo ────────────────────────────────────────────────

router.get('/reportes/comparativo', requirePermiso('reportes.ver'), async (req: Request, res: Response) => {
  const rango = parseMes(req.query.mes);
  if (!rango) {
    res.status(400).json({ code: 'MES_INVALIDO', message: 'Formato esperado: YYYY-MM' });
    return;
  }
  try {
    const [anio, mm] = (req.query.mes as string).split('-').map(Number);
    const mesAnt = mm === 1 ? `${anio - 1}-12` : `${anio}-${String(mm - 1).padStart(2, '0')}`;
    const rangoAnt = parseMes(mesAnt)!;

    const [actual, anterior] = await Promise.all([
      calcularReporte(rango.inicio, rango.fin, req.localId),
      calcularReporte(rangoAnt.inicio, rangoAnt.fin, req.localId),
    ]);

    const pct = (a: number, b: number) =>
      b === 0 ? null : Math.round(((a - b) / b) * 10000) / 100;

    res.json({
      mes_actual:   req.query.mes,
      mes_anterior: mesAnt,
      actual:   actual.resumen,
      anterior: anterior.resumen,
      variacion: {
        ingresos_pct:    pct(actual.resumen.ingresos_totales,        anterior.resumen.ingresos_totales),
        ocupacion_pct:   pct(actual.resumen.ocupacion_promedio_pct,  anterior.resumen.ocupacion_promedio_pct),
        reservas_pct:    pct(actual.resumen.total_reservas,          anterior.resumen.total_reservas),
        adr_pct:         pct(actual.resumen.promedio_por_noche,      anterior.resumen.promedio_por_noche),
        cancelaciones_pct: pct(actual.resumen.cancelaciones,         anterior.resumen.cancelaciones),
      },
    });
  } catch (err) {
    console.error('[reportes] comparativo error', err);
    res.status(500).json({ code: 'ERROR_INTERNO', message: 'Error generando comparativo' });
  }
});

export default router;
