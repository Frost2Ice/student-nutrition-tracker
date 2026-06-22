# Tasks 11–12 — Backup/Restore + CSV transfer + Settings (data-transfer + config)

Part of Phase 3. Build the data-transfer domain logic (TDD) and the real Settings screen
(two goal groups, ported from the prototype).

## Global constraints (HARD)
- `noUnusedLocals`. No git. No server start/kill (:5173). Editor tools only, no heredoc/echo.
- UX parity: port the prototype `<template>`/`<style>` verbatim; do not redesign.
- CSV import validates EVERY measurement row via `src/domain/validation/rules.ts` (the single
  source) — same rules as manual entry (FR-10.5).
- Restore = REPLACE all; Import = MERGE (new added, existing updated, duplicate measurements
  same student+year+term+round skipped). Keep these two clearly distinct.
- Reports vs Data Transfer boundary: Settings emits NO documents; it only moves data files.

## Files
- Create: `src/domain/transfer/backup.ts` + `tests/transfer/backup.test.ts`
- Create: `src/domain/transfer/csv.ts` + `tests/transfer/csv.test.ts`
- Modify: `src/stores/data.ts` (+ append to `tests/stores/data.test.ts`)
- Create: `src/features/SettingsView.vue` (port `src/prototype/SettingsView.vue`)
- Modify: `src/AppShell.vue` (render `SettingsView` for `dest === 'settings'`, replace placeholder)

## Domain — backup.ts (TDD)
- `serializeBackup(state: { students; measures; setup; period }): string` — JSON with a
  `version` field (use `'ntr2-1'`) plus the four arrays/objects.
- `parseBackup(text: string): { students: Student[]; measures: Measurement[]; setup: Setup;
  period: {year;term;round} }` — JSON.parse; throw `Error('ไฟล์สำรองไม่ถูกต้อง')` if shape is
  wrong; for any measure missing `savedAt`, assign `Date.now()` (FR-9.4).
- Test (from plan Task 11): round-trips a backup and repairs missing `savedAt`; setup.school survives.

## Domain — csv.ts (TDD)
- `toCsv(students: Student[], measures: Measurement[]): string` — full data, Excel-openable,
  one CSV with a header row. Include student fields + measurement fields; BE dates as stored.
  (Pick a clear single-sheet layout: a `type` column = `student` | `measure`, or two sections;
  document your choice in the report.)
- `parseImport(text: string): { rows: ParsedRow[]; skipped: { row: number; reason: string }[] }`
  — parse; for measurement rows validate `weightKg`/`heightCm`/`date` via
  `validateWeight/validateHeight/validateThaiDate`; invalid → push to `skipped` with the 1-based
  row number + reason; valid → `rows`.
- `mergeImport(store, parsed): { added: number; updated: number; skippedDup: number; orphans: number }`
  — add new students, update existing by id; add measurements unless a duplicate
  (same student+year+term+round) exists (skip those); measurement whose studentId has no
  student = orphan (skip + count). Use store actions.
- Test (from plan Task 12): an invalid weight row (999) is skipped with `{ row: 2 }`.

## Store additions (append tests to tests/stores/data.test.ts)
- `lastBackupAt` ref (persist key `ntr2_backup_at`, fallback `0`), `markBackup()` (set =
  `Date.now()` + persist), `backupOverdueDays` computed (whole days since last backup;
  if `lastBackupAt === 0` treat as overdue, e.g. return a large number).
- `replaceAll(parsed: { students; measures; setup; period })` — replace all four refs + persist.
- Add at least one test: `markBackup` then `backupOverdueDays === 0`.

## SettingsView (port + wire)
- Port `src/prototype/SettingsView.vue` template/style verbatim (two goal groups
  ข้อมูลของฉัน / แลกข้อมูลกับครูคนอื่น, config panels, danger reset).
- Wire:
  - ข้อมูลโรงเรียน "แก้ไข" → open an inline edit of `data.setup` (call `saveSetup`); ปีการศึกษา
    "เปลี่ยน" → edit `data.period` (call `setPeriod`). Simple inline forms or a dialog — keep light.
  - 💾 เก็บข้อมูลกันหาย → download `serializeBackup({students,measures,setup,period})` as a
    `.json`/backup file (Blob + temporary `<a>`), then `markBackup()`. Reminder line from
    `backupOverdueDays`.
  - ⬇️ ย้ายมาเครื่องนี้/กู้คืน → file input → `parseBackup` → the bad confirm → `replaceAll` →
    toast/reload. Show the "แทนที่ทั้งหมด" warning (it already exists in the port).
  - 📤 ส่งข้อมูลให้ครูคนอื่น → download `toCsv(students, measures)` as `.csv`.
  - 📥 รับข้อมูล/นำเข้า Excel → `emit('go','import')` (the wizard, Task 14).
  - งานประจำปี ขึ้นปีใหม่ → `emit('go','promotion')`.
  - ล้างข้อมูลทั้งหมด → type-to-confirm (`ลบข้อมูล`) → `localStorage.clear()` + `location.reload()`.
- AppShell: render `SettingsView` for `dest==='settings'`, wire `@go="go"`.

## Verify
- `npx vue-tsc --noEmit` clean; `npm test` full suite green (incl new transfer tests);
  `npm run build` succeeds.
- On :5173: Settings shows the two groups (styled — journeys.css is imported globally now);
  💾 downloads a file + updates the reminder; reset confirm gates on the typed word.
  Screenshot `.playwright-mcp/p3-t1112-settings.png`.

## Report contract
Write full report to `docs/superpowers/briefs/phase3-task-11-12-report.md` (status, files,
test results, build, your CSV layout choice, concerns). Return short summary + status.
