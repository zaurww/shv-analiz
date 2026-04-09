# shv-analiz

Tax analysis tool for Azerbaijan — personal tax account statement analyzer + profit tax declaration XML analyzer.

**Live (always the latest version):** https://zaurww.github.io/shv-analiz/  
**Repo:** https://github.com/zaurww/shv-analiz (Public)  
**Stack:** Single HTML file (`index.html`), no backend, no build step. ExcelJS 4.3.0 via CDN.  
**Deploy:** Upload `index.html` to GitHub → commit → instantly live via Pages.

> **⚠️ IMPORTANT FOR CLAUDE:** Authoritative source is always https://zaurww.github.io/shv-analiz/  
> Before any changes: `web_fetch` that URL first. If user uploaded `index.html` in conversation — that file takes priority.  
> Never rely on files from previous conversations.

> **Chat language:** Russian by default. UI and code comments in Azerbaijani/English.

---

## Two Modules

### Tab 1 — Şəxsi Hesab (XLS)
`.xls` file from tax portal (ISO-8859-1 HTML table) → parse → analysis table with KYB/SYB → XLSX export.

### Tab 2 — MV Bəyannaməsi XML
`.xml` from `new.e-taxes.gov.az` ("XML endir") → parse → all indicators with PDF line codes → XLSX (3 sheets).

---

## File Structure (~1790 lines, 10 sections)

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
The section a line appears in within the PDF determines which `codes:[]` array it belongs to — regardless of which XML tag it came from.

> Never place a code based on its XML section tag. Always follow the PDF.

### How to Map a New Code

```
1. Find XML <gosterici> code and its <mebleg> value
2. Find the same amount in the PDF declaration
3. Note the PDF line number → beyCode
4. Note the PDF section → determines which section array
5. Add to MV_LABELS AND the correct section in both:
   - const sections = [...] in XmlRenderer.render()
   - const simpleSecs = [...] in XmlExporter.download()
```

### PDF Structure → Code Sections

| PDF lines | Section | Verified XML codes |
|---|---|---|
| 200–220 | **Gəlirlər** | `1001,1002,1012,1013,1016,1021,1034,1006,1041,1042,1045,1056` |
| 221–236 | **Xərclər** (all bagliHarc codes) | `2001,2002,2003,2004,2005,2007,2008,1200,2009,2011,2012,2014,2016,2018,2019,2020,2021,2022,2023,2027,2031,2033,2034,2039,2140,2040,2043,2049,2050,2052,2053,2057,2062,2063,2064,2066,2071,2073` |
| 237+ | **Verginin hesablanması** | `3001,3002,3003,3004,1022,1023,1102,1106,1031,1076` |
| Əlavə 1 | Asset movement | `A_4017, A_4047, A_4048 ...` |
| Əlavə 1 | Capital/liabilities | `K_4023, K_5001, K_4024 ...` |

### Critical Corrections — DO NOT REVERT (verified 2025-04-09)

| XML code | Wrong old beyCode | Correct beyCode | PDF section |
|---|---|---|---|
| `1021` | `300` | `206` | Gəlirlər |
| `1034` | `310` | `212` | Gəlirlər |
| `1006` | `315` | `212.2` | Gəlirlər |
| `1041` | `320` | `218` ÜMUMİ GƏLİRLƏR | Gəlirlər |
| `1042` | `321` | `219` çıxılamalar | Gəlirlər |
| `1045` | `323` | `219.3` | Gəlirlər |
| `1056` | `330` | `220` | Gəlirlər |
| `3001` | `39` | `237` | Verginin hesablanması |
| `2001–2073` | balance sheet | `221–236` expenses | Xərclər |

### Key Insight: bagliHarc ≠ Balance Sheet
`bagliHarc` codes `2001–2073` are **expense details (sat.221–236)**, not balance sheet items.

### Summary Chips → XML codes

| Chip | XML code | PDF line |
|---|---|---|
| Ümumi gəlir | `1041` | sat.218 |
| Cəmi xərclər | `2071` | sat.234 |
| Vergitutma mənfəəti | `3001` | sat.237 |
| Büdcəyə | `budce` (root field) | sat.243 |
| Ümidsiz borc | `umidsizBorc` (root field) | Əlavə 3 |

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
Excluded: `CARİ(ARAYIŞ)`, `/N` rows (system auto-gen), VAHID MUZDLU deduped via `vahidDates` Set.

### extractTaxKey Priority
`Ödəmə tapşırığı/Sərəncam` → Diger | `ƏDVQR YYYY/MM` | `ƏDV YYYY/MM` | `ÖMV YYYY N.Rüb` | `VAHID MUZDLU YYYY N.Rüb` | `ƏV - N.Rüb YYYY` → HŞƏV | `HŞƏV YYYY` | `MV` (not ÖMV) | fallback | Diger

---

## Quick Section Reference

| What to change | Location in file |
|---|---|
| XML code labels | `const MV_LABELS = {...}` in Section 10 |
| XML display sections | `const sections = [...]` in `XmlRenderer.render()` |
| XML XLSX sections | `const simpleSecs = [...]` in `XmlExporter.download()` |
| KYB/SYB/parsing logic | Section 3 — Parser |
| XLS XLSX export | Section 5 — XlsxExport |
| Tab styles | `.tab-btn` in `<style>` |

---

## Known Issues & Resolutions

| Issue | Resolution |
|---|---|
| Extra `Miqdar (ABŞ$)` column | Dynamic `findIndex` |
| `/N` rows counted as declarations | `isSlashRow = /\/\s*\d+\s*$/.test(opName)` |
| `ƏV` advances must merge into HŞƏV | Key `HŞƏV - YYYY` |
| KYBL always → kyb_azalma | Explicit check before opType |
| VAHID MUZDLU 3 rows = 1 decl | `vahidDates` Set |
| `bagliHarc` confused with balance sheet | It's expenses (sat.221–236) |
| `1034`, `1021` in wrong section | Fixed: both are revenue items |
