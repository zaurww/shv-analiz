// modules/edv/renderer.js
// Responsibility: array of monthly ƏDV data → DOM HTML

import { fmt, fmtRaw, esc } from '../../core/ui.js';

const MONTH_NAMES = {
  1:'Yanvar', 2:'Fevral', 3:'Mart', 4:'Aprel', 5:'May', 6:'İyun',
  7:'İyul', 8:'Avqust', 9:'Sentyabr', 10:'Oktyabr', 11:'Noyabr', 12:'Dekabr',
};

const H2_ROWS = [
  { label: '308. VM 175.1 elektron hesab-fakturalar', edvsiz: 'a1008_edvsiz', edv: 'a1008_edv' },
  { label: '309. 01.01.2001 borcları',                edvsiz: null,           edv: 'a1009_edv'  },
  { label: '310. İdxalda ƏDV-yə cəlb olunan',        edvsiz: 'a1010_edvsiz', edv: 'a1010_edv'  },
  { label: '311. İdxalda ƏDV-dən azad',               edvsiz: 'a1011_edvsiz', edv: null          },
  { label: '312. VM 169 qeyri-rezident',               edvsiz: null,           edv: 'a1012_edv'  },
  { label: '313. VM 175.2 əvəzləşdirilməyən',         edvsiz: null,           edv: 'a1013_edv'  },
  { label: '315. VM 175.4 əvəzləşdirilməyən ƏDV',    edvsiz: 'a1015_edvsiz', edv: null          },
  { label: '316. Sıfır faiz dərəcəsi',                edvsiz: null,           edv: 'a1510_edv'  },
  { label: '317. Əməliyyatlar üzrə CƏMİ',             edvsiz: 'a1016_edvsiz', edv: 'a1016_edv'  },
];

function fmtN(n) {
  if (n === 0) return '<span class="num-zero">—</span>';
  const s = Math.abs(n).toLocaleString('az-AZ', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return n < 0 ? `<span class="num-neg">${s}</span>` : `<span class="num-pos">${s}</span>`;
}
function sum(data, f) { return data.reduce((s, d) => s + (d[f] || 0), 0); }
function ml(d) { return `${MONTH_NAMES[d.ay]} ${d.yil}`; }
function totalRow(cols) {
  return `<tr style="background:var(--bg3);font-weight:700">
    <td style="text-align:left;font-family:var(--sans);font-weight:700;color:var(--green)">CƏMİ</td>
    ${cols.map(v => `<td style="color:var(--green);font-family:var(--mono)">${fmtRaw(v)}</td>`).join('')}
  </tr>`;
}

export function render(data) {
  data.sort((a, b) => (a.yil * 100 + a.ay) - (b.yil * 100 + b.ay));
  document.getElementById('edv-drop-section').style.display = 'none';
  const el = document.getElementById('edv-results');
  el.style.display = 'block';
  el.innerHTML = buildHTML(data);

  el.querySelector('#edv-xlsx-btn')?.addEventListener('click', async () => {
    const btn = el.querySelector('#edv-xlsx-btn');
    btn.innerHTML = '⏳ Hazırlanır...'; btn.disabled = true;
    try {
      const { download } = await import('./exporter.js');
      await download(data);
    } finally { btn.innerHTML = '⬇ XLSX ixrac et'; btn.disabled = false; }
  });
  el.querySelector('#edv-reset-btn')?.addEventListener('click', reset);
}

export function reset() {
  document.getElementById('edv-drop-section').style.display = 'flex';
  document.getElementById('edv-results').style.display = 'none';
  document.getElementById('edv-file-input').value = '';
}

function buildHTML(data) {
  const company    = data[0].adi;
  const voen       = data[0].voen;
  const years      = [...new Set(data.map(d => d.yil))];
  const yearStr    = years.length === 1 ? `${years[0]}-ci il` : `${years[0]}–${years[years.length - 1]}`;
  const totalOden  = sum(data, 'odenilmeli');
  const totalQayt  = sum(data, 'qaytarilmali');

  let html = `
    <div class="company-card">
      <div>
        <div class="company-name">${esc(company)}</div>
        <div class="company-voen">VÖEN: ${esc(voen)}</div>
      </div>
      <div class="company-period"><div>${yearStr}</div><div style="margin-top:2px">${data.length} ay</div></div>
    </div>
    <div class="summary-row">
      <div class="chip"><div class="chip-label">Ödənilməli (cəmi)</div><div class="chip-value ${totalOden > 0 ? 'danger' : 'ok'}">${fmtRaw(totalOden)} ₼</div></div>
      <div class="chip"><div class="chip-label">Qaytarılmalı (cəmi)</div><div class="chip-value ok">${fmtRaw(totalQayt)} ₼</div></div>
      <div class="chip"><div class="chip-label">Ay sayı</div><div class="chip-value">${data.length}</div></div>
    </div>`;

  // Hissə 1
  const s1f = ['h1001_edvsiz','h1001_edv','h1002_deyer','h1002_edvsiz','h1002_edv','h1003_edv','h1004_edv','h1005_deyer','h1005_edvsiz','h1005_edv'];
  html += `<div class="section-title">Hissə 1 — Dövriyyə üzrə ƏDV hesablanması (301–305)</div>
  <div class="table-wrap"><table>
    <thead>
      <tr>
        <th rowspan="2" style="text-align:left;vertical-align:middle">Ay</th>
        <th colspan="2" style="text-align:center;color:var(--accent)">301. ƏDV 18%</th>
        <th colspan="3" style="text-align:center;color:var(--yellow)">302. Sıfır dərəcə</th>
        <th style="text-align:center;color:var(--muted)">303. Azad</th>
        <th style="text-align:center;color:var(--muted)">304. 20%</th>
        <th colspan="3" style="text-align:center;color:var(--green)">305. Cəmi</th>
      </tr>
      <tr>
        <th>ƏDV-siz</th><th>ƏDV</th>
        <th>Dəyər</th><th>ƏDV-siz</th><th>ƏDV</th>
        <th>ƏDV</th><th>ƏDV</th>
        <th>Dəyər</th><th>ƏDV-siz</th><th>ƏDV</th>
      </tr>
    </thead>
    <tbody>
      ${data.map(d => `<tr>
        <td style="text-align:left;font-family:var(--sans);font-weight:500;white-space:nowrap">${ml(d)}</td>
        <td>${fmtN(d.h1001_edvsiz)}</td><td>${fmtN(d.h1001_edv)}</td>
        <td>${fmtN(d.h1002_deyer)}</td><td>${fmtN(d.h1002_edvsiz)}</td><td>${fmtN(d.h1002_edv)}</td>
        <td>${fmtN(d.h1003_edv)}</td><td>${fmtN(d.h1004_edv)}</td>
        <td>${fmtN(d.h1005_deyer)}</td><td>${fmtN(d.h1005_edvsiz)}</td><td>${fmtN(d.h1005_edv)}</td>
      </tr>`).join('')}
      ${totalRow(s1f.map(f => sum(data, f)))}
    </tbody>
  </table></div>`;

  // Hissə 2
  html += `<div class="section-title" style="margin-top:28px">Hissə 2 — Əvəzləşdirilən ƏDV hesablanması (308–317)</div>
  <div class="table-wrap"><table>
    <thead>
      <tr>
        <th style="text-align:left;vertical-align:middle">Ay</th>
        ${H2_ROWS.map(r => `<th colspan="2" style="text-align:center;white-space:normal;min-width:130px;font-size:10px">${r.label}</th>`).join('')}
      </tr>
      <tr>${H2_ROWS.map(() => '<th>ƏDV-siz</th><th>ƏDV</th>').join('')}</tr>
    </thead>
    <tbody>
      ${data.map(d => `<tr>
        <td style="text-align:left;font-family:var(--sans);font-weight:500;white-space:nowrap">${ml(d)}</td>
        ${H2_ROWS.map(r => `<td>${fmtN(r.edvsiz ? (d[r.edvsiz] || 0) : 0)}</td><td>${fmtN(r.edv ? (d[r.edv] || 0) : 0)}</td>`).join('')}
      </tr>`).join('')}
      <tr style="background:var(--bg3);font-weight:700">
        <td style="text-align:left;font-family:var(--sans);font-weight:700;color:var(--green)">CƏMİ</td>
        ${H2_ROWS.map(r => `<td style="color:var(--green);font-family:var(--mono)">${fmtRaw(r.edvsiz ? sum(data, r.edvsiz) : 0)}</td><td style="color:var(--green);font-family:var(--mono)">${fmtRaw(r.edv ? sum(data, r.edv) : 0)}</td>`).join('')}
      </tr>
    </tbody>
  </table></div>`;

  // Hissə 3
  html += `<div class="section-title" style="margin-top:28px">Hissə 3 — Debitor borc</div>
  <div class="table-wrap"><table>
    <thead><tr>
      <th style="text-align:left">Ay</th>
      <th>Əvvələ qalıq</th><th>Yaranan borc</th><th>Silinən borc</th><th>Sona qalıq</th>
    </tr></thead>
    <tbody>
      ${data.map(d => `<tr>
        <td style="text-align:left;font-family:var(--sans);font-weight:500">${ml(d)}</td>
        <td>${fmtN(d.d1400_evvel)}</td><td>${fmtN(d.d1400_yaranan)}</td>
        <td>${fmtN(d.d1400_silinen)}</td><td>${fmtN(d.d1400_son)}</td>
      </tr>`).join('')}
    </tbody>
  </table></div>`;

  // Hissə 4
  html += `<div class="section-title" style="margin-top:28px">Hissə 4 — Hesablaşma</div>
  <div class="table-wrap"><table>
    <thead><tr>
      <th style="text-align:left">Ay</th><th>Ödənilməli</th><th>Qaytarılmalı</th>
    </tr></thead>
    <tbody>
      ${data.map(d => `<tr>
        <td style="text-align:left;font-family:var(--sans);font-weight:500">${ml(d)}</td>
        <td>${fmtN(d.odenilmeli)}</td><td>${fmtN(d.qaytarilmali)}</td>
      </tr>`).join('')}
      <tr style="background:var(--bg3);font-weight:700">
        <td style="text-align:left;font-family:var(--sans);font-weight:700;color:var(--green)">CƏMİ</td>
        <td style="color:${totalOden > 0 ? 'var(--red)' : 'var(--green)'};font-family:var(--mono)">${fmtRaw(totalOden)}</td>
        <td style="color:var(--green);font-family:var(--mono)">${fmtRaw(totalQayt)}</td>
      </tr>
    </tbody>
  </table></div>`;

  html += `<div class="action-row">
    <button class="btn btn-primary" id="edv-xlsx-btn">⬇ XLSX ixrac et</button>
    <button class="btn btn-secondary" id="edv-reset-btn">↩ Yeni fayllar</button>
  </div>`;

  return html;
}
