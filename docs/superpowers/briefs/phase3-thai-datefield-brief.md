# Kill DOB date errors: text-format template + Thai BE date picker

Teachers still hit DOB errors on import. Two root fixes:
A. Excel mangles the template's date column when edited → write date columns as Excel TEXT so it
   stays literal and round-trips.
B. The inline fix is a native `<input type="date">` (Gregorian/CE) — confusing + still mistypeable.
   Replace with a structured Thai Buddhist-era date field (วัน / เดือนไทย / ปีพ.ศ.) that always emits
   canonical `D/M/YYYY` พ.ศ.

## Global constraints
- `noUnusedLocals`. No git. No server start/kill (:5173). Editor tools only, no heredoc/echo.
- Canonical date = `D/M/YYYY` พ.ศ. Validation via `rules.ts`. .xlsx only.

## A. Template date columns as TEXT (`src/domain/transfer/xlsx.ts`)
- Add `aoaToXlsxBlob(aoa, sheetName?, textCols?: number[])`: after `aoa_to_sheet`, for each row≥1 and
  each col in `textCols`, set the cell's type to string and number format text:
  `cell.t = 's'; cell.z = '@';` (and ensure `cell.v` is the string). This tells Excel the column is
  text so editing won't auto-convert dates.
- Apply `textCols`:
  - `studentTemplateAoa` / `studentClassroomTemplateAoa` exports → DOB column index
    (classroom template: index 3 `วันเกิด`; full template: index 3).
  - `measureTemplateAoa` → วันที่วัด column index 3.
  - `studentsToAoa` (roster export) → DOB index 3.
  Update the call sites (StudentsView, ImportView, MeasureView, Promotion uses graduatesToAoa→students
  cols) to pass the right `textCols`. Keep existing signature working (textCols optional, default []).
- Test (append xlsx.test): a workbook built with textCols marks that column's data cell `t==='s'`
  and `z==='@'`.

## B. `src/features/ThaiDateField.vue` (reusable)
- Props: `modelValue: string` (canonical `D/M/YYYY` BE or ''). Emits `update:modelValue`.
- Three inline selects: **วัน** (1–31), **เดือน** (Thai month names ม.ค.…ธ.ค. → 1–12),
  **ปี (พ.ศ.)** (range default `2540–2590` for births; accept a `yearMin`/`yearMax` prop with those
  defaults so it can be reused for measurement dates with a wider/current range).
- Parse `modelValue` on mount/prop-change to populate the three selects (use existing parse: split
  `D/M/YYYY`). Emit `''` until all three chosen; otherwise emit `${d}/${m}/${y}` (unpadded, BE year).
- Compact styling consistent with `.search`/`.field` controls. Keep it small (fits inline in a table row).

## C. Use ThaiDateField
- **ImportView** inline DOB fix: replace the `<input type="date">` with
  `<ThaiDateField :model-value="row.rawDob" @update:model-value="(v)=>onFixDob(row.rowNum, v)" />`
  (onFixDob sets the override + re-parses, as today). Default year range 2540–2590.
- **MeasureView**: (1) inline date fix in the Excel preview → ThaiDateField (measurement date range,
  e.g. 2560–current+1). (2) the session "วันที่วัด" field (manual + excel start) → ThaiDateField too,
  so the round date is always valid.
- **StudentsView**: the student add/edit dialog `วันเกิด` and the measurement add dialog `วันที่วัด` →
  ThaiDateField (births 2540–2590; measure date wider).
- Remove now-dead free-text date inputs / `type="date"` for these.

## D. Verify normalizer covers BE-ISO (`src/domain/date/thai-date.ts`)
- Confirm `buildAndValidate`: 4-digit year ≥ 2400 → treat as BE as-is (NOT +543); 1900–2200 → +543;
  2-digit → +2500 then? keep current. Add a test `normalizeThaiDate('2558-03-15')` → '15/3/2558'
  (BE-ISO must NOT become 3101). Fix buildAndValidate if needed.

## Verify
- `npx vue-tsc --noEmit` clean; `npm test` green; `npm run build` ok.
- On :5173: download student template, open+save in a spreadsheet, re-import → no DOB error
  (text column preserved). On a row with a bad DOB, the inline fix is now วัน/เดือน/ปีพ.ศ. dropdowns;
  choosing a date flips the row to พร้อม. Student add dialog uses the same picker.
  Screenshots `.playwright-mcp/datefield-import.png`, `.playwright-mcp/datefield-form.png`.

## Report contract
Write full report to `docs/superpowers/briefs/phase3-thai-datefield-report.md`. Return short summary + status.
