# Phase 3 Task 3 Report — Roster aggregates for browse (store)

## Status: DONE

## What was done

Appended a failing test to `tests/stores/data.test.ts` covering all five new APIs:
`structure`, `roomInfo`, `gradeInfo`, `roomStudents`, `searchStudents`.

Implemented all five in `src/stores/data.ts`:
- `structure` (computed): grades ordered by `GRADE_ORDER`, rooms sorted numerically per grade.
- `roomInfo(grade, room)`: total + measured count using `latest` Map.
- `gradeInfo(grade)`: sums roomInfo across all rooms for the grade, plus room count.
- `roomStudents(grade, room)`: filtered + sorted by `id` ascending.
- `searchStudents(q)`: trims q, matches id or full name, max 30 results, empty q returns [].

All five are exported from the store's return object.

## Minor correction during TDD

The initial test used `sex` and `birthdate` field names — fixed to `gender` and `dob` to match
the `Student` interface in `src/domain/types.ts`.

## Verification

- `npm test -- data.test`: 10/10 tests pass (2 test files)
- `npx vue-tsc --noEmit`: clean, no errors

## Files modified

- `src/stores/data.ts` — added `GRADE_ORDER` import + 5 new computed/functions + exports
- `tests/stores/data.test.ts` — appended Task 3 test case
