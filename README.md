# shv-analiz

Анализатор выписки личного налогового счёта (Şəxsi Hesab Vərəqəsi) + анализатор XML декларации по налогу на прибыль (Mənfəət Vergisi).

**Live (актуальная версия всегда здесь):** https://zaurww.github.io/shv-analiz/  
**Repo:** https://github.com/zaurww/shv-analiz (Public)  
**Stack:** Один HTML-файл (`index.html`), без бэкенда, без сборки. ExcelJS 4.3.0 через CDN.  
**Deploy:** Загрузи `index.html` на GitHub → commit → сразу в эфире через Pages.

> **⚠️ ВАЖНО ДЛЯ CLAUDE:** Актуальный код всегда на https://zaurww.github.io/shv-analiz/  
> Перед любыми изменениями **сначала fetch этот URL**, чтобы видеть последнюю версию.  
> Не опирайся на файлы из прошлых разговоров — они могут быть устаревшими.

> **Язык чата:** По умолчанию общаемся на **русском**. Интерфейс и комментарии в коде — на азербайджанском/английском.

---

## Что делает

Два независимых модуля в одном файле, переключаются вкладками в шапке:

### Вкладка 1 — 📋 Şəxsi Hesab (личный счёт)
Пользователь перетаскивает `.xls`-файл, скачанный с налогового портала (на самом деле HTML-таблица в кодировке ISO-8859-1) → приложение парсит в браузере → показывает таблицу анализа с KYB/SYB → экспортирует в XLSX.

### Вкладка 2 — 📄 MV Bəyannaməsi XML (декларация по налогу на прибыль)
Пользователь перетаскивает `.xml`-файл, скачанный с портала new.e-taxes.gov.az (кнопка "XML endir" в разделе Bəyannamələr) → приложение парсит → показывает все показатели с кодами → экспортирует в XLSX (3 листа).

---

## Структура файла

Весь код в `index.html` (~1780 строк), разбит на 10 секций:

| Секция | Модуль | Ответственность |
|---|---|---|
| 1 | Constants | `TAX_ORDER`, `DECL_PATTERN` |
| 2 | File I/O | Drag & drop, FileReader (`iso-8859-1`) — для XLS |
| 3 | `Parser` IIFE | Сырой HTML → объект `AnalysisData` |
| 4 | `Renderer` IIFE | `AnalysisData` → DOM (innerHTML) |
| 5 | `XlsxExport` IIFE | `AnalysisData` → ExcelJS workbook → скачивание |
| 6 | Format helpers | `fmt()`, `fmtRaw()`, `esc()` — чистые функции |
| 7 | UI helpers | `ui.showSpinner`, `ui.showError` |
| 8 | Bootstrap | `initDropZone()` |
| 9 | Tab switch | `switchTab('shv'/'xml')` — переключение вкладок |
| 10 | XML Module | `MV_LABELS`, `XmlParser`, `XmlRenderer`, `XmlExporter` |

Глобальное состояние:
- `window._analysisData` — XLS-анализ (Section 3), читается при XLSX-экспорте
- `window._xmlData` — XML-анализ (Section 10), читается при XLSX-экспорте

---

## XML модуль (Section 10) — MV Bəyannaməsi

### Формат входного файла

XML-файл скачивается с нового портала `new.e-taxes.gov.az` → Bəyannamələr → "..." → "XML endir".  
Тип декларации: `MENFEET_1` (Mənfəət Vergisi — налог на прибыль).  
Кодировка: UTF-8. Корневой тег: `<beyanname kodVer="MENFEET_1">`.

**⚠️ XSD недоступен:** XSD-файл (`MENFEET_1.xsd`) не отдаётся порталом публично.  
Маппинг кодов выполнен вручную сопоставлением XML-сумм с PDF-декларацией.

### Секции XML

| XML-секция | Тип данных | Поля |
|---|---|---|
| `vergiHesab` | Простые строки | `<gosterici>` + `<mebleg>` |
| `bagliHarc` | Простые строки | `<gosterici>` + `<mebleg>` |
| `hesabatDovruVergiHesab1` | Простые строки | `<gosterici>` + `<mebleg>` |
| `aktivler` | Таблица движения | `evveline / dahilOlunan / takdimEdilen / sonuna` |
| `kapitalEhtiyatlar` | Таблица движения | `evveline / dahilOlunan / takdimEdilen / silinen / sonuna` |

В `allData` ключи:
- Простые: `'1001'`, `'2001'` и т.д. → `{ mebleg }`
- Активлер: `'A_4017'`, `'A_4015'` и т.д. → `{ evvel, dahil, takdim, son }`
- Капитал: `'K_4023'`, `'K_6001'` и т.д. → `{ evvel, dahil, takdim, silen, son }`

### MV_LABELS — маппинг кодов

Каждый XML-код имеет два атрибута:
```js
MV_LABELS = {
  '1001': { beyCode: '200',   label: 'Malların/işlərin... gəlir (Cəmi)' },
  '1002': { beyCode: '200.1', label: 'Malların təqdim edilməsindən gəlir' },
  // ...
}
```

- **`beyCode`** — номер строки в PDF-декларации (`200`, `200.1`, `321`, `1`, `1.1` и т.д.)
- **`label`** — название показателя на азербайджанском

Вспомогательная функция: `mvInfo(kod)` — возвращает `{ beyCode, label }`, для неизвестных кодов возвращает `{ beyCode: '—', label: 'Göstərici X' }`.

### XLSX-экспорт XML (XmlExporter)

3 листа в одном файле:

| Лист | Цвет вкладки | Колонки |
|---|---|---|
| `MV Göstəriciləri` | Синий | Bəy.kodu \| XML kodu \| Göstərici adı \| Məbləğ |
| `Aktivlər (Əlavə 1)` | Зелёный | Bəy.kodu \| XML kodu \| Ad \| Dövrün əvvəlinə \| Daxil \| Təqdim \| Sonuna |
| `Kapital & Öhdəliklər` | Янтарный | Bəy.kodu \| XML kodu \| Ad \| Əvvəl \| Daxil \| Təqdim \| Silinib \| Sonuna |

Бəyannamə koды (beyCode) в XLSX выделены синим жирным — для удобной сверки с бумажной декларацией.

---

## XLS модуль (Sections 1–8) — Şəxsi Hesab

### Форма входного файла

Портал выгружает `.xls`, который на самом деле является HTML-файлом в кодировке `iso-8859-1`. Содержит несколько `<table>`:

- **Налоговая таблица** — идентифицируется по заголовкам `Yazılış tarixi` + `Əməliyyat adı` + `Miqdar (Manat)`
- **Сводная таблица** — последний `<table>` в документе, пары ключ-значение (период, дата печати, долг и т.д.)

**Разные форматы столбцов:**
```js
// Динамический поиск — не хардкодить индекс!
let amountIdx = headers.findIndex(h => h.includes('Miqdar') && h.includes('Manat'));
if (amountIdx === -1) amountIdx = 4; // fallback
```

`opType` принимает значения: `Hesablama` | `Azalma` | `Ödəniş` (игнорируется)

### AnalysisData shape

```js
{
  companyName, voen, period, printDate, totalDebt,
  taxes,          // TaxEntry[], отсортированы по TAX_ORDER → год → период
  kybActive, kybCancelled,   // фильтры по kyb_status
  sybActive, sybCancelled,   // фильтры по syb_status
  rawRows,        // все сырые строки (для Sheet 2 XLSX)
}
```

### TaxEntry поля

```js
{
  key,              // "ƏDV 2025/03", "MV - 2024", "HŞƏV - 2024"
  hesablama, azalma,
  kyb_hesablama, kyb_azalma, kyb_net, kyb_status,  // 'none'|'active'|'cancelled'
  syb_hesablama, syb_azalma, syb_net, syb_status,
  total_hesablama, total_azalma, total_net,
  decl_count,       // реально поданные декларации (без /N строк, без CARİ(ARAYIŞ))
  vahidDates,       // Set — только для VAHID MUZDLU, дедупликация по date|declType
}
```

### extractTaxKey — приоритеты

| # | Входной паттерн | Выходной ключ |
|---|---|---|
| 1 | `Ödəmə tapşırığı` / `Sərəncam` | `'Diger'` (пропуск) |
| 2 | `ƏDVQR YYYY/MM` | `'ƏDVQR 2024/09'` |
| 3 | `ƏDV YYYY/MM` | `'ƏDV 2025/03'` |
| 4 | `ÖMV YYYY N. Rüb` | `'ÖMV 2025 3. Rüb'` |
| 5 | `VAHID MUZDLU YYYY N. Rüb` | `'VAHID MUZDLU 2025 4. Rüb'` |
| 6 | `ƏV - N.Rüb YYYY` | `'HŞƏV - YYYY'` |
| 7 | `HŞƏV YYYY` | `'HŞƏV - YYYY'` |
| 8 | `MV...` (не ÖMV) | `'MV - YYYY'` |
| 9 | Универсальный fallback | по году/месяцу/кварталу |
| 10 | Всё остальное | `'Diger'` (пропуск) |

### KYB / SYB логика

```js
const isKyb  = opName.includes('KYB');
const isKybl = opName.includes('KYBL');          // ləğv → kyb_azalma
const isSyb  = opName.includes('SYB') && !isKyb; // SYB только без KYB
```

### decl_count — подсчёт деклараций

Паттерн: `/CARİ\(B\)|DƏQİQLƏŞMİŞ\(B\)|DƏQİQLƏŞDİRİLMİŞ\(B\)/`

Исключения:
- `CARİ(ARAYIŞ)` — не декларация
- `/N`-строки (`DƏQİQLƏŞMİŞ(B) / 1` и т.д.) — автогенерация системы, не считаются
- `VAHID MUZDLU` — дедупликация через `vahidDates` Set (3 строки = 1 декларация)

### Таблица UI — 14 столбцов

```
Vergi/Dövr | Bəyannamə | Bəy[Hes|Az|Net] | KYB[Hes|Az|Net|Status] | SYB[Hes|Az|Net|Status] | Cəmi Qalıq
```

### XLSX-экспорт XLS (XlsxExport) — 2 листа

- **Sheet 1 Analiz:** 14 колонок, цветовые группы (синий/янтарный/фиолетовый), KYB-строки с жёлтым фоном
- **Sheet 2 Orijinal Statement:** все rawRows, дата → Excel Date, сумма → числовой формат

---

## Решённые проблемы

| Проблема | Решение |
|---|---|
| Файлы с `Miqdar (ABŞ$)` (9 столбцов) | Динамический `findIndex` |
| `/N`-строки считались как декларации | `isSlashRow = /\/\s*\d+\s*$/.test(opName)` |
| `ƏV` авансы HŞƏV объединяются | Ключ `HŞƏV - YYYY` |
| KYBL всегда в kyb_azalma | Явная проверка до ветки opType |
| VAHID MUZDLU: 3 строки = 1 декл. | `vahidDates` Set |
| XSD портала недоступен | Маппинг MV_LABELS по совпадению сумм XML↔PDF |
| beyCode для Əlavə 1 неточны | Помечены `*` или `a/b` суффиксами, требуют проверки по реальному XSD |

---

## CSS переменные

```css
--bg / --bg2 / --bg3        /* тёмные фоны */
--border                    /* #2a3347 */
--accent / --accent2        /* синий */
--green / --red / --yellow / --purple   /* статусные цвета */
--mono / --sans             /* IBM Plex Mono / IBM Plex Sans */
```

---

## Как работать с Claude

### ⚠️ Обязательный первый шаг

```
Перед любой работой с кодом:
1. Сделай web_fetch https://zaurww.github.io/shv-analiz/
2. Работай с этой версией — она актуальная
3. Не используй файлы из прошлых разговоров
```

### Воркфлоу изменений

```
1. Claude делает fetch https://zaurww.github.io/shv-analiz/
2. Описываешь проблему / желаемое поведение
3. Claude делает точечный str_replace в нужной секции
4. Файл → /mnt/user-data/outputs/index.html → скачиваешь → заливаешь на GitHub
```

### Ссылки на секции

- "Section 3 парсер" — логика KYB/SYB, extractTaxKey, decl_count
- "Section 5 XLSX" — экспорт XLS-анализа
- "Section 10 XML" — MV_LABELS, XmlParser, XmlRenderer, XmlExporter
- "Tab CSS" — `.tab-btn` стили в `<style>`
