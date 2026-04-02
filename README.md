# shv-analiz

Personal tax account statement analyzer for Azerbaijan Tax Portal.

**Live:** https://zaurww.github.io/shv-analiz/  
**Repo:** https://github.com/zaurww/shv-analiz (Public)  
**Stack:** Single HTML file, no backend, no build step. ExcelJS 4.3.0 via CDN.  
**Deploy:** Upload `index.html` to GitHub → commit → live instantly via Pages.

---

## What it does

User drops a `.xls` file downloaded from the Azerbaijan tax portal (actually an ISO-8859-1 encoded HTML table) → app parses it in the browser → renders an analysis table → exports to XLSX.

---

## File structure

Everything is in `index.html`, organized in 8 labeled sections:

| Section | Module | Responsibility |
|---|---|---|
| 1 | Constants | `TAX_ORDER`, `DECL_PATTERN` |
| 2 | File I/O | Drag & drop, FileReader (`iso-8859-1`) |
| 3 | `Parser` IIFE | Raw HTML → `AnalysisData` object |
| 4 | `Renderer` IIFE | `AnalysisData` → DOM (innerHTML) |
| 5 | `XlsxExport` IIFE | `AnalysisData` → ExcelJS workbook → download |
| 6 | Format helpers | `fmt()`, `fmtRaw()`, `esc()` — pure functions |
| 7 | UI helpers | `ui.showSpinner`, `ui.showError` |
| 8 | Bootstrap | `initDropZone()` |

Global state: `window._analysisData` — set after parse, read by XLSX export.

---

## AnalysisData shape

```js
{
  companyName, voen, period, printDate, totalDebt,
  taxes,          // TaxEntry[], sorted by TAX_ORDER then year/period
  kybActive,      // taxes where kyb_status === 'active'
  kybCancelled,   // taxes where kyb_status === 'cancelled'
  sybActive,      // taxes where syb_status === 'active'
  sybCancelled,   // taxes where syb_status === 'cancelled'
  rawRows,        // all raw rows from the tax table (for Sheet 2)
}
```

### TaxEntry fields

```js
{
  key,              // canonical period key, e.g. "ƏDV 2025/03", "HŞƏV - 2024"
  hesablama,        // client-side charges
  azalma,           // client-side reductions
  kyb_hesablama, kyb_azalma, kyb_net,   // kameral audit amounts
  kyb_status,       // 'none' | 'active' | 'cancelled'
  has_kyb, has_kybl,
  syb_hesablama, syb_azalma, syb_net,   // səyyar audit amounts
  syb_status,       // 'none' | 'active' | 'cancelled'
  has_syb,
  total_hesablama,  // hesablama + kyb_hesablama + syb_hesablama
  total_azalma,     // azalma + kyb_azalma + syb_azalma
  total_net,        // total_hesablama - total_azalma
  decl_count,       // unique filed declarations (see counting rules below)
  client_net,       // hesablama - azalma (client only, without audits)
}
```

---

## Parser logic (Section 3)

### Input file format
Portal XLS = HTML table, `iso-8859-1` encoding. Contains multiple `<table>` elements:
- Tax table: identified by headers `Yazılış tarixi` + `Əməliyyat adı` + `Miqdar (Manat)`
- Summary table: last `<table>` in document, key-value pairs

### Row columns (0-indexed)
`[0] date | [1] opName | [2] opType | [3] col3 | [4] amount`

`opType` values: `Hesablama` (charge) | `Azalma` (reduction) | `Ödəniş` (payment, ignored)

### KYB vs SYB detection
```js
const isKyb  = opName.includes('KYB');
const isKybl = opName.includes('KYBL');       // ləğv — always → kyb_azalma
const isSyb  = opName.includes('SYB') && !isKyb;  // SYB only if KYB absent
```

### extractTaxKey — priority order
1. `Ödəmə tapşırığı` / `Sərəncam` → `'Diger'` (skipped)
2. `ƏDVQR YYYY/MM` → `'ƏDVQR 2024/09'`
3. `ƏDV YYYY/MM` → `'ƏDV 2025/03'`
4. `ÖMV YYYY N. Rüb` → `'ÖMV 2025 3. Rüb'`
5. `VAHID MUZDLU YYYY N. Rüb` → `'VAHID MUZDLU 2025 4. Rüb'`
6. `ƏV - N.Rüb YYYY` → `'HŞƏV - YYYY'` (quarterly avans, merged into HŞƏV)
7. `HŞƏV YYYY` → `'HŞƏV - YYYY'`
8. `MV...` (not ÖMV) → `'MV - YYYY'`
9. Universal fallback: `TAX YYYY/MM` | `TAX YYYY N. Rüb` | `TAX YYYY`
10. → `'Diger'` (skipped)

### Declaration counting rules
Pattern: `/CARİ\(B\)|DƏQİQLƏŞMİŞ\(B\)|DƏQİQLƏŞDİRİLMİŞ\(B\)/`  
`CARİ(ARAYIŞ)` is intentionally excluded.  
`opType === 'Ödəniş'` rows are excluded.

**VAHID MUZDLU special case:** portal emits 3 rows per quarterly declaration (one per month). Deduplicated by `vahidDates.add(date|declType)` — Set stores unique `(date, declType)` pairs, so each quarter counts as 1.

### Sort order
```js
TAX_ORDER = ['MV', 'ƏDVQR', 'ƏDV', 'ÖMV', 'HŞƏV', 'VAHID MUZDLU']
// Secondary: year ASC, then month/quarter ASC
// Unknown tax types → end, sorted alphabetically
```

---

## UI (Section 4)

### Main table — 13 columns
`Tax/Period | Decl | Müş-Hes | KYB-Hes | SYB-Hes | Cəmi-Hes | Müş-Az | KYB-Az | SYB-Az | Cəmi-Az | Net | KYB-status | SYB-status`

### Alert blocks
- Yellow `⚠️` — active KYB (kyb_net > 0)
- Purple `🔍` — active SYB (syb_net > 0)

### Summary chips (6 total)
Cəmi borc | KYB sayı | KYB məbləği | SYB sayı | SYB məbləği | Vergi növləri

---

## XLSX Export (Section 5)

Two sheets in one file. **Order matters:** add sheets before `wb.xlsx.writeBuffer()`.

### Sheet 1: Analiz
- Rows 1-2: company header
- Row 3: KYB alert (if active)
- Row 4: SYB alert (if active)
- Row 5: spacer
- Rows 6-7: double header (group + sub)
- Data rows: active KYB rows → red bg; active SYB rows → purple bg
- Summary block after data: totals for debt, KYB, SYB

### Sheet 2: Orijinal
- All `rawRows` from parser
- Date column → Excel Date type (`DD.MM.YYYY`)
- Amount column → numeric with `NUM_FMT`
- Auto-width for opName column (capped at 55)

---

## Known edge cases / solved issues

| Issue | Solution |
|---|---|
| ƏV quarterly avans of HŞƏV | Merged into `HŞƏV - YYYY` key |
| KYBL (ləğv) always reduces kyb, regardless of opType | Explicit check before opType branch |
| VAHID MUZDLU 3x row per declaration | `vahidDates` Set with `date\|declType` key |
| Portal sometimes outputs frameset format | User must use "Saxla" to get standard HTML |
| Amount format `8.415,00` (AZ/DE locale) | `s.replace(/\./g,'').replace(',','.')` |
| XSS in company name | `esc()` wraps all user-data inserted via innerHTML |

---

## CSS variables (quick ref)

```css
--bg / --bg2 / --bg3   /* dark backgrounds, light to dark */
--border               /* #2a3347 */
--accent / --accent2   /* blue */
--green / --red / --yellow / --purple  /* status colors */
--green-bg / --red-bg / --yellow-bg / --purple-bg  /* tinted backgrounds */
--mono / --sans        /* IBM Plex Mono / IBM Plex Sans */
```

---

## How to continue work in chat

1. Paste this README at the start of the conversation
2. Reference section numbers: "Section 3 parser", "Section 5 Sheet 2", etc.
3. The project instruction doc (separate) has the full Azerbaijani-language spec
4. Current file is ~1170 lines — ask Claude to edit specific sections, not rewrite the whole file
