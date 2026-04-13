// modules/shv/renderer.js
// Responsibility: AnalysisData → DOM HTML

import { fmt, fmtRaw, esc } from '../../core/ui.js';

export function render(data) {
  document.getElementById('shv-drop-section').style.display = 'none';
  const el = document.getElementById('shv-results');
  el.style.display = 'block';
  el.innerHTML = buildResultsHTML(data);
}

function buildResultsHTML(data) {
  const { kybActive, sybActive } = data;
  const kybTotal  = kybActive.reduce((s, t) => s + t.kyb_net, 0);
  const sybTotal  = sybActive.reduce((s, t) => s + t.syb_net, 0);
  const debtClass = data.totalDebt > 0 ? 'danger' : 'ok';

  return `
    ${companyCardHTML(data)}
    ${alertsHTML(kybActive, kybTotal, sybActive, sybTotal)}
    ${chipsHTML(data, kybActive, kybTotal, sybActive, sybTotal, debtClass)}
    <div class="section-title">Vergilər üzrə analiz</div>
    <div class="table-wrap">${taxTableHTML(data.taxes)}</div>
    <div class="action-row">
      <button class="btn btn-primary" id="shv-xlsx-btn">⬇ XLSX yüklə</button>
      <button class="btn btn-secondary" onclick="location.reload()">↩ Yeni fayl</button>
    </div>
  `;
}

function companyCardHTML(data) {
  return `
    <div class="company-card">
      <div>
        <div class="company-name">${esc(data.companyName)}</div>
        <div class="company-voen">VÖEN: ${esc(data.voen)}</div>
      </div>
      <div class="company-period">
        <div>Çap tarixi: ${esc(data.printDate)}</div>
        <div style="margin-top:2px">Dövr: ${esc(data.period)}</div>
      </div>
    </div>`;
}

function alertsHTML(kybActive, kybTotal, sybActive, sybTotal) {
  let html = '';
  if (kybActive.length > 0) {
    const names = kybActive.map(t => `<b>${esc(t.key)}</b>`).join(', ');
    html += `
      <div class="alert alert-kyb">
        <span class="icon">⚠️</span>
        <div><b>Aktiv kameral yoxlama (KYB) aşkar edildi!</b><br>
        ${names} üzrə cəmi <b>${fmtRaw(kybTotal)} ₼</b> məbləğində kameral başlama var.</div>
      </div>`;
  }
  if (sybActive.length > 0) {
    const names = sybActive.map(t => `<b>${esc(t.key)}</b>`).join(', ');
    html += `
      <div class="alert alert-syb">
        <span class="icon">🔍</span>
        <div><b>Aktiv səyyar yoxlama (SYB) aşkar edildi!</b><br>
        ${names} üzrə cəmi <b>${fmtRaw(sybTotal)} ₼</b> məbləğində səyyar başlama var.</div>
      </div>`;
  }
  return html;
}

function chipsHTML(data, kybActive, kybTotal, sybActive, sybTotal, debtClass) {
  const chips = [
    { label: 'Cəmi ödənməli borc', value: `${fmtRaw(data.totalDebt)} ₼`, cls: debtClass },
    { label: 'Aktiv KYB sayı',     value: kybActive.length,               cls: kybActive.length > 0 ? 'danger' : 'ok' },
    { label: 'Aktiv KYB məbləği',  value: `${fmtRaw(kybTotal)} ₼`,        cls: kybTotal > 0 ? 'warn' : 'ok' },
    { label: 'Aktiv SYB sayı',     value: sybActive.length,               cls: sybActive.length > 0 ? 'info' : 'ok' },
    { label: 'Aktiv SYB məbləği',  value: `${fmtRaw(sybTotal)} ₼`,        cls: sybTotal > 0 ? 'info' : 'ok' },
    { label: 'Vergi növlərinin sayı', value: data.taxes.length,            cls: '' },
  ];
  return `<div class="summary-row">${
    chips.map(c => `
      <div class="chip">
        <div class="chip-label">${c.label}</div>
        <div class="chip-value ${c.cls}">${c.value}</div>
      </div>`).join('')
  }</div>`;
}

// 14 columns: Tax | Decl | Bəy[Hes|Az|Net] | KYB[Hes|Az|Net|St] | SYB[Hes|Az|Net|St] | Cəmi
function taxTableHTML(taxes) {
  const rows = taxes.map(t => {
    const declCell  = t.decl_count > 0
      ? `<span style="color:var(--accent);font-weight:600">${t.decl_count}</span>`
      : `<span class="num-zero">—</span>`;
    const clientNet = t.hesablama - t.azalma;
    return `
      <tr>
        <td>${esc(t.key)}</td>
        <td style="text-align:center">${declCell}</td>
        <td>${fmt(t.hesablama)}</td>
        <td>${fmt(t.azalma)}</td>
        <td><b>${fmt(clientNet)}</b></td>
        <td>${fmt(t.kyb_hesablama)}</td>
        <td>${fmt(t.kyb_azalma)}</td>
        <td><b>${fmt(t.kyb_net)}</b></td>
        <td style="text-align:center">${statusBadgeHTML('kyb', t.kyb_status, t.kyb_net)}</td>
        <td>${fmt(t.syb_hesablama)}</td>
        <td>${fmt(t.syb_azalma)}</td>
        <td><b>${fmt(t.syb_net)}</b></td>
        <td style="text-align:center">${statusBadgeHTML('syb', t.syb_status, t.syb_net)}</td>
        <td><b>${fmt(t.total_net)}</b></td>
      </tr>`;
  }).join('');

  return `
    <table>
      <thead>
        <tr>
          <th rowspan="2" style="vertical-align:middle;text-align:left">Vergi / Dövr</th>
          <th rowspan="2" style="vertical-align:middle">Bəyannamə</th>
          <th colspan="3" style="text-align:center;color:var(--accent);border-bottom:2px solid var(--accent)">Bəyannamə üzrə</th>
          <th colspan="4" style="text-align:center;color:var(--yellow);border-bottom:2px solid var(--yellow)">KYB (Kameral)</th>
          <th colspan="4" style="text-align:center;color:var(--purple);border-bottom:2px solid var(--purple)">SYB (Səyyar)</th>
          <th rowspan="2" style="vertical-align:middle">Cəmi Qalıq</th>
        </tr>
        <tr>
          <th>Hesablama</th><th>Azalma</th><th>Net</th>
          <th>Hesablama</th><th>Azalma</th><th>Net</th><th>Status</th>
          <th>Hesablama</th><th>Azalma</th><th>Net</th><th>Status</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>`;
}

function statusBadgeHTML(type, status, net) {
  if (status === 'none')      return '<span class="badge badge-muted">—</span>';
  if (status === 'cancelled') return '<span class="badge badge-green">✓ Ləğv</span>';
  const colorClass = type === 'kyb' ? 'badge-red' : 'badge-purple';
  return `<span class="badge ${colorClass}">⚠ ${fmtRaw(net)}</span>`;
}
