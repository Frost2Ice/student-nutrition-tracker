# Task 13 — Promotion wizard + promotion ops

Part of Phase 3. The flagship annual workflow: promote everyone a grade, graduate the
top grade (export-out first), with per-student overrides. Port the prototype wizard, add
the promotion domain logic (TDD).

## Global constraints (HARD)
- `noUnusedLocals`. No git. No server start/kill (:5173). Editor tools only, no heredoc/echo.
- UX parity: port prototype `<template>`/`<style>` verbatim; do not redesign.
- Graduate export is REQUIRED before finishing (the prototype enforces this — keep it).

## Files
- Create: `src/domain/promotion/promote.ts` + `tests/promotion/promote.test.ts`
- Create: `src/features/PromotionView.vue` (port `src/prototype/PromotionJourney.vue`)
- Modify: `src/AppShell.vue` (render `PromotionView` for `overlay === 'promotion'`, replace placeholder)

## What exists now (read first)
- `src/prototype/PromotionJourney.vue` — 6 steps: เริ่มต้น → สำรองข้อมูล → ตรวจสอบ (per-student
  override: เลื่อนปกติ/ซ้ำชั้น/จบการศึกษา + ห้องใหม่) → ผู้จบการศึกษา (required export) → ยืนยัน →
  เสร็จสิ้น. Emits `done`, `exit`. Mock data.
- `src/domain/grade/ladder.ts`: `promote(grade)`, `demote(grade)`, `isMaxGrade(grade, maxGrade)`,
  `GRADE_ORDER`.
- `src/domain/transfer/backup.ts`: `serializeBackup(state)`; `src/domain/transfer/csv.ts`: `toCsv`.
- `src/stores/data.ts`: `students`, `updateStudent`, `deleteStudent`, `setup.maxGrade`,
  `period`, `setPeriod`, `markBackup`, `setup`, `measures`. (Add a bulk helper only if needed.)

## Domain — promote.ts (TDD)
- `planPromotion(students: {id;grade}[], maxGrade: string): { promote: Student[]; graduate: Student[] }`
  — students at `maxGrade` (use `isMaxGrade`) → `graduate`; others → `promote`.
- `applyPromotion(store, decisions): void` — `decisions` is a map studentId →
  `{ action: 'promote'|'repeat'|'graduate'; room?: string }`. For each student:
  - `promote` → `updateStudent(id, { grade: promote(grade), room: room ?? grade-room })`
  - `repeat` → leave grade; set room if provided
  - `graduate` → `deleteStudent(id)`
  Default (no decision) = promote for non-max, graduate for max (from `planPromotion`).
- Test (from plan Task 13): `planPromotion([{id:'1',grade:'ป.6'},{id:'2',grade:'ป.1'}],'ป.6')`
  → `graduate` ids `['1']`, `promote` ids `['2']`.

## PromotionView wiring
- Port template/style verbatim.
- Step สำรองข้อมูล → call `serializeBackup({students,measures,setup,period})` download + `markBackup()`.
- Step ตรวจสอบ → `planPromotion(data.students, data.setup.maxGrade)`; show grouped summary +
  per-student override controls writing into a local `decisions` map.
- Step ผู้จบการศึกษา → REQUIRED download of the graduates via
  `toCsv(graduateStudents, measuresOfGraduates)`; the "ถัดไป" stays disabled until downloaded
  (keep the prototype's gating). Filename like `รายชื่อนักเรียนจบการศึกษา ปีการศึกษา <year>.xlsx`
  (a .csv blob is fine for the prototype-real bridge; keep the label).
- Step ยืนยัน → `applyPromotion(data, decisions)` then `setPeriod({ year: String(+data.period.year+1),
  term: '1', round: '1' })`. เสร็จสิ้น → emit `done`.
- AppShell: render `PromotionView` for `overlay==='promotion'`, `@done="closeOverlay"`,
  `@exit="closeOverlay"`.

## Verify
- `npx vue-tsc --noEmit` clean; `npm test` full suite green (incl promote tests); `npm run build` ok.
- On :5173: open เลื่อนชั้นปีใหม่ (Home quick link or Settings) → walk the 6 steps; graduate
  export gates the Next; finishing advances the year. Screenshot `.playwright-mcp/p3-t13-promotion.png`.

## Report contract
Write full report to `docs/superpowers/briefs/phase3-task-13-report.md`. Return short summary + status.
