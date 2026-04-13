// modules/mv/index.js
// Wires together file I/O, parser, renderer for the MV XML tab.

import { parse }  from './parser.js';
import { render } from './renderer.js';

export function init() {
  const dropZone = document.getElementById('mv-drop-zone');
  const fileInput = document.getElementById('mv-file-input');
  const spinner   = document.getElementById('mv-spinner');
  const errorBox  = document.getElementById('mv-error');

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
      } catch (err) {
        errorBox.textContent = 'XML xətası: ' + err.message;
        errorBox.style.display = 'block';
        console.error(err);
      }
      spinner.style.display = 'none';
    };
    reader.readAsText(file, 'UTF-8');
  }
}
