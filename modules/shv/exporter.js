// modules/shv/exporter.js
// Responsibility: AnalysisData → ExcelJS workbook → file download

import { xFill, xFont, xBorderBottom, NUM_FMT, NUM_FMT_INT, saveWorkbook } from '../../core/xlsx.js';
import { fmtRaw } from '../../core/ui.js';

// Light theme palette
const C = {
  bgDark:      'F1F5F9',
  bgMid:       'FFFFFF',
  bgLight:     'E8F0FE',
  border:      'CBD5E1',
  blue:        '1D4ED8',
  blueLight:   'DBEAFE',
  blueDark:    '1E3A6E',
  amber:       'B45309',
  amberLight:  'FEF3C7',
  amberDark:   '78350F',
  green:       '15803D',
  greenLight:  'DCFCE7',
  red:         'B91C1C',
  redDark:     'FEE2E2',
  purple:      '7E22CE',
  purpleLight: 'F3E8FF',
  purpleDark:  'FAF5FF',
  text:        '0F172A',
  muted:       '475569',
};

const STATUS_LABEL = { none: '—', active: 'Aktiv', cancelled: 'Ləğv edilib' };

export async function download(data, btnEl) {
  if (btnEl) { btnEl.innerHTML = '⏳ Hazırlanır...'; btnEl.disabled = true; }
  try {
    const wb = new ExcelJS.Workbook();
    buildSheet1(wb, data);
    buildSheet2(wb, data);
    await saveWorkbook(wb, `hesab_analiz_${data.voen || 'export'}.xlsx`);
  } catch (err) {
    alert('XLSX yaradılarkən xəta: ' + err.message);
    console.error(err);
  } finally {
    if (btnEl) { btnEl.innerHTML = '⬇ XLSX yüklə'; btnEl.disabled = false; }
  }
}

function buildSheet1(wb, data) {
  const ws = wb.addWorksheet('Analiz', {
    properties: { tabColor: { argb: 'FF3B82F6' } },
    views: [{ state: 'frozen', ySplit: 7 }],
  });
  ws.columns = [
    { width: 32 }, { width: 11 },
    { width: 16 }, { width: 16 }, { width: 16 },
    { width: 15 }, { width: 15 }, { width: 15 }, { width: 18 },
    { width: 15 }, { width: 15 }, { width: 15 }, { width: 18 },
    { width: 16 },
  ];

  const brd = (style, col) => xBorderBottom(style, col || C.border);

  // Rows 1-5: header info
  const merge = (row, val, fontHex, bold, sz, fillHex, height = 16) => {
    ws.mergeCells(`A${row}:N${row}`);
    const r = ws.getRow(row); r.height = height;
    Object.assign(r.getCell(1), {
      value: val, font: xFont(fontHex, bold, sz),
      fill: xFill(fillHex), alignment: { vertical: 'middle' },
    });
  };

  merge(1, data.companyName, C.text, true, 13, C.bgMid, 22);
  merge(2, `VÖEN: ${data.voen}   |   Dövr: ${data.period}   |   Çap tarixi: ${data.printDate}`, C.muted, false, 9, C.bgMid, 15);

  // KYB alert row
  ws.mergeCells('A3:N3');
  const r3 = ws.getRow(3); r3.height = 16;
  if (data.kybActive.length > 0) {
    const tot = data.kybActive.reduce((s, t) => s + t.kyb_net, 0);
    Object.assign(r3.getCell(1), {
      value: `⚠  Aktiv KYB: ${data.kybActive.map(t => t.key).join(', ')}   Cəmi: ${fmtRaw(tot)} ₼`,
      font: xFont('92400E', true, 10), fill: xFill('FEF3C7'),
    });
  } else {
    r3.getCell(1).fill = xFill(C.bgMid);
  }

  // SYB alert row
  ws.mergeCells('A4:N4');
  const r4 = ws.getRow(4); r4.height = 16;
  if (data.sybActive.length > 0) {
    const tot = data.sybActive.reduce((s, t) => s + t.syb_net, 0);
    Object.assign(r4.getCell(1), {
      value: `🔍  Aktiv SYB: ${data.sybActive.map(t => t.key).join(', ')}   Cəmi: ${fmtRaw(tot)} ₼`,
      font: xFont('6B21A8', true, 10), fill: xFill('F3E8FF'),
    });
  } else {
    r4.getCell(1).fill = xFill(C.bgMid);
  }

  // Row 5: spacer
  ws.mergeCells('A5:N5');
  ws.getRow(5).height = 6;
  ws.getRow(5).getCell(1).fill = xFill(C.bgDark);

  // Row 6: group headers
  ws.mergeCells('C6:E6');
  ws.mergeCells('F6:I6');
  ws.mergeCells('J6:M6');
  const r6 = ws.getRow(6); r6.height = 18;
  for (let c = 1; c <= 14; c++) r6.getCell(c).fill = xFill(C.bgLight);
  [
    [1,  'Vergi / Dövr',    C.bgLight,   C.text],
    [2,  'Bəyannamə',       C.bgLight,   C.text],
    [3,  'Bəyannamə üzrə', C.blueDark,  C.blueLight],
    [6,  'KYB (Kameral)',   C.amberDark, C.amberLight],
    [10, 'SYB (Səyyar)',    '4A1D96',    'EDE9FE'],
    [14, 'Cəmi Qalıq',     C.bgLight,   C.text],
  ].forEach(([col, val, bg, fg]) => {
    Object.assign(r6.getCell(col), {
      value: val, font: xFont(fg, true, 10),
      fill: xFill(bg), alignment: { horizontal: 'center', vertical: 'middle' },
      border: brd('medium', C.blue),
    });
  });

  // Row 7: sub-headers
  const r7 = ws.getRow(7); r7.height = 15;
  [
    ['', false, false, false],
    ['', false, false, false],
    ['Hesablama', true,  false, false],
    ['Azalma',    true,  false, false],
    ['Net',       true,  false, false],
    ['Hesablama', false, true,  false],
    ['Azalma',    false, true,  false],
    ['Net',       false, true,  false],
    ['Status',    false, true,  false],
    ['Hesablama', false, false, true],
    ['Azalma',    false, false, true],
    ['Net',       false, false, true],
    ['Status',    false, false, true],
    ['',          false, false, false],
  ].forEach(([v, isBlue, isAmber, isPurple], i) => {
    const bg = isBlue ? C.blueDark : isAmber ? C.amberDark : isPurple ? '4A1D96' : C.bgMid;
    const fg = isBlue ? C.blueLight : isAmber ? C.amberLight : isPurple ? 'EDE9FE' : C.muted;
    Object.assign(r7.getCell(i + 1), {
      value: v, font: xFont(fg, true, 9), fill: xFill(bg),
      alignment: { horizontal: 'center', vertical: 'middle' },
      border: brd('medium', C.blue),
    });
  });

  // Data rows
  data.taxes.forEach((t, i) => {
    const hasKyb    = t.kyb_hesablama > 0;
    const rowBg     = hasKyb ? (i % 2 === 0 ? 'FFFBEB' : 'FEFCE8') : (i % 2 === 0 ? C.bgDark : C.bgMid);
    const kybBg     = t.kyb_status === 'active' ? C.redDark    : rowBg;
    const sybBg     = t.syb_status === 'active' ? C.purpleDark : rowBg;
    const clientNet = t.hesablama - t.azalma;

    const dr = ws.addRow([
      t.key,
      t.decl_count    || null,
      t.hesablama     || null,
      t.azalma        || null,
      clientNet       || null,
      t.kyb_hesablama || null,
      t.kyb_azalma    || null,
      t.kyb_net       || null,
      STATUS_LABEL[t.kyb_status],
      t.syb_hesablama || null,
      t.syb_azalma    || null,
      t.syb_net       || null,
      STATUS_LABEL[t.syb_status],
      t.total_net     || null,
    ]);
    dr.height = 17;

    dr.eachCell({ includeEmpty: true }, (cell, cn) => {
      const isBəy   = cn >= 3  && cn <= 5;
      const isKyb   = cn >= 6  && cn <= 9;
      const isSyb   = cn >= 10 && cn <= 13;
      const isNum   = isBəy || (isKyb && cn !== 9) || (isSyb && cn !== 13);
      const isNet   = cn === 14;
      const isKybSt = cn === 9;
      const isSybSt = cn === 13;
      const isDecl  = cn === 2;
      const isTax   = cn === 1;

      const isBəyNet = cn === 5;
      const isKybNet = cn === 8;
      const isSybNet = cn === 12;

      cell.fill      = xFill(isKybSt ? kybBg : isSybSt ? sybBg : rowBg);
      cell.border    = brd('thin');
      cell.alignment = {
        horizontal: isNum || isDecl || isNet ? 'right' : (isKybSt || isSybSt) ? 'center' : 'left',
        vertical: 'middle',
      };

      const fg = isDecl   ? '60A5FA'
        : isNet    ? (t.total_net < 0 ? C.red  : t.total_net === 0 ? C.muted : C.text)
        : isBəyNet ? (clientNet   < 0 ? C.red  : clientNet   === 0 ? C.muted : C.text)
        : isKybNet ? (t.kyb_net   < 0 ? C.green : t.kyb_net  === 0 ? C.muted : C.red)
        : isSybNet ? (t.syb_net   < 0 ? C.green : t.syb_net  === 0 ? C.muted : C.purple)
        : isKybSt  ? (t.kyb_status === 'active' ? C.red    : t.kyb_status === 'cancelled' ? C.green : C.muted)
        : isSybSt  ? (t.syb_status === 'active' ? C.purple : t.syb_status === 'cancelled' ? C.green : C.muted)
        : C.text;

      cell.font = xFont(fg, isNet || isTax || isBəyNet || isKybNet || isSybNet, 10);
      if (isNum || isNet || isBəyNet || isKybNet || isSybNet) cell.numFmt = NUM_FMT;
      if (isDecl) cell.numFmt = NUM_FMT_INT;
    });
  });

  // Spacer + summary
  const blank = ws.addRow([]); blank.height = 8;
  blank.eachCell({ includeEmpty: true }, c => { c.fill = xFill(C.bgDark); });

  const kybTotal = data.kybActive.reduce((s, t) => s + t.kyb_net, 0);
  const sybTotal = data.sybActive.reduce((s, t) => s + t.syb_net, 0);
  [
    ['Cəmi ödənməli borc', data.totalDebt,        data.totalDebt > 0        ? C.red    : C.green],
    ['Aktiv KYB sayı',     data.kybActive.length,  data.kybActive.length > 0 ? C.amber  : C.green],
    ['Aktiv KYB məbləği',  kybTotal,               kybTotal > 0              ? C.red    : C.green],
    ['Aktiv SYB sayı',     data.sybActive.length,  data.sybActive.length > 0 ? C.purple : C.green],
    ['Aktiv SYB məbləği',  sybTotal,               sybTotal > 0              ? C.purple : C.green],
  ].forEach(([lbl, val, vc]) => {
    const sr = ws.addRow([lbl, val]); sr.height = 17;
    Object.assign(sr.getCell(1), { font: xFont(C.text, true), fill: xFill(C.bgMid), alignment: { vertical: 'middle' } });
    Object.assign(sr.getCell(2), { font: xFont(vc, true), fill: xFill(C.bgMid), alignment: { horizontal: 'right', vertical: 'middle' }, numFmt: NUM_FMT, border: brd('thin') });
  });
}

function buildSheet2(wb, data) {
  const ws = wb.addWorksheet('Orijinal', {
    properties: { tabColor: { argb: 'FF64748B' } },
    views: [{ state: 'frozen', ySplit: 2 }],
  });
  ws.columns = [{ width: 16 }, { width: 45 }, { width: 14 }, { width: 14 }, { width: 16 }];

  ws.mergeCells('A1:E1');
  Object.assign(ws.getRow(1).getCell(1), {
    value: `${data.companyName}  |  VÖEN: ${data.voen}`,
    font: xFont(C.text, true, 12), fill: xFill(C.bgMid), alignment: { vertical: 'middle' },
  });
  ws.getRow(1).height = 20;

  const hr = ws.addRow(['Yazılış tarixi', 'Əməliyyat adı', 'Əməliyyat növü', '', 'Miqdar (Manat)']);
  hr.height = 17;
  hr.eachCell(c => {
    c.font = xFont(C.text, true); c.fill = xFill(C.bgLight);
    c.alignment = { horizontal: 'center', vertical: 'middle' };
    c.border = { bottom: { style: 'medium', color: { argb: 'FF' + C.border } } };
  });

  data.rawRows.forEach((r, i) => {
    const dr = ws.addRow([r.date, r.opName, r.opType, r.col3, r.amount || null]);
    dr.height = 16;
    dr.eachCell({ includeEmpty: true }, (cell, cn) => {
      const rowBg = i % 2 === 0 ? C.bgDark : C.bgMid;
      cell.fill = xFill(rowBg);
      cell.font = xFont(C.text, false, 10);
      cell.border = { bottom: { style: 'thin', color: { argb: 'FF' + C.border } } };
      if (cn === 1) {
        const parts = r.date.match(/^(\d{2})\.(\d{2})\.(\d{4})$/);
        if (parts) { cell.value = new Date(+parts[3], +parts[2] - 1, +parts[1]); cell.numFmt = 'DD.MM.YYYY'; }
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
      }
      if (cn === 5) { cell.numFmt = NUM_FMT; cell.alignment = { horizontal: 'right', vertical: 'middle' }; }
      if (cn === 2 || cn === 3) cell.alignment = { vertical: 'middle' };
    });
  });

  ws.getColumn(2).width = Math.min(55,
    data.rawRows.reduce((max, r) => Math.max(max, (r.opName || '').length), 20));
}
