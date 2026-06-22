# Task 1 — Measurement snapshot fields + academic period + setup flag

Part of Phase 3 (building the real app on the finished domain engine + Pinia store).
This is the foundation task: it extends the data model and store so later tasks have
academic-period state, a setup-complete flag, and per-measurement class snapshots.

## Global constraints (apply to this task)
- `tsconfig` has `noUnusedLocals` — unused imports/vars fail `vue-tsc`. Remove them.
- Thai BE dates `D/M/YYYY`; academic year numbered by start year.
- Grade/room live ONLY on the current student master record; measurements are immutable
  snapshots — hence the new `gradeAtMeasure`/`roomAtMeasure` fields.
- Tests are Vitest, beside source as `*.test.ts`, run with `npm test`.

## Files
- Modify: `src/domain/types.ts`
- Modify: `src/stores/data.ts`
- Test: `src/stores/data.test.ts` (create)

## What exists now (read first)
- `src/domain/types.ts`: `Student`, `Measurement`, `Setup`, `Gender`, `Term`, `Round`.
  NOTE the current `Measurement` has NO grade/room fields, and `Setup` has NO
  year/term/round.
- `src/stores/data.ts`: Pinia setup-store `useData` with `students/measures/setup`
  refs, `persist()`, CRUD, `latest`, `stats`. Persists keys `ntr2_students`,
  `ntr2_measures`, `ntr2_setup`.

## Required changes
1. `Measurement` gains: `gradeAtMeasure: string`, `roomAtMeasure: string`.
2. `Setup` is unchanged here (period is SEPARATE, not on Setup). Do not add year/term/round
   to Setup.
3. Store: add a `period` ref `{ year: string; term: Term; round: Round }`, loaded from
   localStorage key `ntr2_period`, fallback `{ year: '', term: '1', round: '1' }`.
4. Store: add `setPeriod(p: { year: string; term: Term; round: Round })` — assigns + persists.
5. Store: add `isSetup` computed — `setup.value.school.trim() !== ''`.
6. Include `period` in `persist()`; return `period`, `setPeriod`, `isSetup` from the store.

## Produces (later tasks depend on these EXACT names)
- `Measurement.gradeAtMeasure`, `Measurement.roomAtMeasure`
- store `period`, `setPeriod(p)`, `isSetup`

## TDD steps
1. Write `src/stores/data.test.ts` exactly as in the plan's Task 1 Step 1 (3 tests:
   defaults not-setup, becomes setup after saveSetup with a school, period store+update).
   The test imports `setActivePinia, createPinia` from `pinia` and `useData` from `./data`;
   `beforeEach` clears localStorage + sets active pinia.
2. Run `npm test -- data.test` → expect FAIL (`setPeriod`/`isSetup` undefined).
3. Implement the changes above.
4. Run `npm test -- data.test` → expect PASS.
5. Run `npx vue-tsc --noEmit` → expect clean. If any existing consumer references a removed
   field, fix it. (Existing store code does not reference period fields, so this should be clean.)

## Report contract
Write your full report to `docs/superpowers/briefs/phase3-task-1-report.md`:
status (DONE / DONE_WITH_CONCERNS / NEEDS_CONTEXT / BLOCKED), files changed, the exact
`npm test -- data.test` result line and `vue-tsc` result, and any concerns. Return only a
short summary + status here.
