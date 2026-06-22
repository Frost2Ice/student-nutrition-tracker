# Task 8 Report: Nutrition Classification Engine

## Status
COMPLETE — all tests GREEN.

## TDD Evidence

### Step 1: Test written
File: `tests/domain/engine.test.ts`
6 tests across two describe blocks: `classifyWFH` (4) and `calcNutrition` (2).

### Step 2: RED (confirmed failure)
```
FAIL  tests/domain/engine.test.ts [ tests/domain/engine.test.ts ]
Error: Failed to load url ../../src/domain/nutrition/engine ... Does the file exist?
Test Files  1 failed (1)
Tests  no tests
```
Failure mode: module not found (engine.ts did not yet exist). Correct RED state.

### Step 3: Implementation written
File: `src/domain/nutrition/engine.ts`
Exact verbatim content from the brief.

### Step 4: GREEN (all pass)
```
✓ tests/domain/engine.test.ts  (6 tests) 2ms
Test Files  1 passed (1)
Tests  6 passed (6)
Duration  293ms
```

## Files Created
- `src/domain/nutrition/engine.ts` — the single shared classification engine
- `tests/domain/engine.test.ts` — 6 unit tests

## Functions Implemented
- `classifyWFH(gender, heightCm, weightKg): WfhLabel | null` — interpolates gender WFH table at exact height → 6 bands
- `classifyWFA(ref, weightKg): WfaLabel` — classifies weight-for-age against AgeRef
- `classifyHFA(ref, heightCm): HfaLabel` — classifies height-for-age against AgeRef
- `isTallProportionate(hfa, wfh): boolean` — checks if height is in normal range and weight-for-height is proportionate
- `calcNutrition(student, m): NutritionResult | null` — combines all; returns null when age < 24 months, no reference found, or not assessable; never defaults to สมส่วน

## Concerns
- None. Implementation is pure logic, no Vue dependencies, verbatim from brief.
- The `classifyWFH` boundary: weight exactly equal to `row[2]` (สมส่วน upper bound) falls into สมส่วน (< row[3] ท้วม). This is intentional per the brief's band ordering using strict `<` comparisons.
- `isTallProportionate` includes ท้วม in the "norm" weight band — this is intentional per the brief.
- `findRef` uses a ±6 month tolerance, so very edge ages may return null and calcNutrition will return null (correct behavior per brief: never default).
