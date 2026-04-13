// modules/mv/exporter.js
// MV declaration data → ExcelJS workbook → file download
// Sheet 1: Bölmə 2 — PDF bəyannamə strukturunda (200–249)
// Sheet 2: Əlavə 1 — Aktivlər
// Sheet 3: Əlavə 1 — Kapital & Öhdəliklər

import { xFill, xFont, xBorderAll, NUM_FMT, saveWorkbook } from '../../core/xlsx.js';
import { PDF_STRUCTURE, mvInfo } from './labels.js';

export async function download(data) {
  const wb = new ExcelJS.Workbook();
  const fl = hex => xFill(hex);
  const fn = (hex, bold, sz) => xFont(hex, bold, sz);
  const brd = () => xBorderAll();
  const aL = () => ({ horizontal:'left', vertical:'middle' });
  const aR = () => ({ horizontal:'right', vertical:'middle' });
  const aC = () => ({ horizontal:'center', vertical:'middle' });

  // ═══════════════════════════════════════════════════════════════
  // SHEET 1: Bölmə 2 — PDF bəyannamə strukturu
  // ═══════════════════════════════════════════════════════════════
  const ws = wb.addWorksheet('Bölmə 2 — Verginin hesablanması', {
    properties: { tabColor: { argb: 'FF1D4ED8' } },
    views: [{ state: 'frozen', ySplit: 5 }],
  });
  ws.columns = [{ width: 11 }, { width: 65 }, { width: 20 }];

  // Row 1: Company name
  ws.mergeCells('A1:C1');
  Object.assign(ws.getRow(1).getCell(1), {
    value: `Mənfəət vergisinin bəyannaməsi — ${data.adi}`,
    font: fn('1E3A5F', true, 13), fill: fl('DBEAFE'), alignment: aL(),
  });
  ws.getRow(1).height = 24;

  // Row 2: Meta info
  ws.mergeCells('A2:C2');
  Object.assign(ws.getRow(2).getCell(1), {
    value: `VÖEN: ${data.vergiNo}   |   Vergi dövrü: ${data.donem}   |   Bəyannamə növü: ${data.beyannameTipi}   |   ${data.faaliyetAdi}`,
    font: fn('6B7280', false, 9), fill: fl('EFF6FF'), alignment: aL(),
  });
  ws.getRow(2).height = 16;

  // Row 3: Summary
  const gelir = data.allData['1041']?.mebleg || 0;
  const xerc  = data.allData['2071']?.mebleg || 0;
  const budce = data.budce || 0;
  ws.mergeCells('A3:C3');
  Object.assign(ws.getRow(3).getCell(1), {
    value: `Ümumi gəlir: ${fmt2(gelir)}   |   Cəmi xərclər: ${fmt2(xerc)}   |   Büdcəyə ödənilməli: ${fmt2(budce)}`,
    font: fn(budce > 0 ? 'B45309' : '065F46', true, 10),
    fill: fl(budce > 0 ? 'FEF3C7' : 'D1FAE5'), alignment: aL(),
  });
  ws.getRow(3).height = 18;

  // Row 4: spacer
  ws.getRow(4).height = 6;

  // Row 5: Header
  const hr = ws.getRow(5); hr.height = 17;
  ['Göstəricilər', '', 'Məbləğ, manatla'].forEach((v, i) => {
    const c = hr.getCell(i + 1);
    c.value = v;
    c.font = fn('FFFFFF', true, 10); c.fill = fl('1D4ED8');
    c.alignment = i === 2 ? aR() : aL(); c.border = brd();
  });
  ws.mergeCells('A5:B5');

  // ── Data rows from PDF_STRUCTURE ──
  let ri = 6;
  const INDENT = '    '; // 4 spaces per level

  for (const row of PDF_STRUCTURE) {
    const r = ws.getRow(ri); r.height = row.type === 'H' ? 20 : 16;

    if (row.type === 'H') {
      // Section header
      ws.mergeCells(`A${ri}:C${ri}`);
      Object.assign(r.getCell(1), {
        value: row.label,
        font: fn('1E40AF', true, 11), fill: fl('DBEAFE'),
        alignment: { horizontal: 'center', vertical: 'middle' },
      });
      r.getCell(1).border = brd();
      ri++; continue;
    }

    // Data or Total line
    const isTotal = row.type === 'T';
    const indent = INDENT.repeat(row.lvl || 0);
    const labelText = `${row.bey} ${indent}${row.label}`;

    // Get value from XML data
    let val = null;
    if (row.xml && data.allData[row.xml]) {
      val = data.allData[row.xml].mebleg;
    }
    const hasVal = val !== null && val !== undefined && val !== 0;

    // Colors
    const bgHex = isTotal ? 'EFF6FF' : (ri % 2 === 0 ? 'F9FAFB' : 'FFFFFF');
    const labelColor = isTotal ? '1E3A5F' : '111827';
    const valColor   = isTotal ? '1E3A5F' : (val < 0 ? 'DC2626' : '111827');

    // Cell A: bey code
    const cA = r.getCell(1);
    cA.value = row.bey;
    cA.font = fn('1D4ED8', isTotal, 9);
    cA.fill = fl(bgHex); cA.alignment = aL(); cA.border = brd();

    // Cell B: label with indentation
    const cB = r.getCell(2);
    cB.value = indent + row.label;
    cB.font = fn(labelColor, isTotal, isTotal ? 10 : 9);
    cB.fill = fl(bgHex); cB.alignment = aL(); cB.border = brd();

    // Cell C: amount
    const cC = r.getCell(3);
    cC.value = hasVal ? val : null;
    cC.font = fn(valColor, isTotal, isTotal ? 11 : 10);
    cC.fill = fl(bgHex); cC.alignment = aR(); cC.border = brd();
    cC.numFmt = NUM_FMT;

    ri++;
  }

  // ═══════════════════════════════════════════════════════════════
  // SHEET 2: Aktivlər (Əlavə №1)
  // ═══════════════════════════════════════════════════════════════
  const ws2 = wb.addWorksheet('Əlavə 1 — Aktivlər', { properties: { tabColor: { argb: 'FF10B981' } } });
  ws2.columns = [{ width: 10 }, { width: 50 }, { width: 18 }, { width: 18 }, { width: 18 }, { width: 18 }];
  ws2.mergeCells('A1:F1');
  Object.assign(ws2.getRow(1).getCell(1), {
    value: `Mənfəət vergisinin bəyannaməsinə Əlavə № 1 — ${data.adi}  |  ${data.donem}`,
    font: fn('065F46', true, 12), fill: fl('D1FAE5'), alignment: aL(),
  });
  ws2.getRow(1).height = 22;

  const h2 = ws2.getRow(2); h2.height = 17;
  ['Kod', 'Göstəricilər', 'Dövrün əvvəlinə', 'Dövr ərzində daxil olmuşdur', 'Təqdim edilmişdir, Silinmişdir', 'Dövrün sonuna'].forEach((v, i) => {
    const c = h2.getCell(i + 1);
    c.value = v; c.font = fn('FFFFFF', true, 9); c.fill = fl('065F46');
    c.alignment = i > 1 ? aR() : aL(); c.border = brd();
  });

  let r2 = 3;
  for (const k of Object.keys(data.allData).filter(k => k.startsWith('A_')).sort()) {
    const kod = k.slice(2); const d = data.allData[k]; const info = mvInfo(kod);
    const dr = ws2.getRow(r2); dr.height = 16;
    [info.beyCode, info.label, d.evvel, d.dahil, d.takdim, d.son].forEach((v, ci) => {
      const cell = dr.getCell(ci + 1); cell.value = v; cell.border = brd();
      cell.fill = fl(r2 % 2 === 0 ? 'F0FDF4' : 'FFFFFF');
      cell.alignment = ci > 1 ? aR() : aL();
      if (ci === 0) cell.font = fn('1D4ED8', true, 9);
      else cell.font = fn('111827', false, 10);
      if (ci > 1) cell.numFmt = NUM_FMT;
    });
    r2++;
  }

  // ═══════════════════════════════════════════════════════════════
  // SHEET 3: Kapital & Öhdəliklər (Əlavə №1)
  // ═══════════════════════════════════════════════════════════════
  const ws3 = wb.addWorksheet('Əlavə 1 — Kapital & Öhdəliklər', { properties: { tabColor: { argb: 'FFF59E0B' } } });
  ws3.columns = [{ width: 10 }, { width: 50 }, { width: 18 }, { width: 18 }, { width: 18 }, { width: 18 }, { width: 18 }];
  ws3.mergeCells('A1:G1');
  Object.assign(ws3.getRow(1).getCell(1), {
    value: `Mənfəət vergisinin bəyannaməsinə Əlavə № 1 — Kapital & Öhdəliklər  |  ${data.adi}  |  ${data.donem}`,
    font: fn('78350F', true, 12), fill: fl('FEF3C7'), alignment: aL(),
  });
  ws3.getRow(1).height = 22;

  const h3 = ws3.getRow(2); h3.height = 17;
  ['Kod', 'Göstəricilər', 'Dövrün əvvəlinə', 'Daxil olmuşdur', 'Təqdim edilmişdir', 'Silinmişdir', 'Dövrün sonuna'].forEach((v, i) => {
    const c = h3.getCell(i + 1);
    c.value = v; c.font = fn('FFFFFF', true, 9); c.fill = fl('B45309');
    c.alignment = i > 1 ? aR() : aL(); c.border = brd();
  });

  let r3 = 3;
  for (const k of Object.keys(data.allData).filter(k => k.startsWith('K_')).sort()) {
    const kod = k.slice(2); const d = data.allData[k]; const info = mvInfo(kod);
    const dr = ws3.getRow(r3); dr.height = 16;
    [info.beyCode, info.label, d.evvel, d.dahil, d.takdim, d.silen || 0, d.son].forEach((v, ci) => {
      const cell = dr.getCell(ci + 1); cell.value = v; cell.border = brd();
      cell.fill = fl(r3 % 2 === 0 ? 'FFFBEB' : 'FFFFFF');
      cell.alignment = ci > 1 ? aR() : aL();
      if (ci === 0) cell.font = fn('1D4ED8', true, 9);
      else cell.font = fn('111827', false, 10);
      if (ci > 1) cell.numFmt = NUM_FMT;
    });
    r3++;
  }

  await saveWorkbook(wb, `mv_beyanname_${data.vergiNo}_${data.donem.replace('/', '_')}.xlsx`);
}

function fmt2(n) {
  return n.toLocaleString('az-AZ', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' ₼';
}
