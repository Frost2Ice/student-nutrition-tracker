# Phase 3 — xlsx domain module (teacher data exchange in Excel)

Standardize teacher data exchange to real Excel `.xlsx` (SheetJS `xlsx`, already installed).
Backup/Restore stays JSON (do NOT touch `backup.ts`). This task adds the xlsx domain module +
tests and an AOA summary builder. It is NON-BREAKING: leave `csv.ts` and `toSummaryCsv` in place
(views get rewired + csv.ts deleted in a later task).

## Global constraints
- `noUnusedLocals`. No git. No server start/kill. Editor tools only, no heredoc/echo.
- Single-file offline build must still work (`npm run build` → one inlined index.html). SheetJS is
  pure JS and bundles; verify the build at the end.
- Validation ONLY via `src/domain/validation/rules.ts`. Dates Thai BE `D/M/YYYY`.

## Files
- Create: `src/domain/transfer/xlsx.ts`
- Create: `tests/transfer/xlsx.test.ts`
- Modify: `src/domain/report/summary.ts` — ADD `summaryToAoa(setup, summary, year, term): (string|number)[][]`
  (keep existing `toSummaryCsv` for now).

## xlsx.ts API (use `import * as XLSX from 'xlsx'`)
Headers (exact):
- `STUDENT_HEADERS = ['รหัสนักเรียน','ชื่อ','นามสกุล','วันเกิด','เพศ','ชั้น','ห้อง']`
- `MEASURE_HEADERS = ['รหัสนักเรียน','น้ำหนัก(กก.)','ส่วนสูง(ซม.)','วันที่วัด']`

Pure AOA builders (array-of-arrays; unit-testable, no SheetJS needed):
- `studentTemplateAoa(): (string)[][]` — `[STUDENT_HEADERS, ['10001','สมชาย','ใจดี','15/3/2558','ชาย','ป.1','1']]`
- `measureTemplateAoa(): string[][]` — `[MEASURE_HEADERS, ['10001','22.5','120','15/6/2569']]`
- `studentsToAoa(students: Student[]): string[][]` — header + one row per student.
- `graduatesToAoa(students: Student[]): string[][]` — same columns as students (graduate list).

SheetJS read/write (thin wrappers):
- `aoaToXlsxBlob(aoa: unknown[][], sheetName = 'ข้อมูล'): Blob` — `XLSX.utils.aoa_to_sheet` →
  `book_new`/`book_append_sheet` → `XLSX.write(wb,{type:'array',bookType:'xlsx'})` → `new Blob([...],
  {type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'})`.
- `readXlsxToAoa(buf: ArrayBuffer): string[][]` — `XLSX.read(buf,{type:'array'})`, first sheet →
  `XLSX.utils.sheet_to_json(ws,{header:1,raw:false,defval:''})` → coerce every cell to trimmed string.

Parsers (pure over AOA; row numbers are 1-based incl header, so first data row = 2):
- `parseStudentAoa(aoa): { rows: Student[]; skipped: { row: number; reason: string }[] }`
  - skip + reason for: missing รหัสนักเรียน; missing ชื่อ. gender defaults 'ชาย' if blank/invalid.
- `parseMeasureAoa(aoa, period: {year;term;round}): { rows: Measurement[]; skipped: {row;reason}[] }`
  - validate น้ำหนัก via `validateWeight`, ส่วนสูง via `validateHeight`, วันที่วัด via
    `validateThaiDate(date,false)`; any failure → skip with the rule's message + row number.
  - valid rows → `Measurement` with the passed `period` (year/term/round), `savedAt: Date.now()`,
    `gradeAtMeasure:''`, `roomAtMeasure:''` (filled at merge time from the matched student).

Merge into the store (mirror the existing csv.ts mergeImport semantics, split by entity):
- `mergeStudents(store, rows: Student[]): { added: number; updated: number }`
  — existing id → `updateStudent`; else `addStudent`.
- `mergeMeasures(store, rows: Measurement[]): { added: number; skippedDup: number; orphans: number }`
  — no matching student → orphan (skip+count); `findDuplicate(id, year, term, round)` non-null →
  skippedDup; else set `gradeAtMeasure`/`roomAtMeasure` from the student and `addMeasure`.
  Use a `MergeStore`-style type with `students.value` (read) + the real actions, like csv.ts does.

## summary.ts addition
- `summaryToAoa(setup, summary, year, term): (string|number)[][]` — same content as `toSummaryCsv`
  (school, location, per-bucket counts + percentages, by-grade rows) as an AOA suitable for
  `aoaToXlsxBlob`. Reuse `WFH_BUCKET_LABELS` and the summary fields.

## Tests (`tests/transfer/xlsx.test.ts`)
- `studentTemplateAoa()[0]` equals STUDENT_HEADERS; `measureTemplateAoa()[0]` equals MEASURE_HEADERS.
- `parseMeasureAoa` skips an invalid weight (999) with `{ row: 2 }`.
- `parseStudentAoa` skips a row missing id with a reason.
- Round-trip: `readXlsxToAoa(<arraybuffer from XLSX.write of studentTemplateAoa>)` returns the
  headers as strings. (Build the arraybuffer via `XLSX.write(wb,{type:'array',bookType:'xlsx'})` in
  the test; confirm SheetJS read works in the vitest/node env.)

## Verify
- `npx vue-tsc --noEmit` clean; `npm test` green (incl new xlsx tests); `npm run build` succeeds
  (note the new bundle size in the report).

## Report contract
Write full report to `docs/superpowers/briefs/phase3-xlsx-domain-report.md` (API summary, bundle
size delta, test results). Return short summary + status.
