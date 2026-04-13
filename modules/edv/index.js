// modules/edv/index.js
// Wires together file I/O, parser, renderer for the ƏDV XML tab.
// Supports multiple XML files (one per month), deduplicates by month.

import { parse }  from './parser.js';
import { render } from './renderer.js';

export function init() {
  const dropZone  = document.getElementById('edv-drop-zone');
  const fileInput = document.getElementById('edv-file-input');
  const fileList  = document.getElementById('edv-file-list');
  const btnGen    = document.getElementById('edv-btn-generate');
  const btnClear  = document.getElementById('edv-btn-clear');
  const errorBox  = document.getElementById('edv-error');

  let loadedFiles = new Map(); // filename → xmlText
  let parsedData  = [];

  dropZone.addEventListener('dragover', e => { e.preventDefault(); dropZone.classList.add('drag-over'); });
  dropZone.addEventListener('dragleave', () => dropZone.classList.remove('drag-over'));
  dropZone.addEventListener('drop', e => {
    e.preventDefault(); dropZone.classList.remove('drag-over');
    handleFiles(e.dataTransfer.files);
  });
  fileInput.addEventListener('change', e => handleFiles(e.target.files));

  function handleFiles(files) {
    for (const file of files) {
      if (!file.name.toLowerCase().endsWith('.xml')) continue;
      const reader = new FileReader();
      reader.onload = ev => { loadedFiles.set(file.name, ev.target.result); updateUI(); };
      reader.readAsText(file, 'UTF-8');
    }
  }

  function updateUI() {
    fileList.innerHTML = '';
    for (const [name] of loadedFiles) {
      const chip = document.createElement('div');
      chip.className = 'file-chip';
      chip.innerHTML = `<span class="file-chip-dot"></span>${name}<span class="file-chip-remove" data-name="${name}">×</span>`;
      chip.querySelector('.file-chip-remove').addEventListener('click', e => {
        e.stopPropagation(); loadedFiles.delete(e.target.dataset.name); updateUI();
      });
      fileList.appendChild(chip);
    }
    btnGen.disabled = loadedFiles.size === 0;
    btnClear.style.display = loadedFiles.size > 0 ? '' : 'none';
  }

  btnClear.addEventListener('click', () => {
    loadedFiles.clear(); parsedData = [];
    document.getElementById('edv-results').style.display = 'none';
    document.getElementById('edv-results').innerHTML = '';
    fileInput.value = ''; updateUI();
  });

  btnGen.addEventListener('click', () => {
    errorBox.style.display = 'none';
    parsedData = [];
    const errors = [];
    for (const [name, xml] of loadedFiles) {
      const d = parse(xml);
      if (!d) { errors.push(name); continue; }
      const idx = parsedData.findIndex(x => x.ay === d.ay && x.yil === d.yil);
      if (idx >= 0) parsedData[idx] = d; else parsedData.push(d);
    }
    if (errors.length) {
      errorBox.textContent = 'XML xətası olan fayllar: ' + errors.join(', ');
      errorBox.style.display = 'block';
    }
    if (parsedData.length === 0) return;
    render(parsedData);
    document.getElementById('edv-results').scrollIntoView({ behavior: 'smooth', block: 'start' });
  });
}
