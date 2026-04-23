// modules/eqaime/parser.js
// Responsibility: raw XLSX rows (gələn + göndərilən) → structured EqaimeData object
// Portal exports: "Detallı gələn e-qaimələr" and "Detallı göndərilən e-qaimələr"

// ── Column key finders ──────────────────────────────────────────────────────
function findKey(keys, patterns) {
  for (const p of patterns) {
    const found = keys.find(k => p.test(String(k)));
    if (found) return found;
  }
  return null;
}

function buildGelirKeyMap(sample) {
  const keys = Object.keys(sample);
  return {
    seriya:   findKey(keys, [/seriya/i]),
    tarix:    findKey(keys, [/^tarix$/i]),
    gonderan: findKey(keys, [/göndərən\s*adı|göndərən\s*ad/i, /gonder.*ad/i]),
    gVoen:    findKey(keys, [/göndərən\s*vöen/i, /gonder.*voen/i]),
    status:   findKey(keys, [/^status$/i]),
    // "Yekun məbləğ" = total with VAT; fallback to "Cəmi məbləği"
    umumi:    findKey(keys, [/yekun məbləğ/i, /ümumi/i]),
    edvAmt:   findKey(keys, [/^ƏDV məbləği$/i, /ədv məbləği/i]),
    // Portal uses "o/t ƏDV-yə 18%" style
    edv18:    findKey(keys, [/ƏDV-yə\s*18%/i, /18%\s*baz/i]),
    edv0:     findKey(keys, [/ƏDV-yə\s*0%/i, /0%\s*baz/i, /sıfır.*baz/i]),
    edvAzad:  findKey(keys, [/ƏDV-dən\s*azad/i, /azad/i]),
    aksiz:    findKey(keys, [/aksiz məbləği/i, /aksiz/i]),
    yolV:     findKey(keys, [/yol\s*vergisi/i, /yol v/i]),
    cemi:     findKey(keys, [/cəmi məbləği/i]),
    mal:      findKey(keys, [/malın\s*\(işin.*\)\s*adı/i, /mal.*xidm.*adı/i, /məhsul.*adı/i]),
    kod:      findKey(keys, [/malın\s*kodu/i, /tnved/i, /^kod$/i]),
    miqdar:   findKey(keys, [/miqdarı/i, /miqdar/i]),
    vahid:    findKey(keys, [/vahidinin\s*satış/i, /vahid qiym/i]),
  };
}

function buildGonderKeyMap(sample) {
  const keys = Object.keys(sample);
  return {
    seriya:  findKey(keys, [/seriya/i]),
    tarix:   findKey(keys, [/^tarix$/i]),
    alan:    findKey(keys, [/alıcı\s*adı/i, /alan.*adı/i, /müştəri.*adı/i]),
    aVoen:   findKey(keys, [/alıcı\s*vöen/i, /alan.*vöen/i]),
    status:  findKey(keys, [/^status$/i]),
    umumi:   findKey(keys, [/yekun məbləğ/i, /ümumi/i]),
    edvAmt:  findKey(keys, [/^ƏDV məbləği$/i, /ədv məbləği/i]),
    cemi:    findKey(keys, [/cəmi məbləği/i]),
    mal:     findKey(keys, [/malın\s*\(işin.*\)\s*adı/i, /mal.*xidm.*adı/i, /məhsul.*adı/i]),
    miqdar:  findKey(keys, [/miqdarı/i, /miqdar/i]),
    vahid:   findKey(keys, [/vahidinin\s*satış/i, /vahid qiym/i]),
  };
}

// ── Main parse functions ────────────────────────────────────────────────────

export function parseGelir(rows) {
  if (!rows || !rows.length) return null;
  const km = buildGelirKeyMap(rows[0]);

  const suppliers = {};   // gonderan → {total, edv, inv:Set, pending}
  const monthly   = {};   // YYYY-MM → {total, edv, inv:Set}
  const items     = {};   // mal adı → {total, qty, count}
  const kodGroups = {};   // first 4 chars of TNVED → {total, count, samples}
  const statuses  = {};
  const invSet    = new Set();

  let total = 0, edv = 0;
  let edv18 = 0, edv0 = 0, edvAzad = 0, aksiz = 0, yolV = 0;
  let passivCount = 0, passivTotal = 0;
  let pendingCount = 0;

  for (const r of rows) {
    const seriya  = String(r[km.seriya]  || '').trim();
    const sup     = String(r[km.gonderan]|| '').trim();
    const gVoen   = String(r[km.gVoen]  || '').trim();
    const status  = String(r[km.status] || '').trim();
    const tarix   = parseMonth(r[km.tarix]);
    const amt     = toNum(r[km.umumi]);
    const edvAmt  = toNum(r[km.edvAmt]);
    const mal     = String(r[km.mal]    || '').trim();
    const kod     = String(r[km.kod]    || '').trim();
    const qty     = toNum(r[km.miqdar]);
    const vahidQ  = toNum(r[km.vahid]);
    const cemiAmt = toNum(r[km.cemi]);
    const e18     = toNum(r[km.edv18]);
    const e0      = toNum(r[km.edv0]);
    const eAzad   = toNum(r[km.edvAzad]);
    const ax      = toNum(r[km.aksiz]);
    const yv      = toNum(r[km.yolV]);

    statuses[status] = (statuses[status] || 0) + 1;

    // Excluded statuses (not counted in totals):
    //   - Passiv edilmiş           (deactivated)
    //   - Ləğv edildi              (cancelled)
    //   - Silindi                  (deleted)
    //   - Sistem tərəfindən silindi (system-deleted)
    // IMPORTANT: "Ləğvdən imtina / Təsdiqləndi" is ACTIVE (refusal-to-cancel → confirmed).
    const isExcluded = /passiv|ləğv\s*edildi|silindi/i.test(status);
    const isPending  = /gözləyi|pending/i.test(status);

    if (isExcluded) {
      passivCount++;
      passivTotal += amt;
      continue;
    }

    if (isPending) pendingCount++;

    total += amt;
    edv   += edvAmt;
    edv18 += e18; edv0 += e0; edvAzad += eAzad; aksiz += ax; yolV += yv;
    if (seriya) invSet.add(seriya);

    // Suppliers
    if (sup) {
      if (!suppliers[sup]) suppliers[sup] = { total: 0, edv: 0, inv: new Set(), pending: 0, voen: gVoen };
      suppliers[sup].total += amt;
      suppliers[sup].edv   += edvAmt;
      if (seriya) suppliers[sup].inv.add(seriya);
      if (isPending) suppliers[sup].pending++;
    }

    // Monthly
    if (tarix) {
      if (!monthly[tarix]) monthly[tarix] = { total: 0, edv: 0, inv: new Set() };
      monthly[tarix].total += amt;
      monthly[tarix].edv   += edvAmt;
      if (seriya) monthly[tarix].inv.add(seriya);
    }

    // Items (mal/xidmət)
    if (mal) {
      if (!items[mal]) items[mal] = { total: 0, qty: 0, count: 0 };
      items[mal].total += cemiAmt || amt;
      items[mal].qty   += qty;
      items[mal].count++;
    }

    // TNVED kod groups
    const grp = kod.slice(0, 4);
    if (grp && /^\d{4}/.test(grp)) {
      if (!kodGroups[grp]) kodGroups[grp] = { total: 0, count: 0, samples: [] };
      kodGroups[grp].total += cemiAmt || amt;
      kodGroups[grp].count++;
      if (kodGroups[grp].samples.length < 3 && mal && !kodGroups[grp].samples.includes(mal))
        kodGroups[grp].samples.push(mal);
    }
  }

  return {
    total, edv, edv18, edv0, edvAzad, aksiz, yolV,
    invoices: invSet.size,
    passivCount, passivTotal,
    pendingCount,
    suppliers, monthly, items, kodGroups, statuses,
  };
}

export function parseGonder(rows) {
  if (!rows || !rows.length) return null;
  const km = buildGonderKeyMap(rows[0]);

  const customers = {};
  const monthly   = {};
  const items     = {};
  const statuses  = {};
  const invSet    = new Set();

  let total = 0, edv = 0;
  let passivCount = 0, passivTotal = 0;

  for (const r of rows) {
    const seriya = String(r[km.seriya] || '').trim();
    const cust   = String(r[km.alan]   || '').trim();
    const aVoen  = String(r[km.aVoen]  || '').trim();
    const status = String(r[km.status] || '').trim();
    const tarix  = parseMonth(r[km.tarix]);
    const amt    = toNum(r[km.umumi]);
    const edvAmt = toNum(r[km.edvAmt]);
    const mal    = String(r[km.mal]    || '').trim();
    const qty    = toNum(r[km.miqdar]);
    const cemi   = toNum(r[km.cemi]);

    statuses[status] = (statuses[status] || 0) + 1;

    // Excluded statuses (see parseGelir for full list)
    const isExcluded = /passiv|ləğv\s*edildi|silindi/i.test(status);
    if (isExcluded) { passivCount++; passivTotal += amt; continue; }

    total += amt;
    edv   += edvAmt;
    if (seriya) invSet.add(seriya);

    if (cust) {
      if (!customers[cust]) customers[cust] = { total: 0, edv: 0, inv: new Set(), voen: aVoen };
      customers[cust].total += amt;
      customers[cust].edv   += edvAmt;
      if (seriya) customers[cust].inv.add(seriya);
    }

    if (tarix) {
      if (!monthly[tarix]) monthly[tarix] = { total: 0, edv: 0, inv: new Set() };
      monthly[tarix].total += amt;
      monthly[tarix].edv   += edvAmt;
      if (seriya) monthly[tarix].inv.add(seriya);
    }

    if (mal) {
      if (!items[mal]) items[mal] = { total: 0, qty: 0, count: 0 };
      items[mal].total += cemi || amt;
      items[mal].qty   += qty;
      items[mal].count++;
    }
  }

  return {
    total, edv,
    invoices: invSet.size,
    passivCount, passivTotal,
    customers, monthly, items, statuses,
  };
}

// ── Risk flags ──────────────────────────────────────────────────────────────
export function computeRisks(gelir, gonder) {
  const risks = [];

  if (gelir) {
    // Concentration risk: top supplier > 40%
    const supEntries = Object.entries(gelir.suppliers)
      .filter(([k]) => k.trim())
      .sort((a, b) => b[1].total - a[1].total);
    if (supEntries.length > 0 && gelir.total > 0) {
      const topPct = supEntries[0][1].total / gelir.total * 100;
      if (topPct > 50) risks.push({ level: 'red',    text: `Xərc konsentrasiyası: "${supEntries[0][0]}" alışların ${topPct.toFixed(0)}%-ni təşkil edir (>50%) — asılılıq riski yüksəkdir.` });
      else if (topPct > 30) risks.push({ level: 'yellow', text: `Xərc konsentrasiyası: "${supEntries[0][0]}" alışların ${topPct.toFixed(0)}%-ni təşkil edir (>30%).` });
    }

    // Pending invoices risk
    if (gelir.pendingCount > 0) {
      risks.push({ level: 'yellow', text: `${gelir.pendingCount} ədəd gözləyən (pending) qaimə var — ƏDV kreditinin qəbul edilməmə riski.` });
    }

    // ƏDV avantaj: 0% vs 18%
    const edvBase = gelir.edv18 + gelir.edv0 + gelir.edvAzad;
    if (edvBase > 0 && gelir.edv0 / edvBase > 0.5) {
      risks.push({ level: 'green', text: `Gələn qaimələrin ${(gelir.edv0 / edvBase * 100).toFixed(0)}%-i 0% ƏDV dərəcəlidir — əvəzləşdirmə imkanı məhduddur.` });
    }
  }

  if (gelir && gonder) {
    const margin = gonder.total - gelir.total;
    const marginPct = gonder.total ? margin / gonder.total * 100 : 0;

    if (gonder.total > 0 && margin < 0) {
      risks.push({ level: 'red', text: `Brüt marja mənfidir: ${marginPct.toFixed(1)}% — xərclər gəlirdən çoxdur.` });
    } else if (gonder.total > 0 && marginPct < 5) {
      risks.push({ level: 'yellow', text: `Brüt marja çox aşağıdır: ${marginPct.toFixed(1)}% — fəaliyyətin rentabelliyi şübhəlidir.` });
    }

    // ƏDV balance: should owe or get back
    const edvBalance = gonder.edv - gelir.edv;
    if (edvBalance < -5000) {
      risks.push({ level: 'green', text: `ƏDV balansı ${fmtRaw(Math.abs(edvBalance))} ₼ artıqdır — geri qaytarma tələbi mümkündür.` });
    }
  }

  if (gonder) {
    // Customer concentration
    const custEntries = Object.entries(gonder.customers)
      .filter(([k]) => k.trim())
      .sort((a, b) => b[1].total - a[1].total);
    if (custEntries.length > 0 && gonder.total > 0) {
      const topPct = custEntries[0][1].total / gonder.total * 100;
      if (topPct > 50) risks.push({ level: 'red',    text: `Gəlir konsentrasiyası: "${custEntries[0][0]}" satışların ${topPct.toFixed(0)}%-ni təşkil edir — müştəri asılılığı.` });
      else if (topPct > 30) risks.push({ level: 'yellow', text: `Gəlir konsentrasiyası: "${custEntries[0][0]}" satışların ${topPct.toFixed(0)}%-ni təşkil edir.` });
    }
  }

  return risks;
}

// Handles date values from SheetJS: string "2025-01-15 10:00", JS Date, or Excel serial number
function parseMonth(v) {
  if (!v) return '';
  // JS Date object (SheetJS with cellDates:true)
  if (v instanceof Date) {
    const y = v.getFullYear();
    const m = String(v.getMonth() + 1).padStart(2, '0');
    return `${y}-${m}`;
  }
  // Excel serial number (days since 1900-01-01)
  if (typeof v === 'number') {
    const d = new Date(Math.round((v - 25569) * 86400 * 1000));
    const y = d.getUTCFullYear();
    const m = String(d.getUTCMonth() + 1).padStart(2, '0');
    return `${y}-${m}`;
  }
  // String: "2025-01-15 10:00" or "2025-01" etc.
  return String(v).trim().slice(0, 7);
}

function toNum(v) {
  if (v == null) return 0;
  if (typeof v === 'number') return v;
  return parseFloat(String(v).replace(/\./g, '').replace(',', '.')) || 0;
}

function fmtRaw(n) {
  return Math.abs(n).toLocaleString('az-AZ', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
