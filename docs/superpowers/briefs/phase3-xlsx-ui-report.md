# Phase 3 — XLSX UI Relocation Report

**Date:** 2026-06-21  
**Status:** DONE

---

## What was done

### New shared helper
- Created `src/features/download.ts` — exports `downloadBlob(blob, filename)` used by all views.

### 1. StudentsView (`src/features/StudentsView.vue`)
- Added `emit` declaration with `go` event.
- Added imports for `aoaToXlsxBlob`, `studentTemplateAoa`, `studentsToAoa`, `downloadBlob`.
- Added `.import-toolbar` action bar (right-aligned, below search, visible only at `level === 'grades'` and no search query) with:
  - `📥 นำเข้ารายชื่อ (Excel)` → `emit('go', 'import')`
  - `ดาวน์โหลดแม่แบบ` (quiet) → downloads `แม่แบบรายชื่อนักเรียน.xlsx`
  - `ส่งออกรายชื่อ` (quiet) → downloads `รายชื่อนักเรียน.xlsx`

### 2. ImportView (`src/features/ImportView.vue`)
- Fully rewritten to xlsx-based flow (CSV code removed).
- Steps simplified: เลือกไฟล์ → ตรวจสอบ → เสร็จสิ้น (3 steps, no room-selection step).
- Prominent `ดาวน์โหลดแม่แบบ Excel` button in step 1 (inside callout).
- File input `accept=".xlsx"` → reads as `ArrayBuffer` → `readXlsxToAoa` → `parseStudentAoa` → shows valid rows + skipped.
- Confirm → `mergeStudents(store, rows)` → shows `{ added, updated }`.
- Imports from `src/domain/transfer/xlsx` and `src/features/download.ts`.

### 3. MeasureView (`src/features/MeasureView.vue`)
- Added imports for xlsx module and `downloadBlob`.
- Excel upload step (mode=excel, i=1): added prominent `ดาวน์โหลดแม่แบบ Excel` button above file picker.
- File input `accept=".xlsx"` → ArrayBuffer → `readXlsxToAoa` → `parseMeasureAoa(aoa, {year, term, round})`.
- Review step (mode=excel, i=2): shows valid rows table + skipped rows; confirm button calls `mergeMeasures(store, rows)`.
- Done step: shows `{ added, skippedDup, orphans }` for Excel mode.
- Removed "(เชื่อมต่อในขั้นถัดไป)" stub callouts.

### 4. PromotionView (`src/features/PromotionView.vue`)
- Replaced `toCsv` import with `aoaToXlsxBlob`, `graduatesToAoa`, `downloadBlob`.
- `downloadGraduates()` now calls `aoaToXlsxBlob(graduatesToAoa(...), 'ผู้จบการศึกษา')`.
- Button label updated to "ดาวน์โหลด Excel (จำเป็น)".
- Filename: `รายชื่อนักเรียนจบการศึกษา ปีการศึกษา {year}.xlsx`.

### 5. ReportsView (`src/features/ReportsView.vue`)
- Replaced `toSummaryCsv` import with `summaryToAoa`, added `aoaToXlsxBlob`, `downloadBlob`.
- `handleCsv()` renamed to `handleXlsx()` — calls `aoaToXlsxBlob(summaryToAoa(...), 'สรุปโภชนาการ')`.
- Button label: "📊 ส่งออก Excel".
- Filename: `รายงานสรุป {year} ภาค{term}.xlsx`.

### 6. SettingsView (`src/features/SettingsView.vue`)
- Removed `toCsv` import and `doExportCsv()` function.
- Removed entire "ส่งออก / นำเข้าข้อมูล (Excel)" panel and its two goal rows.
- Renamed group-head from "ข้อมูลและการสำรอง" → "การสำรองข้อมูล".
- JSON backup/restore panel untouched.

### 7. AppShell (`src/AppShell.vue`)
- Added `@go="go"` to `<StudentsView>` component so the import overlay is triggered from StudentsView.

### 8. Cleanup
- Deleted `src/domain/transfer/csv.ts`.
- Deleted `tests/transfer/csv.test.ts`.
- Removed `toSummaryCsv` function from `src/domain/report/summary.ts`.
- Updated `tests/report/summary.test.ts`: replaced `toSummaryCsv` describe block with `summaryToAoa` tests.

---

## Verification results

| Check | Result |
|-------|--------|
| `npx vue-tsc --noEmit` | ✅ Clean (no errors) |
| `npm test` | ✅ 117 tests passed across 14 test files |
| `npm run build` | ✅ Single-file `dist/index.html` (906 kB) |

### Screenshots (saved to `.playwright-mcp/`)
- `xlsx-students.png` — นักเรียน root showing import/template/export toolbar
- `xlsx-measure-excel.png` — Measure Excel step with "ดาวน์โหลดแม่แบบ Excel" button and file picker
- `xlsx-settings.png` — Settings with no Excel panel; only backup/restore + yearly tasks remain

---

## Files changed

| File | Action |
|------|--------|
| `src/features/download.ts` | Created |
| `src/features/StudentsView.vue` | Added emit + xlsx toolbar |
| `src/features/ImportView.vue` | Rewritten to xlsx 3-step flow |
| `src/features/MeasureView.vue` | Wired Excel import steps |
| `src/features/PromotionView.vue` | Replaced CSV with xlsx export |
| `src/features/ReportsView.vue` | Replaced CSV with xlsx export |
| `src/features/SettingsView.vue` | Removed Excel panel |
| `src/AppShell.vue` | Added `@go` to StudentsView |
| `src/domain/transfer/csv.ts` | Deleted |
| `src/domain/report/summary.ts` | Removed `toSummaryCsv` |
| `tests/transfer/csv.test.ts` | Deleted |
| `tests/report/summary.test.ts` | Updated to use `summaryToAoa` |
