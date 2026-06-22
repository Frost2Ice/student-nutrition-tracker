# Task 10 — Measurement room worklist flow + duplicate gate

Part of Phase 3. Port the prototype Measure journey into the real app, wired to the store.

## Global constraints (HARD)
- `noUnusedLocals`. No git. No server start/kill (:5173). Editor tools only.
- UX parity: copy prototype `<template>`/`<style>` verbatim; do not redesign.
- Nutrition labels ONLY from `calcNutrition` (engine). Validation ONLY from `rules.ts`.
- Measurements snapshot grade/room at save time; `savedAt: Date.now()`.

## Files
- Create: `src/features/MeasureView.vue` (port `src/prototype/MeasureJourney.vue`; replace the
  first-gen MeasureView contents entirely)
- Move: `src/prototype/Stepper.vue` → `src/components/Stepper.vue` (update the import in the
  ported MeasureView and in any other file that imports the prototype Stepper). Do NOT delete
  the prototype copy yet if other prototype files still import it — instead create
  `src/components/Stepper.vue` (copy) and have the REAL views import the components one.
- Modify: `src/AppShell.vue` (render `MeasureView` for `dest === 'measure'`, replace placeholder)

## What exists now (read first)
- `src/prototype/MeasureJourney.vue` — pick-room (clickable rows + status pill + "นำเข้า Excel")
  → entry (live result pills, dup tag + "บันทึกทับ" gate) → ตรวจทาน → done. Round + date chosen
  at session start. Uses mock `CLASSES/CLASS_STUDENTS/mockAssess`.
- `src/stores/data.ts`: `structure`, `roomStudents(grade,room)`, `roomInfo`, `period`,
  `setPeriod`, `findDuplicate(id,year,term,round)`, `addMeasure`.
- `src/domain/nutrition/engine.ts`: `calcNutrition(student, measurement)`.
- `src/domain/validation/rules.ts`: `validateWeight`, `validateHeight`, `validateThaiDate`, `round1`.
- `Measurement` fields incl `gradeAtMeasure`, `roomAtMeasure`, `savedAt`.

## Wiring spec
1. Move Stepper to `src/components/Stepper.vue`; real MeasureView imports it from there.
2. Port template/style verbatim.
3. Session start: round selector + วันที่วัด. On entering a room, call `setPeriod({ year:
   data.period.year, term: data.period.term, round })` so the chosen round is the active period
   (year+term come from the current period; Measure only picks round + date).
4. Room list: from `structure` + `roomStudents`. Status pill = PERIOD-SCOPED measured count:
   for each room, `measured` = number of students in the room for whom
   `findDuplicate(id, period.year, period.term, round)` is non-null; `total` = room size.
   (Do NOT use the global `roomInfo.measured` here — it counts any-period.)
5. Entry rows: from `roomStudents(grade,room)`. Live result = `calcNutrition(student, {the row's
   weight/height as a Measurement-shaped object with current period+date})`; show wfh/wfa/hfa
   pills (null → "—" / ประเมินไม่ได้). Validate weight/height via rules.ts (show inline issues).
6. Duplicate gate: a student with `findDuplicate(id, period)` non-null shows the "วัดแล้วรอบนี้"
   tag; once weight+height entered, withhold the result behind a "บันทึกทับ" button (sets the
   row's `ok=true`) before it counts as ready — exactly as the prototype.
7. Save: for each filled+valid (and dup-confirmed) row, `addMeasure({ studentId, year, term,
   round, date, weightKg: round1(w), heightCm: round1(h), gradeAtMeasure: student.grade,
   roomAtMeasure: student.room, savedAt: Date.now() })`.
8. Excel-import mode: keep the prototype's review-screen UI but mark it clearly as wired in
   Task 12 (a small "(เชื่อมต่อในขั้นถัดไป)" note + disabled confirm is fine). Do NOT block manual mode.
9. AppShell: render MeasureView for `dest==='measure'`.

## Verify
- `npx vue-tsc --noEmit` clean; `npm run build` succeeds.
- On :5173 (seed a room with students): tap a room → enter weights/heights → live pills →
  a re-measured student shows the dup gate → save → returning to the room list shows the
  period-scoped status updated. Screenshot `.playwright-mcp/p3-t10-measure.png`.

## Report contract
Write full report to `docs/superpowers/briefs/phase3-task-10-report.md`. Return short summary + status.
