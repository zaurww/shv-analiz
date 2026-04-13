# Vergi Analizatoru

Tax analysis toolkit for Azerbaijan. Runs entirely in the browser — no backend, no build step.

**Live:** https://zaurww.github.io/shv-analiz/  
**Repo:** https://github.com/zaurww/shv-analiz (Public)  
**Deploy:** Upload files to GitHub → commit → instantly live via Pages.

> **For Claude:** Always use the uploaded `index.html` as the source of truth (it is newer than the project file). Never rely on previous conversation memory for code.  
> **Chat language:** Russian.

---

## Three Modules

| Tab | Input | What it does |
|---|---|---|
| 📋 Şəxsi Hesab | `.xls` from tax portal | Parses personal tax account statement → analysis table with KYB/SYB detection → XLSX (2 sheets) |
| 📄 MV Bəyannaməsi | `.xml` from e-taxes portal | Parses profit tax declaration → all indicators with PDF line codes → XLSX (3 sheets) |
| 📊 ƏDV Bəyannaməsi | multiple `.xml` files | Parses VAT declarations → monthly report across 4 sections → XLSX |

---

## File Structure

```
index.html              ← Shell: header, tab buttons, tab panels, bootstrap script
core/
  styles.css            ← All shared CSS (variables, layout, tables, badges, buttons)
  ui.js                 ← switchTab(), fmt(), fmtRaw(), esc()
  xlsx.js               ← Shared ExcelJS helpers: xFill, xFont, xBorderAll, saveWorkbook
modules/
  shv/
    parser.js           ← XLS/HTML text → AnalysisData object
    renderer.js         ← AnalysisData → DOM HTML
    exporter.js         ← AnalysisData → XLSX (2 sheets: Analiz + Orijinal)
    index.js            ← Wires drop zone + file reader → parser → renderer → exporter
  mv/
    labels.js           ← MV_LABELS map: XML code → { beyCode, label }
    parser.js           ← XML text → MV declaration data object
    renderer.js         ← MV data → DOM HTML (sections + aktivlər + kapital tables)
    exporter.js         ← MV data → XLSX (3 sheets)
    index.js            ← Wires drop zone → parser → renderer
  edv/
    parser.js           ← ƏDV XML text → monthly data object
    renderer.js         ← Array of monthly data → DOM HTML (4 sections)
    exporter.js         ← Monthly data array → XLSX (1 sheet, 4 sections)
    index.js            ← Wires multi-file drop, deduplication, generate button
```

---

## How to Add a New Module

1. Create `modules/{name}/` with `parser.js`, `renderer.js`, `exporter.js`, `index.js`
2. Add a tab button in `index.html`:
   ```html
   <button class="tab-btn" id="tab-btn-{name}" onclick="switchTab('{name}')">🔧 Title</button>
   ```
3. Add a tab panel in `index.html` (copy the pattern from an existing tab)
4. Register the id in `core/ui.js` → `TABS` array
5. Import and call `init` in the bootstrap script:
   ```js
   import { init as initNew } from './modules/{name}/index.js';
   initNew();
   ```

That's it — no other files need to change.

---

## Module Contracts

### parser.js
Every parser exports a single `parse(input)` function.  
Input types: `string` (HTML or XML text).  
Returns a plain JS object — the "data object" passed to renderer and exporter.

### renderer.js
Every renderer exports `render(data)`.  
It hides the drop section, shows the results area, and sets `innerHTML`.  
It wires buttons (XLSX, reset) **after** setting innerHTML — never before.

### exporter.js
Every exporter exports `download(data)`.  
It creates an ExcelJS workbook, builds sheets, calls `saveWorkbook(wb, filename)` from `core/xlsx.js`.  
ExcelJS is available as a global (`window.ExcelJS`) — loaded via `<script>` tag in `index.html`.

### index.js
Every module index exports `init()`.  
It wires DOM events (dragover, drop, change) and calls parser → renderer in sequence.  
No direct DOM manipulation beyond its own tab panel.

---

## SHV Module — Key Details

### Column Detection (dynamic)
```js
let amountIdx = headers.findIndex(h => h.includes('Miqdar') && h.includes('Manat'));
if (amountIdx === -1) amountIdx = 4; // fallback
```
Reason: some portal exports add an extra `Miqdar (ABŞ$)` column, shifting the Manat column from index 4 to 5.

### KYB / SYB Detection
```js
const isKyb  = opName.includes('KYB');
const isKybl = opName.includes('KYBL'); // → kyb_azalma (cancellation)
const isSyb  = opName.includes('SYB') && !isKyb; // SYB only if no KYB
```

### Declaration Count (`decl_count`)
Pattern matched: `/CARİ\(B\)|DƏQİQLƏŞMİŞ\(B\)|DƏQİQLƏŞDİRİLMİŞ\(B\)/`  
Excluded: `CARİ(ARAYIŞ)`, rows ending in `/N` (auto-generated avans corrections).  
VAHID MUZDLU: 3 rows per quarter (one per month) → deduped by `date|declType` key in `vahidDates` Set.

### extractTaxKey Priority Order
```
Ödəmə tapşırığı / Sərəncam → Diger
ƏDVQR YYYY/MM
ƏDV YYYY/MM
ÖMV YYYY N. Rüb
VAHID MUZDLU YYYY N. Rüb
ƏV - N.Rüb YYYY → HŞƏV - YYYY
HŞƏV YYYY → HŞƏV - YYYY
MV (not ÖMV) → MV - YYYY
Universal fallback (YYYY/MM | YYYY N.Rüb | YYYY annual)
Diger
```

### AnalysisData Object Shape
```js
{
  companyName, voen, period, printDate, totalDebt,
  taxes,        // sorted array of TaxEntry objects
  kybActive, kybCancelled, sybActive, sybCancelled,
  rawRows,      // all rows from the original statement table
}
```

### TaxEntry Shape
```js
{
  key,                          // canonical period string, e.g. "ƏDV 2025/03"
  hesablama, azalma,            // client declarations
  kyb_hesablama, kyb_azalma, kyb_net, kyb_status, has_kyb,
  syb_hesablama, syb_azalma, syb_net, syb_status, has_syb,
  total_hesablama, total_azalma, total_net,
  decl_count,                   // unique declarations filed by client
}
```

---

## MV Module — Key Details

### MV_LABELS Golden Rule
**The PDF declaration is the single source of truth.**  
If a line appears in Gəlirlər in the PDF → it belongs in the Gəlirlər section in code.  
Never place a code based on its XML tag. Always verify against the PDF.

### Critical Corrections (do not revert)

| XML code | Wrong beyCode | Correct beyCode | Reason |
|---|---|---|---|
| `1021` | `300` | `206` | Revenue item, not expense |
| `1034` | `310` | `212` | Revenue (interest income) |
| `1041` | `320` | `218` | ÜMUMİ GƏLİRLƏR |
| `3001` | `39`  | `237` | Tax calculation section |
| `3004` | `240` | `240` | sat.240=0 in sample; code kept at 240 |
| `4017` | `1`   | `1.5` | Pul vəsaitləri, not Cəmi aktivlər |
| `4022` | `2`   | `1.10`| Digər aktivlər, not Kapital |
| `bagliHarc` codes | balance sheet | sat.221–236 | bagliHarc = expense details |

### Adding or Fixing a Code
```
1. Find XML <gosterici> code and its <mebleg> value in the XML file
2. Find the same amount in the PDF declaration
3. Note PDF line number → beyCode
4. Note PDF section → determines which section array
5. Update MV_LABELS in modules/mv/labels.js
6. Update sections array in modules/mv/renderer.js (SECTIONS constant)
7. Update simpleSecs array in modules/mv/exporter.js
```

### Duplicate beyCode Issue
Some XML codes share the same PDF beyCode. Secondary ones get suffix `b`/`*` and are excluded from sections.  
Excluded from sections (duplicates, all zero in known samples): `2062`, `1031`, `1102`, `1106`.

### Summary Chips → XML Codes

| Chip | XML code | PDF line |
|---|---|---|
| Cəmi gəlir | `1001` | sat.200 |
| Cəmi xərclər | `1041` | sat.218 ÜMUMİ GƏLİRLƏR |
| Vergitutma mənfəəti | `3001` | sat.237 |
| Büdcəyə ödənilməli | `budce` (root XML field) | sat.243 |
| Ümidsiz borc | `umidsizBorc` (root XML field) | Əlavə 3 |

---

## ƏDV Module — Key Details

- Accepts **multiple XML files** — one per month, deduplicates by `(ay, yil)`
- 4 sections: Hissə 1 (sat.301–305), Hissə 2 (sat.308–317), Hissə 3 (Debitor borc), Hissə 4 (Hesablaşma)
- File encoding: UTF-8 (unlike SHV which uses ISO-8859-1)

---

## Core Utilities

### core/ui.js
```js
switchTab(id)    // hide all tabs, show selected, toggle active class
fmt(n)           // number → colored HTML span (num-pos / num-neg / num-zero)
fmtRaw(n)        // number → plain string "1,234.56"
esc(s)           // HTML-escape to prevent XSS
```

### core/xlsx.js
```js
xFill(hex)           // solid fill from 6-char hex
xFont(hex, bold, sz) // font descriptor
xBorderAll()         // thin border on all 4 sides
xBorderBottom(style, hex)  // bottom border only
NUM_FMT              // '#,##0.00;[Red]-#,##0.00;"-"'
NUM_FMT_INT          // '#,##0;[Red]-#,##0;"-"'
saveWorkbook(wb, filename)  // write buffer + trigger download
```

---

## Known Issues & Resolutions

| Issue | Resolution |
|---|---|
| Extra `Miqdar (ABŞ$)` column in some XLS exports | Dynamic `findIndex` for `Miqdar (Manat)` |
| `/N` rows (avans auto-corrections) counted as declarations | `isSlashRow = /\/\s*\d+\s*$/.test(opName)` — these are skipped |
| `ƏV` quarterly avans rows → should group with HŞƏV | Key normalized to `HŞƏV - YYYY` |
| KYBL rows → should reduce KYB, not client balance | Explicit `isKybl` check before `opType` branch |
| VAHID MUZDLU: portal emits 3 rows per quarter | `vahidDates` Set deduplicates by `date|declType` |
| MV `bagliHarc` XML tag confused with balance sheet | It holds expense details (sat.221–236) — all `2001–2073` codes are expenses |
| Aktivlər codes had wrong beyCode mapping | Fixed 2025-04-09: full remap vs PDF screenshots |
| ES Modules don't work via `file://` (double-click) | Use GitHub Pages or any HTTP server — not an issue for production |

---

## Typical Workflow with Claude

1. Paste this README at the start of the conversation
2. Upload the current `index.html` **or** reference the GitHub URL
3. Reference file and function by name: "fix `extractTaxKey` in `modules/shv/parser.js`"
4. Claude reads only the relevant file, makes a targeted change
5. Download the changed file, upload to GitHub
