# Phase 3 Birth-Year Range — Implementation Report

## Status: DONE

## Summary

Replaced all hardcoded พ.ศ. 2540–2590 birth-year constants with a dynamic window
derived from the current academic period year: `[periodYear − 19, periodYear − 2]`.

---

## Changes Made

### 1. `src/domain/validation/rules.ts`
- Added optional `periodYear?: number` third argument to `validateThaiDate`.
- Removed hardcoded `y < 2540 || y > 2590` check.
- When `isDob && typeof periodYear === 'number' && !isNaN(periodYear)`:
  - `min = periodYear − 19`, `max = periodYear − 2`
  - Error message: `ปีเกิดควรอยู่ระหว่าง พ.ศ. ${min}–${max} (อายุ 2–18 ปี)` (dynamic values)
- When no `periodYear` supplied: birth-window check is skipped entirely (format/calendar checks still run).
- Fully backward-compatible — existing callers without the third arg continue to work.

### 2. `src/domain/transfer/xlsx.ts`
- `parseStudentImport` signature extended: `periodYear?: number` added as 5th parameter.
- Passed through to `validateThaiDate(dob, true, periodYear)` on the DOB validation line.
- Measurement date validation (`validateThaiDate(resolvedDate, false)`) unchanged.

### 3. `src/features/ThaiDateField.vue`
- Removed hardcoded `yearMin: 2540` and `yearMax: 2590` defaults.
- New generic fallback defaults: `yearMin = current CE year + 443` (≈ BE − 100), `yearMax = current CE year + 543` (≈ current BE).
- DOB callers always pass explicit `:year-min` / `:year-max` so the fallback is never used for student DOB.
- Note: `withDefaults` in `<script setup>` cannot reference locally-declared variables (Vue compiler restriction), so defaults use inline `new Date().getFullYear() + N` expressions.

### 4. `src/features/StudentsView.vue`
- Student DOB `ThaiDateField`: `:year-min="+data.period.year - 19"` `:year-max="+data.period.year - 2"`.
- `saveStudent()`: derives `const py = +data.period.year` and passes to `validateThaiDate(sForm.dob, true, py)`.
- Measurement date ThaiDateField already had its own non-dob range (`measureYearMax`) — left unchanged.

### 5. `src/features/ImportView.vue`
- `runParse()`: derives `const py = +data.period.year` and passes as 5th arg to `parseStudentImport(..., py)`.
- Inline DOB fix ThaiDateField in preview table: `:year-min="+data.period.year - 19"` `:year-max="+data.period.year - 2"`.

### 6. `tests/domain/rules.test.ts`
- TDD — tests written **before** implementation.
- Added `describe('with periodYear 2569', ...)` block covering:
  - Birth 2550 (lower bound, age 19) → null (ok)
  - Birth 2558 (mid-range) → null (ok)
  - Birth 2567 (upper bound, age 2) → null (ok)
  - Birth 2549 (too old, age > 19) → error
  - Birth 2568 (too young) → error
  - Error message contains dynamic min `2550` and max `2567`
- Added `describe('without periodYear', ...)`:
  - Birth 2549 with no periodYear → null (no birth-window check)
  - Format error still caught without periodYear
- Updated the old hardcoded test `'rejects BE year out of dob range'` → now passes `periodYear 2569` to test correctly.

---

## Verification

| Check | Result |
|---|---|
| `npm test` (159 tests, 14 files) | PASS |
| `npx vue-tsc --noEmit` | PASS (no output) |
| `npm run build` | PASS (874 kB single-file index.html) |
| Playwright :5173 period 2569 — year dropdown | Shows 2567 down to 2550 exactly |
| Screenshot | `.playwright-mcp/birthyear.png` |

The Playwright snapshot confirmed: with period year 2569, the student DOB year dropdown
in the add-student dialog lists options from 2567 (max = 2569−2) down to 2550 (min = 2569−19),
with no values outside that window. The old 2540/2590 constants are gone from all files.
