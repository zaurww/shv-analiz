// modules/mv/renderer.js
// Responsibility: MV declaration data → DOM HTML

import { fmt, esc } from '../../core/ui.js';
import { mvInfo }   from './labels.js';

const SECTIONS = [
  { title: '💰 Gəlirlər',                     codes: ['1001','1002','1012','1013','1016'] },
  { title: '📉 Xərclər',                       codes: ['1021','1022','1023','1102','1106','1031','1034','1006','1041','1042','1045','1056','1076'] },
  { title: '🧾 Vergi hesabı (hesabat dövrü)',  codes: ['3001','3002','3003','3004'] },
  { title: '🏦 Balans — Aktivlər',             codes: ['2001','2002','2003','2004','2005','2007','2008','1200','2009','2011','2012','2014','2016','2018','2019'] },
  { title: '📋 Balans — Öhdəliklər & Kapital', codes: ['2020','2021','2022','2023','2027','2031','2033','2034','2039','2140','2040','2043','2049','2050','2052','2053','2057','2062'] },
  { title: '🔄 Gəlir/Xərc dövriyyəsi',        codes: ['2063','2064','2066','2071','2073'] },
];

function fmtN(n) {
  if (n === 0) return '<span class="num-zero">—</span>';
  const f = Math.abs(n).toLocaleString('az-AZ', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return n < 0 ? `<span class="num-neg">${f}</span>` : `<span class="num-pos">${f}</span>`;
}

export function render(data) {
  document.getElementById('mv-drop-section').style.display = 'none';
  const el = document.getElementById('mv-results');
  el.style.display = 'block';
  el.innerHTML = buildHTML(data);

  // Wire buttons after render
  el.querySelector('#mv-xlsx-btn')?.addEventListener('click', async () => {
    const btn = el.querySelector('#mv-xlsx-btn');
    btn.innerHTML = '⏳ Hazırlanır...'; btn.disabled = true;
    try {
      const { download } = await import('./exporter.js');
      await download(data);
    } finally {
      btn.innerHTML = '⬇ XLSX yüklə'; btn.disabled = false;
    }
  });
  el.querySelector('#mv-reset-btn')?.addEventListener('click', reset);
}

export function reset() {
  document.getElementById('mv-drop-section').style.display = 'flex';
  document.getElementById('mv-results').style.display = 'none';
  document.getElementById('mv-file-input').value = '';
}

function buildHTML(data) {
  const gelir = data.allData['1001']?.mebleg || 0;
  const xrc   = data.allData['1041']?.mebleg || 0;
  const mv    = data.allData['1042']?.mebleg || 0;

  const aktivKeys = Object.keys(data.allData).filter(k => k.startsWith('A_')).sort();
  const kapKeys   = Object.keys(data.allData).filter(k => k.startsWith('K_')).sort();

  let html = `
    <div class="company-card">
      <div>
        <div class="company-name">${esc(data.adi)}</div>
        <div class="company-voen">VÖEN: ${esc(data.vergiNo)} · ${esc(data.faaliyetAdi)}</div>
      </div>
      <div class="company-period">
        <div>Dövr: ${esc(data.donem)}</div>
        <div style="margin-top:2px">Bəyannamə: ${esc(data.beyannameTipi)}</div>
      </div>
    </div>
    <div class="summary-row">
      <div class="chip"><div class="chip-label">Büdcəyə ödənilməli</div><div class="chip-value ${data.budce > 0 ? 'danger' : 'ok'}">${gelirFmt(data.budce)} ₼</div></div>
      <div class="chip"><div class="chip-label">Cəmi gəlir</div><div class="chip-value ok">${gelirFmt(gelir)} ₼</div></div>
      <div class="chip"><div class="chip-label">Cəmi xərclər</div><div class="chip-value">${gelirFmt(xrc)} ₼</div></div>
      <div class="chip"><div class="chip-label">Vergiyə cəlb olunan mənfəət</div><div class="chip-value ${mv > 0 ? 'ok' : 'danger'}">${gelirFmt(mv)} ₼</div></div>
      <div class="chip"><div class="chip-label">Ümidsiz borc</div><div class="chip-value ${data.umidsizBorc > 0 ? 'danger' : 'ok'}">${gelirFmt(data.umidsizBorc)} ₼</div></div>
    </div>`;

  for (const sec of SECTIONS) {
    const tbl = simpleTable(sec.codes, data);
    if (tbl) html += `<div class="section-title">${sec.title}</div>${tbl}`;
  }
  if (aktivKeys.length) html += `<div class="section-title">📦 Aktivlər (Əlavə 1)</div>${aktivTable(aktivKeys, data)}`;
  if (kapKeys.length)   html += `<div class="section-title">🏛️ Kapital & Öhdəliklər (Əlavə 1)</div>${kapTable(kapKeys, data)}`;

  html += `<div class="action-row">
    <button class="btn btn-primary" id="mv-xlsx-btn">⬇ XLSX yüklə</button>
    <button class="btn btn-secondary" id="mv-reset-btn">↩ Yeni XML</button>
  </div>`;

  return html;
}

function gelirFmt(n) {
  return n.toLocaleString('az-AZ', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function simpleTable(codes, data) {
  const rows = codes
    .filter(c => data.allData[c]?.mebleg !== undefined)
    .map(c => {
      const v    = data.allData[c].mebleg;
      const info = mvInfo(c);
      const bold = ['1041','1056','3001','3003','2071'].includes(c) ? 'style="font-weight:700"' : '';
      return `<tr ${bold}>
        <td style="text-align:center;font-family:var(--mono);font-size:11px;color:var(--accent)">${esc(info.beyCode)}</td>
        <td style="text-align:center;font-family:var(--mono);font-size:11px;color:var(--muted)">${c}</td>
        <td style="text-align:left">${esc(info.label)}</td>
        <td>${fmtN(v)}</td>
      </tr>`;
    });
  if (!rows.length) return '';
  return `<div class="table-wrap"><table>
    <thead><tr>
      <th style="text-align:center">Bəy. kodu</th>
      <th style="text-align:center">XML kodu</th>
      <th style="text-align:left">Göstərici adı</th>
      <th>Məbləğ (₼)</th>
    </tr></thead>
    <tbody>${rows.join('')}</tbody>
  </table></div>`;
}

function aktivTable(keys, data) {
  const rows = keys.map(k => {
    const kod  = k.slice(2);
    const d    = data.allData[k];
    const info = mvInfo(kod);
    return `<tr>
      <td style="text-align:center;font-family:var(--mono);font-size:11px;color:var(--accent)">${esc(info.beyCode)}</td>
      <td style="text-align:center;font-family:var(--mono);font-size:11px;color:var(--muted)">${kod}</td>
      <td style="text-align:left">${esc(info.label)}</td>
      <td>${fmtN(d.evvel)}</td><td>${fmtN(d.dahil)}</td><td>${fmtN(d.takdim)}</td><td>${fmtN(d.son)}</td>
    </tr>`;
  });
  if (!rows.length) return '';
  return `<div class="table-wrap"><table>
    <thead><tr>
      <th style="text-align:center">Bəy. kodu</th><th style="text-align:center">XML kodu</th>
      <th style="text-align:left">Göstərici adı</th>
      <th>Dövrün əvvəlinə</th><th>Daxil olmuşdur</th><th>Təqdim edilmişdir</th><th>Dövrün sonuna</th>
    </tr></thead>
    <tbody>${rows.join('')}</tbody>
  </table></div>`;
}

function kapTable(keys, data) {
  const rows = keys.map(k => {
    const kod  = k.slice(2);
    const d    = data.allData[k];
    const info = mvInfo(kod);
    return `<tr>
      <td style="text-align:center;font-family:var(--mono);font-size:11px;color:var(--accent)">${esc(info.beyCode)}</td>
      <td style="text-align:center;font-family:var(--mono);font-size:11px;color:var(--muted)">${kod}</td>
      <td style="text-align:left">${esc(info.label)}</td>
      <td>${fmtN(d.evvel)}</td><td>${fmtN(d.dahil)}</td><td>${fmtN(d.takdim)}</td><td>${fmtN(d.silen || 0)}</td><td>${fmtN(d.son)}</td>
    </tr>`;
  });
  if (!rows.length) return '';
  return `<div class="table-wrap"><table>
    <thead><tr>
      <th style="text-align:center">Bəy. kodu</th><th style="text-align:center">XML kodu</th>
      <th style="text-align:left">Göstərici adı</th>
      <th>Dövrün əvvəlinə</th><th>Daxil olmuşdur</th><th>Təqdim edilmişdir</th><th>Silinmişdir</th><th>Dövrün sonuna</th>
    </tr></thead>
    <tbody>${rows.join('')}</tbody>
  </table></div>`;
}
