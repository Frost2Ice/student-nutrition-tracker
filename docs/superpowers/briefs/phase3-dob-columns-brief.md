# Student DOB as separate Day/Month/Year columns (kills Excel date mangling)

Storing DOB as one date cell lets Excel auto-reformat it. Split the import/export DOB into three
NUMERIC columns วัน / เดือน / ปี(พ.ศ.) — Excel keeps numbers as-is, no date conversion. Internally DOB
stays canonical `D/M/YYYY` พ.ศ. (Student.dob unchanged); only the Excel columns change.

## Global constraints
- `noUnusedLocals`. No git. No server start/kill (:5173). Editor tools only, no heredoc/echo.
- Validation via `rules.ts`. Birth-year window from period (`validateThaiDate(dob,true,periodYear)`).

## Files
- Modify: `src/domain/transfer/xlsx.ts` (+ tests in `tests/transfer/xlsx.test.ts`)
- Modify: `src/features/ImportView.vue` (preview columns/copy if they reference the old single column)

## Changes (xlsx.ts)
- Headers:
  - `STUDENT_CLASSROOM_HEADERS = ['รหัสนักเรียน','ชื่อ','นามสกุล','วันเกิด-วัน','วันเกิด-เดือน','วันเกิด-ปี(พ.ศ.)','เพศ']`
  - `STUDENT_HEADERS` (full/roster) likewise: replace the single `วันเกิด` with the three columns,
    keeping ชั้น/ห้อง after เพศ. New order:
    `['รหัสนักเรียน','ชื่อ','นามสกุล','วันเกิด-วัน','วันเกิด-เดือน','วันเกิด-ปี(พ.ศ.)','เพศ','ชั้น','ห้อง']`.
- Template builders: example DOB split into 3 cells, e.g. `['10001','สมชาย','ใจดี','15','3','2558','ชาย']`
  (classroom) and the full template with ชั้น/ห้อง appended.
- `studentsToAoa` (roster export): emit day/month/year by splitting `s.dob` (`D/M/YYYY` → d, m, y).
  `graduatesToAoa` follows (it reuses studentsToAoa).
- These columns are NUMERIC text values — no `@` text-format needed; drop the DOB textCols (numbers
  don't get date-mangled). Keep textCols param for any other use; pass `[]` for student exports now.
- `parseStudentImport(aoa, ctx, existingIds, overrides?, periodYear?)`:
  - Read id(0), firstName(1), lastName(2), **day(3), month(4), year(5)**, gender(6).
  - If all of day/month/year present and numeric → build `dob = `${+day}/${+month}/${+year}`` then
    `validateThaiDate(dob, true, periodYear)`; invalid → error with that message.
  - If any of the three missing/blank → error `'กรอกวันเกิดให้ครบ (วัน/เดือน/ปี พ.ศ.)'`.
  - Overrides: still keyed by rowNum with `{ dob?: string }` (the inline ThaiDateField fix supplies a
    full `D/M/YYYY`); when an override exists, use it instead of the three columns.
  - Build `student` with the resulting `dob` (canonical) + ctx grade/room. Status/issues as before
    (id rules, dup→update, etc.).
- Update tests: a row with valid 15/3/2558 split → ok; missing month → error; out-of-window year →
  error; existing id → update.

## ImportView.vue
- Preview table วันเกิด column: show the combined `row.dob` (or the 3 values joined) for readability;
  the inline date fix (ThaiDateField) stays — on fix it sets the override dob (canonical) and re-parses.
- Update any copy that says the file has a single date column → mention วัน/เดือน/ปี(พ.ศ.) columns.

## Verify
- `npx vue-tsc --noEmit` clean; `npm test` green; `npm run build` ok.
- On :5173: download the student template → DOB is three numeric columns; importing a normal file
  (edited in a spreadsheet) → no date-format errors; a missing/invalid DOB still flags + inline-fixable.
  Screenshot `.playwright-mcp/dob-columns.png` (preview).

## Report contract
Write full report to `docs/superpowers/briefs/phase3-dob-columns-report.md`. Return short summary + status.
