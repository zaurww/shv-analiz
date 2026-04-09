# shv-analiz

Tax analysis tool for Azerbaijan — personal tax account statement analyzer + profit tax declaration XML analyzer.

**Live (always the latest version):** https://zaurww.github.io/shv-analiz/  
**Repo:** https://github.com/zaurww/shv-analiz (Public)  
**Stack:** Single HTML file (`index.html`), no backend, no build step. ExcelJS 4.3.0 via CDN.  
**Deploy:** Upload `index.html` to GitHub → commit → instantly live via Pages.

> **⚠️ IMPORTANT FOR CLAUDE:** Authoritative source is always https://zaurww.github.io/shv-analiz/  
> Before any changes: `web_fetch` that URL first. If user uploaded `index.html` — use that file (it's newer).  
> Never rely on files from previous conversations.

> **Chat language:** Russian by default. UI and code comments in Azerbaijani/English.

---

## Two Modules

### Tab 1 — Şəxsi Hesab (XLS)
`.xls` from tax portal (ISO-8859-1 HTML) → parse → analysis table with KYB/SYB → XLSX (2 sheets).

### Tab 2 — MV Bəyannaməsi XML
`.xml` from `new.e-taxes.gov.az` ("XML endir") → parse → all indicators with PDF line codes → XLSX (3 sheets).

---

## File Structure (~1795 lines, 10 sections)

| Section | Module |
|---|---|
| 1 | Constants: `TAX_ORDER`, `DECL_PATTERN` |
| 2 | File I/O: drag & drop, FileReader iso-8859-1 |
| 3 | `Parser` IIFE: raw HTML → AnalysisData |
| 4 | `Renderer` IIFE: AnalysisData → DOM |
| 5 | `XlsxExport` IIFE: AnalysisData → XLSX |
| 6 | Format helpers: `fmt()`, `fmtRaw()`, `esc()` |
| 7 | UI helpers: `ui.showSpinner`, `ui.showError` |
| 8 | Bootstrap: `initDropZone()` |
| 9 | Tab switch: `switchTab('shv'/'xml')` |
| 10 | XML Module: `MV_LABELS`, `XmlParser`, `XmlRenderer`, `XmlExporter` |

---

## XML Module — MV_LABELS Code Mapping

### THE GOLDEN RULE
**The PDF declaration is the single source of truth.**  
If a line appears in Gəlirlər in the PDF → it goes in the Gəlirlər section in code.  
Never place a code based on its XML tag. Always follow the PDF.

### How to Map a New Code
```
1. Find XML <gosterici> code and its <mebleg> value
2. Find the same amount in the PDF declaration
3. Note PDF line number → beyCode
4. Note PDF section → determines which section array
5. Add to MV_LABELS AND correct section in both:
   - const sections = [...] in XmlRenderer.render()
   - const simpleSecs = [...] in XmlExporter.download()
```

### PDF Structure → Section Arrays (verified 2025-04-09)

| PDF lines | Section title | XML codes |
|---|---|---|
| 200–220 | Gəlirlər (sat.200–220) | `1001,1002,1012,1013,1016,1021,1034,1006,1041,1042,1045,1056` |
| 221–236 | Xərclər (sat.221–236) | `2001,2002,2003,2004,2005,2007,2008,1200,2009,2011,2012,2014,2016,2018,2019,2020,2021,2022,2023,2027,2031,2033,2034,2039,2140,2040,2043,2049,2050,2052,2053,2057,2063,2064,2066,2071,2073` |
| 237+ | Verginin hesablanması (sat.237+) | `3001,3002,3003,3004,1022,1023,1076` |
| Əlavə 1 | Aktivlər | `A_4017, A_4047, A_4048 ...` |
| Əlavə 1 | Kapital/Öhdəliklər | `K_4023, K_5001, K_4024 ...` |

### Key Insight: bagliHarc ≠ Balance Sheet
`bagliHarc` XML tag holds **expense details (sat.221–236)**, not balance sheet items.  
Codes `2001–2073` ALL belong to the Xərclər section.

### Critical Corrections — DO NOT REVERT (verified 2025-04-09 vs PDF)

| XML code | Wrong old beyCode | Correct beyCode | Note |
|---|---|---|---|
| `1021` | `300` | `206` | Revenue, not expense |
| `1034` | `310` | `212` | Revenue (interest income) |
| `1006` | `315` | `212.2` | Revenue (other interest) |
| `1041` | `320` | `218` ÜMUMİ GƏLİRLƏR | Revenue total |
| `1042` | `321` | `219` | Deductions from revenue |
| `1045` | `323` | `219.3` | FX rate difference |
| `1056` | `330` | `220` | Net revenue after deductions |
| `3001` | `39` | `237` | Tax calculation |
| `3004` | `240` | `241` | PDF sat.240=0, sat.241=43488.43 |
| `2001–2073` | balance sheet | `221–236` expenses | bagliHarc = expenses |

### Duplicate beyCode Issue
Some XML codes share the same PDF beyCode (e.g. `2043` and `2062` both = `231`).  
Resolution: the secondary one gets suffix `b` (e.g. `231b`) and is excluded from sections array.  
Excluded from sections (all zero, duplicates): `2062`, `1031`, `1102`, `1106`.

### Summary Chips → XML codes

| Chip | XML code | PDF line |
|---|---|---|
| Ümumi gəlir | `1041` | sat.218 ÜMUMİ GƏLİRLƏR |
| Cəmi xərclər | `2071` | sat.234 CƏMİ XƏRCLƏR |
| Vergitutma mənfəəti | `3001` | sat.237 |
| Büdcəyə ödənilməli | `budce` (root XML field) | sat.243 |
| Ümidsiz borc | `umidsizBorc` (root XML field) | Əlavə 3 |

### KEY_CODES (highlighted in XLSX)
`1041` (218), `1056` (220), `2071` (234), `3001` (237), `3004` (241)

---

## XLS Module Key Details

### Column Detection (always dynamic)
```js
let amountIdx = headers.findIndex(h => h.includes('Miqdar') && h.includes('Manat'));
if (amountIdx === -1) amountIdx = 4;
```

### KYB / SYB
```js
const isKyb  = opName.includes('KYB');
const isKybl = opName.includes('KYBL');  // → kyb_azalma
const isSyb  = opName.includes('SYB') && !isKyb;
```

### decl_count
Pattern: `/CARİ\(B\)|DƏQİQLƏŞMİŞ\(B\)|DƏQİQLƏŞDİRİLMİŞ\(B\)/`  
Excluded: `CARİ(ARAYIŞ)`, `/N` rows, VAHID MUZDLU deduped via `vahidDates` Set.

### extractTaxKey Priority
`Ödəmə tapşırığı/Sərəncam`→Diger | `ƏDVQR YYYY/MM` | `ƏDV YYYY/MM` | `ÖMV YYYY N.Rüb` | `VAHID MUZDLU YYYY N.Rüb` | `ƏV - N.Rüb YYYY`→HŞƏV | `HŞƏV YYYY` | `MV` (not ÖMV) | fallback | Diger

---

## Quick Section Reference

| What to change | Location |
|---|---|
| XML code labels | `const MV_LABELS = {...}` in Section 10 |
| XML display sections | `const sections = [...]` in `XmlRenderer.render()` |
| XML XLSX sections | `const simpleSecs = [...]` in `XmlExporter.download()` |
| KYB/SYB/parsing | Section 3 — Parser |
| XLS XLSX export | Section 5 — XlsxExport |
| Tab styles | `.tab-btn` in `<style>` |

---

## Known Issues & Resolutions

| Issue | Resolution |
|---|---|
| Extra `Miqdar (ABŞ$)` column | Dynamic `findIndex` |
| `/N` rows counted as declarations | `isSlashRow = /\/\s*\d+\s*$/.test(opName)` |
| `ƏV` avans → HŞƏV | Key `HŞƏV - YYYY` |
| KYBL → kyb_azalma | Explicit check before opType |
| VAHID MUZDLU 3 rows = 1 decl | `vahidDates` Set |
| `bagliHarc` = balance sheet | Wrong — it's expenses sat.221–236 |
| `1034`, `1021` in wrong section | Fixed: revenue items sat.212, sat.206 |
| `3004` mapped to sat.240 | Fixed: sat.240=0, sat.241=43488.43, `3004`→`241` |
| Duplicate beyCode (231, 230, 222) | Secondary codes get `b` suffix, excluded from sections |
