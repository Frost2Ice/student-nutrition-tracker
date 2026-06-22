# Tasks 7–9 — StudentsView: browse + profile + 3 charts + registry CRUD + measurement mgmt

Part of Phase 3. Build the real Students surface by porting the prototype
`StudentProfileView.vue` VERBATIM (template + style) into `src/features/StudentsView.vue`,
then wiring every mock to the store and the real domain. These three plan tasks share one
component, so they are done together.

## Global constraints (HARD)
- `noUnusedLocals`. No git. No server start/kill (:5173 is the user's). Editor tools only.
- UX parity: copy the prototype `<template>`/`<style>` verbatim; do not redesign.
- **Nutrition labels come ONLY from `calcNutrition`** (engine). Never hand-write a label.
- **Growth charts MUST use `src/features/charts.ts` `buildWfh/buildHfa/buildWfa`** — do NOT
  draw your own SVG/zones. Those builders are the audited, exactness-locked source (BRD §6.2);
  the chart zone a point sits in must equal the engine's text, and a test already enforces it.
  Set `animation: false` (the builders already do). Destroy + recreate Chart instances on
  student/metric change to avoid canvas reuse errors.
- Thai BE dates; validation via `src/domain/validation/rules.ts` ONLY.
- Grade/room live on the student master; measurements snapshot grade/room at save time.

## Files
- Create: `src/features/StudentsView.vue` (port of `src/prototype/StudentProfileView.vue`)
- Modify: `src/AppShell.vue` (render `StudentsView` for `dest === 'students'`, replace placeholder)

## What exists now (read first)
- `src/prototype/StudentProfileView.vue` — the full UX: browse drill-down (grades→rooms→
  students with `ภาวะล่าสุด` column + `เฉพาะกลุ่มเสี่ยง` filter), search shortcut, rich profile
  (header w/ แก้ไข/ลบ, latest pills, growth chart + metric toggle, editable history table with
  per-row แก้ไข/ลบ + "+ บันทึกการวัด"), student add/edit dialog, grade/room-change confirm,
  measurement add/edit dialog, delete confirms, toast. All on mock data.
- `src/stores/data.ts`: `students`, `addStudent`, `updateStudent`, `deleteStudent`,
  `measuresFor(id)`, `addMeasure`, `deleteMeasure`, `findDuplicate`, `period`, `structure`,
  `roomInfo`, `gradeInfo`, `roomStudents`, `searchStudents`, `latest`.
- `src/domain/nutrition/engine.ts`: `calcNutrition(student, measurement)` →
  `{ wfa, hfa, wfh, tall, ageMonths, bmi } | null`. Labels are the WFH/WFA/HFA Thai strings.
- `src/features/charts.ts`: `buildWfh/buildHfa/buildWfa(student, measures)` → Chart.js config.
- `src/domain/date/thai-date.ts`: `getAgeMonths(dob, date)`.
- `Student`: id, firstName, lastName, dob, gender, grade, room.
- `Measurement`: studentId, year, term, round, date, weightKg, heightCm, gradeAtMeasure,
  roomAtMeasure, savedAt.

## Wiring spec
### Browse (Task 7)
- grades/rooms/students from `structure`, `gradeInfo(grade)`, `roomInfo(grade,room)`,
  `roomStudents(grade,room)`. Search → `searchStudents(q)`.
- Room-list `ภาวะล่าสุด` per student: take the student's latest measurement
  (`latest.get(id)` or newest of `measuresFor(id)`); if none → pill `ยังไม่วัด` (neutral);
  else `calcNutrition(student, m)` → use `wfh` label, color good for `สมส่วน`, warn for
  `ค่อนข้างผอม/ท้วม/เริ่มอ้วน`, bad for `ผอม/อ้วน`; null result → `ประเมินไม่ได้` neutral.
- `เฉพาะกลุ่มเสี่ยง` filter: keep students whose computed status is warn/bad. `roomRiskCount`
  = count of those in the room.
- Clicking a student row sets `open = student`.

### Profile (Task 8)
- Header: name = first+last, `รหัส id · gender · เกิด dob · อายุ` from `getAgeMonths`
  (format years/months). Current class pill from grade/room.
- Latest assessment pills: from `calcNutrition` of the latest measurement (wfh, wfa, hfa,
  and tall → `สูงดีสมส่วน`/`ไม่สมส่วน`). Color by each label.
- Charts: render THREE charts WFH/HFA/WFA using `buildWfh/buildHfa/buildWfa(open, measuresFor(open.id))`.
  Keep the prototype's segmented metric toggle (show one at a time) OR stack all three — your
  choice, but all three must exist. Use `<canvas>` + `new Chart(...)`; destroy on change.
- Registry edit/delete: แก้ไขข้อมูล opens the student dialog prefilled; ลบ → confirm →
  `deleteStudent(id)` → close profile. Add (from room list "+ เพิ่มนักเรียน") opens the dialog
  empty with grade/room prefilled to the current room. Save → validate (id unique among
  `data.students` for add; dob via `validateThaiDate(dob,true)`) → `addStudent`/`updateStudent`.
  Grade/room change on edit → show the lightweight confirm BEFORE `updateStudent` (copy from
  prototype's `gradeConfirm`).

### Measurement management (Task 9)
- History table from `measuresFor(open.id)` sorted newest-first (by year→term→round→savedAt);
  each row shows period, date, `gradeAtMeasure`, weight, height, and `calcNutrition` labels
  (wfh + tall). Per-row แก้ไข/ลบ.
- "+ บันทึกการวัด" / edit dialog: fields date, weightKg, heightCm. Validate via rules.ts.
  Save (add): build Measurement with current `period`, `gradeAtMeasure`/`roomAtMeasure` =
  student's current grade/room, `savedAt: Date.now()`; if `findDuplicate(id, period...)` exists,
  show a confirm/warn before adding. Edit = `deleteMeasure(old)` then `addMeasure(new)`.
  Delete → confirm → `deleteMeasure(row)`. Re-render charts after any change.

## Verify (do all)
- `npx vue-tsc --noEmit` clean; `npm run build` succeeds.
- On :5173 with seeded data (add a student + a couple measurements if store is empty):
  1. Drill grade→room→list; status column + risk filter work. Screenshot `.playwright-mcp/p3-t79-browse.png`.
  2. Open a profile: all THREE charts render (not blank), latest pills correct.
     Screenshot `.playwright-mcp/p3-t79-profile.png`.
  3. Add a measurement → row + charts update. Edit a student's room → confirm appears.
  4. Spot-check ONE student: the WFH pill text in the room list equals the WFH label shown on
     the profile (same engine path) — note this in the report.

## Report contract
Write full report to `docs/superpowers/briefs/phase3-task-7-9-report.md` (status, files, tsc +
build, what you verified incl the chart-renders-not-blank check and the label-consistency
spot-check, concerns). Return short summary + status.
