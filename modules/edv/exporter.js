// modules/edv/exporter.js
// Responsibility: array of monthly ƏDV data → ExcelJS workbook → download

import { xFill, xFont, xBorderAll, NUM_FMT, saveWorkbook } from '../../core/xlsx.js';

const MONTH_NAMES = {
  1:'Yanvar', 2:'Fevral', 3:'Mart', 4:'Aprel', 5:'May', 6:'İyun',
  7:'İyul', 8:'Avqust', 9:'Sentyabr', 10:'Oktyabr', 11:'Noyabr', 12:'Dekabr',
};

const H2_ROWS = [
  { label: '308. VM 175.1',         edvsiz: 'a1008_edvsiz', edv: 'a1008_edv' },
  { label: '309. 01.01.2001 borcu', edvsiz: null,           edv: 'a1009_edv' },
  { label: '310. İdxal (ƏDV-li)',   edvsiz: 'a1010_edvsiz', edv: 'a1010_edv' },
  { label: '311. İdxal (ƏDV-siz)',  edvsiz: 'a1011_edvsiz', edv: null        },
  { label: '312. VM 169 qeyri-rez', edvsiz: null,           edv: 'a1012_edv' },
  { label: '313. VM 175.2',         edvsiz: null,           edv: 'a1013_edv' },
  { label: '315. VM 175.4',         edvsiz: 'a1015_edvsiz', edv: null        },
  { label: '316. Sıfır faiz',       edvsiz: null,           edv: 'a1510_edv' },
  { label: '317. CƏMİ',            edvsiz: 'a1016_edvsiz', edv: 'a1016_edv' },
];

export async function download(data) {
  const wb  = new ExcelJS.Workbook();
  const ws  = wb.addWorksheet('ƏDV Hesabat');
  const fl  = hex => xFill(hex);
  const fn  = (hex, bold, sz) => xFont(hex, bold, sz);
  const brd = () => xBorderAll();
  const aL  = () => ({ horizontal: 'left',   vertical: 'middle' });
  const aR  = () => ({ horizontal: 'right',  vertical: 'middle' });
  const aC  = () => ({ horizontal: 'center', vertical: 'middle' });
  const sumF = f => data.reduce((s, d) => s + (d[f] || 0), 0);

  const years   = [...new Set(data.map(d => d.yil))];
  const yearStr = years.length === 1 ? String(years[0]) : `${years[0]}-${years[years.length - 1]}`;

  function sCell(cell, val, opts = {}) {
    cell.value = val;
    if (opts.font)      cell.font      = opts.font;
    if (opts.fill)      cell.fill      = opts.fill;
    if (opts.alignment) cell.alignment = opts.alignment;
    if (opts.numFmt)    cell.numFmt    = opts.numFmt;
    if (opts.border !== false) cell.border = brd();
  }

  const hdrFont  = fn('1E3A5F', true, 10);
  const dataFont = fn('111827', false, 10);
  const totFont  = fn('15803D', true, 10);
  const secFont  = fn('FFFFFF', true, 11);
  const hdrFill  = fl('DBEAFE');
  const totFill  = fl('DCFCE7');
  const secFill  = fl('1E3A5F');

  let row = 1;
  // Title
  ws.mergeCells(row, 1, row, 12);
  sCell(ws.getCell(row, 1),
    `ƏDV Hesabat — ${data[0].adi} (VÖEN: ${data[0].voen}) — ${yearStr}`,
    { font: fn('1E3A5F', true, 13), fill: fl('EFF6FF'), alignment: aL(), border: false });
  ws.getRow(row).height = 24; row++;

  // ── Hissə 1 ──────────────────────────────────────────────────
  ws.mergeCells(row, 1, row, 12);
  sCell(ws.getCell(row, 1), 'Hissə 1 — Dövriyyə üzrə ƏDV hesablanması (301–305)',
    { font: secFont, fill: secFill, alignment: aL() });
  ws.getRow(row).height = 18; row++;

  const grpH = row;
  ws.mergeCells(grpH, 1, grpH + 1, 1); sCell(ws.getCell(grpH, 1), 'Ay', { font: hdrFont, fill: hdrFill, alignment: aC() });
  ws.mergeCells(grpH, 2, grpH, 3);     sCell(ws.getCell(grpH, 2), '301. ƏDV 18%',    { font: hdrFont, fill: fl('BFDBFE'), alignment: aC() });
  ws.mergeCells(grpH, 4, grpH, 6);     sCell(ws.getCell(grpH, 4), '302. Sıfır dərəcə', { font: hdrFont, fill: fl('FEF9C3'), alignment: aC() });
  sCell(ws.getCell(grpH, 7), '303. Azad', { font: hdrFont, fill: hdrFill, alignment: aC() });
  sCell(ws.getCell(grpH, 8), '304. 20%',  { font: hdrFont, fill: hdrFill, alignment: aC() });
  ws.mergeCells(grpH, 9, grpH, 11); sCell(ws.getCell(grpH, 9), '305. Cəmi', { font: hdrFont, fill: fl('DCFCE7'), alignment: aC() });
  ws.getRow(grpH).height = 18; row++;

  ['ƏDV-siz','ƏDV','Dəyər','ƏDV-siz','ƏDV','ƏDV','ƏDV','Dəyər','ƏDV-siz','ƏDV'].forEach((h, i) => {
    sCell(ws.getCell(row, 2 + i), h, { font: hdrFont, fill: hdrFill, alignment: aC() });
  });
  ws.getRow(row).height = 15; row++;

  const s1Fields = ['h1001_edvsiz','h1001_edv','h1002_deyer','h1002_edvsiz','h1002_edv','h1003_edv','h1004_edv','h1005_deyer','h1005_edvsiz','h1005_edv'];
  const ds1 = row;
  for (const d of data) {
    const bg = fl((row - ds1) % 2 === 1 ? 'F1F5F9' : 'FFFFFF');
    sCell(ws.getCell(row, 1), `${MONTH_NAMES[d.ay]} ${d.yil}`, { font: dataFont, alignment: aL(), fill: bg });
    s1Fields.forEach((f, i) => { sCell(ws.getCell(row, 2 + i), d[f] || 0, { font: dataFont, alignment: aR(), numFmt: NUM_FMT, fill: bg }); });
    ws.getRow(row).height = 16; row++;
  }
  sCell(ws.getCell(row, 1), 'CƏMİ', { font: totFont, fill: totFill, alignment: aL() });
  s1Fields.forEach((f, i) => { sCell(ws.getCell(row, 2 + i), sumF(f), { font: totFont, fill: totFill, alignment: aR(), numFmt: NUM_FMT }); });
  ws.getRow(row).height = 17; row += 2;

  // ── Hissə 2 ──────────────────────────────────────────────────
  const h2cols = 1 + H2_ROWS.length * 2;
  ws.mergeCells(row, 1, row, h2cols);
  sCell(ws.getCell(row, 1), 'Hissə 2 — Əvəzləşdirilən ƏDV (308–317)', { font: secFont, fill: secFill, alignment: aL() });
  ws.getRow(row).height = 18; row++;

  const gr2 = row;
  ws.mergeCells(gr2, 1, gr2 + 1, 1); sCell(ws.getCell(gr2, 1), 'Ay', { font: hdrFont, fill: hdrFill, alignment: aC() });
  H2_ROWS.forEach((r, i) => {
    const c = 2 + i * 2;
    ws.mergeCells(gr2, c, gr2, c + 1);
    sCell(ws.getCell(gr2, c), r.label, { font: hdrFont, fill: fl('BFDBFE'), alignment: aC() });
  });
  ws.getRow(gr2).height = 18; row++;
  H2_ROWS.forEach((_, i) => {
    sCell(ws.getCell(row, 2 + i * 2), 'ƏDV-siz', { font: hdrFont, fill: hdrFill, alignment: aC() });
    sCell(ws.getCell(row, 3 + i * 2), 'ƏDV',     { font: hdrFont, fill: hdrFill, alignment: aC() });
  });
  ws.getRow(row).height = 15; row++;

  const ds2 = row;
  for (const d of data) {
    const bg = fl((row - ds2) % 2 === 1 ? 'F1F5F9' : 'FFFFFF');
    sCell(ws.getCell(row, 1), `${MONTH_NAMES[d.ay]} ${d.yil}`, { font: dataFont, alignment: aL(), fill: bg });
    H2_ROWS.forEach((r, i) => {
      sCell(ws.getCell(row, 2 + i * 2), r.edvsiz ? (d[r.edvsiz] || 0) : 0, { font: dataFont, alignment: aR(), numFmt: NUM_FMT, fill: bg });
      sCell(ws.getCell(row, 3 + i * 2), r.edv    ? (d[r.edv]    || 0) : 0, { font: dataFont, alignment: aR(), numFmt: NUM_FMT, fill: bg });
    });
    ws.getRow(row).height = 16; row++;
  }
  sCell(ws.getCell(row, 1), 'CƏMİ', { font: totFont, fill: totFill, alignment: aL() });
  H2_ROWS.forEach((r, i) => {
    sCell(ws.getCell(row, 2 + i * 2), r.edvsiz ? sumF(r.edvsiz) : 0, { font: totFont, fill: totFill, alignment: aR(), numFmt: NUM_FMT });
    sCell(ws.getCell(row, 3 + i * 2), r.edv    ? sumF(r.edv)    : 0, { font: totFont, fill: totFill, alignment: aR(), numFmt: NUM_FMT });
  });
  ws.getRow(row).height = 17; row += 2;

  // ── Hissə 3 ──────────────────────────────────────────────────
  ws.mergeCells(row, 1, row, 5);
  sCell(ws.getCell(row, 1), 'Hissə 3 — Debitor borc', { font: secFont, fill: secFill, alignment: aL() });
  ws.getRow(row).height = 18; row++;
  ['Ay','Əvvələ qalıq','Yaranan borc','Silinən borc','Sona qalıq'].forEach((h, i) => {
    sCell(ws.getCell(row, 1 + i), h, { font: hdrFont, fill: hdrFill, alignment: i === 0 ? aL() : aC() });
  });
  ws.getRow(row).height = 15; row++;
  const ds3 = row;
  for (const d of data) {
    const bg = fl((row - ds3) % 2 === 1 ? 'F1F5F9' : 'FFFFFF');
    sCell(ws.getCell(row, 1), `${MONTH_NAMES[d.ay]} ${d.yil}`, { font: dataFont, alignment: aL(), fill: bg });
    [d.d1400_evvel, d.d1400_yaranan, d.d1400_silinen, d.d1400_son].forEach((v, i) => {
      sCell(ws.getCell(row, 2 + i), v || 0, { font: dataFont, alignment: aR(), numFmt: NUM_FMT, fill: bg });
    });
    ws.getRow(row).height = 16; row++;
  }
  row++;

  // ── Hissə 4 ──────────────────────────────────────────────────
  ws.mergeCells(row, 1, row, 3);
  sCell(ws.getCell(row, 1), 'Hissə 4 — Hesablaşma', { font: secFont, fill: secFill, alignment: aL() });
  ws.getRow(row).height = 18; row++;
  ['Ay','Ödənilməli','Qaytarılmalı'].forEach((h, i) => {
    sCell(ws.getCell(row, 1 + i), h, { font: hdrFont, fill: hdrFill, alignment: i === 0 ? aL() : aC() });
  });
  ws.getRow(row).height = 15; row++;
  const ds4 = row;
  for (const d of data) {
    const bg = fl((row - ds4) % 2 === 1 ? 'F1F5F9' : 'FFFFFF');
    sCell(ws.getCell(row, 1), `${MONTH_NAMES[d.ay]} ${d.yil}`, { font: dataFont, alignment: aL(), fill: bg });
    sCell(ws.getCell(row, 2), d.odenilmeli   || 0, { font: dataFont, alignment: aR(), numFmt: NUM_FMT, fill: bg });
    sCell(ws.getCell(row, 3), d.qaytarilmali || 0, { font: dataFont, alignment: aR(), numFmt: NUM_FMT, fill: bg });
    ws.getRow(row).height = 16; row++;
  }
  sCell(ws.getCell(row, 1), 'CƏMİ',      { font: totFont, fill: totFill, alignment: aL() });
  sCell(ws.getCell(row, 2), sumF('odenilmeli'),   { font: totFont, fill: totFill, alignment: aR(), numFmt: NUM_FMT });
  sCell(ws.getCell(row, 3), sumF('qaytarilmali'), { font: totFont, fill: totFill, alignment: aR(), numFmt: NUM_FMT });
  ws.getRow(row).height = 17;

  ws.columns = [
    {width:20},{width:14},{width:14},{width:14},{width:14},
    {width:14},{width:14},{width:14},{width:14},{width:14},{width:14},{width:14},
  ];

  await saveWorkbook(wb, `EDV_Hesabat_${yearStr}_${data[0].voen}.xlsx`);
}
