# Task 3 — Roster aggregates for browse (store)

Part of Phase 3. Adds the derived data the Students browse drill-down (grade → room →
student), Home, and Measure room-list all need: structure, per-room/grade counts +
measured progress, room rosters, and search.

## Global constraints
- `noUnusedLocals`. Vitest under `tests/**/*.test.ts`. No git. No server start/kill.
- "measured" is relative to the CURRENT `period` (year+term+round) via `latest`.

## Files
- Modify: `src/stores/data.ts`
- Test: `tests/stores/data.test.ts` (append; existing harness mocks localStorage + pinia)

## What exists now
- Store: `students`, `measures`, `period`, `latest` (computed `Map<studentId, Measurement>`
  from `latestPerStudent(measures)`), `setup.maxGrade`, `findStudent`.
- `src/domain/grade/ladder.ts` exports `GRADE_ORDER: string[]` (ordered อ.1..ป.6 etc).
- `Student` has `firstName`, `lastName`, `grade`, `room`, `id`.

## Required additions (export all from the store)
- `structure` computed: `{ grade: string; rooms: string[] }[]` — grades that appear in the
  registry, ordered by `GRADE_ORDER` (grades not in GRADE_ORDER sort last, stable); each
  grade's `rooms` = distinct room values for that grade, sorted numerically ascending.
- `roomInfo(grade: string, room: string): { total: number; measured: number }` —
  total = students whose grade+room match; measured = of those, how many have an entry in
  `latest` (i.e. `latest.value.has(student.id)`).
- `gradeInfo(grade: string): { total: number; measured: number; rooms: number }` —
  summed over the grade's rooms; `rooms` = count of rooms.
- `roomStudents(grade: string, room: string): Student[]` — students in that grade+room,
  sorted by `id` ascending.
- `searchStudents(q: string): Student[]` — `q` trimmed; match if `id` includes q OR
  `firstName + ' ' + lastName` includes q; return at most 30. Empty q → `[]`.

## Produces (later tasks depend on these EXACT names)
- `structure`, `roomInfo`, `gradeInfo`, `roomStudents`, `searchStudents`

## TDD steps
1. Append the plan's Task 3 Step 1 test to `tests/stores/data.test.ts` (sets period, adds 2
   students in ป.1/1, one measure for student 1, asserts `structure`, `roomInfo` `{total:2,
   measured:1}`, and `searchStudents('ค')[0].id === '2'`). Reuse the file's existing harness.
2. Run `npm test -- data.test` → FAIL.
3. Implement the computeds/functions; export them.
4. Run `npm test -- data.test` → PASS.
5. `npx vue-tsc --noEmit` → clean.

## Report contract
Write full report to `docs/superpowers/briefs/phase3-task-3-report.md`. Return short
summary + status.
