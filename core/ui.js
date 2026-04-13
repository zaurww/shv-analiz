// core/ui.js
// Shared UI utilities used by all modules

/**
 * Switch active tab. Automatically hides all registered tab panels
 * and shows the selected one.
 *
 * To add a new tab:
 *   1. Add its button: <button onclick="switchTab('newtab')">...</button>
 *   2. Add its panel:  <div id="tab-newtab" class="tab-panel">...</div>
 *   3. Register it here in TABS array.
 */
const TABS = ['shv', 'mv', 'edv'];

export function switchTab(tab) {
  TABS.forEach(id => {
    const panel  = document.getElementById(`tab-${id}`);
    const button = document.getElementById(`tab-btn-${id}`);
    if (panel)  panel.style.display  = id === tab ? 'block' : 'none';
    if (button) button.classList.toggle('active', id === tab);
  });
}

/** Format number → colored HTML span */
export function fmt(n) {
  if (n === 0) return '<span class="num-zero">—</span>';
  const s = Math.abs(n).toLocaleString('az-AZ', {
    minimumFractionDigits: 2, maximumFractionDigits: 2,
  });
  return n < 0
    ? `<span class="num-neg">-${s}</span>`
    : `<span class="num-pos">${s}</span>`;
}

/** Format number → plain string (for alerts, XLSX labels) */
export function fmtRaw(n) {
  return Math.abs(n).toLocaleString('az-AZ', {
    minimumFractionDigits: 2, maximumFractionDigits: 2,
  });
}

/** HTML-escape to prevent XSS */
export function esc(s) {
  return String(s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
