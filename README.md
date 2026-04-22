# Vergi Analizatoru

Tax analysis toolkit for Azerbaijan. Runs entirely in the browser — no backend, no build step.

**Live:** https://zaurww.github.io/shv-analiz/  
**Repo:** https://github.com/zaurww/shv-analiz (Public)  
**Deploy:** Upload files to GitHub → commit → instantly live via Pages.

> **For Claude:** Always use the uploaded `index.html` as the source of truth (it is newer than the project file). Never rely on previous conversation memory for code.  
> **Chat language:** Russian.

---

## Four Modules

| Tab | Input | What it does |
|---|---|---|
| 📋 Şəxsi Hesab | `.xls` from tax portal | Parses personal tax account statement → analysis table with KYB/SYB detection → XLSX (2 sheets) |
| 📄 MV Bəyannaməsi | `.xml` from e-taxes portal | Parses profit tax declaration → all indicators with PDF line codes → XLSX (3 sheets) |
| 📊 ƏDV Bəyannaməsi | multiple `.xml` files | Parses VAT declarations → monthly report across 4 sections → XLSX |
| 🧾 E-Qaimə | two `.xlsx` files (gələn + göndərilən) | Parses detailed e-invoice exports → monthly trend, top suppliers/customers, item structure, risk flags → XLSX (6 sheets) |

---

## File Structure

```
index.html              ← Shell: header, tab buttons, tab panels, bootstrap script
core/
  styles.css            ← All shared CSS (variables, layout, tables, badges, buttons)
  ui.js                 ← switchTab(), fmt(), fmtRaw(), esc()  [TABS: shv, mv, edv, eqaime]
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
  eqaime/
    parser.js           ← XLSX rows → gelir/gonder data objects + risk flags
    renderer.js         ← Data → DOM HTML (monthly, suppliers, customers, items)
    exporter.js         ← Data → XLSX (6 sheets)
    index.js            ← Wires two drop zones (gelir + gonder) → parse → render
```

---

## Bootstrap Pattern (index.html) — CRITICAL

`switchTab` must be defined in a plain `<script>` **before** the `<script type="module">` block. ES modules execute deferred — if any import fails the entire module block is skipped, leaving `window.switchTab` undefined and all tab buttons broken.

```html
<!-- 1. Plain script — executes synchronously, always available on click -->
<script>
  function switchTab(tab) {
    ['shv','mv','edv','eqaime'].forEach(function(id) {
      var panel  = document.getElementById('tab-' + id);
      var button = document.getElementById('tab-btn-' + id);
      if (panel)  panel.style.display = id === tab ? 'block' : 'none';
      if (button) button.classList.toggle('active', id === tab);
    });
  }
  window.switchTab = switchTab;
</script>

<!-- 2. Module script — loads async, wires file I/O events -->
<script type="module">
  import { init as initShv    } from './modules/shv/index.js';
  import { init as initMv     } from './modules/mv/index.js';
  import { init as initEdv    } from './modules/edv/index.js';
  import { init as initEqaime } from './modules/eqaime/index.js';

  initShv();
  initMv();
  initEdv();
  initEqaime();
</script>
```

`core/ui.js` still exports `switchTab` for use inside modules. The bootstrap no longer imports it — the inline version handles all `onclick=` calls.

---

## How to Add a New Module

1. Create `modules/{name}/` with `parser.js`, `renderer.js`, `exporter.js`, `index.js`
2. Add tab button in `index.html`: `<button class="tab-btn" id="tab-btn-{name}" onclick="switchTab('{name}')">...</button>`
3. Add tab panel in `index.html`
4. Add `'{name}'` to the TABS array in the inline `<script>` in `index.html` AND in `core/ui.js`
5. Import and call `init` in `<script type="module">`

---

## Module Contracts

### parser.js
Exports `parse(input)` or named parse functions. Input: string (HTML/XML) or row array (SheetJS). Returns plain JS object.

### renderer.js
Exports `render(data)`. Hides drop section, shows results area, sets innerHTML, wires buttons after innerHTML — never before.

### exporter.js
Exports `download(data)`. Creates ExcelJS workbook, calls `saveWorkbook(wb, filename)`. ExcelJS available as global `window.ExcelJS`.

### index.js
Exports `init()`. Wires DOM events, calls parser → renderer. No DOM manipulation outside its own tab panel.

---

## SHV Module — Key Details

### Column Detection
```js
let amountIdx = headers.findIndex(h => h.includes('Miqdar') && h.includes('Manat'));
if (amountIdx === -1) amountIdx = 4;
```

### KYB / SYB Detection
```js
const isKyb  = opName.includes('KYB');
const isKybl = opName.includes('KYBL'); // → kyb_azalma
const isSyb  = opName.includes('SYB') && !isKyb;
```

### Declaration Count
Pattern: `/CARİ\(B\)|DƏQİQLƏŞMİŞ\(B\)|DƏQİQLƏŞDİRİLMİŞ\(B\)/`  
Excluded: `CARİ(ARAYIŞ)`, rows ending `/N`.  
VAHID MUZDLU: deduped by `date|declType` in `vahidDates` Set.

### extractTaxKey Priority
```
Ödəmə tapşırığı / Sərəncam → Diger
ƏDVQR YYYY/MM → ƏDV YYYY/MM → ÖMV YYYY N.Rüb → VAHID MUZDLU YYYY N.Rüb
ƏV - N.Rüb YYYY → HŞƏV - YYYY
HŞƏV YYYY → HŞƏV - YYYY
MV (not ÖMV) → MV - YYYY
Universal fallback → Diger
```

### Data Shape
```js
// AnalysisData:
{ companyName, voen, period, printDate, totalDebt,
  taxes, kybActive, kybCancelled, sybActive, sybCancelled, rawRows }

// TaxEntry:
{ key, hesablama, azalma,
  kyb_hesablama, kyb_azalma, kyb_net, kyb_status, has_kyb,
  syb_hesablama, syb_azalma, syb_net, syb_status, has_syb,
  total_hesablama, total_azalma, total_net, decl_count }
```

---

## MV Module — Key Details

**Golden Rule:** PDF is the single source of truth. Never place a code based on XML tag alone.

### Critical Corrections (do not revert)

| XML code | Correct beyCode | Reason |
|---|---|---|
| `1021` | `206` | Revenue item, not expense |
| `1034` | `212` | Revenue (interest income) |
| `1041` | `218` | ÜMUMİ GƏLİRLƏR |
| `3001` | `237` | Tax calculation section |
| `4017` | `1.5` | Pul vəsaitləri |
| `4022` | `1.10` | Digər aktivlər |
| `bagliHarc` codes | sat.221–236 | Expense details, not balance sheet |

---

## ƏDV Module — Key Details

- Multiple XML files, deduplicates by `(ay, yil)`
- 4 sections: Hissə 1 (301–305), Hissə 2 (308–317), Hissə 3 (Debitor borc), Hissə 4 (Hesablaşma)
- Encoding: UTF-8

---

## E-Qaimə Module — Key Details

### Input Format
Portal exports `.xlsx` with summary row `"CƏMİ (filtered)"` in row 1. Real headers in row 2. Fixed in `index.js` by shifting SheetJS range:
```js
const range = XLSX.utils.decode_range(ws['!ref']);
range.s.r = 1;
ws['!ref'] = XLSX.utils.encode_range(range);
```

### Actual Column Names (portal, 2025)
| Field | Column |
|---|---|
| Total | `Yekun məbləğ` |
| VAT | `ƏDV məbləği` |
| VAT 18% base | `o/t ƏDV-yə 18%` |
| VAT 0% base | `o/t ƏDV-yə 0%` |
| VAT exempt | `o/t ƏDV-dən azad` |
| Supplier | `Göndərən Adı` / `Göndərən VÖEN` |
| Customer | `Alıcı Adı` / `Alıcı VÖEN` |
| Item | `Malın (işin, xidmətin) adı` |
| Qty | `Miqdarı` |

Column detection uses `findKey()` with regex — resilient to portal changes.

### Date Parsing
`parseMonth(v)` in `parser.js` handles string `"2025-01-15 12:12"`, JS Date, and Excel serial number → returns `"YYYY-MM"`.

### UI — What Is Shown
- **2 chips:** gəlir (satış) · alış — no margin, no VAT chips
- **Risk flags:** concentration >30%/50%, pending invoices, negative margin (only when revenue > 0)
- **Aylıq dinamika:** Ay · Gəlir · Xərc · Qaimə sayı (satış/alış) with CƏMİ totals
- Top Təchizatçılar (20) · Top Alıcılar (20) · Mal/Xidmət + TNVED

### Data Shape
```js
// parseGelir():
{ total, edv, edv18, edv0, edvAzad, aksiz, yolV,
  invoices, passivCount, passivTotal, pendingCount,
  suppliers, monthly, items, kodGroups, statuses }

// parseGonder():
{ total, edv, invoices, passivCount, passivTotal,
  customers, monthly, items, statuses }
```

### XLSX Export — 6 Sheets
Xülasə · Aylıq Dinamika · Top Təchizatçılar · Top Alıcılar · Gələn Mal-Xidmət · Göndərilən Mal-Xidmət

### Dependencies
SheetJS `xlsx.full.min.js` in `index.html` `<head>` (reading). ExcelJS (already present, writing).

---

## Core Utilities

### core/ui.js
```js
switchTab(id), fmt(n), fmtRaw(n), esc(s)
```

### core/xlsx.js
```js
xFill(hex), xFont(hex, bold, sz), xBorderAll(), xBorderBottom(style, hex)
NUM_FMT, NUM_FMT_INT, saveWorkbook(wb, filename)
```

---

## Known Issues & Resolutions

| Issue | Resolution |
|---|---|
| **`switchTab is not defined`** — tab buttons don't work | Define `switchTab` in a plain `<script>` before `<script type="module">`. See Bootstrap Pattern above. Never rely on module assignment alone. |
| Extra `Miqdar (ABŞ$)` column in SHV exports | Dynamic `findIndex` for `Miqdar (Manat)` |
| `/N` rows counted as declarations | `isSlashRow = /\/\s*\d+\s*$/.test(opName)` — skipped |
| `ƏV` avans rows should group with HŞƏV | Key normalized to `HŞƏV - YYYY` |
| KYBL rows reduce KYB | Explicit `isKybl` check before `opType` |
| VAHID MUZDLU: 3 rows per quarter | `vahidDates` Set deduplicates by `date\|declType` |
| MV `bagliHarc` is not balance sheet | It holds expense details sat.221–236 |
| ES Modules don't work via `file://` | Use GitHub Pages or HTTP server |
| E-qaimə: row 1 is summary, not headers | Shift SheetJS range `range.s.r = 1` before parse |
| E-qaimə: column names vary | `findKey()` with regex in `buildGelirKeyMap` / `buildGonderKeyMap` |
| E-qaimə: Tarix type varies | `parseMonth()` handles string / Date / serial number |
| E-qaimə: margin risk fires with no data | Check `gonder.total > 0` before computing margin % |

---

## Typical Workflow with Claude

1. Paste this README at the start of the conversation
2. Upload current `index.html` + any relevant module files
3. Reference by file and function: "fix `extractTaxKey` in `modules/shv/parser.js`"
4. Claude makes a targeted change to the relevant file only
5. Download, upload to GitHub
