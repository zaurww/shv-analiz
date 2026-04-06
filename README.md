# shv-analiz

Анализатор выписки личного налогового счёта (Şəxsi Hesab Vərəqəsi) с портала налоговой службы Азербайджана.

**Live:** https://zaurww.github.io/shv-analiz/  
**Repo:** https://github.com/zaurww/shv-analiz (Public)  
**Stack:** Один HTML-файл, без бэкенда, без сборки. ExcelJS 4.3.0 через CDN.  
**Deploy:** Загрузи `index.html` в GitHub → commit → сразу в эфире через Pages.

> **Язык чата:** По умолчанию общаемся на **русском**. Интерфейс и комментарии в коде — на азербайджанском/английском.

---

## Что делает

Пользователь перетаскивает `.xls`-файл, скачанный с налогового портала (на самом деле это HTML-таблица в кодировке ISO-8859-1) → приложение парсит его в браузере → отображает таблицу анализа → экспортирует в XLSX.

---

## Структура файла

Весь код в `index.html` (~1185 строк), разбит на 8 секций:

| Секция | Модуль | Ответственность |
|---|---|---|
| 1 | Constants | `TAX_ORDER`, `DECL_PATTERN` |
| 2 | File I/O | Drag & drop, FileReader (`iso-8859-1`) |
| 3 | `Parser` IIFE | Сырой HTML → объект `AnalysisData` |
| 4 | `Renderer` IIFE | `AnalysisData` → DOM (innerHTML) |
| 5 | `XlsxExport` IIFE | `AnalysisData` → ExcelJS workbook → скачивание |
| 6 | Format helpers | `fmt()`, `fmtRaw()`, `esc()` — чистые функции |
| 7 | UI helpers | `ui.showSpinner`, `ui.showError` |
| 8 | Bootstrap | `initDropZone()` |

Глобальное состояние: `window._analysisData` — устанавливается после парсинга, читается при XLSX-экспорте.

---

## Форма входного файла

Портал выгружает `.xls`, который на самом деле является HTML-файлом в кодировке `iso-8859-1`. Содержит несколько `<table>`:

- **Налоговая таблица** — идентифицируется по заголовкам `Yazılış tarixi` + `Əməliyyat adı` + `Miqdar (Manat)`
- **Сводная таблица** — последний `<table>` в документе, пары ключ-значение (период, дата печати, долг и т.д.)

### Важно: разные форматы файлов с портала

Некоторые компании имеют файлы с дополнительным столбцом `Miqdar (ABŞ$)` перед `Miqdar (Manat)`. Поэтому индекс столбца суммы определяется **динамически** через `findIndex`, а не захардкожен:

```js
let amountIdx = headers.findIndex(h => h.includes('Miqdar') && h.includes('Manat'));
if (amountIdx === -1) amountIdx = 4; // fallback
```

Возможные варианты столбцов (0-indexed):
- **Стандартный формат (8 столбцов):** `date[0] | opName[1] | opType[2] | col3[3] | amount[4] | qaliq[5] | artiq[6] | faiz[7]`
- **С валютным столбцом (9 столбцов):** `date[0] | opName[1] | opType[2] | col3[3] | ABŞ$[4] | Manat[5] | qaliq[6] | artiq[7] | faiz[8]`

`opType` принимает значения: `Hesablama` (начисление) | `Azalma` (уменьшение) | `Ödəniş` (оплата, игнорируется)

---

## AnalysisData shape

```js
{
  companyName, voen, period, printDate, totalDebt,
  taxes,          // TaxEntry[], отсортированы по TAX_ORDER, затем год/период
  kybActive,      // taxes где kyb_status === 'active'
  kybCancelled,   // taxes где kyb_status === 'cancelled'
  sybActive,      // taxes где syb_status === 'active'
  sybCancelled,   // taxes где syb_status === 'cancelled'
  rawRows,        // все сырые строки из налоговой таблицы (для Sheet 2)
}
```

### Поля TaxEntry

```js
{
  key,              // канонический ключ периода, напр. "ƏDV 2025/03", "MV - 2024", "HŞƏV - 2024"
  hesablama,        // начисления клиента
  azalma,           // уменьшения клиента
  kyb_hesablama, kyb_azalma, kyb_net,   // суммы камеральной проверки
  kyb_status,       // 'none' | 'active' | 'cancelled'
  has_kyb, has_kybl,
  syb_hesablama, syb_azalma, syb_net,   // суммы выездной проверки
  syb_status,       // 'none' | 'active' | 'cancelled'
  has_syb,
  total_hesablama,  // hesablama + kyb_hesablama + syb_hesablama
  total_azalma,     // azalma + kyb_azalma + syb_azalma
  total_net,        // total_hesablama - total_azalma
  decl_count,       // количество реально поданных деклараций (см. правила ниже)
  client_net,       // hesablama - azalma (только клиентская часть, без проверок)
  decl_count: 0,    // счётчик (не Set), накапливается в buildTaxMap
  vahidDates: Set,  // только для VAHID MUZDLU — дедупликация (date|declType)
}
```

---

## Логика парсера (Section 3)

### 3.1 Определение KYB / SYB

```js
const isKyb  = opName.includes('KYB');
const isKybl = opName.includes('KYBL');        // ləğv — всегда → kyb_azalma
const isSyb  = opName.includes('SYB') && !isKyb;  // SYB только если KYB отсутствует
```

KYB (камеральная проверка):
- `has_kyb = true` при любом вхождении KYB
- KYBL всегда идёт в `kyb_azalma` независимо от `opType`
- `kyb_status`: `active` если `kyb_net > 0`, `cancelled` если `kyb_net ≤ 0`, `none` если проверки нет

SYB (выездная проверка) — аналогичная логика.

### 3.2 extractTaxKey — приоритетный порядок

Функция принимает `opName` и возвращает канонический ключ периода:

| Приоритет | Паттерн входа | Ключ выхода |
|---|---|---|
| 1 | `Ödəmə tapşırığı` / `Sərəncam` | `'Diger'` (пропускается) |
| 2 | `ƏDVQR YYYY/MM` | `'ƏDVQR 2024/09'` |
| 3 | `ƏDV YYYY/MM` | `'ƏDV 2025/03'` |
| 4 | `ÖMV YYYY N. Rüb` | `'ÖMV 2025 3. Rüb'` |
| 5 | `VAHID MUZDLU YYYY N. Rüb` | `'VAHID MUZDLU 2025 4. Rüb'` |
| 6 | `ƏV - N.Rüb YYYY` | `'HŞƏV - YYYY'` (квартальный аванс, объединяется с HŞƏV) |
| 7 | `HŞƏV YYYY` | `'HŞƏV - YYYY'` |
| 8 | `MV...` (не ÖMV) | `'MV - YYYY'` |
| 9 | Universal fallback | `TAX YYYY/MM` → `TAX YYYY/MM` |
| 9 | Universal fallback | `TAX YYYY N. Rüb` → `TAX YYYY N. Rüb` |
| 9 | Universal fallback | `TAX YYYY` → `TAX - YYYY` |
| 10 | Всё остальное | `'Diger'` (пропускается) |

**Важно про MV:** В налоговой таблице MV встречается в двух форматах:
- `MV - 4. Rüb 2024 - Cari hesablama (151.1)` — квартальный аванс (регулярные начисления)
- `MV 2024 - DƏQİQLƏŞMİŞ(B)` — годовая декларация с уточнениями

Оба формата попадают в один ключ `'MV - 2024'` через правило 8.

### 3.3 Подсчёт деклараций (decl_count)

**Паттерн:** `/CARİ\(B\)|DƏQİQLƏŞMİŞ\(B\)|DƏQİQLƏŞDİRİLMİŞ\(B\)/`

Исключения:
- `CARİ(ARAYIŞ)` — не считается (это справка, не декларация)
- `opType === 'Ödəniş'` — не считается
- Строки с суффиксом `/ N` (напр. `MV 2024 - DƏQİQLƏŞMİŞ(B) / 1`) — **не считаются**

**Ключевое правило про `/N` суффиксы:**  
Когда компания подаёт `DƏQİQLƏŞMİŞ(B)`, система налоговой автоматически добавляет строки `/ 1`, `/ 2`, `/ 3`, `/ 4` — это корректировки по каждому квартальному авансу (151.1, 151.2 и т.д.). Эти строки не являются декларациями клиента — это автогенерация системы. Поэтому:

```js
const isSlashRow = /\/\s*\d+\s*$/.test(opName);
if (DECL_PATTERN.test(opName) && opType !== 'Ödəniş' && !isSlashRow) {
  entry.decl_count++;  // только slash-free строки = реальные декларации
}
```

**Исключение — VAHID MUZDLU:**  
Портал создаёт **3 строки** на одну квартальную декларацию (по одной на каждый месяц квартала). Дедупликация через `vahidDates.add(date|declType)` — Set хранит уникальные пары `(yazılış tarixi, тип декларации)`, каждый квартал считается как 1.

### 3.4 Сортировка

```js
TAX_ORDER = ['MV', 'ƏDVQR', 'ƏDV', 'ÖMV', 'HŞƏV', 'VAHID MUZDLU']
// Вторичная сортировка: год ASC, затем месяц/квартал ASC
// Неизвестные типы налогов → в конец, сортируются алфавитно
```

---

## UI (Section 4)

### Основная таблица — 14 столбцов

Колонки сгруппированы по **источнику**, а не по типу операции:

```
Vergi/Dövr | Bəyannamə | Bəy[Hes|Az|Net] | KYB[Hes|Az|Net|Status] | SYB[Hes|Az|Net|Status] | Cəmi Qalıq
```

- **Bəyannamə üzrə** (синий) — что клиент сам начислил/уменьшил/итог
- **KYB (Kameral)** (янтарный) — начисления/уменьшения камеральной проверки + статус-бейдж
- **SYB (Səyyar)** (фиолетовый) — начисления/уменьшения выездной проверки + статус-бейдж
- **Cəmi Qalıq** — итоговый остаток (все источники)

Статус-бейдж в строке: `⚠ сумма` (активный) / `✓ Ləğv` (ləğv edilib) / `—` (нет проверки).  
Отдельные разделы "Ləğv edilmiş KYB/SYB" **убраны** — вся информация видна в строке таблицы.

Шапка таблицы двухстрочная, обе строки закреплены при скролле (`position: sticky`, первая на `top:0`, вторая на `top:31px`).

### Alert-блоки

- Жёлтый `⚠️` — есть активный KYB (kyb_net > 0)
- Фиолетовый `🔍` — есть активный SYB (syb_net > 0)

### Summary chips (6 штук)

Cəmi borc | KYB sayı | KYB məbləği | SYB sayı | SYB məbləği | Vergi növləri

---

## XLSX Export (Section 5)

Два листа в одном файле. **Порядок важен:** листы добавляются до `wb.xlsx.writeBuffer()`.

### Sheet 1: Analiz

- Строки 1-2: шапка компании
- Строка 3: KYB-предупреждение (если есть активные)
- Строка 4: SYB-предупреждение (если есть активные)
- Строка 5: отступ
- Строки 6-7: двойной заголовок (группа + подзаголовок), заморожены (`ySplit: 7`)
- **14 колонок данных:** Tax | Decl | Bəy[Hes, Az, Net] | KYB[Hes, Az, Net, Status] | SYB[Hes, Az, Net, Status] | Cəmi Qalıq
- Цветовые группы: синий = Bəyannamə, янтарный = KYB, фиолетовый = SYB
- Строки с `kyb_hesablama > 0` → светло-жёлтый фон; активный KYB → красный фон в колонке статуса; активный SYB → фиолетовый фон
- KYB Net: зелёный (≤ 0, т.е. погашен/ləğv), красный (> 0, активный)
- Итоговый блок после данных: долг, KYB sayı/məbləği, SYB sayı/məbləği

### Sheet 2: Orijinal Statement

- Все `rawRows` из парсера в оригинальном виде
- Столбец даты → тип Excel Date (`DD.MM.YYYY`)
- Столбец суммы → числовой с `NUM_FMT`
- Ширина столбца opName — автоматически, не более 55 символов

---

## Решённые проблемы / известные нюансы

| Проблема | Решение |
|---|---|
| Файлы с `Miqdar (ABŞ$)` столбцом (9 столбцов вместо 8) | Динамический `findIndex` для поиска `Miqdar (Manat)` |
| `/N`-строки (авто-корректировки авансов) считались как декларации | Проверка `isSlashRow = /\/\s*\d+\s*$/.test(opName)`, такие строки не считаются |
| `ƏV` квартальные авансы HŞƏV | Объединяются в ключ `HŞƏV - YYYY` |
| KYBL (ləğv) — всегда уменьшение KYB | Явная проверка до ветки opType |
| VAHID MUZDLU: 3 строки на одну декларацию | `vahidDates` Set с ключом `date|declType` |
| Портал иногда выгружает frameset-формат | Пользователь должен использовать "Saxla" для стандартного HTML |
| Формат суммы `8.415,00` (AZ/DE локаль) | `s.replace(/\./g,'').replace(',','.')` |
| XSS в названии компании | `esc()` оборачивает все данные пользователя в innerHTML |
| XLSX был тёмным, непригодным для печати | Палитра `C` полностью переработана на светлую тему (белый/светло-серый фон, тёмный текст) |
| Строки с KYB начислениями не выделялись | Светло-жёлтый фон (`FFFBEB`/`FEFCE8`) для строк где `kyb_hesablama > 0` |

---

## CSS переменные (краткий справочник)

```css
--bg / --bg2 / --bg3        /* тёмные фоны */
--border                    /* #2a3347 */
--accent / --accent2        /* синий */
--green / --red / --yellow / --purple   /* статусные цвета */
--green-bg / --red-bg / --yellow-bg / --purple-bg  /* тонированные фоны */
--mono / --sans             /* IBM Plex Mono / IBM Plex Sans */
```

---

## Как продолжить работу в чате

1. Вставь этот README в начало разговора
2. Также загрузи актуальный `index.html` в проект
3. Ссылайся на номера секций: "Section 3 парсер", "Section 5 Sheet 2" и т.д.
4. Файл ~1200 строк — просите Claude редактировать конкретные секции, а не переписывать всё
5. **Язык общения: русский**

### Типичный воркфлоу изменения

```
1. Описать проблему / желаемое поведение
2. Claude читает нужную секцию через view tool
3. Claude делает точечный str_replace
4. Проверка через python-скрипт на реальном .xls файле (если нужно)
5. Файл копируется в /mnt/user-data/outputs/ → скачиваешь → загружаешь на GitHub
```
