# Phase 3 — relocate Excel I/O into owning features; remove CSV + Settings Excel section

Move all teacher data exchange to the feature that owns the data, standardize on `.xlsx`, give every
import an Excel template download, and delete CSV. Backup/Restore stays JSON (do NOT touch backup.ts
or the Settings backup panel).

## Global constraints
- `noUnusedLocals`. No git. No server start/kill (:5173). Editor tools only, no heredoc/echo.
- UX: keep the existing visual system (panels, .btn, callouts); match each view's current style.
- All exchange files are `.xlsx`. No `.csv` anywhere after this task.
- Use the domain module `src/domain/transfer/xlsx.ts` (already built): `STUDENT_HEADERS`,
  `MEASURE_HEADERS`, `studentTemplateAoa`, `measureTemplateAoa`, `studentsToAoa`, `graduatesToAoa`,
  `aoaToXlsxBlob(aoa, sheetName?)`, `readXlsxToAoa(arrayBuffer)`, `parseStudentAoa`,
  `parseMeasureAoa(aoa, period)`, `mergeStudents`, `mergeMeasures`; and `summaryToAoa` in
  `src/domain/report/summary.ts`.

### Shared download helper
Add `src/features/download.ts` exporting `downloadBlob(blob: Blob, filename: string)` (temp `<a>` +
`URL.createObjectURL`/revoke). Use it everywhere instead of per-view duplicates.

## 1. นักเรียน (`src/features/StudentsView.vue`) — student list import/template/export
At the BROWSE ROOT only (the `level === 'grades'` view, not inside a room or profile), add a small
right-aligned action toolbar above the grade grid (below the search), with:
- `📥 นำเข้ารายชื่อ (Excel)` → `emit('go','import')` (opens the import overlay; add `go` emit to
  StudentsView and wire it in AppShell: `<StudentsView @go="go" />`).
- `ดาวน์โหลดแม่แบบ` (quiet) → `downloadBlob(aoaToXlsxBlob(studentTemplateAoa(),'รายชื่อนักเรียน'),
  'แม่แบบรายชื่อนักเรียน.xlsx')`.
- `ส่งออกรายชื่อ` (quiet) → `downloadBlob(aoaToXlsxBlob(studentsToAoa(allStudentsList),
  'รายชื่อนักเรียน'),'รายชื่อนักเรียน.xlsx')` where allStudentsList = every student
  (`data.students`). Keep it unobtrusive; this is a manage-list affordance, not the primary content.

## 2. Import overlay (`src/features/ImportView.vue`) — student list import → xlsx
- Switch the file input to `accept=".xlsx"`; read as ArrayBuffer → `readXlsxToAoa(buf)` →
  `parseStudentAoa(aoa)`. Show valid rows + skipped (row + reason). On confirm `mergeStudents(store,
  rows)` and show `{ added, updated }`.
- Add a prominent `ดาวน์โหลดแม่แบบ Excel` button in the file-select step (above the picker):
  `downloadBlob(aoaToXlsxBlob(studentTemplateAoa(),'รายชื่อนักเรียน'),'แม่แบบรายชื่อนักเรียน.xlsx')`.
- Update copy: remove "CSV" mentions → "Excel". Keep the stepper/flow.
- This overlay now imports the STUDENT LIST (not measurements). If it currently has a per-classroom
  selection step that no longer fits xlsx-with-grade/room-in-file, simplify to: choose file →
  review → merge → done. (Grade/room come from the file columns.)

## 3. บันทึกการวัด (`src/features/MeasureView.vue`) — measurement import → xlsx
In the Excel mode upload step:
- Add `ดาวน์โหลดแม่แบบ Excel` (prominent, above the dropzone):
  `downloadBlob(aoaToXlsxBlob(measureTemplateAoa(),'ผลการวัด'),'แม่แบบผลการวัด.xlsx')`.
- File input `accept=".xlsx"` → ArrayBuffer → `readXlsxToAoa` → `parseMeasureAoa(aoa, { year:
  data.period.year, term: data.period.term, round: round.value })`. Show valid + skipped(row+reason)
  in the review step. On confirm `mergeMeasures(store, rows)` → show `{ added, skippedDup, orphans }`,
  then go to the done step. Remove the "(เชื่อมต่อในขั้นถัดไป)" stub.

## 4. Promotion (`src/features/PromotionView.vue`) — graduate export → xlsx
- Replace the CSV graduate export with
  `downloadBlob(aoaToXlsxBlob(graduatesToAoa(graduateStudents),'ผู้จบการศึกษา'),
  'รายชื่อนักเรียนจบการศึกษา ปีการศึกษา '+data.period.year+'.xlsx')`. Keep the required-download gate.
  Button label "ดาวน์โหลด Excel". Remove the `toCsv` import.

## 5. Reports (`src/features/ReportsView.vue`) — summary export → xlsx
- Replace `handleCsv`/`toSummaryCsv` with
  `downloadBlob(aoaToXlsxBlob(summaryToAoa(data.setup, summary, year, term),'สรุปโภชนาการ'),
  'รายงานสรุป '+year+' ภาค'+term+'.xlsx')`. Button label "ส่งออก Excel". Remove CSV import/code.

## 6. Settings (`src/features/SettingsView.vue`) — remove Excel section
- Delete the entire "ส่งออก / นำเข้าข้อมูล (Excel)" panel, `doExportCsv`, the `toCsv` import, and the
  `emit('go','import')` usage from that panel. KEEP the JSON backup/restore panel untouched.
- The group-head "ข้อมูลและการสำรอง" now sits over only the backup panel — change it to
  "การสำรองข้อมูล" (or drop the group-head and keep the backup panel's own section-title). Keep IA clean.

## 7. Cleanup
- Delete `src/domain/transfer/csv.ts` and remove `toSummaryCsv` from `src/domain/report/summary.ts`
  (and its test references). Ensure nothing imports them. Fix `noUnusedLocals`.
- AppShell: import overlay still launched (now from StudentsView). Confirm `@go` wired on StudentsView.

## Verify
- `npx vue-tsc --noEmit` clean; `npm test` green (remove/replace any csv.ts tests; xlsx tests stay);
  `npm run build` ok (single file).
- On :5173: (a) นักเรียน root shows import/template/export actions; template downloads an .xlsx;
  (b) Measure Excel step has a template button + imports an .xlsx; (c) Settings no longer shows the
  Excel section, backup still there; (d) Reports/Promotion export .xlsx. Screenshots:
  `.playwright-mcp/xlsx-students.png`, `.playwright-mcp/xlsx-measure-excel.png`,
  `.playwright-mcp/xlsx-settings.png`.

## Report contract
Write full report to `docs/superpowers/briefs/phase3-xlsx-ui-report.md`. Return short summary + status.
