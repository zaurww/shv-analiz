// modules/mv/renderer.js
// Responsibility: MV declaration data → DOM HTML
// Uses PDF_STRUCTURE from labels.js as single source of truth (mirrors exporter)

import { fmt, esc } from '../../core/ui.js';
import { mvInfo, PDF_STRUCTURE } from './labels.js';

function fmtN(n) {
  if (n === null || n === undefined) return '<span class="num-zero">—</span>';
  if (n === 0) return '<span class="num-zero">—</span>';
  const f = Math.abs(n).toLocaleString('az-AZ', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return n < 0 ? `<span class="num-neg">${f}</span>` : `<span class="num-pos">${f}</span>`;
}

function gelirFmt(n) {
  return n.toLocaleString('az-AZ', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function render(data) {
  document.getElementById('mv-drop-section').style.display = 'none';
  const el = document.getElementById('mv-results');
  el.style.display = 'block';
  el.innerHTML = buildHTML(data);

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
  const gelir  = data.allData['1041']?.mebleg || 0;
  const xrc    = data.allData['2071']?.mebleg || 0;
  const mv     = data.allData['3004']?.mebleg || 0;
  const budce  = data.budce || 0;

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
      <div class="chip">
        <div class="chip-label">Büdcəyə ödənilməli</div>
        <div class="chip-value ${budce > 0 ? 'danger' : 'ok'}">${gelirFmt(budce)} ₼</div>
      </div>
      <div class="chip">
        <div class="chip-label">Ümumi gəlirlər</div>
        <div class="chip-value ok">${gelirFmt(gelir)} ₼</div>
      </div>
      <div class="chip">
        <div class="chip-label">Cəmi xərclər</div>
        <div class="chip-value">${gelirFmt(xrc)} ₼</div>
      </div>
      <div class="chip">
        <div class="chip-label">Vergiyə cəlb olunan mənfəət</div>
        <div class="chip-value ${mv > 0 ? 'ok' : 'danger'}">${gelirFmt(mv)} ₼</div>
      </div>
      <div class="chip">
        <div class="chip-label">Ümidsiz borc</div>
        <div class="chip-value ${data.umidsizBorc > 0 ? 'danger' : 'ok'}">${gelirFmt(data.umidsizBorc || 0)} ₼</div>
      </div>
    </div>

    ${buildPdfTable(data)}
  `;

  if (aktivKeys.length) html += `<div class="section-title">📦 Aktivlər (Əlavə 1)</div>${aktivTable(aktivKeys, data)}`;
  if (kapKeys.length)   html += `<div class="section-title">🏛️ Kapital & Öhdəliklər (Əlavə 1)</div>${kapTable(kapKeys, data)}`;

  html += `
    <div class="action-row">
      <button class="btn btn-primary" id="mv-xlsx-btn">⬇ XLSX yüklə</button>
      <button class="btn btn-secondary" id="mv-reset-btn">↩ Yeni XML</button>
    </div>`;

  return html;
}

// ── PDF_STRUCTURE → HTML table (mirrors exporter Sheet 1) ─────────
function buildPdfTable(data) {
  // Section emoji map
  const SECTION_ICONS = {
    'GƏLİR': '💰',
    'XƏRC': '📉',
    'vergi': '🧾',
  };

  function sectionIcon(label) {
    if (label.includes('GƏLİR')) return '💰';
    if (label.includes('XƏRC') || label.includes('xərc')) return '📉';
    return '🧾';
  }

  const INDENT_PX = 14; // px per indent level

  let out = '';
  let inSection = false;
  let tableOpen = false;

  const closeTable = () => {
    if (tableOpen) { out += '</tbody></table></div>'; tableOpen = false; }
  };

  for (const row of PDF_STRUCTURE) {
    if (row.type === 'H') {
      closeTable();
      const icon = sectionIcon(row.label);
      out += `<div class="section-title">${icon} ${esc(row.label)}</div>`;
      out += `<div class="table-wrap"><table>
        <thead><tr>
          <th style="text-align:center;width:90px">Bəy. kodu</th>
          <th style="text-align:center;width:80px">XML kodu</th>
          <th style="text-align:left">Göstərici adı</th>
          <th style="width:150px">Məbləğ (₼)</th>
        </tr></thead>
        <tbody>`;
      tableOpen = true;
      continue;
    }

    // L or T line
    const isTotal = row.type === 'T';
    const pad     = row.lvl ? `padding-left:${row.lvl * INDENT_PX + 4}px` : 'padding-left:4px';
    const xmlCode = row.xml || '';
    const val     = row.xml ? (data.allData[row.xml]?.mebleg ?? null) : null;
    const hasVal  = val !== null && val !== 0;

    // Row background: total lines get accent bg, odd/even for data lines
    const rowClass = isTotal ? 'style="background:var(--bg3)"' : '';
    const labelStyle = isTotal
      ? 'font-weight:700;color:var(--text)'
      : (hasVal ? 'color:var(--text)' : 'color:var(--muted)');

    out += `<tr ${rowClass}>
      <td style="text-align:center;font-family:var(--mono);font-size:11px;color:var(--accent);font-weight:${isTotal?'700':'400'}">${esc(row.bey)}</td>
      <td style="text-align:center;font-family:var(--mono);font-size:11px;color:var(--muted)">${esc(xmlCode)}</td>
      <td style="${pad};${labelStyle};font-size:${isTotal?'13':'12'}px">${esc(row.label)}</td>
      <td style="font-weight:${isTotal?'700':'400'}">${fmtN(val)}</td>
    </tr>`;
  }

  closeTable();
  return out;
}

// ── Aktivlər table ─────────────────────────────────────────────────
function aktivTable(keys, data) {
  const rows = keys.map(k => {
    const kod  = k.slice(2);
    const d    = data.allData[k];
    const info = mvInfo(kod);
    return `<tr>
      <td style="text-align:center;font-family:var(--mono);font-size:11px;color:var(--accent)">${esc(info.beyCode)}</td>
      <td style="text-align:center;font-family:var(--mono);font-size:11px;color:var(--muted)">${esc(kod)}</td>
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

// ── Kapital & Öhdəliklər table ─────────────────────────────────────
function kapTable(keys, data) {
  const rows = keys.map(k => {
    const kod  = k.slice(2);
    const d    = data.allData[k];
    const info = mvInfo(kod);
    return `<tr>
      <td style="text-align:center;font-family:var(--mono);font-size:11px;color:var(--accent)">${esc(info.beyCode)}</td>
      <td style="text-align:center;font-family:var(--mono);font-size:11px;color:var(--muted)">${esc(kod)}</td>
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
