// modules/mv/exporter.js
// Responsibility: MV declaration data → ExcelJS workbook → file download

import { xFill, xFont, xBorderAll, NUM_FMT, saveWorkbook } from '../../core/xlsx.js';
import { mvInfo } from './labels.js';

export async function download(data) {
  const wb     = new ExcelJS.Workbook();
  const fl     = hex => xFill(hex);
  const fn     = (hex, bold, sz) => xFont(hex, bold, sz);
  const brd    = () => xBorderAll();
  const aL     = () => ({ horizontal: 'left',   vertical: 'middle' });
  const aR     = () => ({ horizontal: 'right',  vertical: 'middle' });
  const aC     = () => ({ horizontal: 'center', vertical: 'middle' });

  // ── Sheet 1: MV Göstəriciləri ───────────────────────────────
  const ws1 = wb.addWorksheet('MV Göstəriciləri', {
    properties: { tabColor: { argb: 'FF3B82F6' } },
    views: [{ state: 'frozen', ySplit: 5 }],
  });
  ws1.columns = [{ width: 12 }, { width: 10 }, { width: 52 }, { width: 20 }];

  ws1.mergeCells('A1:D1');
  Object.assign(ws1.getRow(1).getCell(1), { value: data.adi, font: fn('1E3A5F', true, 13), fill: fl('DBEAFE'), alignment: aL() });
  ws1.getRow(1).height = 22;

  ws1.mergeCells('A2:D2');
  Object.assign(ws1.getRow(2).getCell(1), {
    value: `VÖEN: ${data.vergiNo}   |   Dövr: ${data.donem}   |   Bəyannamə: ${data.beyannameTipi}   |   ${data.faaliyetAdi}`,
    font: fn('6B7280', false, 9), fill: fl('EFF6FF'), alignment: aL(),
  });
  ws1.getRow(2).height = 14;

  const gelir = data.allData['1001']?.mebleg || 0;
  const xrc   = data.allData['1041']?.mebleg || 0;
  const mv    = data.allData['1042']?.mebleg || 0;
  ws1.mergeCells('A3:D3');
  Object.assign(ws1.getRow(3).getCell(1), {
    value: `Gəlir: ${fmt2(gelir)}   |   Xərclər: ${fmt2(xrc)}   |   Mənfəət: ${fmt2(mv)}   |   Büdcəyə: ${fmt2(data.budce)}`,
    font: fn(data.budce > 0 ? 'B45309' : '065F46', true, 10),
    fill: fl(data.budce > 0 ? 'FEF3C7' : 'D1FAE5'),
    alignment: aL(),
  });
  ws1.getRow(3).height = 18;
  ws1.getRow(4).height = 8;

  // Header row
  const hr = ws1.getRow(5); hr.height = 17;
  ['Bəy. kodu', 'XML kodu', 'Göstərici adı', 'Məbləğ (₼)'].forEach((v, i) => {
    const c = hr.getCell(i + 1);
    c.value = v; c.font = fn('FFFFFF', true, 10); c.fill = fl('1D4ED8');
    c.alignment = i === 3 ? aR() : i < 2 ? aC() : aL();
    c.border = brd();
  });

  const KEY_CODES = new Set(['1001', '1041', '1042', '1056', '3001', '2071']);
  const simpleSecs = [
    { title: 'GƏLİRLƏR',               codes: ['1001','1002','1012','1013','1016'] },
    { title: 'XƏRCLƏR',                 codes: ['1021','1022','1023','1102','1106','1031','1034','1006','1041','1042','1045','1056','1076'] },
    { title: 'VERGİ HESABI',            codes: ['3001','3002','3003','3004'] },
    { title: 'BALANS — AKTİVLƏR',       codes: ['2001','2002','2003','2004','2005','2007','2008','1200','2009','2011','2012','2014','2016','2018','2019'] },
    { title: 'BALANS — ÖHDƏLİKLƏR',    codes: ['2020','2021','2022','2023','2027','2031','2033','2034','2039','2140','2040','2043','2049','2050','2052','2053','2057','2062'] },
    { title: 'GƏLİR/XƏRC DÖVRİYYƏSİ', codes: ['2063','2064','2066','2071','2073'] },
  ];

  let ri = 6;
  for (const sec of simpleSecs) {
    ws1.mergeCells(`A${ri}:D${ri}`);
    Object.assign(ws1.getRow(ri).getCell(1), { value: sec.title, font: fn('1E40AF', true, 9), fill: fl('EFF6FF'), alignment: aL() });
    ws1.getRow(ri).height = 15; ri++;
    for (const c of sec.codes) {
      if (!data.allData[c] || data.allData[c].mebleg === undefined) continue;
      const v    = data.allData[c].mebleg;
      const info = mvInfo(c);
      const isKey = KEY_CODES.has(c);
      const dr = ws1.getRow(ri++); dr.height = 16;
      [info.beyCode, c, info.label, v].forEach((val, ci) => {
        const cell = dr.getCell(ci + 1);
        cell.value = val; cell.border = brd();
        cell.fill = fl(isKey ? 'FFF7ED' : (ri % 2 === 0 ? 'F9FAFB' : 'FFFFFF'));
        cell.alignment = ci === 3 ? aR() : ci < 2 ? aC() : aL();
        if (ci === 0) cell.font = fn('1D4ED8', true, 10);
        else if (ci === 1) cell.font = fn('6B7280', false, 9);
        else cell.font = fn(isKey ? '92400E' : '111827', isKey, 10);
        if (ci === 3) cell.numFmt = NUM_FMT;
      });
    }
    ri++;
  }

  // ── Sheet 2: Aktivlər ──────────────────────────────────────
  const ws2 = wb.addWorksheet('Aktivlər (Əlavə 1)', { properties: { tabColor: { argb: 'FF10B981' } } });
  ws2.columns = [{ width: 12 }, { width: 10 }, { width: 52 }, { width: 18 }, { width: 18 }, { width: 18 }, { width: 18 }];
  ws2.mergeCells('A1:G1');
  Object.assign(ws2.getRow(1).getCell(1), {
    value: `${data.adi}  |  Aktivlər (Əlavə №1)  |  ${data.donem}`,
    font: fn('065F46', true, 12), fill: fl('D1FAE5'), alignment: aL(),
  });
  ws2.getRow(1).height = 20;
  const h2 = ws2.getRow(2); h2.height = 17;
  ['Bəy. kodu', 'XML kodu', 'Göstərici adı', 'Dövrün əvvəlinə', 'Daxil olmuşdur', 'Təqdim edilmişdir', 'Dövrün sonuna'].forEach((v, i) => {
    const c = h2.getCell(i + 1);
    c.value = v; c.font = fn('FFFFFF', true, 10); c.fill = fl('065F46');
    c.alignment = i > 2 ? aR() : i < 2 ? aC() : aL(); c.border = brd();
  });
  let r2 = 3;
  for (const k of Object.keys(data.allData).filter(k => k.startsWith('A_')).sort()) {
    const kod = k.slice(2); const d = data.allData[k]; const info = mvInfo(kod);
    const dr = ws2.getRow(r2++); dr.height = 16;
    [info.beyCode, kod, info.label, d.evvel, d.dahil, d.takdim, d.son].forEach((v, ci) => {
      const cell = dr.getCell(ci + 1); cell.value = v; cell.border = brd();
      cell.fill = fl(r2 % 2 === 0 ? 'F0FDF4' : 'FFFFFF');
      cell.alignment = ci > 2 ? aR() : ci < 2 ? aC() : aL();
      if (ci === 0) cell.font = fn('1D4ED8', true, 10);
      else if (ci === 1) cell.font = fn('6B7280', false, 9);
      else cell.font = fn('111827', false, 10);
      if (ci > 2) cell.numFmt = NUM_FMT;
    });
  }

  // ── Sheet 3: Kapital & Öhdəliklər ──────────────────────────
  const ws3 = wb.addWorksheet('Kapital & Öhdəliklər', { properties: { tabColor: { argb: 'FFF59E0B' } } });
  ws3.columns = [{ width: 12 }, { width: 10 }, { width: 52 }, { width: 18 }, { width: 18 }, { width: 18 }, { width: 18 }, { width: 18 }];
  ws3.mergeCells('A1:H1');
  Object.assign(ws3.getRow(1).getCell(1), {
    value: `${data.adi}  |  Kapital & Öhdəliklər (Əlavə №1)  |  ${data.donem}`,
    font: fn('78350F', true, 12), fill: fl('FEF3C7'), alignment: aL(),
  });
  ws3.getRow(1).height = 20;
  const h3 = ws3.getRow(2); h3.height = 17;
  ['Bəy. kodu', 'XML kodu', 'Göstərici adı', 'Dövrün əvvəlinə', 'Daxil olmuşdur', 'Təqdim edilmişdir', 'Silinmişdir', 'Dövrün sonuna'].forEach((v, i) => {
    const c = h3.getCell(i + 1);
    c.value = v; c.font = fn('FFFFFF', true, 10); c.fill = fl('B45309');
    c.alignment = i > 2 ? aR() : i < 2 ? aC() : aL(); c.border = brd();
  });
  let r3 = 3;
  for (const k of Object.keys(data.allData).filter(k => k.startsWith('K_')).sort()) {
    const kod = k.slice(2); const d = data.allData[k]; const info = mvInfo(kod);
    const dr = ws3.getRow(r3++); dr.height = 16;
    [info.beyCode, kod, info.label, d.evvel, d.dahil, d.takdim, d.silen || 0, d.son].forEach((v, ci) => {
      const cell = dr.getCell(ci + 1); cell.value = v; cell.border = brd();
      cell.fill = fl(r3 % 2 === 0 ? 'FFFBEB' : 'FFFFFF');
      cell.alignment = ci > 2 ? aR() : ci < 2 ? aC() : aL();
      if (ci === 0) cell.font = fn('1D4ED8', true, 10);
      else if (ci === 1) cell.font = fn('6B7280', false, 9);
      else cell.font = fn('111827', false, 10);
      if (ci > 2) cell.numFmt = NUM_FMT;
    });
  }

  await saveWorkbook(wb, `mv_beyanname_${data.vergiNo}_${data.donem.replace('/', '_')}.xlsx`);
}

function fmt2(n) {
  return n.toLocaleString('az-AZ', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' ₼';
}
