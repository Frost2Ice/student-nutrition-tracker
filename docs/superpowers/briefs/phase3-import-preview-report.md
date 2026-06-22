# Phase 3 Import Preview — Implementation Report

## Summary

Implemented per-classroom student import with always-visible preview and plain-Thai validation
flagging, following the brief exactly. TDD was applied to all new domain logic before any
implementation code was written.

---

## What Was Done

### 1. Domain — `src/domain/transfer/xlsx.ts`

**New exports:**

- `STUDENT_CLASSROOM_HEADERS` — 5-column tuple `['รหัสนักเรียน','ชื่อ','นามสกุล','วันเกิด','เพศ']`
- `studentClassroomTemplateAoa()` — headers + one example row (no grade/room columns)
- `ImportPreviewRow` interface — rowNum, id, firstName, lastName, dob, gender, issues[], status, student
- `parseStudentImport(aoa, ctx, existingIds)` — full per-classroom validation parser

**Validation rules implemented (all in plain Thai):**
- Empty id → error `'ไม่มีรหัสนักเรียน'`
- Non-digit id → error `'รหัสนักเรียนต้องเป็นตัวเลข'`
- Duplicate id within file → error `'รหัสซ้ำกันในไฟล์'` on every occurrence (two-pass scan)
- Empty firstName → error `'ไม่มีชื่อ'`
- Empty lastName → error `'ไม่มีนามสกุล'`
- Invalid dob → error with exact `validateThaiDate(dob, true)` message
- Invalid gender → warn `'เพศไม่ถูกต้อง ใช้ค่าเริ่มต้น "ชาย"'`, defaults to 'ชาย', not an error
- Existing id (no errors) → status `'update'`, warn `'มีรหัสนี้อยู่แล้ว — จะอัปเดตข้อมูลเดิม'`
- Clean new id → status `'ok'`
- Any error → status `'error'`, student = null
- Returns `counts: { ok, update, error }`

### 2. Tests — `tests/transfer/xlsx.test.ts`

Appended 11 new tests (all written before implementation — watched each fail for the correct reason):

- `STUDENT_CLASSROOM_HEADERS` shape
- `studentClassroomTemplateAoa` header and example row
- `parseStudentImport`: clean row → ok + correct rowNum + grade/room from ctx
- bad dob → error with validateThaiDate message
- missing id → error `'ไม่มีรหัสนักเรียน'`
- non-digit id → error `'รหัสนักเรียนต้องเป็นตัวเลข'`
- existing id → status update + warn message
- duplicate id in file → both rows error `'รหัสซ้ำกันในไฟล์'`
- invalid gender → warn, student still built with default ชาย
- mixed rows → counts correct

**Result: 128/128 tests pass.**

### 3. `src/features/ImportView.vue` — full rewrite (4 steps)

- **Step 1 — เลือกห้อง**: grade buttons from `data.structure`, then room buttons; confirmation
  callout shows "ป.X/Y"; Next disabled until both selected
- **Step 2 — เลือกไฟล์**: shows target room; prominent download template button (classroom-specific
  filename `แม่แบบรายชื่อ ป.1-1.xlsx`); file input `.xlsx` only; on change → readXlsxToAoa →
  parseStudentImport → advance to step 3
- **Step 3 — ตรวจสอบ**: summary callout with bold counts; table with all rows; row background
  `bad-tint` (error) / `warn-tint` (update) / transparent (ok); status pill + issue messages
  in plain text; "นำเข้า N รายการ" button disabled when ok+update=0; note about skipped rows
- **Step 4 — เสร็จสิ้น**: calls `mergeStudents` with only non-null students; shows added/updated/skipped

---

## Verification

### Tests
```
Test Files  14 passed (14)
Tests  128 passed (128)
```

### Type check
```
npx vue-tsc --noEmit  →  (no output = clean)
```

### Build
```
dist/index.html  866.62 kB │ gzip: 293.89 kB
✓ built in 1.23s
```

### Browser (localhost:5173)

Tested with a 3-row file containing:
- Row 2: id=10001, valid data (duplicate with row 4)
- Row 3: id=10002, bad dob `notadate`
- Row 4: id=10001, valid data (duplicate with row 2)

Preview showed:
- พร้อมเพิ่ม **0** · อัปเดต **0** · มีปัญหา **3**
- Row 2: ⚠️ ปัญหา / รหัสซ้ำกันในไฟล์ (red tint)
- Row 3: ⚠️ ปัญหา / รูปแบบ: วัน/เดือน/ปีพ.ศ. เช่น 15/05/2556 (red tint)
- Row 4: ⚠️ ปัญหา / รหัสซ้ำกันในไฟล์ (red tint)
- "นำเข้า 0 รายการ" button correctly disabled

Screenshots saved to `.playwright-mcp/import-pick.png` and `.playwright-mcp/import-preview.png`.

---

## Files Changed

- `src/domain/transfer/xlsx.ts` — added STUDENT_CLASSROOM_HEADERS, studentClassroomTemplateAoa,
  ImportPreviewRow, parseStudentImport
- `src/features/ImportView.vue` — full rewrite (4-step flow)
- `tests/transfer/xlsx.test.ts` — 11 new tests appended

No files were created outside the repo. No git operations performed. Dev server untouched.
