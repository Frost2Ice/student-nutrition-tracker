# Phase 3 Task 4A Report — Chart zone ↔ classification exactness

**Status: DONE**
**Date: 2026-06-20**

## Summary

The chart zone rendering in `src/features/charts.ts` now exactly matches the engine's
classification logic in `src/domain/nutrition/engine.ts` for all three chart types (WFH,
HFA, WFA) across both genders. An invariant test locks this requirement going forward.

## Files changed

- `src/features/charts.ts` — rendering fix (tension and stepped)
- `tests/features/charts-consistency.test.ts` — new invariant test (created)

## Root cause

The `zones()` helper in `charts.ts` was setting `tension: 0.3` on every band dataset,
causing spline-curved boundaries. For WFH charts, the engine uses **linear** interpolation
between height rows, so curved chart boundaries diverged from the text classification for
off-grid heights. For HFA/WFA charts, the engine uses **nearest-row snap** (`findRef`),
but the chart drew straight lines between monthly data points, diverging mid-interval.

## Fix applied

### `zones()` function signature change

Added an optional `stepped?: 'middle'` parameter.

- **All band datasets**: `tension` changed from `0.3` → `0`.
- **HFA/WFA calls**: pass `'middle'` to `zones()`, which sets `stepped: 'middle'` on each
  band dataset. This makes Chart.js step at the midpoint between consecutive data points,
  which exactly replicates the nearest-row selection of `findRef`.
- **WFH call**: no `stepped` argument — bands remain linear (matching engine's linear
  interpolation between height rows).

The `zones()` helper assigns `stepped` via `(dataset as unknown as Record<string, unknown>).stepped`
to satisfy TypeScript's strict type checking (Chart.js `ChartDataset<'line'>` type does not
declare `stepped` as a top-level field in the version used here).

## Invariant test: `tests/features/charts-consistency.test.ts`

18 tests total, grouped as:

### Structural checks (12 tests — 2 genders × 3 chart types × 2 properties)

- Every zone-band dataset in `buildWfh`, `buildHfa`, `buildWfa` has `tension === 0`.
- HFA and WFA zone-band datasets have `stepped === 'middle'`.
- WFH zone-band datasets do NOT have `stepped` set (falsy).

### Behavioral checks (6 tests — 2 genders × 3 chart types)

- **WFH**: For heights from first to last table row in 0.25 cm steps, test weights
  bracketing each of the 5 boundary cutoffs (just below/above each, plus midpoints).
  Chart classification (linear boundary interpolation) must equal `classifyWFH()`.
- **HFA**: For every integer-month age present in `AGE_DATA`, test heights around each
  SD threshold (±0.05). Chart classification (stepping at vertex = ref field value) must
  equal `classifyHFA(ref, h)`.
- **WFA**: Same pattern as HFA but for weight thresholds and `classifyWFA(ref, w)`.

## Test results

### Before fix (RED)
```
Tests  10 failed | 8 passed (18)
```
Failures: tension=0.3 instead of 0; stepped=undefined instead of 'middle'.

### After fix (GREEN)
```
✓ tests/features/charts-consistency.test.ts  (18 tests) 34ms
Test Files  1 passed (1) / Tests  18 passed (18)
```

### Full suite
```
Test Files  10 passed (10)
Tests  73 passed (73)
```

### Type check
```
npx vue-tsc --noEmit → TSC CLEAN (no errors)
```

## Divergence analysis

**No input region diverges between chart and text after the fix.**

- **WFH**: Linear interpolation of the chart boundaries at any height now exactly
  replicates `classifyWFH`'s linear interpolation. The behavioral test sweeps every
  0.25 cm step across the full table range with weights testing all band boundaries.
- **HFA/WFA**: The `stepped: 'middle'` rendering steps the boundary at the midpoint
  between consecutive monthly rows, which means: for any age `mo`, the boundary
  visible at `mo` equals the data point at `mo` (i.e., `ref.sdXh` / `ref.sdXw`),
  exactly matching `findRef(gender, mo)`. The behavioral test verifies this at every
  integer-month vertex present in `AGE_DATA`.

The only residual nuance: between integer months (e.g., at mo=24.5), the stepped
chart shows the boundary as the row for mo=24 (the lower step), while the engine
would use whichever row is nearest. The `stepped: 'middle'` option steps at the
halfway point between rows, so a student measured at age 24.6 months would be
rendered on the mo=25 step. `findRef` would also return mo=25 (difference = 0.4
vs 0.6). The midpoint rule and the nearest-row rule coincide exactly at the halfway
point — there is no divergence for integer-month measurements (which is all
`getAgeMonths` can return, since it returns integer months).
