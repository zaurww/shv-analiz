// modules/eqaime/exporter.js
// Responsibility: gelir + gonder data → ExcelJS workbook → download

import { xFill, xFont, xBorderAll, xBorderBottom, NUM_FMT, saveWorkbook } from '../../core/xlsx.js';

const C = {
  text:    '0F172A', muted:   '475569',
  bg:      'F8F9FB', bg2:     'FFFFFF', bg3:     'F1F3F7',
  blue:    '1D4ED8', blueLt:  'DBEAFE', blueDk:  '1E3A6E',
  green:   '15803D', greenLt: 'DCFCE7',
  red:     'B91C1C', redLt:   'FEE2E2',
  amber:   'B45309', amberLt: 'FEF3C7',
  border:  'E2E5EB',
};

export async function download(gelir, gonder) {
  const wb = new ExcelJS.Workbook();

  // Sheet 1: Xülasə (Summary)
  buildSummary(wb, gelir, gonder);

  // Sheet 2: Aylıq Dinamika
  if (gelir || gonder) buildMonthly(wb, gelir, gonder);

  // Sheet 3: Top Təchizatçılar
  if (gelir?.suppliers) buildSuppliers(wb, gelir);

  // Sheet 4: Top Alıcılar
  if (gonder?.customers) buildCustomers(wb, gonder);

  // Sheet 5: Mal/Xidmət (Gələn)
  if (gelir?.items) buildItems(wb, gelir.items, 'Gələn — Mal-Xidmət', C.blue);

  // Sheet 6: Mal/Xidmət (Göndərilən)
  if (gonder?.items) buildItems(wb, gonder.items, 'Göndərilən — Mal-Xidmət', C.green);

  await saveWorkbook(wb, `eqaime_analiz_${new Date().toISOString().slice(0,10)}.xlsx`);
}

// ── Sheet 1: Summary ────────────────────────────────────────────────────────
function buildSummary(wb, gelir, gonder) {
  const ws = wb.addWorksheet('Xülasə', { properties: { tabColor: { argb: 'FF2563EB' } } });
  ws.columns = [{ width: 35 }, { width: 22 }, { width: 22 }];

  const fl = hex => xFill(hex); const fn = (h,b,s) => xFont(h,b,s);
  const aL = () => ({ horizontal:'left', vertical:'middle' });
  const aR = () => ({ horizontal:'right', vertical:'middle' });

  // Title
  ws.mergeCells('A1:C1');
  Object.assign(ws.getRow(1).getCell(1), {
    value: 'E-Qaimə Analizi — Xülasə',
    font: fn(C.text, true, 13), fill: fl(C.blueLt), alignment: aL(),
  });
  ws.getRow(1).height = 22;

  const rev    = gonder?.total || 0;
  const exp    = gelir?.total  || 0;
  const margin = rev - exp;
  const edvOhde  = gonder?.edv || 0;
  const edvKredit= gelir?.edv  || 0;
  const edvBal   = edvOhde - edvKredit;

  const rows = [
    ['', '', ''],
    ['GƏLİR (SATIŞ)', '', ''],
    ['Ümumi gəlir',             rev,     ''],
    ['ƏDV (göndərilən)',         edvOhde, ''],
    ['Qaimə sayı',               gonder?.invoices || 0, ''],
    ['Xaric edilmiş qaimə',      gonder?.passivCount || 0, ''],
    ['', '', ''],
    ['XƏRC (ALIŞ)', '', ''],
    ['Ümumi xərc',               exp,     ''],
    ['ƏDV (gələn)',               edvKredit, ''],
    ['Qaimə sayı',               gelir?.invoices || 0, ''],
    ['Xaric edilmiş qaimə',      gelir?.passivCount || 0, ''],
    ['Gözləyən (pending)',       gelir?.pendingCount || 0, ''],
    ['', '', ''],
    ['NƏTİCƏ', '', ''],
    ['Brüt Marja',               margin,  ''],
    ['Marja faizi',              rev > 0 ? margin / rev * 100 : 0, '%'],
    ['ƏDV Balansı (öhdəlik - kredit)', edvBal, ''],
    ['', '', ''],
    ['ƏDV STRUKTURU (GƏLƏNLƏr)', '', ''],
    ['ƏDV 18% bazası',           gelir?.edv18   || 0, ''],
    ['ƏDV 0% bazası',            gelir?.edv0    || 0, ''],
    ['ƏDV-dən azad',             gelir?.edvAzad || 0, ''],
    ['Aksiz',                    gelir?.aksiz   || 0, ''],
    ['Yol vergisi',              gelir?.yolV    || 0, ''],
  ];

  const headers = new Set(['GƏLİR (SATIŞ)', 'XƏRC (ALIŞ)', 'NƏTİCƏ', 'ƏDV STRUKTURU (GƏLƏNLƏr)']);

  let ri = 2;
  for (const [lbl, val, unit] of rows) {
    const r = ws.addRow([]); r.height = 17;
    if (!lbl) { ws.mergeCells(`A${ri}:C${ri}`); ri++; continue; }

    const isHdr = headers.has(lbl);
    const isNeg = typeof val === 'number' && val < 0;

    Object.assign(r.getCell(1), {
      value: lbl,
      font: fn(isHdr ? C.blueDk : C.text, isHdr, isHdr ? 11 : 10),
      fill: fl(isHdr ? C.blueLt : ri % 2 === 0 ? C.bg : C.bg2),
      alignment: aL(), border: xBorderBottom(),
    });
    if (typeof val === 'number' && val !== 0) {
      Object.assign(r.getCell(2), {
        value: val,
        font: fn(isNeg ? C.red : (lbl === 'Brüt Marja' && val > 0 ? C.green : C.text), isHdr, 10),
        fill: fl(isHdr ? C.blueLt : ri % 2 === 0 ? C.bg : C.bg2),
        alignment: aR(), numFmt: unit === '%' ? '0.00"%"' : NUM_FMT,
        border: xBorderBottom(),
      });
    }
    ri++;
  }
}

// ── Sheet 2: Monthly ────────────────────────────────────────────────────────
function buildMonthly(wb, gelir, gonder) {
  const ws = wb.addWorksheet('Aylıq Dinamika', { properties: { tabColor: { argb: 'FF10B981' } } });
  ws.columns = [{ width: 14 }, { width: 16 }, { width: 16 }, { width: 16 }, { width: 14 }, { width: 14 }, { width: 12 }, { width: 12 }];

  const fl = hex => xFill(hex); const fn = (h,b,s) => xFont(h,b,s);
  const aL = () => ({ horizontal:'left', vertical:'middle' });
  const aR = () => ({ horizontal:'right', vertical:'middle' });
  const brd = () => xBorderAll();

  ws.mergeCells('A1:H1');
  Object.assign(ws.getRow(1).getCell(1), {
    value: 'Aylıq Dinamika',
    font: fn(C.text, true, 12), fill: fl('D1FAE5'), alignment: aL(),
  });
  ws.getRow(1).height = 20;

  const hr = ws.getRow(2); hr.height = 17;
  ['Ay', 'Gəlir (₼)', 'Xərc (₼)', 'Marja (₼)', 'ƏDV öhdəlik', 'ƏDV kredit', 'Sat. qaimə', 'Al. qaimə'].forEach((h, i) => {
    const c = hr.getCell(i+1);
    c.value = h; c.font = fn('FFFFFF', true, 9); c.fill = fl('059669');
    c.alignment = i === 0 ? aL() : aR(); c.border = brd();
  });

  const months = [...new Set([
    ...Object.keys(gelir?.monthly  || {}),
    ...Object.keys(gonder?.monthly || {}),
  ])].sort();

  let totRev=0, totExp=0, totEdvO=0, totEdvG=0;
  months.forEach((m, i) => {
    const g  = gelir?.monthly[m];
    const gn = gonder?.monthly[m];
    const rev = gn?.total || 0; const exp = g?.total || 0; const mar = rev - exp;
    totRev+=rev; totExp+=exp; totEdvO+=(gn?.edv||0); totEdvG+=(g?.edv||0);
    const bg = fl(i % 2 === 0 ? C.bg : C.bg2);
    const dr = ws.addRow([m, rev||null, exp||null, mar||null, gn?.edv||null, g?.edv||null, gn?.inv.size||null, g?.inv.size||null]);
    dr.height = 16;
    dr.eachCell({ includeEmpty: true }, (cell, cn) => {
      cell.fill = bg; cell.border = brd();
      cell.alignment = cn === 1 ? aL() : aR();
      cell.font = fn(cn === 4 ? (mar < 0 ? C.red : C.green) : C.text, cn === 4, 10);
      if (cn > 1 && cn < 7) cell.numFmt = NUM_FMT;
    });
  });

  const tr = ws.addRow(['CƏMİ', totRev, totExp, totRev-totExp, totEdvO, totEdvG, '', '']); tr.height = 18;
  tr.eachCell({ includeEmpty: true }, (cell, cn) => {
    cell.fill = fl(C.greenLt); cell.border = brd();
    cell.alignment = cn === 1 ? aL() : aR();
    cell.font = fn(C.green, true, 10);
    if (cn > 1 && cn < 7) cell.numFmt = NUM_FMT;
  });
}

// ── Sheet 3: Suppliers ──────────────────────────────────────────────────────
function buildSuppliers(wb, gelir) {
  const ws = wb.addWorksheet('Top Təchizatçılar', { properties: { tabColor: { argb: 'FF2563EB' } } });
  ws.columns = [{ width: 50 }, { width: 18 }, { width: 16 }, { width: 12 }, { width: 10 }, { width: 10 }];

  const fl = hex => xFill(hex); const fn = (h,b,s) => xFont(h,b,s);
  const brd = () => xBorderAll();

  ws.mergeCells('A1:F1');
  Object.assign(ws.getRow(1).getCell(1), { value: 'Top Təchizatçılar — Gələn Qaimələr', font: fn(C.text, true, 12), fill: fl(C.blueLt), alignment: { horizontal:'left', vertical:'middle' } });
  ws.getRow(1).height = 20;

  const hr = ws.getRow(2); hr.height = 17;
  ['Təchizatçı adı', 'Məbləğ (₼)', 'ƏDV (₼)', 'Pay (%)', 'Qaimə', 'Gözləyən'].forEach((h, i) => {
    const c = hr.getCell(i+1);
    c.value = h; c.font = fn('FFFFFF', true, 9); c.fill = fl(C.blue);
    c.alignment = { horizontal: i === 0 ? 'left' : 'right', vertical: 'middle' }; c.border = brd();
  });

  const sorted = Object.entries(gelir.suppliers)
    .filter(([k]) => k.trim())
    .sort((a, b) => b[1].total - a[1].total);

  sorted.forEach(([name, d], i) => {
    const pct = gelir.total ? d.total / gelir.total * 100 : 0;
    const bg = fl(i % 2 === 0 ? C.bg : C.bg2);
    const dr = ws.addRow([name, d.total || null, d.edv || null, pct || null, d.inv.size, d.pending || null]);
    dr.height = 16;
    dr.eachCell({ includeEmpty: true }, (cell, cn) => {
      cell.fill = bg; cell.border = brd();
      cell.font = fn(C.text, false, 10);
      cell.alignment = { horizontal: cn === 1 ? 'left' : 'right', vertical: 'middle' };
      if (cn === 2 || cn === 3) cell.numFmt = NUM_FMT;
      if (cn === 4) cell.numFmt = '0.00"%"';
    });
  });
}

// ── Sheet 4: Customers ──────────────────────────────────────────────────────
function buildCustomers(wb, gonder) {
  const ws = wb.addWorksheet('Top Alıcılar', { properties: { tabColor: { argb: 'FF059669' } } });
  ws.columns = [{ width: 50 }, { width: 18 }, { width: 16 }, { width: 12 }, { width: 10 }];

  const fl = hex => xFill(hex); const fn = (h,b,s) => xFont(h,b,s);
  const brd = () => xBorderAll();

  ws.mergeCells('A1:E1');
  Object.assign(ws.getRow(1).getCell(1), { value: 'Top Alıcılar — Göndərilən Qaimələr', font: fn(C.text, true, 12), fill: fl(C.greenLt), alignment: { horizontal:'left', vertical:'middle' } });
  ws.getRow(1).height = 20;

  const hr = ws.getRow(2); hr.height = 17;
  ['Alıcı adı', 'Məbləğ (₼)', 'ƏDV (₼)', 'Pay (%)', 'Qaimə'].forEach((h, i) => {
    const c = hr.getCell(i+1);
    c.value = h; c.font = fn('FFFFFF', true, 9); c.fill = fl(C.green);
    c.alignment = { horizontal: i === 0 ? 'left' : 'right', vertical: 'middle' }; c.border = brd();
  });

  const sorted = Object.entries(gonder.customers)
    .filter(([k]) => k.trim())
    .sort((a, b) => b[1].total - a[1].total);

  sorted.forEach(([name, d], i) => {
    const pct = gonder.total ? d.total / gonder.total * 100 : 0;
    const bg = fl(i % 2 === 0 ? C.bg : C.bg2);
    const dr = ws.addRow([name, d.total || null, d.edv || null, pct || null, d.inv.size]);
    dr.height = 16;
    dr.eachCell({ includeEmpty: true }, (cell, cn) => {
      cell.fill = bg; cell.border = brd();
      cell.font = fn(C.text, false, 10);
      cell.alignment = { horizontal: cn === 1 ? 'left' : 'right', vertical: 'middle' };
      if (cn === 2 || cn === 3) cell.numFmt = NUM_FMT;
      if (cn === 4) cell.numFmt = '0.00"%"';
    });
  });
}

// ── Sheet 5/6: Items ─────────────────────────────────────────────────────────
function buildItems(wb, items, sheetName, colorHex) {
  const ws = wb.addWorksheet(sheetName, { properties: { tabColor: { argb: 'FF' + colorHex } } });
  ws.columns = [{ width: 60 }, { width: 18 }, { width: 14 }, { width: 16 }, { width: 10 }];

  const fl = hex => xFill(hex); const fn = (h,b,s) => xFont(h,b,s);
  const brd = () => xBorderAll();

  ws.mergeCells('A1:E1');
  Object.assign(ws.getRow(1).getCell(1), { value: sheetName, font: fn(C.text, true, 12), fill: fl('DBEAFE'), alignment: { horizontal:'left', vertical:'middle' } });
  ws.getRow(1).height = 20;

  const hr = ws.getRow(2); hr.height = 17;
  ['Mal/Xidmət adı', 'Məbləğ (₼)', 'Miqdar', 'Ort. qiymət (₼)', 'Sətir'].forEach((h, i) => {
    const c = hr.getCell(i+1);
    c.value = h; c.font = fn('FFFFFF', true, 9); c.fill = fl(colorHex);
    c.alignment = { horizontal: i === 0 ? 'left' : 'right', vertical: 'middle' }; c.border = brd();
  });

  const sorted = Object.entries(items)
    .filter(([k]) => k.trim())
    .sort((a, b) => b[1].total - a[1].total);

  sorted.forEach(([name, v], i) => {
    const avg = v.qty > 0 ? v.total / v.qty : null;
    const bg = fl(i % 2 === 0 ? C.bg : C.bg2);
    const dr = ws.addRow([name, v.total || null, v.qty || null, avg, v.count]);
    dr.height = 16;
    dr.eachCell({ includeEmpty: true }, (cell, cn) => {
      cell.fill = bg; cell.border = brd();
      cell.font = fn(C.text, false, 10);
      cell.alignment = { horizontal: cn === 1 ? 'left' : 'right', vertical: 'middle' };
      if (cn === 2 || cn === 4) cell.numFmt = NUM_FMT;
    });
  });
}
