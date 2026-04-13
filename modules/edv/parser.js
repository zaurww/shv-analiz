// modules/edv/parser.js
// Responsibility: ƏDV XML text → structured monthly data object

export function parse(xmlText) {
  const doc = new DOMParser().parseFromString(xmlText, 'text/xml');
  if (doc.querySelector('parsererror')) return null;

  const root = doc.documentElement;
  const ay   = parseInt(root.querySelector('donem > ay')?.textContent  || '0');
  const yil  = parseInt(root.querySelector('donem > yil')?.textContent || '0');
  const adi  = root.querySelector('mukellef > adi')?.textContent?.trim()      || '';
  const voen = root.querySelector('mukellef > vergiNo')?.textContent?.trim()  || '';

  function rv(sectionTag, code, field) {
    const section = root.querySelector(sectionTag);
    if (!section) return 0;
    for (const row of section.querySelectorAll('row')) {
      if (row.querySelector('gosterici')?.textContent === String(code)) {
        const el = row.querySelector(field);
        return el ? parseFloat(el.textContent) || 0 : 0;
      }
    }
    return 0;
  }

  const vergi = root.querySelector('vergiAsil');
  return {
    ay, yil, adi, voen,
    odenilmeli:   parseFloat(vergi?.querySelector('odenilmeli')?.textContent)   || 0,
    qaytarilmali: parseFloat(vergi?.querySelector('qaytarilmali')?.textContent) || 0,
    // Hissə 1: 301–305
    h1001_edvsiz: rv('HesaplamaUzreEnt', 1001, 'edvsiz'),
    h1001_edv:    rv('HesaplamaUzreEnt', 1001, 'edv'),
    h1002_deyer:  rv('HesaplamaUzreEnt', 1002, 'deyer'),
    h1002_edvsiz: rv('HesaplamaUzreEnt', 1002, 'edvsiz'),
    h1002_edv:    rv('HesaplamaUzreEnt', 1002, 'edv'),
    h1003_edv:    rv('HesaplamaUzreEnt', 1003, 'edv'),
    h1004_edv:    rv('HesaplamaUzreEnt', 1004, 'edv'),
    h1005_deyer:  rv('HesaplamaUzreEnt', 1005, 'deyer'),
    h1005_edvsiz: rv('HesaplamaUzreEnt', 1005, 'edvsiz'),
    h1005_edv:    rv('HesaplamaUzreEnt', 1005, 'edv'),
    // Hissə 2: 308–317
    a1008_edvsiz: rv('HesaplamaAvazEnt', 1008, 'edvsiz'),
    a1008_edv:    rv('HesaplamaAvazEnt', 1008, 'edv'),
    a1009_edv:    rv('HesaplamaAvazEnt', 1009, 'edv'),
    a1010_edvsiz: rv('HesaplamaAvazEnt', 1010, 'edvsiz'),
    a1010_edv:    rv('HesaplamaAvazEnt', 1010, 'edv'),
    a1011_edvsiz: rv('HesaplamaAvazEnt', 1011, 'edvsiz'),
    a1012_edv:    rv('HesaplamaAvazEnt', 1012, 'edv'),
    a1013_edv:    rv('HesaplamaAvazEnt', 1013, 'edv'),
    a1015_edvsiz: rv('HesaplamaAvazEnt', 1015, 'edvsiz'),
    a1510_edv:    rv('HesaplamaAvazEnt', 1510, 'edv'),
    a1016_edvsiz: rv('HesaplamaAvazEnt', 1016, 'edvsiz'),
    a1016_edv:    rv('HesaplamaAvazEnt', 1016, 'edv'),
    // Hissə 3: Debitor borc
    d1400_evvel:   rv('DebitorBorcEnt', 1400, 'borcEvvel'),
    d1400_yaranan: rv('DebitorBorcEnt', 1400, 'borcYaranan'),
    d1400_silinen: rv('DebitorBorcEnt', 1400, 'borcSilinen'),
    d1400_son:     rv('DebitorBorcEnt', 1400, 'borcSon'),
  };
}
