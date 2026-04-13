// core/xlsx.js
// Shared ExcelJS helper functions used by all XLSX exporters.
// ExcelJS is loaded as a global <script> tag in index.html.

/** Solid fill from 6-char hex (without #) */
export function xFill(hex) {
  return { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF' + hex } };
}

/** Font descriptor */
export function xFont(color, bold = false, size = 10) {
  return { name: 'Arial', size, bold: !!bold, color: { argb: 'FF' + color } };
}

/** Thin border on all sides */
export function xBorderAll() {
  const s = { style: 'thin', color: { argb: 'FFD1D5DB' } };
  return { top: s, bottom: s, left: s, right: s };
}

/** Bottom border only (for header rows) */
export function xBorderBottom(style = 'thin', hex = 'CBD5E1') {
  return { bottom: { style, color: { argb: 'FF' + hex } } };
}

/** Standard number format: 1,234.56 / red negatives / dash for zero */
export const NUM_FMT     = '#,##0.00;[Red]-#,##0.00;"-"';
export const NUM_FMT_INT = '#,##0;[Red]-#,##0;"-"';

/** Trigger file download from an ExcelJS workbook */
export async function saveWorkbook(wb, filename) {
  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = URL.createObjectURL(blob);
  Object.assign(document.createElement('a'), {
    href: url, download: filename,
  }).click();
  URL.revokeObjectURL(url);
}
