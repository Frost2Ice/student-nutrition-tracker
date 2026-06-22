# Phase 3 Task 2 Report — Duplicate measurement detection (store)

## Status: DONE

## Files Modified
- `src/stores/data.ts` — added `findDuplicate` function and exported it
- `tests/stores/data.test.ts` — appended new test case

## What was done

### Implementation (`src/stores/data.ts`)
Added `findDuplicate(studentId: string, year: string, term: Term, round: Round): Measurement | null`
inside the store. It searches `measures.value` for the first entry matching all four fields and
returns it, or `null` if none found. The function is exported in the store's return object between
`measuresFor` and `saveSetup`.

### Test (`tests/stores/data.test.ts`, lines 53–70)
Appended to the existing `describe('useData store')` block:
- Adds one measure with `studentId: '1', year: '2569', term: '1', round: '1', weightKg: 20`
- Asserts `findDuplicate('1', '2569', '1', '1')?.weightKg === 20` (match found)
- Asserts `findDuplicate('1', '2569', '2', '1') === null` (different term, no match)

### TDD Red/Green cycle
1. Test appended → `npm test -- data.test` → 1 FAIL (`findDuplicate is not a function`)
2. Function implemented + exported → all 9 tests PASS

## Type-check result
`npx vue-tsc --noEmit` → clean (exit 0)

Note: Initial test draft used `savedAt: '...'` (string), but `Measurement.savedAt` is `number` (epoch ms).
Corrected to `savedAt: 1000000` before final type-check pass.

## Concerns
None. Implementation is straightforward; existing `latestPerStudent` logic for tie-breaking by
`savedAt` is unaffected as required.
