// modules/eqaime/renderer.js
// Responsibility: EqaimeData → DOM HTML

import { fmt, fmtRaw, esc } from '../../core/ui.js';
import { computeRisks } from './parser.js';

export function render(gelir, gonder) {
  document.getElementById('eqaime-drop-section').style.display = 'none';
  const el = document.getElementById('eqaime-results');
  el.style.display = 'block';
  el.innerHTML = buildHTML(gelir, gonder);

  // Wire XLSX button
  el.querySelector('#eqaime-xlsx-btn')?.addEventListener('click', async () => {
    const btn = el.querySelector('#eqaime-xlsx-btn');
    btn.innerHTML = '⏳ Hazırlanır...'; btn.disabled = true;
    try {
      const { download } = await import('./exporter.js');
      await download(gelir, gonder);
    } finally { btn.innerHTML = '⬇ XLSX ixrac et'; btn.disabled = false; }
  });

  el.querySelector('#eqaime-reset-btn')?.addEventListener('click', reset);
}

export function reset() {
  document.getElementById('eqaime-drop-section').style.display = 'flex';
  document.getElementById('eqaime-results').style.display = 'none';
  document.getElementById('eqaime-results').innerHTML = '';
}

// ── Main HTML builder ───────────────────────────────────────────────────────
function buildHTML(gelir, gonder) {
  const rev    = gonder?.total || 0;
  const exp    = gelir?.total  || 0;
  const margin = rev - exp;
  const marginPct = rev > 0 ? margin / rev * 100 : 0;

  const edvOhde  = gonder?.edv || 0;  // ƏDV hesablanmış (göndərilən)
  const edvKredit= gelir?.edv  || 0;  // ƏDV ödənilmiş  (gələn)
  const edvBal   = edvOhde - edvKredit;

  const allMonths = new Set([
    ...Object.keys(gelir?.monthly  || {}),
    ...Object.keys(gonder?.monthly || {}),
  ]);
  const months  = [...allMonths].sort();
  const period  = months.length ? `${months[0]} — ${months[months.length - 1]}` : '—';

  const risks = computeRisks(gelir, gonder);

  return `
    ${headerHTML(period, gelir, gonder)}
    ${chipsHTML(rev, exp, margin, marginPct, edvBal, edvOhde, edvKredit, gelir, gonder)}
    ${risksHTML(risks)}
    ${edvCompareHTML(edvOhde, edvKredit, edvBal, gelir)}
    ${monthlyHTML(months, gelir, gonder)}
    ${gelir  ? suppliersHTML(gelir)  : ''}
    ${gonder ? customersHTML(gonder) : ''}
    ${gelir  ? gelirDetailHTML(gelir)  : ''}
    ${gonder ? gonderDetailHTML(gonder) : ''}
    <div class="action-row">
      <button class="btn btn-primary"   id="eqaime-xlsx-btn">⬇ XLSX ixrac et</button>
      <button class="btn btn-secondary" id="eqaime-reset-btn">↩ Yeni fayllar</button>
    </div>
  `;
}

// ── Header ──────────────────────────────────────────────────────────────────
function headerHTML(period, gelir, gonder) {
  const gelirInv  = gelir  ? `${gelir.invoices} qaimə`  : '—';
  const gonderInv = gonder ? `${gonder.invoices} qaimə` : '—';
  return `
    <div class="company-card">
      <div>
        <div class="company-name" style="color:var(--accent)">E-Qaimə Analizi</div>
        <div class="company-voen">Gələn: ${gelirInv} &nbsp;·&nbsp; Göndərilən: ${gonderInv}</div>
      </div>
      <div class="company-period">
        <div>Dövr: ${esc(period)}</div>
        ${gelir?.passivCount ? `<div style="margin-top:2px;color:var(--red)">${gelir.passivCount} passiv xaric edildi</div>` : ''}
        ${gonder?.passivCount ? `<div style="color:var(--red)">${gonder.passivCount} passiv xaric edildi</div>` : ''}
      </div>
    </div>`;
}

// ── Summary chips ───────────────────────────────────────────────────────────
function chipsHTML(rev, exp, margin, marginPct, edvBal, edvOhde, edvKredit, gelir, gonder) {
  const marginCls = margin < 0 ? 'danger' : margin < exp * 0.05 ? 'warn' : 'ok';
  const edvCls    = edvBal > 0 ? 'warn' : 'ok';

  const chips = [
    { label: 'Ümumi Gəlir (satış)', value: fmtAZN(rev),          cls: 'ok',    sub: gonder ? `${gonder.invoices} qaimə` : '' },
    { label: 'Ümumi Xərc (alış)',   value: fmtAZN(exp),          cls: '',      sub: gelir  ? `${gelir.invoices} qaimə`  : '' },
    { label: 'Brüt Marja',          value: fmtAZN(margin),       cls: marginCls, sub: `${marginPct.toFixed(1)}%` },
    { label: 'ƏDV Öhdəliyi',        value: fmtAZN(edvOhde),     cls: edvOhde > 0 ? 'warn' : '',  sub: 'göndərilən' },
    { label: 'ƏDV Krediti',         value: fmtAZN(edvKredit),   cls: 'ok',    sub: 'gələn' },
    { label: 'ƏDV Balansı',         value: fmtAZN(Math.abs(edvBal)), cls: edvCls, sub: edvBal >= 0 ? 'ödənilməli' : 'artıq ödənmiş' },
  ];

  return `<div class="summary-row">${chips.map(c => `
    <div class="chip">
      <div class="chip-label">${c.label}</div>
      <div class="chip-value ${c.cls}">${c.value}</div>
      ${c.sub ? `<div style="font-size:11px;color:var(--muted);margin-top:3px">${c.sub}</div>` : ''}
    </div>`).join('')}</div>`;
}

// ── Risks ───────────────────────────────────────────────────────────────────
function risksHTML(risks) {
  if (!risks.length) return '';
  const icons = { red: '🔴', yellow: '🟡', green: '🟢' };
  const cls   = { red: 'alert-kyb', yellow: 'alert-kyb', green: 'alert-syb' };
  return risks.map(r => `
    <div class="alert ${cls[r.level] || 'alert-kyb'}">
      <span class="icon">${icons[r.level]}</span>
      <div>${esc(r.text)}</div>
    </div>`).join('');
}

// ── ƏDV comparison block ────────────────────────────────────────────────────
function edvCompareHTML(edvOhde, edvKredit, edvBal, gelir) {
  if (!edvOhde && !edvKredit) return '';

  const edvBase = (gelir?.edv18 || 0) + (gelir?.edv0 || 0) + (gelir?.edvAzad || 0);
  const structHTML = gelir && edvBase > 0 ? `
    <div style="display:flex;gap:6px;margin-top:12px;flex-wrap:wrap">
      ${edvStructChip('ƏDV 18%', gelir.edv18, edvBase, 'var(--accent)')}
      ${edvStructChip('ƏDV 0%',  gelir.edv0,  edvBase, 'var(--yellow)')}
      ${edvStructChip('ƏDV-dən azad', gelir.edvAzad, edvBase, 'var(--muted)')}
    </div>` : '';

  const balColor = edvBal > 0 ? 'var(--red)' : 'var(--green)';
  const balLabel = edvBal > 0 ? 'ödənilməli' : 'artıq ödənmiş';

  return `
    <div class="section-title">ƏDV Balans Analizi</div>
    <div style="background:var(--bg2);border:1px solid var(--border);border-radius:var(--radius);padding:20px;box-shadow:var(--shadow-sm)">
      <div style="display:grid;grid-template-columns:1fr auto 1fr;gap:16px;align-items:center">
        <div style="text-align:center">
          <div style="font-size:11px;color:var(--muted);text-transform:uppercase;letter-spacing:.06em;margin-bottom:6px">ƏDV Öhdəliyi<br><span style="font-weight:400">(göndərilən qaimələr)</span></div>
          <div style="font-family:var(--mono);font-size:22px;font-weight:700;color:var(--red)">${fmtAZN(edvOhde)}</div>
        </div>
        <div style="text-align:center;color:var(--muted);font-size:22px">−</div>
        <div style="text-align:center">
          <div style="font-size:11px;color:var(--muted);text-transform:uppercase;letter-spacing:.06em;margin-bottom:6px">ƏDV Krediti<br><span style="font-weight:400">(gələn qaimələr)</span></div>
          <div style="font-family:var(--mono);font-size:22px;font-weight:700;color:var(--green)">${fmtAZN(edvKredit)}</div>
        </div>
      </div>
      <div style="margin-top:16px;padding-top:16px;border-top:1px solid var(--border);text-align:center">
        <div style="font-size:11px;color:var(--muted);text-transform:uppercase;letter-spacing:.06em;margin-bottom:4px">Nəticə — ${balLabel}</div>
        <div style="font-family:var(--mono);font-size:28px;font-weight:700;color:${balColor}">${fmtAZN(Math.abs(edvBal))}</div>
      </div>
      ${structHTML}
    </div>`;
}

function edvStructChip(label, val, base, color) {
  const pct = base > 0 ? (val / base * 100).toFixed(1) : 0;
  return `<div style="flex:1;min-width:120px;background:var(--bg3);border-radius:8px;padding:10px 12px">
    <div style="font-size:10px;color:var(--muted);text-transform:uppercase;letter-spacing:.05em">${label}</div>
    <div style="font-family:var(--mono);font-size:14px;font-weight:600;color:${color};margin-top:3px">${fmtAZN(val)}</div>
    <div style="font-size:11px;color:var(--muted)">${pct}%</div>
  </div>`;
}

// ── Monthly trend ───────────────────────────────────────────────────────────
function monthlyHTML(months, gelir, gonder) {
  if (!months.length) return '';

  const rows = months.map(m => {
    const g = gelir?.monthly[m];
    const gn= gonder?.monthly[m];
    const rev = gn?.total || 0;
    const exp = g?.total  || 0;
    const mar = rev - exp;
    return `<tr>
      <td style="text-align:left;font-family:var(--sans);font-weight:500;white-space:nowrap">${esc(m)}</td>
      <td>${rev > 0 ? fmtAZN(rev) : '<span class="num-zero">—</span>'}</td>
      <td>${exp > 0 ? fmtAZN(exp) : '<span class="num-zero">—</span>'}</td>
      <td><b style="color:${mar >= 0 ? 'var(--green)' : 'var(--red)'}">${fmtAZN(mar)}</b></td>
      <td>${gn?.edv > 0 ? fmtAZN(gn.edv) : '<span class="num-zero">—</span>'}</td>
      <td>${g?.edv  > 0 ? fmtAZN(g.edv)  : '<span class="num-zero">—</span>'}</td>
      <td>${gn?.inv.size || g?.inv.size ? (gn?.inv.size || 0) + ' / ' + (g?.inv.size || 0) : '<span class="num-zero">—</span>'}</td>
    </tr>`;
  });

  // Totals
  const totalRev = months.reduce((s,m) => s + (gonder?.monthly[m]?.total || 0), 0);
  const totalExp = months.reduce((s,m) => s + (gelir?.monthly[m]?.total  || 0), 0);
  const totalMar = totalRev - totalExp;
  const totalEdvO= months.reduce((s,m) => s + (gonder?.monthly[m]?.edv || 0), 0);
  const totalEdvG= months.reduce((s,m) => s + (gelir?.monthly[m]?.edv  || 0), 0);

  return `
    <div class="section-title">Aylıq Dinamika</div>
    <div class="table-wrap"><table>
      <thead><tr>
        <th style="text-align:left">Ay</th>
        <th>Gəlir (satış)</th>
        <th>Xərc (alış)</th>
        <th>Marja</th>
        <th>ƏDV öhdəlik</th>
        <th>ƏDV kredit</th>
        <th style="text-align:center">Qaimə (sat/al)</th>
      </tr></thead>
      <tbody>
        ${rows.join('')}
        <tr style="background:var(--bg3);font-weight:700;border-top:2px solid var(--border)">
          <td style="text-align:left;font-family:var(--sans);font-weight:700;color:var(--green)">CƏMİ</td>
          <td style="font-family:var(--mono);color:var(--green)">${fmtAZN(totalRev)}</td>
          <td style="font-family:var(--mono)">${fmtAZN(totalExp)}</td>
          <td style="font-family:var(--mono);color:${totalMar>=0?'var(--green)':'var(--red)'};font-weight:700">${fmtAZN(totalMar)}</td>
          <td style="font-family:var(--mono)">${fmtAZN(totalEdvO)}</td>
          <td style="font-family:var(--mono)">${fmtAZN(totalEdvG)}</td>
          <td></td>
        </tr>
      </tbody>
    </table></div>`;
}

// ── Suppliers table ─────────────────────────────────────────────────────────
function suppliersHTML(gelir) {
  const sorted = Object.entries(gelir.suppliers)
    .filter(([k]) => k.trim())
    .sort((a, b) => b[1].total - a[1].total)
    .slice(0, 20);

  if (!sorted.length) return '';
  const maxAmt = sorted[0][1].total;

  const rows = sorted.map(([name, d], i) => {
    const pct  = gelir.total ? (d.total / gelir.total * 100).toFixed(1) : 0;
    const barW = maxAmt ? Math.round(d.total / maxAmt * 100) : 0;
    const pendBadge = d.pending > 0
      ? `<span class="badge badge-yellow" style="margin-left:6px">${d.pending} gözləyir</span>` : '';
    return `<tr>
      <td style="text-align:center;font-family:var(--mono);font-size:11px;color:var(--muted)">${i+1}</td>
      <td>
        <div style="font-weight:500">${esc(name.slice(0, 55))}${name.length > 55 ? '…' : ''}${pendBadge}</div>
        <div style="height:3px;background:var(--accent);width:${barW}%;border-radius:2px;margin-top:3px;opacity:0.5"></div>
      </td>
      <td>${esc(d.voen || '—')}</td>
      <td>${fmtAZN(d.total)}</td>
      <td>${pct}%</td>
      <td>${fmtAZN(d.edv)}</td>
      <td style="text-align:center">${d.inv.size}</td>
    </tr>`;
  });

  return `
    <div class="section-title">Top Təchizatçılar (Gələn Qaimələr)</div>
    <div class="table-wrap"><table>
      <thead><tr>
        <th style="text-align:center">#</th>
        <th style="text-align:left">Təchizatçı adı</th>
        <th style="text-align:left">VÖEN</th>
        <th>Məbləğ (₼)</th>
        <th>Pay</th>
        <th>ƏDV (₼)</th>
        <th style="text-align:center">Qaimə</th>
      </tr></thead>
      <tbody>${rows.join('')}</tbody>
    </table></div>`;
}

// ── Customers table ─────────────────────────────────────────────────────────
function customersHTML(gonder) {
  const sorted = Object.entries(gonder.customers)
    .filter(([k]) => k.trim())
    .sort((a, b) => b[1].total - a[1].total)
    .slice(0, 20);

  if (!sorted.length) return '';
  const maxAmt = sorted[0][1].total;

  const rows = sorted.map(([name, d], i) => {
    const pct  = gonder.total ? (d.total / gonder.total * 100).toFixed(1) : 0;
    const barW = maxAmt ? Math.round(d.total / maxAmt * 100) : 0;
    return `<tr>
      <td style="text-align:center;font-family:var(--mono);font-size:11px;color:var(--muted)">${i+1}</td>
      <td>
        <div style="font-weight:500">${esc(name.slice(0, 55))}${name.length > 55 ? '…' : ''}</div>
        <div style="height:3px;background:var(--green);width:${barW}%;border-radius:2px;margin-top:3px;opacity:0.5"></div>
      </td>
      <td>${esc(d.voen || '—')}</td>
      <td>${fmtAZN(d.total)}</td>
      <td>${pct}%</td>
      <td>${fmtAZN(d.edv)}</td>
      <td style="text-align:center">${d.inv.size}</td>
    </tr>`;
  });

  return `
    <div class="section-title">Top Alıcılar (Göndərilən Qaimələr)</div>
    <div class="table-wrap"><table>
      <thead><tr>
        <th style="text-align:center">#</th>
        <th style="text-align:left">Alıcı adı</th>
        <th style="text-align:left">VÖEN</th>
        <th>Məbləğ (₼)</th>
        <th>Pay</th>
        <th>ƏDV (₼)</th>
        <th style="text-align:center">Qaimə</th>
      </tr></thead>
      <tbody>${rows.join('')}</tbody>
    </table></div>`;
}

// ── Gələn detail: top items + TNVED ─────────────────────────────────────────
function gelirDetailHTML(gelir) {
  const topItems = Object.entries(gelir.items)
    .filter(([k]) => k.trim())
    .sort((a, b) => b[1].total - a[1].total)
    .slice(0, 15);

  const topKods = Object.entries(gelir.kodGroups)
    .sort((a, b) => b[1].total - a[1].total)
    .slice(0, 10);

  const maxAmt = topItems[0]?.[1].total || 1;
  const kodTotal = topKods.reduce((s, [, v]) => s + v.total, 0) || 1;

  const itemRows = topItems.map(([name, v]) => {
    const barW = Math.round(v.total / maxAmt * 100);
    const avg = v.qty > 0 ? v.total / v.qty : 0;
    return `<tr>
      <td>
        <div style="font-weight:500">${esc(name.slice(0, 60))}${name.length > 60 ? '…' : ''}</div>
        <div style="height:3px;background:var(--accent);width:${barW}%;border-radius:2px;margin-top:3px;opacity:0.4"></div>
      </td>
      <td>${fmtAZN(v.total)}</td>
      <td style="font-family:var(--mono);font-size:11px">${v.qty > 0 ? v.qty.toLocaleString('az-AZ', {maximumFractionDigits:2}) : '—'}</td>
      <td>${avg > 0 ? fmtAZN(avg) : '<span class="num-zero">—</span>'}</td>
      <td style="text-align:center;font-family:var(--mono);font-size:11px">${v.count}</td>
    </tr>`;
  }).join('');

  const kodRows = topKods.map(([grp, v]) => `<tr>
    <td style="font-family:var(--mono);font-weight:600;color:var(--accent)">${esc(grp)}xxxx</td>
    <td style="color:var(--muted);font-size:12px">${esc(v.samples.join(' / ').slice(0, 70))}</td>
    <td>${fmtAZN(v.total)}</td>
    <td style="font-family:var(--mono);font-size:11px">${(v.total / kodTotal * 100).toFixed(1)}%</td>
  </tr>`).join('');

  return `
    <div class="section-title">Gələn Qaimələr — Mal/Xidmət Strukturu</div>
    <div class="table-wrap"><table>
      <thead><tr>
        <th style="text-align:left">Mal/Xidmət adı</th>
        <th>Məbləğ (₼)</th>
        <th>Miqdar</th>
        <th>Ort. qiymət</th>
        <th style="text-align:center">Sətir</th>
      </tr></thead>
      <tbody>${itemRows || noDataRow(5)}</tbody>
    </table></div>

    ${topKods.length ? `
    <div class="section-title">Gələn Qaimələr — TNVED Kod Qrupları</div>
    <div class="table-wrap"><table>
      <thead><tr>
        <th style="text-align:left">Kod qrupu</th>
        <th style="text-align:left">Nümunə mallar</th>
        <th>Məbləğ (₼)</th>
        <th>Pay</th>
      </tr></thead>
      <tbody>${kodRows}</tbody>
    </table></div>` : ''}`;
}

// ── Göndərilən detail: top items ────────────────────────────────────────────
function gonderDetailHTML(gonder) {
  const topItems = Object.entries(gonder.items)
    .filter(([k]) => k.trim())
    .sort((a, b) => b[1].total - a[1].total)
    .slice(0, 15);

  if (!topItems.length) return '';
  const maxAmt = topItems[0][1].total;

  const itemRows = topItems.map(([name, v]) => {
    const barW = Math.round(v.total / maxAmt * 100);
    const avg = v.qty > 0 ? v.total / v.qty : 0;
    return `<tr>
      <td>
        <div style="font-weight:500">${esc(name.slice(0, 60))}${name.length > 60 ? '…' : ''}</div>
        <div style="height:3px;background:var(--green);width:${barW}%;border-radius:2px;margin-top:3px;opacity:0.5"></div>
      </td>
      <td>${fmtAZN(v.total)}</td>
      <td style="font-family:var(--mono);font-size:11px">${v.qty > 0 ? v.qty.toLocaleString('az-AZ', {maximumFractionDigits:2}) : '—'}</td>
      <td>${avg > 0 ? fmtAZN(avg) : '<span class="num-zero">—</span>'}</td>
      <td style="text-align:center;font-family:var(--mono);font-size:11px">${v.count}</td>
    </tr>`;
  }).join('');

  return `
    <div class="section-title">Göndərilən Qaimələr — Mal/Xidmət Strukturu</div>
    <div class="table-wrap"><table>
      <thead><tr>
        <th style="text-align:left">Mal/Xidmət adı</th>
        <th>Məbləğ (₼)</th>
        <th>Miqdar</th>
        <th>Ort. qiymət</th>
        <th style="text-align:center">Sətir</th>
      </tr></thead>
      <tbody>${itemRows}</tbody>
    </table></div>`;
}

// ── Helpers ─────────────────────────────────────────────────────────────────
function fmtAZN(n) {
  return fmtRaw(n) + ' ₼';
}

function noDataRow(cols) {
  return `<tr><td colspan="${cols}" style="text-align:center;color:var(--muted);padding:16px">Məlumat yoxdur</td></tr>`;
}
