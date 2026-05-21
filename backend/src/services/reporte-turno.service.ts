import PDFDocument from 'pdfkit';

type ReporteJSON = Record<string, unknown>;

// ─── Helpers de formato ───────────────────────────────────────────────────────

function fmt(n: unknown): string {
  const num = typeof n === 'number' ? n : Number(n ?? 0);
  return `S/ ${num.toFixed(2)}`;
}

function fmtFecha(d: unknown): string {
  if (!d) return '';
  return new Date(d as string | Date).toLocaleString('es-PE', {
    timeZone:    'America/Lima',
    day:         '2-digit',
    month:       '2-digit',
    year:        'numeric',
    hour:        '2-digit',
    minute:      '2-digit',
  });
}

function fmtFechaSolo(d: unknown): string {
  if (!d) return '';
  return new Date(d as string | Date).toLocaleDateString('es-PE', {
    timeZone: 'America/Lima',
    day:      '2-digit',
    month:    '2-digit',
    year:     'numeric',
  });
}

// ─── Generación del PDF ───────────────────────────────────────────────────────

/**
 * Genera el PDF completo del reporte de turno con 5 secciones.
 * Retorna un Buffer listo para escribir a disco o enviar como respuesta HTTP.
 */
export async function generarPDFReporte(jsonReporte: ReporteJSON): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const buffers: Buffer[] = [];
    const doc = new PDFDocument({ size: 'A4', margin: 40 });

    doc.on('data',  (chunk: Buffer) => buffers.push(chunk));
    doc.on('end',   () => resolve(Buffer.concat(buffers)));
    doc.on('error', reject);

    const enc = (s: unknown) => String(s ?? '');
    const W   = doc.page.width - 80; // ancho útil
    const COL = W / 9;               // ancho de columna estimado para tablas

    // ── ENCABEZADO ────────────────────────────────────────────────────────────
    const cab = (jsonReporte.encabezado ?? {}) as Record<string, unknown>;

    doc.fontSize(16).font('Helvetica-Bold').text(enc(cab.empresa), { align: 'center' });
    doc.fontSize(10).font('Helvetica').text(`RUC: ${enc(cab.ruc)}`, { align: 'center' });
    if (cab.establecimiento) doc.text(enc(cab.establecimiento), { align: 'center' });
    if (cab.direccion)       doc.text(enc(cab.direccion),       { align: 'center' });
    doc.moveDown(0.5);

    doc.fontSize(13).font('Helvetica-Bold').text('REPORTE DE TURNO', { align: 'center' });
    doc.moveDown(0.3);

    // ── SECCIÓN A: Datos del turno ────────────────────────────────────────────
    doc.fontSize(11).font('Helvetica-Bold').text('A. Datos del Turno');
    doc.fontSize(9).font('Helvetica');

    const secA: Array<[string, string]> = [
      ['Vendedor',      enc(cab.vendedor)],
      ['Turno',         enc(cab.turno)],
      ['Fecha',         fmtFechaSolo(cab.fecha_reporte)],
      ['Apertura',      fmtFecha(cab.hora_apertura)],
      ['Cierre',        fmtFecha(cab.hora_cierre)],
      ['Estado caja',   enc(cab.estado_caja)],
      ['Saldo inicial', fmt(cab.saldo_inicial)],
    ];

    secA.forEach(([k, v]) => {
      doc.text(`${k}: `, { continued: true }).font('Helvetica-Bold').text(v).font('Helvetica');
    });
    doc.moveDown();

    // ── SECCIÓN B: Detalle de transacciones ───────────────────────────────────
    doc.fontSize(11).font('Helvetica-Bold').text('B. Detalle de Transacciones');
    doc.moveDown(0.3);

    const transacciones = (jsonReporte.transacciones as Array<Record<string, unknown>>) ?? [];

    if (transacciones.length === 0) {
      doc.fontSize(9).font('Helvetica').text('Sin transacciones en este turno.', { indent: 10 });
    } else {
      const headers = ['Nro', 'Comprobante', 'Cliente', 'Hab.', 'Moneda', 'Monto', 'Método', 'Total'];
      doc.fontSize(7.5).font('Helvetica-Bold');
      let x = 40;
      const colWidths = [30, 70, 100, 30, 35, 45, 55, 50];
      headers.forEach((h, i) => doc.text(h, x + colWidths.slice(0, i).reduce((a, b) => a + b, 0), doc.y, { width: colWidths[i], align: 'left' }));
      doc.moveDown(0.5);
      doc.font('Helvetica').fontSize(7);

      transacciones.forEach((t) => {
        const row = [
          enc(t.nro_transaccion),
          enc(t.nro_documento_comprobante ?? '—'),
          enc(t.cliente).slice(0, 20),
          enc(t.nro_habitacion),
          enc(t.moneda),
          fmt(t.monto),
          enc(t.metodo_pago),
          fmt(t.total_a_pagar),
        ];
        const y = doc.y;
        row.forEach((cell, i) => {
          doc.text(cell, 40 + colWidths.slice(0, i).reduce((a, b) => a + b, 0), y, { width: colWidths[i] });
        });
        doc.moveDown(0.4);
      });
    }
    doc.moveDown();

    // ── SECCIÓN C: Gastos de caja ─────────────────────────────────────────────
    doc.fontSize(11).font('Helvetica-Bold').text('C. Gastos de Caja');
    doc.moveDown(0.3);

    const gastos = (jsonReporte.gastos_caja as Array<Record<string, unknown>>) ?? [];
    const totalGastos = Number(jsonReporte.total_gastos_caja ?? 0);

    if (gastos.length === 0) {
      doc.fontSize(9).font('Helvetica').text('Sin gastos en este turno.', { indent: 10 });
    } else {
      doc.fontSize(8).font('Helvetica');
      gastos.forEach((g) => {
        doc.text(
          `${fmtFecha(g.fecha)}  ${enc(g.concepto)}  ${fmt(g.monto)}  Comprobante: ${enc(g.comprobante_proveedor ?? '—')}  (${enc(g.registrado_por)})`,
        );
      });
    }
    doc.fontSize(9).font('Helvetica-Bold').text(`Total gastos: ${fmt(totalGastos)}`, { indent: 10 });
    doc.moveDown();

    // ── SECCIÓN D: Resumen por método de pago ─────────────────────────────────
    doc.fontSize(11).font('Helvetica-Bold').text('D. Resumen por Método de Pago');
    doc.moveDown(0.3);

    const rp = (jsonReporte.resumen_pagos ?? {}) as Record<string, { cantidad: number; total: number }>;
    doc.fontSize(9).font('Helvetica');

    const metodos: [string, string][] = [
      ['Efectivo',        'efectivo'],
      ['Yape',            'yape'],
      ['Plin',            'plin'],
      ['Tarjeta Débito',  'tarjeta_debito'],
      ['Tarjeta Crédito', 'tarjeta_credito'],
      ['Transferencia',   'transferencia'],
    ];

    metodos.forEach(([label, key]) => {
      const m = rp[key] ?? { cantidad: 0, total: 0 };
      doc.text(`${label.padEnd(18)} Cant: ${m.cantidad}   Total: ${fmt(m.total)}`);
    });
    doc.moveDown();

    // ── SECCIÓN E: Totales ────────────────────────────────────────────────────
    doc.fontSize(11).font('Helvetica-Bold').text('E. Totales de Caja');
    doc.moveDown(0.3);

    const tot = (jsonReporte.totales ?? {}) as Record<string, unknown>;
    const filasTotal: [string, unknown][] = [
      ['Efectivo bruto',          tot.total_efectivo_bruto],
      ['Gastos de caja',          tot.total_gastos_caja],
      ['Efectivo neto',           tot.efectivo_neto],
      ['Billeteras digitales',    tot.total_billeteras_digitales],
      ['Tarjetas',                tot.total_tarjetas],
      ['Transferencias',          tot.total_transferencias],
      ['TOTAL GENERAL',           tot.total_general],
      ['SALDO FINAL CAJA',        tot.saldo_final_caja],
    ];

    doc.fontSize(9).font('Helvetica');
    filasTotal.forEach(([label, val], i) => {
      const isTotal = i >= filasTotal.length - 2;
      if (isTotal) doc.font('Helvetica-Bold');
      doc.text(`${label.padEnd(22)} ${fmt(val)}`);
      if (isTotal) doc.font('Helvetica');
    });
    doc.moveDown(1.5);

    // ── PIE: Firma ────────────────────────────────────────────────────────────
    const firma = (jsonReporte.firma ?? {}) as Record<string, unknown>;
    doc.fontSize(9).font('Helvetica').text('Reporte generado electrónicamente. Firmado por:');
    doc.fontSize(10).font('Helvetica-Bold').text(enc(firma.recepcionista_nombre));
    doc.fontSize(7).font('Helvetica').text(`Hash: ${enc(firma.firma_hash).slice(0, 16)}...`);
    doc.text(`Cerrado el: ${fmtFecha(firma.firmado_at)}`);

    doc.end();
  });
}
