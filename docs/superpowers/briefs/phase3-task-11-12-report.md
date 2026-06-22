# Phase 3 Tasks 11–12 — Implementation Report

## Status
DONE

## Files Created / Modified

| File | Action |
|------|--------|
| `src/domain/transfer/backup.ts` | Created |
| `src/domain/transfer/csv.ts` | Created |
| `tests/transfer/backup.test.ts` | Created |
| `tests/transfer/csv.test.ts` | Created |
| `src/stores/data.ts` | Modified (added `lastBackupAt`, `backupOverdueDays`, `markBackup`, `replaceAll`) |
| `tests/stores/data.test.ts` | Modified (appended 4 new store tests) |
| `src/features/SettingsView.vue` | Created |
| `src/AppShell.vue` | Modified (import + render SettingsView for `dest === 'settings'`) |

## TDD Cycle Summary

All domain logic was written test-first:

1. **backup.test.ts** — 6 tests written, watched fail (module-not-found), then backup.ts implemented → all 6 green.
2. **csv.test.ts** — 9 tests written, watched fail (module-not-found), then csv.ts implemented → all 9 green.
3. **data.test.ts** — 4 new tests appended, watched fail (`markBackup is not a function`, `replaceAll is not a function`), then store additions implemented → all 9 store tests green.

## Test Results

```
Test Files  12 passed (12)
Tests       92 passed (92)
```

## Type Check
```
npx vue-tsc --noEmit  →  (no output, clean)
```

## Build
```
npm run build  →  dist/index.html  440.83 kB │ gzip: 154.72 kB  ✓
```

## CSV Layout Choice

**Single-sheet, two-row-type design** with a leading `type` column:

```
type,id,firstName,lastName,dob,gender,grade,room,studentId,year,term,round,date,weightKg,heightCm,gradeAtMeasure,roomAtMeasure
student,S001,สมชาย,ใจดี,1/1/2560,ชาย,ป.1,1,,,,,,,,, 
measure,,,,,,,,S001,2568,1,1,15/5/2568,25,120,ป.1,1
```

Rationale:
- One file, one sheet — easy to open in Excel/LibreOffice without column-switching.
- `type` discriminator allows `parseImport` to route each row cleanly.
- Blank cells in unused columns are harmless and preserve column alignment.
- A BOM (`﻿`) is prepended to the CSV blob so Thai text opens correctly in Windows Excel without encoding issues.

## Behaviour Summary

### backup.ts
- `serializeBackup` — JSON stringify with `version: 'ntr2-1'` plus students/measures/setup/period.
- `parseBackup` — validates version + shape, throws `'ไฟล์สำรองไม่ถูกต้อง'` on any failure, backfills missing `savedAt` via `Date.now()` (FR-9.4).

### csv.ts
- `toCsv` — single-sheet CSV with BOM for Excel compatibility.
- `parseImport` — validates measurement rows via `validateWeight` / `validateHeight` / `validateThaiDate`; invalid rows pushed to `skipped[]` with 1-based row number + reason.
- `mergeImport` — add new students, update existing by id; add measurements unless duplicate (same student+year+term+round); orphaned measurements (no matching student) counted and skipped.

### store additions (data.ts)
- `lastBackupAt` ref — persisted to `ntr2_backup_at`, fallback `0`.
- `backupOverdueDays` computed — whole days since last backup; returns `999999` when never backed up.
- `markBackup()` — sets `lastBackupAt = Date.now()` and persists.
- `replaceAll(parsed)` — replaces all four refs (students, measures, setup, period) and calls persist().

### SettingsView.vue
Ported prototype template/style verbatim. Wiring:
- **ข้อมูลโรงเรียน แก้ไข** → inline edit form → `saveSetup()`
- **ปีการศึกษา เปลี่ยน** → inline edit form → `setPeriod()`
- **💾 เก็บข้อมูลตอนนี้** → `serializeBackup` → Blob download → `markBackup()` → toast
- **⬇️ เลือกไฟล์** → hidden file input → `parseBackup` → confirm dialog → `replaceAll` → toast + `location.reload()`
- **📤 ส่งออกเป็นไฟล์** → `toCsv` → Blob CSV download → toast
- **📥 นำเข้าข้อมูล** → `emit('go', 'import')` (Task 14 wizard, placeholder)
- **เริ่มเลื่อนชั้น** → `emit('go', 'promotion')`
- **ล้างข้อมูลทั้งหมด** → type-to-confirm (`ลบข้อมูล`) → `localStorage.clear()` + `location.reload()`

## Screenshot
`.playwright-mcp/p3-t1112-settings.png` — Settings view on :5173, showing both goal groups (ข้อมูลของฉัน + แลกข้อมูลกับครูคนอื่น), config panels, and danger zone.

## Concerns / Notes
- None. All brief requirements implemented. No scope exceeded.
- `mergeImport` (csv.ts) takes a store-interface parameter to avoid circular imports between domain and store layers — same pattern as the rest of the domain layer.
- The restore confirm dialog matches the prototype exactly (inline callout, not a modal).
