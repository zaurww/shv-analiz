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

## File Structure (~1800 lines, 10 sections)

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
| Əlavə 1 aktivlər | Asset movement table | see Aktivlər map below |
| Əlavə 1 kapital | Capital/liabilities table | see Kapital map below |

### Key Insight: bagliHarc ≠ Balance Sheet
`bagliHarc` XML tag holds **expense details (sat.221–236)**, not balance sheet items.  
Codes `2001–2073` ALL belong to the Xərclər section.

---

## Aktivlər (Əlavə 1) — Full Map (verified vs PDF screenshots)

| XML code | beyCode | Label |
|---|---|---|
| `4001` | `1` | Cəmi aktivlər |
| `4002` | `1.1` | Əsas vəsaitlərin dəyəri |
| `4003` | `1.1.1` | Torpaqların yaxşılaşdırılması üzrə kapitallaşdırılmış xərclər, binalar, tikililər və qurğular |
| `4007` | `1.1.5` | Digər əsas vəsaitlər |
| `4045` | `1.1.6` | Yüksək texnologiyalar məhsulu olan hesablama texnikası |
| `4008` | `1.2` | Qeyri-maddi aktivlərin dəyəri |
| `4050` | `1.2.1` | İstifadə müddəti məlum olmayan qeyri-maddi aktivlərin dəyəri |
| `4040` | `1.3` | Ehtiyatlar |
| `4041` | `1.3.1` | Hazır məhsul |
| `4005` | `1.3.2` | Mallar |
| `4042` | `1.3.3` | Bitməmiş istehsalat |
| `4043` | `1.3.4` | Sair ehtiyatlar |
| `4014` | `1.4` | Debitor borcları |
| `4015` | `1.4.1` | Dövlət büdcəsinə (vergilər üzrə) debitor borcu |
| `4016` | `1.4.2` | Sair debitor borcları |
| `4017` | `1.5` | Pul vəsaitləri |
| `4022` | `1.10` | Digər aktivlər |
| Others | `—` | Not yet mapped (all zero in this sample) |

**Previously wrong (do not revert):**
- `4017` was `1` (Cəmi aktivlər) → correct is `1.5` (Pul vəsaitləri)
- `4022` was `2` (Kapital) → correct is `1.10` (Digər aktivlər)
- `4047,4048,4051,4053,4054` etc — had wrong beyCode, now `—` until confirmed

---

## Kapital & Öhdəliklər (Əlavə 1) — Full Map (verified vs PDF screenshots)

| XML code | beyCode | Label |
|---|---|---|
| `4023` | `2` | Cəmi kapital və öhdəliklər |
| `5001` | `2.1` | Cəmi kapital |
| `4024` | `2.1.1` | Nizamnamə kapitalı |
| `4025` | `2.1.2` | Hesabat dövrünün xalis mənfəəti |
| `4026` | `2.1.3` | Əvvəlki illər üzrə bölüşdürülməmiş mənfəət |
| `7001` | `2.1.4` | Emissiya gəliri |
| `7002` | `2.1.5` | Kapital ehtiyatları |
| `6001` | `2.2` | Cəmi öhdəliklər |
| `4027` | `2.2.1` | Kreditor borcları |
| `4028` | `2.2.1.1` | Bank kreditləri |
| `4029` | `2.2.1.1.1` | O cümlədən xarici borclar |
| `4031` | `2.2.1.2` | Alınmış avanslar |
| `4052` | `2.2.1.5` | Sair kreditor borcları |
| `4032` | `2.2.1.5.1` | O cümlədən xarici borclar (sair) |
| `4034` | `2.2.3` | Digər öhdəliklər |
| Others | `—` | Not yet mapped |

---

## Critical Corrections — DO NOT REVERT (all verified vs PDF)

| XML code | Wrong old beyCode | Correct beyCode | Note |
|---|---|---|---|
| `1021` | `300` | `206` | Revenue, not expense |
| `1034` | `310` | `212` | Revenue (interest income) |
| `1006` | `315` | `212.2` | Revenue (other interest) |
| `1041` | `320` | `218` | ÜMUMİ GƏLİRLƏR |
| `1042` | `321` | `219` | Deductions from revenue |
| `1045` | `323` | `219.3` | FX rate difference |
| `1056` | `330` | `220` | Net revenue after deductions |
| `3001` | `39` | `237` | Tax calculation |
| `3004` | `240` | `241` | PDF sat.240=0, sat.241=43488.43 |
| `2001–2073` | balance sheet | `221–236` | bagliHarc = expenses, not balance |
| `4017` | `1` Cəmi aktivlər | `1.5` Pul vəsaitləri | Aktivlər map fixed |
| `4022` | `2` Kapital | `1.10` Digər aktivlər | Aktivlər map fixed |

### Duplicate beyCode Issue
Some XML codes share the same PDF beyCode. Resolution: secondary one gets suffix `b`/`*` and excluded from sections array.  
Excluded from sections (duplicates, all zero): `2062`, `1031`, `1102`, `1106`.

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
| `3004` mapped to sat.240 | Fixed: sat.240=0, `3004`→sat.241 |
| Duplicate beyCode (231, 230, 222) | Secondary codes get `b`/`*` suffix, excluded from sections |
| Aktivlər codes all had wrong beyCode | Fixed 2025-04-09: `4001–4050` remapped vs PDF screenshots |
| Many aktivlər codes show `—` | Not yet confirmed vs PDF — zero in current sample, update when non-zero appears |
