# Task 7: Reference Lookup (`findRef`) — TDD Completion Report

## Status: ✅ COMPLETE

All tests passing. Implementation complete and verified.

## TDD Process Evidence

### Step 1: Test File Created
- **File**: `tests/domain/find-ref.test.ts`
- **Content**: Verbatim from brief (4 test cases)
- **Tests**:
  1. `returns exact-age male reference` — findRef('ชาย', 24) → AGE_DATA['M-24']
  2. `returns nearest within 6 months` — findRef('ชาย', 103) → AGE_DATA['M-100'] (3 months from 100)
  3. `returns null when nearest entry exceeds 6 months` — findRef('ชาย', 1) and findRef('ชาย', 999) → null
  4. `respects gender split` — findRef('หญิง', 24) → AGE_DATA['F-24']

### Step 2: Initial Test Run (RED)
```
Error: Failed to load url ../../src/domain/nutrition/reference/index
Does the file exist?
```
✅ Confirmed failure due to missing implementation.

### Step 3: Implementation Created
- **File**: `src/domain/nutrition/reference/index.ts`
- **Content**: Verbatim from brief
- **Logic**:
  - Accepts `gender` (Gender) and `ageMonths` (number)
  - Converts gender to prefix: 'ชาย' → 'M', 'หญิง' → 'F'
  - Iterates AGE_DATA keys, filters by gender prefix
  - Tracks nearest entry (minimum diff in age)
  - Returns best match if within ±6 months tolerance, else null
  - Re-exports AgeRef type

### Step 4: Final Test Run (GREEN)
```
✓ tests/domain/find-ref.test.ts  (4 tests) 1ms

Test Files  1 passed (1)
Tests  4 passed (4)
```
✅ All tests pass.

## Files Created

| File | Purpose |
|------|---------|
| `tests/domain/find-ref.test.ts` | Complete test suite (4 cases) |
| `src/domain/nutrition/reference/index.ts` | findRef implementation + AgeRef export |

## Implementation Summary

**Function Signature**:
```ts
export function findRef(gender: Gender, ageMonths: number): AgeRef | null
```

**Behavior**:
- Scans AGE_DATA keys for gender + age combinations (e.g., 'M-24', 'F-72')
- Finds nearest age entry to input `ageMonths`
- Returns that entry only if within ±6 months tolerance
- Returns null if no entry within tolerance or data is sparse
- Re-exports AgeRef type for consumers

**Key Design**:
- Pure logic, no side effects, no Vue dependencies
- Efficient O(n) scan of AGE_DATA keys
- Tolerance-based matching prevents stale/distant references
- Gender-aware filtering ensures correct reference tables

## Concerns

None. Implementation is straightforward, tests are comprehensive, and TDD process was followed exactly per the brief.

## Test Coverage

| Case | Input | Expected | Status |
|------|-------|----------|--------|
| Exact age male | ('ชาย', 24) | AGE_DATA['M-24'] | ✅ PASS |
| Nearest within tolerance | ('ชาย', 103) | AGE_DATA['M-100'] | ✅ PASS |
| Outside tolerance (low) | ('ชาย', 1) | null | ✅ PASS |
| Outside tolerance (high) | ('ชาย', 999) | null | ✅ PASS |
| Gender split | ('หญิง', 24) | AGE_DATA['F-24'] | ✅ PASS |

---
**Completed**: 2026-06-19  
**TDD Order**: Test → RED → Implementation → GREEN  
**No Git Operations**: Confirmed (task constraints)
