import ExcelJS from 'exceljs';

// Paleta compartida por todos los reportes Excel (reportes.ts, contabilidad.ts).
export const AZUL   = { argb: 'FF1B3A6B' } as ExcelJS.Color;
export const BLANCO = { argb: 'FFFFFFFF' } as ExcelJS.Color;
export const GRIS   = { argb: 'FFF5F5F5' } as ExcelJS.Color;

export function headerStyle(ws: ExcelJS.Worksheet, row: ExcelJS.Row): void {
  row.eachCell((cell) => {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: AZUL };
    cell.font = { bold: true, color: BLANCO };
    cell.alignment = { horizontal: 'center', vertical: 'middle' };
    cell.border = { bottom: { style: 'thin', color: { argb: 'FFCCCCCC' } } };
  });
  row.height = 20;
  void ws;
}

export function autoWidth(ws: ExcelJS.Worksheet): void {
  ws.columns.forEach((col) => {
    let max = 10;
    col.eachCell?.({ includeEmpty: false }, (cell) => {
      const len = String(cell.value ?? '').length;
      if (len > max) max = len;
    });
    col.width = Math.min(max + 4, 40);
  });
}
