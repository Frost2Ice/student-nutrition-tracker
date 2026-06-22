# Task 2 — Duplicate measurement detection (store)

Part of Phase 3. Adds period-aware duplicate detection so the Measure flow and the
profile can warn before a second measurement is saved for the same student+period
(BRD §6.4 / FR-5.7). Duplicates remain ALLOWED after UI confirm; `latestPerStudent`
already resolves them by `savedAt`. This task does NOT change write behavior.

## Global constraints
- `noUnusedLocals`: no unused imports/vars. Tests are Vitest under `tests/**/*.test.ts`.
- Do not touch git. Do not start/kill any server.

## Files
- Modify: `src/stores/data.ts`
- Test: `tests/stores/data.test.ts` (ALREADY EXISTS from Task 1 — append to it; it mocks
  localStorage via `vi.stubGlobal` and sets active pinia in `beforeEach`)

## What exists now
- Store `useData` already has `period`, `setPeriod`, `addMeasure`, `measures`.
- `Measurement` has `studentId, year, term, round, date, weightKg, heightCm,
  gradeAtMeasure, roomAtMeasure, savedAt`.

## Required change
Add and export from the store:
`findDuplicate(studentId: string, year: string, term: Term, round: Round): Measurement | null`
— returns the first existing measurement matching studentId+year+term+round (ignoring
`savedAt`), else null. Import `Term`/`Round` types if needed (already imported in data.ts).

## Produces (later tasks depend on this EXACT name)
- store `findDuplicate(studentId, year, term, round)`

## TDD steps
1. Append to `tests/stores/data.test.ts` the test from the plan's Task 2 Step 1
   (adds one measure, expects `findDuplicate('1','2569','1','1')?.weightKg === 20` and
   `findDuplicate('1','2569','2','1')` === null). Use the existing imports/harness in that file.
2. Run `npm test -- data.test` → expect FAIL (`findDuplicate` undefined).
3. Implement `findDuplicate`; export it in the store return.
4. Run `npm test -- data.test` → expect PASS.
5. `npx vue-tsc --noEmit` → clean.

## Report contract
Write full report to `docs/superpowers/briefs/phase3-task-2-report.md` (status, files,
exact test line, tsc result, concerns). Return a short summary + status.
