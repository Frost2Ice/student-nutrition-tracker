# Remove hardcoded birth-year range; derive from current academic year

`validateThaiDate` hardcodes `ปีเกิดต้องอยู่ระหว่าง พ.ศ. 2540–2590`, and `ThaiDateField` defaults
yearMin/Max to 2540/2590. Replace with a window derived from the current academic year:
**birth year ∈ [periodYear − 19, periodYear − 2]** (engine supports ages 2–18; 18 yr 2 m still
counts, hence −19). No fixed constants.

## Global constraints
- `noUnusedLocals`. No git. No server start/kill (:5173). Editor tools only. .xlsx only.

## Changes
1. `src/domain/validation/rules.ts` — `validateThaiDate(str, isDob, periodYear?: number)`:
   - Remove the hardcoded `y < 2540 || y > 2590` check.
   - When `isDob` AND `periodYear` is a valid number: min = periodYear − 19, max = periodYear − 2;
     if `y < min || y > max` → `` `ปีเกิดควรอยู่ระหว่าง พ.ศ. ${min}–${max} (อายุ 2–18 ปี)` ``.
   - When `isDob` and no `periodYear` → skip the birth-window check (keep format/calendar checks).
   - Keep all other checks (4-digit BE, month/day, calendar). Backward compatible (3rd arg optional).
   - Tests (rules test): periodYear 2569 → birth 2550 ok, 2549 (age>19) error, 2568 (too young) error,
     message contains the dynamic min–max; no periodYear → no birth-window error.

2. `src/domain/transfer/xlsx.ts` — `parseStudentImport(aoa, ctx, existingIds, overrides?, periodYear?: number)`:
   pass `periodYear` through to `validateThaiDate(dob, true, periodYear)`. (measure date unaffected.)

3. `src/features/ThaiDateField.vue` — remove the 2540/2590 defaults. Callers must pass `yearMin`/
   `yearMax`. Keep props; if a caller omits them, fall back to a generic wide range
   (e.g. current Gregorian year+543 down 100 yrs) — but DOB callers always pass explicit values.

4. Callers pass the derived window (`const py = +data.period.year`):
   - **StudentsView**: student add/edit dob — ThaiDateField `:year-min="py-19" :year-max="py-2"`;
     dob validation → `validateThaiDate(dob, true, py)`.
   - **ImportView**: `parseStudentImport(..., py)`; inline DOB ThaiDateField `:year-min/:year-max` derived.
   - Measurement date fields keep their own (non-dob) range (e.g. py-1 … py+1) — unchanged behavior,
     just ensure no 2540/2590 leftover.

## Verify
- `npx vue-tsc --noEmit` clean; `npm test` green; `npm run build` ok.
- On :5173 (period 2569): student form ปีพ.ศ. dropdown offers 2550–2567; importing a student born
  2558 → no birth-year error. Screenshot `.playwright-mcp/birthyear.png`.

## Report contract
Write full report to `docs/superpowers/briefs/phase3-birthyear-report.md`. Return short summary + status.
