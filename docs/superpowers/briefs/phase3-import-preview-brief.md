# Student import — per-classroom + preview + plain-language validation

Rework the student Excel import so teachers: pick the target grade+classroom first, download that
classroom's template, import the file, then ALWAYS see a preview that flags problems in plain Thai
with the affected rows highlighted, before anything is saved.

## Global constraints
- `noUnusedLocals`. No git. No server start/kill (:5173). Editor tools only, no heredoc/echo.
- .xlsx only (no CSV). Validation via `src/domain/validation/rules.ts` (`validateThaiDate`).
- Keep the design system + journey style (Stepper overlay).

## Files
- Modify: `src/domain/transfer/xlsx.ts` (+ append tests to `tests/transfer/xlsx.test.ts`)
- Rewrite: `src/features/ImportView.vue`

## Domain — xlsx.ts additions (TDD)
Per-classroom template (grade/room come from the teacher's selection, NOT the file):
- `STUDENT_CLASSROOM_HEADERS = ['รหัสนักเรียน','ชื่อ','นามสกุล','วันเกิด','เพศ']`
- `studentClassroomTemplateAoa(): string[][]` — headers + one example row
  (`['10001','สมชาย','ใจดี','15/3/2558','ชาย']`).

Validation parser → preview rows:
```ts
export interface ImportPreviewRow {
  rowNum: number;                 // 1-based incl header; first data row = 2
  id: string; firstName: string; lastName: string; dob: string; gender: string;
  issues: { message: string; severity: 'error' | 'warn' }[];
  status: 'ok' | 'update' | 'error';
  student: Student | null;        // built when status !== 'error' (grade/room from ctx)
}
export function parseStudentImport(
  aoa: string[][],
  ctx: { grade: string; room: string },
  existingIds: Set<string>,
): { rows: ImportPreviewRow[]; counts: { ok: number; update: number; error: number } }
```
Rules per data row (collect ALL issues for the row; plain Thai messages):
- id empty → error `'ไม่มีรหัสนักเรียน'`
- id present but not all digits → error `'รหัสนักเรียนต้องเป็นตัวเลข'`
- id duplicated within the file → error `'รหัสซ้ำกันในไฟล์'` (mark every occurrence)
- firstName empty → error `'ไม่มีชื่อ'`; lastName empty → error `'ไม่มีนามสกุล'`
- dob: `validateThaiDate(dob, true)` → if it returns a message, error with that exact message
- gender not 'ชาย'/'หญิง' → warn `'เพศไม่ถูกต้อง ใช้ค่าเริ่มต้น "ชาย"'` (default to 'ชาย', not an error)
- if no errors AND `existingIds.has(id)` → status `'update'`, warn `'มีรหัสนี้อยู่แล้ว — จะอัปเดตข้อมูลเดิม'`
- if no errors and new id → status `'ok'`
- any error → status `'error'`, `student = null`
- `student` (ok/update) = `{ id, firstName, lastName, dob, gender, grade: ctx.grade, room: ctx.room }`
- `counts` tallies the three statuses.
Reuse existing `mergeStudents` to save (it updates existing / adds new).

Tests (append): a clean row → ok; a bad dob → error with the rule message + correct rowNum;
missing id → error; an id already in `existingIds` → status 'update'; duplicate id in file → both
rows error 'รหัสซ้ำกันในไฟล์'; counts correct.

## ImportView.vue — 4 steps
Stepper: `['เลือกห้อง','เลือกไฟล์','ตรวจสอบ','เสร็จสิ้น']`.
1. **เลือกห้อง**: pick grade then room from `data.structure` (grade buttons/select → room
   buttons/select). Show the chosen ห้อง. Next enabled when both chosen.
2. **เลือกไฟล์**: show the target ห้อง; a prominent `ดาวน์โหลดแม่แบบ Excel` →
   `downloadBlob(aoaToXlsxBlob(studentClassroomTemplateAoa(),'รายชื่อนักเรียน'),
   'แม่แบบรายชื่อ '+grade+'-'+room+'.xlsx')`; file input `accept=".xlsx"` → ArrayBuffer →
   `readXlsxToAoa` → `parseStudentImport(aoa, {grade,room}, new Set(data.students.map(s=>s.id)))`
   → go to step 3.
3. **ตรวจสอบ (preview, ALWAYS before save)**: summary callout
   `พร้อมเพิ่ม {ok} · อัปเดต {update} · มีปัญหา {error}`. A table of ALL rows:
   columns แถว / รหัส / ชื่อ-สกุล / วันเกิด / เพศ / สถานะ. Highlight rows by status:
   error row → `bad-tint` background, update → `warn-tint`, ok → normal. In the สถานะ cell show a
   pill (✓ พร้อม / ✏️ อัปเดต / ⚠️ ปัญหา) and list the row's issue messages in plain text beneath.
   Buttons: back to เลือกไฟล์ (เลือกไฟล์ใหม่), and `นำเข้า {ok+update} รายการ` (disabled if 0).
   Note under the table: "แถวที่มีปัญหาจะถูกข้าม แก้ไขในไฟล์แล้วนำเข้าใหม่ได้".
4. **เสร็จสิ้น**: on confirm call `mergeStudents(store, rows.filter(r=>r.student).map(r=>r.student!))`;
   show added/updated counts + skipped(error) count. Done emits.

## Verify
- `npx vue-tsc --noEmit` clean; `npm test` green (incl new tests); `npm run build` ok.
- On :5173: open นำเข้ารายชื่อ from นักเรียน → pick ป.1/1 → download template → (import a file with a
  bad DOB + a duplicate) → preview highlights the bad rows with plain messages, counts correct →
  importing saves only the good rows. Screenshots `.playwright-mcp/import-pick.png`,
  `.playwright-mcp/import-preview.png`.

## Report contract
Write full report to `docs/superpowers/briefs/phase3-import-preview-report.md`. Return short
summary + status.
