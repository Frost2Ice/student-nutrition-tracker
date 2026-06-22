# Phase 3 — Forgiving Excel Date Import: Implementation Report

## Status: DONE

## What Was Built

### 1. `normalizeThaiDate` — TDD, `src/domain/date/thai-date.ts`

New exported function:
```ts
export function normalizeThaiDate(input: string | number | Date): { value: string; converted: boolean } | null
```

Handles:
- **JS Date object** → `formatThaiDate(date)`, converted:true
- **Excel serial number** (epoch 1899-12-30) → JS Date → BE string, converted:true
- **String — D/M/YYYY BE** (slash-separated, year ≥2400) → unchanged, converted:false
- **String — D/M/YYYY CE** (year 1900–2200) → +543, converted:true
- **String — YYYY-MM-DD ISO** → reorder to D/M/Y, CE→BE, converted:true
- **String — dot/dash separated** → same numeric logic, converted:true (non-slash)
- **String — 2-digit year** → assume CE 20xx → +543, converted:true
- **String — Thai month full name** (มกราคม…ธันวาคม) → mapped to month 1–12, converted:true
- **String — Thai month abbreviated** (ม.ค.…ธ.ค.) → mapped to month 1–12, converted:true
- **Invalid/junk** → null
- **Calendar sanity check** (real days-in-month) → null if invalid (e.g. 31/2/2558)

**TDD cycle:** 13 new tests written first (all RED), then implementation (all GREEN). 21 total tests in thai-date.test.ts pass.

### 2. `readXlsxToAoa` — `src/domain/transfer/xlsx.ts`

- Changed `XLSX.read` option: `cellDates: true` and `raw: true`
- Date-typed cells (JS `Date`) are converted immediately via `formatThaiDate` to canonical BE string
- Non-date cells: coerced to trimmed string as before

### 3. `parseMeasureAoa` — normalize วันที่วัด

Before `validateThaiDate`, runs `normalizeThaiDate` on the date cell:
- `null` → skip row with Thai message: `'อ่านวันที่วัดไม่ได้ — ใช้รูปแบบ วัน/เดือน/ปีพ.ศ.'`
- success → uses `normDate.value`; range validation via `validateThaiDate` still runs

### 4. `parseStudentImport` — normalize dob + overrides + inline fix

- New optional 4th arg: `overrides?: Map<number, { dob?: string }>`
- For each row: uses override dob if present, otherwise raw cell value
- Runs `normalizeThaiDate` on the result:
  - `null` → error issue: `'อ่านวันเกิดไม่ได้ — แก้ไขในช่องด้านล่าง หรือใช้รูปแบบ วัน/เดือน/ปีพ.ศ.'`
  - converted:true → warn issue: `'ปรับรูปแบบวันที่ให้อัตโนมัติ'` (not an error)
  - Then `validateThaiDate(normalized, true)` for range check (2540–2590)
- `ImportPreviewRow` interface extended with `rawDob: string` and `hasDateError: boolean`

### 5. `ImportView.vue` — inline date fix in preview

- `lastAoa` ref stores the parsed AOA for re-parsing without re-reading the file
- `overrides` ref (Map) stores per-rowNum dob overrides
- `runParse()` re-runs `parseStudentImport` with current overrides → updates preview + counts live
- `onDobOverride(rowNum, dob)` updates the map and calls `runParse()`
- In the preview table, rows with `hasDateError` show an `<input type="text">` (orange-bordered) prefilled with `rawDob`; all other rows show plain text
- Live re-validation: typing a valid date flips the row from "ปัญหา" to "พร้อม" and enables the import button

### 6. `MeasureView.vue` — no changes required

`MeasureView` calls `parseMeasureAoa` from `xlsx.ts`, which now normalizes วันที่วัด automatically. The skipped-row reason is already in plain Thai. Inline-fix not required per brief ("at minimum: auto-convert + clear skipped-row reason" — both fulfilled via xlsx.ts).

## Verification

### Tests
```
Test Files  14 passed (14)
Tests       141 passed (141)
```

### Type check
```
npx vue-tsc --noEmit  ← no output (clean)
```

### Build
```
dist/index.html  869.17 kB │ gzip: 295.14 kB
✓ built in 1.26s
```

### Playwright screenshots
- `.playwright-mcp/dates-autoconvert.png` — CE date `15/3/2015` auto-converted to `15/3/2558`; row status "อัปเดต" (not error); import button enabled; warn "ปรับรูปแบบวันที่ให้อัตโนมัติ"
- `.playwright-mcp/dates-inlinefix-before.png` — junk date "ไม่ใช่วันที่"; row pink/ปัญหา; inline input visible; import button shows 0 items
- `.playwright-mcp/dates-inlinefix.png` — after typing valid date; row flips to green/พร้อม; import button enabled "นำเข้า 1 รายการ"

## Files Modified

| File | Change |
|------|--------|
| `src/domain/date/thai-date.ts` | Added `normalizeThaiDate` + Thai month maps |
| `src/domain/transfer/xlsx.ts` | `cellDates:true`, import `normalizeThaiDate`/`formatThaiDate`, updated `parseMeasureAoa` + `parseStudentImport` (overrides, normalize, `ImportPreviewRow` fields) |
| `src/features/ImportView.vue` | `lastAoa`/`overrides` refs, `runParse`/`onDobOverride`, inline date input in preview table |
| `tests/domain/thai-date.test.ts` | 13 new `normalizeThaiDate` tests (TDD RED→GREEN) |
| `docs/superpowers/briefs/phase3-forgiving-dates-report.md` | This file |

## Concerns / Notes

- The `15/3/2545` shown in one screenshot is because the keyboard `type` call appended to existing text in the inline input; in real use the teacher clears and types fresh — the logic correctly parses whatever D/M/YYYY string they enter.
- BE dates with non-slash separators (e.g. `15.3.2558`) are `converted:true` — a warn is shown but import proceeds. This is intentional per brief.
- Excel serials with `cellDates:false` (unformatted cells) arrive as number strings; `normalizeThaiDate` handles numeric serials passed as `number`, but if SheetJS stringifies them (e.g. `"42078"`) they won't be recognized as serials. With `cellDates:true`, properly-formatted date cells arrive as `Date` objects and are handled correctly.
