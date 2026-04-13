// modules/shv/index.js
// Wires together file I/O, parser, renderer, and exporter for the SHV tab.

import { parse }    from './parser.js';
import { render }   from './renderer.js';
import { download } from './exporter.js';

export function init() {
  const dropZone = document.getElementById('shv-drop-zone');
  const fileInput = document.getElementById('shv-file-input');
  const spinner   = document.getElementById('shv-spinner');
  const errorBox  = document.getElementById('shv-error');

  dropZone.addEventListener('dragover', e => { e.preventDefault(); dropZone.classList.add('drag-over'); });
  dropZone.addEventListener('dragleave', () => dropZone.classList.remove('drag-over'));
  dropZone.addEventListener('drop', e => {
    e.preventDefault(); dropZone.classList.remove('drag-over');
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  });
  fileInput.addEventListener('change', e => { if (e.target.files[0]) handleFile(e.target.files[0]); });

  function handleFile(file) {
    spinner.style.display = 'block';
    errorBox.style.display = 'none';
    const reader = new FileReader();
    reader.onload = e => {
      try {
        const data = parse(e.target.result);
        render(data);
        // Wire XLSX button after render (button is created by renderer)
        const btn = document.getElementById('shv-xlsx-btn');
        if (btn) btn.addEventListener('click', () => download(data, btn));
      } catch (err) {
        errorBox.textContent = 'Fayl oxunarkən xəta: ' + err.message;
        errorBox.style.display = 'block';
        console.error(err);
      }
      spinner.style.display = 'none';
    };
    reader.onerror = () => {
      errorBox.textContent = 'Fayl oxuna bilmədi.';
      errorBox.style.display = 'block';
      spinner.style.display = 'none';
    };
    reader.readAsText(file, 'iso-8859-1');
  }
}
