// modules/shv/parser.js
// Responsibility: raw XLS/HTML text → structured AnalysisData object

const TAX_ORDER = ['MV', 'ƏDVQR', 'ƏDV', 'ÖMV', 'HŞƏV', 'VAHID MUZDLU'];

// Declaration patterns that count as filed returns.
// CARİ(ARAYIŞ) and /N rows are intentionally excluded.
const DECL_PATTERN = /CARİ\(B\)|DƏQİQLƏŞMİŞ\(B\)|DƏQİQLƏŞDİRİLMİŞ\(B\)/;

export function parse(html) {
  const doc        = new DOMParser().parseFromString(html, 'text/html');
  const companyInfo = extractCompanyInfo(doc);
  const summaryData = extractSummaryTable(doc);
  const rawRows     = extractRawRows(doc);
  const taxMap      = buildTaxMap(rawRows);
  const taxes       = finalizeTaxes(taxMap);

  return {
    ...companyInfo,
    period:    summaryData['Əhatə etdiyi dövr']  || '',
    printDate: summaryData['Çap olunma tarixi']  || '',
    totalDebt: parseAmount(summaryData['Cəmi ödənməli borc'] || '0'),
    taxes,
    kybActive:    taxes.filter(t => t.kyb_status === 'active'),
    kybCancelled: taxes.filter(t => t.kyb_status === 'cancelled'),
    sybActive:    taxes.filter(t => t.syb_status === 'active'),
    sybCancelled: taxes.filter(t => t.syb_status === 'cancelled'),
    rawRows,
  };
}

function extractCompanyInfo(doc) {
  let companyRaw = '';
  for (const b of doc.querySelectorAll('b')) {
    const t = b.textContent.trim();
    if (t.includes('VÖEN') || t.length > 10) { companyRaw = t; break; }
  }
  const voenMatch  = companyRaw.match(/VÖEN[:\s]*(\d+)/);
  const voen       = voenMatch ? voenMatch[1] : '';
  const companyName = companyRaw
    .replace(/\(VÖEN[^)]*\)/, '')
    .replace(/VÖEN[:\s]*\d+/, '')
    .trim().replace(/\s+/g, ' ');
  return { companyName, voen };
}

function extractSummaryTable(doc) {
  const tables = doc.querySelectorAll('table');
  const summaryTable = tables[tables.length - 1];
  const result = {};
  if (!summaryTable) return result;
  for (const row of summaryTable.querySelectorAll('tr')) {
    const cells = [...row.querySelectorAll('td')].map(td => td.textContent.trim());
    if (cells.length >= 2 && cells[0]) result[cells[0]] = cells[1];
  }
  return result;
}

function extractRawRows(doc) {
  const taxTable = findTaxTable(doc);
  if (!taxTable) throw new Error('Vergi cədvəli tapılmadı');

  const headerRow = taxTable.querySelector('tr');
  const headers   = [...headerRow.querySelectorAll('td')].map(td => td.textContent.trim());

  // Dynamically find "Miqdar (Manat)" — handles extra columns like "Miqdar (ABŞ$)"
  let amountIdx = headers.findIndex(h => h.includes('Miqdar') && h.includes('Manat'));
  if (amountIdx === -1) amountIdx = 4;

  const rows   = [...taxTable.querySelectorAll('tr')].slice(1);
  const result = [];
  for (const row of rows) {
    const cells = [...row.querySelectorAll('td')].map(td => td.textContent.trim());
    if (cells.length < 5) continue;
    result.push({
      date:   cells[0],
      opName: cells[1],
      opType: cells[2], // Hesablama | Azalma | Ödəniş
      col3:   cells[3],
      amount: parseAmount(cells[amountIdx]),
    });
  }
  return result;
}

function findTaxTable(doc) {
  for (const t of doc.querySelectorAll('table')) {
    const firstRow = t.querySelector('tr');
    if (!firstRow) continue;
    const headers = [...firstRow.querySelectorAll('td')].map(td => td.textContent.trim());
    if (
      headers.includes('Yazılış tarixi') &&
      headers.includes('Əməliyyat adı') &&
      headers.includes('Miqdar (Manat)')
    ) return t;
  }
  return null;
}

function buildTaxMap(rawRows) {
  const taxMap = {};
  for (const r of rawRows) {
    const { opName, opType, amount, date } = r;
    if (!opName || !opType) continue;

    const key   = extractTaxKey(opName);
    if (key === 'Diger') continue;

    const isKyb  = opName.includes('KYB');
    const isKybl = opName.includes('KYBL');
    const isSyb  = opName.includes('SYB') && !isKyb;

    if (!taxMap[key]) taxMap[key] = newTaxEntry(key);
    const entry = taxMap[key];

    if (isKyb) {
      entry.has_kyb = true;
      if (isKybl) {
        entry.has_kybl = true;
        entry.kyb_azalma += amount;
      } else {
        if (opType === 'Hesablama') entry.kyb_hesablama += amount;
        else if (opType === 'Azalma') entry.kyb_azalma += amount;
      }
    } else if (isSyb) {
      entry.has_syb = true;
      if (opType === 'Hesablama') entry.syb_hesablama += amount;
      else if (opType === 'Azalma') entry.syb_azalma += amount;
    } else {
      if (opType === 'Hesablama') entry.hesablama += amount;
      else if (opType === 'Azalma') entry.azalma += amount;

      // Count real declarations (slash-free rows only)
      const isSlashRow = /\/\s*\d+\s*$/.test(opName);
      if (DECL_PATTERN.test(opName) && opType !== 'Ödəniş' && !isSlashRow) {
        if (key.startsWith('VAHID MUZDLU')) {
          const declTypeMatch = opName.match(DECL_PATTERN);
          if (declTypeMatch) entry.vahidDates.add(`${date}|${declTypeMatch[0]}`);
        } else {
          entry.decl_count++;
        }
      }
    }
  }
  return taxMap;
}

function newTaxEntry(key) {
  return {
    key,
    hesablama: 0, azalma: 0,
    kyb_hesablama: 0, kyb_azalma: 0, has_kyb: false, has_kybl: false,
    syb_hesablama: 0, syb_azalma: 0, has_syb: false,
    decl_count: 0,
    vahidDates: new Set(),
  };
}

function finalizeTaxes(taxMap) {
  for (const t of Object.values(taxMap)) {
    t.kyb_net    = t.kyb_hesablama - t.kyb_azalma;
    t.kyb_status = !t.has_kyb ? 'none' : t.kyb_net <= 0 ? 'cancelled' : 'active';
    t.syb_net    = t.syb_hesablama - t.syb_azalma;
    t.syb_status = !t.has_syb ? 'none' : t.syb_net <= 0 ? 'cancelled' : 'active';
    t.client_net      = t.hesablama - t.azalma;
    t.total_hesablama = t.hesablama + t.kyb_hesablama + t.syb_hesablama;
    t.total_azalma    = t.azalma    + t.kyb_azalma    + t.syb_azalma;
    t.total_net       = t.total_hesablama - t.total_azalma;
    t.decl_count = t.key.startsWith('VAHID MUZDLU') ? t.vahidDates.size : t.decl_count;
  }
  return Object.values(taxMap)
    .filter(t => t.total_net !== 0 || t.has_kyb || t.has_syb)
    .sort((a, b) => taxSortKey(a.key).localeCompare(taxSortKey(b.key)));
}

function extractTaxKey(op) {
  op = op.trim();
  if (/^(Ödəmə tapşırığı|Sərəncam)\b/.test(op)) return 'Diger';

  let m;
  m = op.match(/^(ƏDVQR\s+\d{4}\/\d{2})/);         if (m) return m[1];
  m = op.match(/^(ƏDV\s+\d{4}\/\d{2})/);           if (m) return m[1];
  m = op.match(/^(ÖMV\s+\d{4}\s+\d+\.?\s*Rüb)/);  if (m) return m[1].replace(/\s+/g,' ').trim();
  m = op.match(/^(VAHID MUZDLU\s+\d{4}\s+\d+\.?\s*Rüb)/); if (m) return m[1].replace(/\s+/g,' ').trim();
  m = op.match(/^ƏV\s*[-–]\s*\d+\.?\s*Rüb\s+(\d{4})/); if (m) return `HŞƏV - ${m[1]}`;
  m = op.match(/^HŞƏV\s+(\d{4})/);                 if (m) return `HŞƏV - ${m[1]}`;
  m = op.match(/^MV[\s\-]/);
  if (m) { const yr = op.match(/(\d{4})/); return yr ? `MV - ${yr[1]}` : 'Diger'; }

  // Universal fallback
  m = op.match(/^([A-ZƏÜÖĞIİŞÇ][A-ZƏÜÖĞIİŞÇ\s]{0,20}?)\s+(\d{4}\/\d{2})\b/);
  if (m) return `${m[1].trim()} ${m[2]}`;
  m = op.match(/^([A-ZƏÜÖĞIİŞÇ][A-ZƏÜÖĞIİŞÇ\s]{0,20}?)\s+(\d{4})\s+\d+\.?\s*Rüb/);
  if (m) { const qm = op.match(/(\d+)\.?\s*Rüb/); return `${m[1].trim()} ${m[2]} ${qm[1]}. Rüb`; }
  m = op.match(/^([A-ZƏÜÖĞIİŞÇ][A-ZƏÜÖĞIİŞÇ\s]{0,20}?)\s+(\d{4})\b/);
  if (m) return `${m[1].trim()} - ${m[2]}`;

  return 'Diger';
}

function taxSortKey(key) {
  for (let i = 0; i < TAX_ORDER.length; i++) {
    if (key.startsWith(TAX_ORDER[i])) {
      const yr    = key.match(/(\d{4})/);
      const mo    = key.match(/\/(\d{2})/);
      const rub   = key.match(/(\d+)\.\s*Rüb/);
      const year  = yr  ? parseInt(yr[1])  : 9999;
      const month = mo  ? parseInt(mo[1])  : rub ? parseInt(rub[1]) * 3 : 0;
      return `${String(i).padStart(2,'0')}_${year}_${String(month).padStart(2,'0')}_${key}`;
    }
  }
  return `99_${key}`;
}

// Handles "8.415,00" (AZ/DE locale) → 8415.00
function parseAmount(s) {
  if (!s) return 0;
  return parseFloat(String(s).trim().replace(/\./g, '').replace(',', '.')) || 0;
}
