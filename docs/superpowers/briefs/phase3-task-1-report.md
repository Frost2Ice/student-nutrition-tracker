# Phase 3 Task 1 — Report

## Status
DONE

## Files Changed
- `src/domain/types.ts` — Added `gradeAtMeasure: string` and `roomAtMeasure: string` to `Measurement` interface.
- `src/stores/data.ts` — Added `Term`/`Round` to imports; added `period` ref (loaded from `ntr2_period`, fallback `{ year: '', term: '1', round: '1' }`); added `setPeriod()` function; added `isSetup` computed; included `period` in `persist()`; exported `period`, `setPeriod`, `isSetup` from store.
- `tests/stores/data.test.ts` — Created (in `tests/stores/` because Vitest is configured for `tests/**`; brief said `src/stores/` but the Vitest include pattern `tests/**/*.test.ts` excludes `src/`). Uses `vi.stubGlobal('localStorage', ...)` mock (jsdom not installed).
- `src/features/MeasureView.vue` — Fixed two `Measurement` object literals to include `gradeAtMeasure: s.grade, roomAtMeasure: s.room` (direct type-error fix caused by adding required fields).
- `tests/domain/engine.test.ts` — Added `gradeAtMeasure: '', roomAtMeasure: ''` to two `Measurement` literals (type-error fix).
- `tests/domain/latest.test.ts` — Added `gradeAtMeasure: '', roomAtMeasure: ''` to base object in `mk()` helper (type-error fix).

## Test Result
```
 ✓ tests/domain/reference-data.test.ts  (5 tests) 8ms
 ✓ tests/stores/data.test.ts  (3 tests) 3ms

 Test Files  2 passed (2)
      Tests  8 passed (8)
```

## vue-tsc Result
Clean — no output, exit 0.

## Concerns
1. **Test file location**: The brief specifies `src/stores/data.test.ts` but Vitest's `include` pattern is `tests/**/*.test.ts`, so the file was placed at `tests/stores/data.test.ts` to be discovered. The misplaced `src/stores/data.test.ts` (created initially) was superseded; it is an empty artifact — recommend deleting it if it persists.
2. **jsdom not installed**: Used `vi.stubGlobal` to mock localStorage for the node environment. If jsdom is added later, the mock can be removed and the `// @vitest-environment jsdom` docblock restored.
3. **MeasureView.vue `save()`**: Added `const s = student.value!` (non-null assertion) before accessing `s.grade`/`s.room` in `save()`. The `validate()` function already guards `ctx.studentId` existence, so this is safe, but a future refactor might want explicit null-checking.
