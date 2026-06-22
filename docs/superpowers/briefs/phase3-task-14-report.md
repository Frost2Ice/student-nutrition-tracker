# Phase 3 Task 14 — Import Wizard Report

## Status: DONE

## What Was Implemented

Created `src/features/ImportView.vue` — a fully wired 5-step import wizard — and replaced
the placeholder in `src/AppShell.vue`. The wizard ports the prototype template/style
verbatim and connects to the real CSV pipeline.

## Files Created / Modified

### Created
- `src/features/ImportView.vue` — 5-step import wizard component

### Modified
- `src/AppShell.vue` — added `ImportView` import; replaced placeholder `<div>` with
  `<ImportView v-else-if="overlay === 'import'" @done="closeOverlay" @exit="closeOverlay" />`

## Wiring Details

| Step | UI | Data |
|------|----|------|
| 0 เลือกห้อง | Clickable room list | `data.structure` (from Pinia) |
| 1 เลือกไฟล์ | `<label>` wrapping hidden `<input type="file">` | `FileReader` → `parseImport(text)` |
| 2 ตรวจ/แก้ | Valid rows table + skipped rows table with reason | `parsedRows` / `skippedRows` from parseImport result |
| 3 รายการซ้ำ | Info callout explaining merge strategy + counts | Display only; no per-row UI needed (mergeImport handles it) |
| 4 เสร็จสิ้น | Success hero with merge counts | `mergeImport(storeAdapter, { rows: parsedRows })` |

### MergeStore Adapter

`mergeImport` expects a `MergeStore` interface with `{ students: { value: Student[] }, ... }`.
Pinia's reactive store exposes arrays directly at the TS type level (not wrapped in `{ value }`).
A thin adapter object was built at call time in `confirmImport()` to satisfy the interface:

```ts
const store: MergeStore = {
  students: { value: data.students },
  measures: { value: data.measures },
  addStudent: (s) => data.addStudent(s),
  updateStudent: (id, patch) => data.updateStudent(id, patch),
  addMeasure: (m) => data.addMeasure(m),
  findDuplicate: (studentId, year, term, round) =>
    data.findDuplicate(studentId, year, term, round),
};
```

This pattern is sound at runtime — Pinia's `ref`s are accessed as plain values by the
store's public API, but `data.students` is the raw `Ref<Student[]>` internally, which
satisfies the `{ value: Student[] }` shape.

## Deviations from Prototype

- **Step 2 (ตรวจ/แก้):** The prototype used mock `IMPORT_ROWS` with `ok/fixed/error/dup`
  states and a single table. The real implementation uses two separate tables: one for
  valid rows (all shown as "พร้อมนำเข้า") and one for skipped rows with their reason.
  This matches the brief's wiring spec § 4 ("show `rows` (valid) and `skipped` (row number + reason)").
- **Step 1 (เลือกไฟล์):** Changed "เลือกไฟล์ Excel" button to a `<label>` wrapping a real
  `<input type="file" accept=".csv,text/csv">` — functional replacement; prototype was a mock click.
- **Step 3 (รายการซ้ำ):** The prototype showed per-row update/skip toggles with mock data.
  The brief says "surface that duplicate measurements will be skipped (counts come from mergeImport)".
  Implemented as an info callout explaining the merge strategy + row counts from parse result,
  with the actual duplicate count surfaced after mergeImport runs on the done screen.
  This is consistent with the brief's §5 ("Import = MERGE ... skip duplicate measurements").

## TypeScript Fix Required

`noUnusedLocals` caught `stateMeta` (prototype artifact, unused in the real implementation).
Removed it. Also fixed `mergeImport` call via the `MergeStore` adapter above.

## Verification Results

### Type-check
```
npx vue-tsc --noEmit  →  exit 0, no output
```

### Build
```
npm run build  →  exit 0
dist/index.html  422.24 kB │ gzip: 145.89 kB
```

### Tests
```
npm test  →  13 test files, 103 tests, all passed
```

### Playwright (http://localhost:5173)

Walked the full wizard with a 3-row CSV (1 student, 1 valid measure, 1 invalid measure with
weight 99999):

- Step 0: Room list showed ป.3/1 and ป.3/2 from `data.structure` ✓
- Step 1: File upload panel rendered with callout ✓
- Step 2: "พร้อมนำเข้า 2 แถว · ข้าม 1 แถว" — valid rows (student + measure) shown; skipped
  row 4 shown with reason "น้ำหนักต้องอยู่ระหว่าง 5–150 กก." ✓
- Step 3: Info callout + row counts shown ✓
- Step 4 (done): "เพิ่มใหม่ 2 รายการ · อัปเดต 0 รายการ · ข้ามซ้ำ 0 รายการ · ไม่พบนักเรียน 0 รายการ"
  from real `mergeImport` return value ✓
- All 4 completed stepper steps show ✓ marks ✓

Screenshot saved to `.playwright-mcp/p3-t14-import.png`.
