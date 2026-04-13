// modules/mv/parser.js
// Responsibility: XML text → structured MV declaration data object

export function parse(xmlText) {
  const doc  = new DOMParser().parseFromString(xmlText, 'text/xml');
  const get  = tag => doc.querySelector(tag)?.textContent?.trim() || '';
  const getN = tag => parseFloat(get(tag)) || 0;

  const vergiNo       = get('vergiNo');
  const adi           = get('adi');
  const yil           = get('yil');
  const ay            = get('ay');
  const donem         = ay ? `${yil}/${ay.padStart(2, '0')}` : yil;
  const beyannameTipi = get('beyannameTipi') === '0' ? 'Cari' : 'Dəqiqləşdirilmiş';
  const budce         = getN('budceyeOdenilmeli');
  const faaliyetAdi   = get('faaliyetNovuAdi');
  const umidsizBorc   = getN('umidsizBorcCemi');

  const allData = {};

  // Simple sections: <gosterici> + <mebleg>
  for (const sec of ['vergiHesab', 'bagliHarc', 'hesabatDovruVergiHesab1', 'hesabatDovruVergiHesab2', 'hesabatDovruVergiHesab']) {
    for (const row of doc.querySelectorAll(`${sec} row`)) {
      const kod    = row.querySelector('gosterici')?.textContent?.trim();
      const mebleg = parseFloat(row.querySelector('mebleg')?.textContent) || 0;
      if (kod && !allData[kod]) allData[kod] = { mebleg };
    }
  }

  // Aktivlər (Əlavə 1) — 4 columns
  for (const row of doc.querySelectorAll('aktivler row')) {
    const kod = row.querySelector('gosterici')?.textContent?.trim();
    if (!kod) continue;
    allData['A_' + kod] = {
      evvel:  parseFloat(row.querySelector('hesabatDovruEvveline')?.textContent) || 0,
      dahil:  parseFloat(row.querySelector('dahilOlunan')?.textContent)          || 0,
      takdim: parseFloat(row.querySelector('takdimEdilen')?.textContent)         || 0,
      son:    parseFloat(row.querySelector('hesabatDovruSonuna')?.textContent)   || 0,
    };
  }

  // Kapital & Öhdəliklər (Əlavə 1) — 5 columns
  for (const row of doc.querySelectorAll('kapitalEhtiyatlar row')) {
    const kod = row.querySelector('gosterici')?.textContent?.trim();
    if (!kod) continue;
    allData['K_' + kod] = {
      evvel:  parseFloat(row.querySelector('hesabatDovruEvveline')?.textContent) || 0,
      dahil:  parseFloat(row.querySelector('dahilOlunan')?.textContent)          || 0,
      takdim: parseFloat(row.querySelector('takdimEdilen')?.textContent)         || 0,
      silen:  parseFloat(row.querySelector('silinen')?.textContent)              || 0,
      son:    parseFloat(row.querySelector('hesabatDovruSonuna')?.textContent)   || 0,
    };
  }

  return { vergiNo, adi, donem, beyannameTipi, budce, faaliyetAdi, umidsizBorc, allData };
}
