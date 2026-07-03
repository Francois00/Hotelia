import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import ExcelJS from 'exceljs';
import { TipoAsientoContable } from '@prisma/client';
import { authenticate } from '../middleware/auth';
import { requirePermiso } from '../middleware/permisos';
import { headerStyle, autoWidth } from '../lib/exceljsHelpers';
import * as service from '../services/contabilidad.service';
import { generarRegistroVentas, generarRegistroCompras } from '../services/ple.service';

const router = Router();
router.use(authenticate);

const crearAsientoSchema = z.object({
  fecha:           z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Formato YYYY-MM-DD requerido'),
  tipo:            z.nativeEnum(TipoAsientoContable),
  concepto:        z.string().min(1).max(500),
  debe:            z.number().min(0).optional(),
  haber:           z.number().min(0).optional(),
  cuenta_contable: z.string().max(20).optional(),
});

// ─── GET /contabilidad/resumen-ventas?mes=YYYY-MM ─────────────────────────────

router.get('/contabilidad/resumen-ventas', requirePermiso('contabilidad.ver'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const mes = typeof req.query.mes === 'string' ? req.query.mes : new Date().toISOString().slice(0, 7);
    const resumen = await service.resumenVentas(req.localId, mes);
    res.json(resumen);
  } catch (err) { next(err); }
});

// ─── GET /contabilidad/libro-diario?fecha_inicio=&fecha_fin= ──────────────────

router.get('/contabilidad/libro-diario', requirePermiso('contabilidad.ver'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { fecha_inicio, fecha_fin } = req.query as { fecha_inicio?: string; fecha_fin?: string };
    if (!fecha_inicio || !fecha_fin) {
      res.status(400).json({ code: 'FECHAS_REQUERIDAS', message: 'Se requiere fecha_inicio y fecha_fin' });
      return;
    }
    const libro = await service.libroDiario(req.localId, fecha_inicio, fecha_fin);
    res.json(libro);
  } catch (err) { next(err); }
});

// ─── GET /contabilidad/libro-diario/excel ─────────────────────────────────────

router.get('/contabilidad/libro-diario/excel', requirePermiso('contabilidad.exportar'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { fecha_inicio, fecha_fin } = req.query as { fecha_inicio?: string; fecha_fin?: string };
    if (!fecha_inicio || !fecha_fin) {
      res.status(400).json({ code: 'FECHAS_REQUERIDAS', message: 'Se requiere fecha_inicio y fecha_fin' });
      return;
    }
    const libro = await service.libroDiario(req.localId, fecha_inicio, fecha_fin);

    const wb = new ExcelJS.Workbook();
    wb.creator = 'Hotel PMS';
    wb.created = new Date();

    const ws = wb.addWorksheet('Libro Diario');
    const header = ws.addRow(['Fecha', 'Tipo', 'Cuenta', 'Concepto', 'Debe (S/)', 'Haber (S/)', 'Saldo (S/)']);
    headerStyle(ws, header);
    libro.asientos.forEach((a) => {
      ws.addRow([
        a.fecha.toISOString().slice(0, 10),
        a.tipo,
        a.cuenta_contable ?? '',
        a.concepto,
        a.debe,
        a.haber,
        a.saldo,
      ]);
    });
    const totalRow = ws.addRow(['', '', '', 'TOTALES', libro.total_debe, libro.total_haber, libro.saldo_final]);
    totalRow.font = { bold: true };
    autoWidth(ws);

    const buffer = await wb.xlsx.writeBuffer();
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="libro-diario-${fecha_inicio}_${fecha_fin}.xlsx"`);
    res.send(Buffer.from(buffer));
  } catch (err) { next(err); }
});

// ─── GET /contabilidad/libros-electronicos/ple?mes=YYYY-MM&libro=ventas|compras ─
// ⚠️ Ver disclaimer de "no validado" en ple.service.ts

router.get('/contabilidad/libros-electronicos/ple', requirePermiso('contabilidad.exportar'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const mes   = typeof req.query.mes === 'string' ? req.query.mes : undefined;
    const libro = req.query.libro === 'compras' ? 'compras' : 'ventas';
    if (!mes) {
      res.status(400).json({ code: 'MES_REQUERIDO', message: 'Se requiere ?mes=YYYY-MM' });
      return;
    }
    const contenido = libro === 'ventas'
      ? await generarRegistroVentas(req.localId, mes)
      : await generarRegistroCompras(req.localId, mes);

    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="PLE-${libro}-${mes}.txt"`);
    res.setHeader('X-PLE-Validado', 'false');
    res.send(contenido);
  } catch (err) { next(err); }
});

// ─── POST /contabilidad/asientos ──────────────────────────────────────────────

router.post('/contabilidad/asientos', requirePermiso('contabilidad.gestionar'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = crearAsientoSchema.parse(req.body);
    const asiento = await service.crearAsientoManual(req.localId, data, req.user?.sub);
    res.status(201).json(asiento);
  } catch (err) { next(err); }
});

export default router;
