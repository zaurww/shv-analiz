// modules/eqaime/index.js
// Wires together file I/O, parser, renderer for the E-Qaimə tab.
// Accepts two XLSX files: "Detallı gələn" and "Detallı göndərilən"

import { parseGelir, parseGonder } from './parser.js';
import { render } from './renderer.js';

export function init() {
  const dropGelir  = document.getElementById('eqaime-drop-gelir');
  const dropGonder = document.getElementById('eqaime-drop-gonder');
  const inputGelir  = document.getElementById('eqaime-input-gelir');
  const inputGonder = document.getElementById('eqaime-input-gonder');
  const btnGenerate = document.getElementById('eqaime-btn-generate');
  const btnClear    = document.getElementById('eqaime-btn-clear');
  const errorBox    = document.getElementById('eqaime-error');

  let parsedGelir  = null;
  let parsedGonder = null;

  // ── Drag & drop ──────────────────────────────────────────────
  setupDrop(dropGelir,  inputGelir,  'gelir');
  setupDrop(dropGonder, inputGonder, 'gonder');

  function setupDrop(zone, input, key) {
    zone.addEventListener('dragover', e => { e.preventDefault(); zone.classList.add('drag-over'); });
    zone.addEventListener('dragleave', () => zone.classList.remove('drag-over'));
    zone.addEventListener('drop', e => {
      e.preventDefault(); zone.classList.remove('drag-over');
      const f = e.dataTransfer.files[0];
      if (f) loadFile(f, key, zone);
    });
    input.addEventListener('change', e => {
      if (e.target.files[0]) loadFile(e.target.files[0], key, zone);
    });
  }

  // ── File loader ──────────────────────────────────────────────
  function loadFile(file, key, zone) {
    errorBox.style.display = 'none';
    const reader = new FileReader();
    reader.onload = ev => {
      try {
        const wb   = XLSX.read(ev.target.result, { type: 'array' });
        const ws   = wb.Sheets[wb.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json(ws, { defval: null });

        if (!rows.length) throw new Error('Fayl boşdur və ya oxuna bilmir');

        if (key === 'gelir') {
          parsedGelir = parseGelir(rows);
          markLoaded(zone, file.name, parsedGelir?.invoices || 0, 'gələn');
        } else {
          parsedGonder = parseGonder(rows);
          markLoaded(zone, file.name, parsedGonder?.invoices || 0, 'göndərilən');
        }

        updateBtn();
      } catch (err) {
        errorBox.textContent = `${key === 'gelir' ? 'Gələn' : 'Göndərilən'} fayl xətası: ` + err.message;
        errorBox.style.display = 'block';
      }
    };
    reader.onerror = () => {
      errorBox.textContent = 'Fayl oxuna bilmədi.';
      errorBox.style.display = 'block';
    };
    reader.readAsArrayBuffer(file);
  }

  function markLoaded(zone, filename, invCount, type) {
    zone.classList.add('loaded');
    const nameEl = zone.querySelector('.eqaime-filename');
    if (nameEl) nameEl.textContent = `✓ ${filename} (${invCount} qaimə)`;
  }

  function updateBtn() {
    btnGenerate.disabled = !parsedGelir && !parsedGonder;
  }

  // ── Generate ─────────────────────────────────────────────────
  btnGenerate.addEventListener('click', () => {
    errorBox.style.display = 'none';
    if (!parsedGelir && !parsedGonder) {
      errorBox.textContent = 'Zəhmət olmasa ən azı bir fayl yükləyin.';
      errorBox.style.display = 'block';
      return;
    }
    render(parsedGelir, parsedGonder);
    document.getElementById('eqaime-results').scrollIntoView({ behavior: 'smooth', block: 'start' });
  });

  // ── Clear ────────────────────────────────────────────────────
  btnClear.addEventListener('click', () => {
    parsedGelir = parsedGonder = null;
    inputGelir.value = ''; inputGonder.value = '';
    [dropGelir, dropGonder].forEach(z => {
      z.classList.remove('loaded');
      const nameEl = z.querySelector('.eqaime-filename');
      if (nameEl) nameEl.textContent = '';
    });
    document.getElementById('eqaime-results').style.display = 'none';
    document.getElementById('eqaime-results').innerHTML = '';
    errorBox.style.display = 'none';
    updateBtn();
  });

  updateBtn();
}
