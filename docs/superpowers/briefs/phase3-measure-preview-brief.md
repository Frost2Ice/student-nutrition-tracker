# Measurement import — mirror student-import preview + forgiving dates

Bring the measurement Excel import (บันทึกการวัด → Excel mode) up to parity with the student import:
always-on preview, per-row plain-Thai issues, highlighted rows, forgiving date handling
(`normalizeThaiDate`), and inline in-app fix for date errors. Same look/behaviour as ImportView.

## Global constraints
- `noUnusedLocals`. No git. No server start/kill (:5173). Editor tools only, no heredoc/echo.
- .xlsx only. Dates → canonical D/M/YYYY พ.ศ. via `normalizeThaiDate` (already in thai-date.ts).
- Nutrition labels (if shown) only from `calcNutrition`. Validation via `rules.ts`.

## Files
- Modify: `src/domain/transfer/xlsx.ts` (+ append tests to `tests/transfer/xlsx.test.ts`)
- Modify: `src/features/MeasureView.vue` (Excel mode steps)

## Reference (mirror these)
- `parseStudentImport` + `ImportPreviewRow` in xlsx.ts (status/issues/overrides pattern).
- ImportView.vue step 3 preview (summary callout, highlighted rows, inline date input, live re-parse).
- `normalizeThaiDate`, `mergeMeasures` already exist.

## Domain — `parseMeasureImport` (TDD), in xlsx.ts
```ts
export interface MeasureImportPreviewRow {
  rowNum: number;
  id: string; weightRaw: string; heightRaw: string; dateRaw: string;
  name: string;                       // matched student full name, or '' if not found
  issues: { message: string; severity: 'error' | 'warn' }[];
  status: 'ok' | 'dup' | 'error';
  measure: Measurement | null;        // built when status === 'ok'
}
export function parseMeasureImport(
  aoa: string[][],
  period: { year: string; term: Term; round: Round },
  students: Student[],
  hasDup: (studentId: string) => boolean,   // findDuplicate(id, period) !== null
  overrides?: Map<number, { date?: string; weight?: string; height?: string }>,
): { rows: MeasureImportPreviewRow[]; counts: { ok: number; dup: number; error: number } }
```
File columns = MEASURE_HEADERS `['รหัสนักเรียน','น้ำหนัก(กก.)','ส่วนสูง(ซม.)','วันที่วัด']`.
Per data row (apply overrides first if present for that field):
- id empty → error `'ไม่มีรหัสนักเรียน'`.
- student not found in `students` (by id) → error `'ไม่พบรหัสนักเรียนนี้ในระบบ'` (orphan). Set name ''.
- weight: `validateWeight(parseFloat(weight))` → error with its message if invalid.
- height: `validateHeight(parseFloat(height))` → error with its message.
- date: `normalizeThaiDate(dateRaw)` → `null` → error `'อ่านวันที่วัดไม่ได้ — แก้ไขในช่องด้านล่าง'`;
  else use normalized value, `validateThaiDate(value,false)` for range (error if fails); if
  `converted` add warn `'ปรับรูปแบบวันที่ให้อัตโนมัติ'`.
- if no errors AND `hasDup(id)` → status `'dup'`, warn `'มีผลของรอบนี้แล้ว — จะข้ามแถวนี้'`, measure null.
- if no errors and not dup → status `'ok'`, build `Measurement` with the period, normalized date,
  `weightKg`/`heightCm` rounded (`round1`), `savedAt: Date.now()`, and
  `gradeAtMeasure`/`roomAtMeasure` from the matched student's current grade/room.
- counts tally ok/dup/error.
Tests (append): clean row → ok; bad weight (999) → error w/ message + rowNum; orphan id → error;
CE/Excel date auto-converts → ok with the warn; dup id → status 'dup'; counts correct.

## MeasureView.vue — Excel mode
Replace the current upload→simple-review→done with: upload (template + .xlsx picker, already present) →
**preview** (mirror ImportView step 3) → done.
- After file read (`readXlsxToAoa`), call `parseMeasureImport(aoa, {year:data.period.year,
  term:data.period.term, round:round.value}, data.students, (id)=>data.findDuplicate(id,
  data.period.year, data.period.term, round.value)!==null, overrides)`.
- Preview: summary `พร้อมบันทึก {ok} · ข้าม(มีผลแล้ว) {dup} · มีปัญหา {error}`. Table columns
  แถว / รหัส / ชื่อ / น้ำหนัก / ส่วนสูง / วันที่ / สถานะ. Highlight: error → bad-tint, dup → warn-tint,
  ok → normal. สถานะ pill (✓ พร้อม / ⏭️ ข้าม / ⚠️ ปัญหา) + issue messages beneath.
- Inline fix: for rows with a date error show an inline date input (prefilled `dateRaw`) →
  set `overrides.set(rowNum,{date})` → re-run parseMeasureImport live (row re-validates). (Weight/height
  inline inputs optional — add if cheap with the same override map.)
- Confirm button `บันทึกผลการวัด {ok} รายการ` (disabled if ok===0) → `mergeMeasures(store,
  rows.filter(r=>r.status==='ok').map(r=>r.measure!))` (or addMeasure loop) → done step shows
  added/skipped counts.
- Keep manual mode unchanged.

## Verify
- `npx vue-tsc --noEmit` clean; `npm test` green (incl new tests); `npm run build` ok.
- On :5173: บันทึกการวัด → Excel mode on a room → import a file with one good row, one bad weight,
  one Excel-reformatted date (auto-converts), one already-measured (dup) → preview shows the four
  statuses correctly; fixing a bad date inline flips it to พร้อม; confirm saves only ok rows.
  Screenshots `.playwright-mcp/measure-preview.png`, `.playwright-mcp/measure-inlinefix.png`.

## Report contract
Write full report to `docs/superpowers/briefs/phase3-measure-preview-report.md`. Return short
summary + status.
