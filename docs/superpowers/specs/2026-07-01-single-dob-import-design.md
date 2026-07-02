# Single DOB Column — Import Refactor Design

**Date:** 2026-07-01
**Status:** Approved for planning

## Problem

Student import (upload / paste / template) splits date-of-birth across three
columns — `วันเกิด-วัน`, `วันเกิด-เดือน`, `วันเกิด-ปี(พ.ศ.)`. This is brittle:
teachers enter dates in many real-world formats (slash/dot/dash separators, Thai
month names, Thai numerals, CE or BE years) that don't fit three rigid numeric
cells. We collapse DOB to a **single `วันเกิด` column** everywhere and parse it
through one tolerant, well-tested function.

The domain model already stores `Student.dob` as a single canonical
`D/M/YYYY` Buddhist-era string, and `normalizeThaiDate` already parses most
formats. The work is concentrated in the **import layer**: column layout,
parsers, templates, mock data, plus two parser gaps (Thai numerals, 2-digit
years) and an ambiguity-handling upgrade.

## Goals

- One `วันเกิด` column in all student import templates and parsers.
- Tolerant parse: many separators, Thai month names (full + abbr), Thai
  numerals, mixed numerals, irregular whitespace, CE↔BE auto-detect.
- DOB always interpreted as **Day / Month / Year** — never silently reorder.
- Display DOB in BE format throughout (already the case).
- Only truly invalid dates (impossible / unparseable) are hard errors — and
  those stay fixable inline via the existing import-preview edit path.

## Non-goals

- `Student.dob` model / storage — unchanged.
- Measure date (`วันที่วัด`) — already a single column via `normalizeThaiDate`.
- Date-picker UI components — unchanged (they already edit a single `dob`).
- Backward compatibility with legacy 3-column files — **explicit hard cutover**
  (see Legacy handling).

## Design

### 1. `normalizeThaiDate` — the single parse path

File: `src/domain/date/thai-date.ts`. Extend the existing function; all DOB
import routes through it (single source, already unit-tested).

**Return contract (unchanged):**

```ts
{ value: string; converted: boolean } | null
```

- `null` — uninterpretable OR impossible date (bad structure, unknown month,
  `32/13/2565`, day exceeds days-in-month). → hard validation **error**, fixable
  inline in the preview.
- otherwise parsed to canonical BE `D/M/YYYY`. `converted: true` whenever any
  adjustment happened (CE→BE, Excel serial, 2-digit expansion, non-slash
  reformat) — drives the existing informational "auto-adjusted" warn.

No confidence tier / no ambiguity-block gate: with D/M/Y order fixed and 2-digit
years trusted as short BE, there is no ambiguous-but-guessable class left.

**Parsing steps (in order):**

1. **Numeral normalization (new):** map Thai digits `๐–๙` → `0–9` across the
   whole string first. Handles `๐๒-๑๐-๒๕๖๕` and mixed `๒ ต.ค. 2565`.
2. **Whitespace normalization (new):** collapse runs of whitespace to a single
   space and trim, so `  2  ต.ค.  2565 ` parses.
3. Excel serial number / JS `Date` (unchanged).
4. Thai month name (full + abbr) `D <month> YYYY|YY`.
5. Numeric 3-part on `/ . - space`: ISO (`YYYY-MM-DD`) when first part is
   4-digit, otherwise `D/M/Y`. Never reorder D and M.

**Year resolution (`resolveYearToBE`):**

| Input year          | Interpretation           |
|---------------------|--------------------------|
| 4-digit `≥ 2400`    | BE as-is                 |
| 4-digit `1900–2200` | CE → `+543`              |
| 2-digit `yy`        | **BE short → `2500+yy`** |

2-digit years follow Thai roster convention (`65` → `2565` BE), trusted (marked
`converted` so the informational warn shows, but not blocking).

### 2. Column layout — single `วันเกิด`, everywhere

File: `src/domain/transfer/xlsx.ts`.

- `STUDENT_HEADERS`: replace the three DOB headers with one `วันเกิด`.
  Gender/grade/room shift left by two indices.
- `STUDENT_CLASSROOM_HEADERS`: replace three DOB headers with one `วันเกิด`.
- Reindex and simplify all builders/parsers:
  - `studentsToAoa` / `graduatesToAoa`: emit `s.dob` directly (no split).
  - `gridRowsToAoa`: emit `r.dob` directly (no split).
  - `parseClipboardGrid`: single dob cell → `normalizeThaiDate`.
  - `parseStudentAoa` (bulk parser): read the single dob column, normalize,
    then `validateThaiDate`.
  - `parseStudentImportRows` (preview parser): read single dob column; drop the
    `rawDay/rawMonth/rawYear` join; normalize; keep the override + warn-on-
    converted + validate flow unchanged.
- `src/components/ImportDialog.vue` line ~226 manual-paste `d && m && y` join →
  single dob cell.

### 3. Preview error-fix path (existing, unchanged)

DOB rows that parse to `null` or fail the age-range `validateThaiDate` check
remain hard errors, surfaced in the preview and fixable inline via the existing
editable-DOB path (`onDobFix` / `dobOverrides`, single-field date picker) — no
new UI, no new gating logic beyond what already exists for error rows.

### 4. Legacy 3-column files — hard cutover

Only the single `วันเกิด` column is supported. On parse, if any legacy header
(`วันเกิด-วัน`, `วันเกิด-เดือน`, `วันเกิด-ปี(พ.ศ.)`) is present, fail the whole
import with a clear message:

> `ไฟล์รูปแบบเก่า (วันเกิดแยก 3 ช่อง) — ดาวน์โหลดแม่แบบใหม่ที่ใช้ช่อง "วันเกิด" ช่องเดียว`

### 5. Validation

File: `src/domain/validation/rules.ts`. `validateThaiDate` stays as-is (canonical
`D/M/YYYY` in, age-range check). Because `normalizeThaiDate` runs first,
impossible/unparseable input is already `null` before validation. Position is
fixed D/M/Y — no silent reordering path exists.

### 6. Templates + mock data

- Template downloads already flow through the headers in §2 — single column
  automatically.
- `mockdata/generate.mjs`: `thaiDate()` already emits single `D/M/BE`;
  regenerate `roster-*.xlsx` samples so their sheets carry one `วันเกิด` column.
- Delete the stale `~$roster-ป.1-1.xlsx` Excel lock file.

## Testing (TDD)

`tests/domain/thai-date.test.ts` — add:
- `02/10/2565`, `2/10/2565`, `02-10-2565`, `02.10.2565` → high `2/10/2565`.
- `02 ต.ค. 2565`, `2 ตุลาคม 2565` → high.
- `02-10-2022` (CE) → high, converted, `2/10/2565`.
- `๐๒-๑๐-๒๕๖๕` (Thai numerals) → high.
- `๒ ต.ค. 2565` (mixed numerals) → high.
- `  2  ต.ค.  2565 ` (irregular whitespace) → high.
- `02/10/65`, `02-10-65`, `2 ต.ค. 65`, `๒ ต.ค. ๖๕` → `2/10/2565`, converted.
- Impossible / unparseable (`32/13/2565`, `2565`, `abc`) → `null`.

`tests/transfer/xlsx.test.ts` — add:
- Single-column student parse (bulk + preview).
- Legacy 3-column file → rejection with the cutover message.
- Round-trip `studentsToAoa` → parse yields matching `dob`.
- Preview row with `null`-parse DOB → flagged error, fixable via override.

## Impact / touch list

- `src/domain/date/thai-date.ts` — numerals, whitespace, 2-digit-year expansion.
- `src/domain/transfer/xlsx.ts` — headers, builders, both parsers, legacy guard.
- `src/components/ImportDialog.vue` — single-column manual-paste join.
- `src/domain/validation/rules.ts` — no change expected (verify only).
- `mockdata/generate.mjs` + regenerated `roster-*.xlsx`; delete `~$` lock file.
- Tests: `thai-date.test.ts`, `xlsx.test.ts`.
