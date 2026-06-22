## Task 7: Reference lookup (`findRef`)

**Files:**
- Create: `src/domain/nutrition/reference/index.ts`
- Test: `tests/domain/find-ref.test.ts`

**Interfaces:**
- Consumes: `AGE_DATA`, `AgeRef` from `./age-data`; `Gender` from `domain/types`.
- Produces:
  ```ts
  function findRef(gender: Gender, ageMonths: number): AgeRef | null; // nearest within ±6 months, else null
  ```

- [ ] **Step 1: Write failing tests**

```ts
// tests/domain/find-ref.test.ts
import { describe, it, expect } from 'vitest';
import { findRef } from '../../src/domain/nutrition/reference/index';
import { AGE_DATA } from '../../src/domain/nutrition/reference/age-data';

describe('findRef', () => {
  it('returns exact-age male reference', () => {
    expect(findRef('ชาย', 24)).toEqual(AGE_DATA['M-24']);
  });
  it('returns nearest within 6 months', () => {
    // legacy data jumps M-100 → M-108; age 103 is 3 months from 100
    expect(findRef('ชาย', 103)).toEqual(AGE_DATA['M-100']);
  });
  it('returns null when nearest entry exceeds 6 months', () => {
    // M-100 → M-108 gap: age 104 is 4 from 108 (closer) within tolerance; pick a true gap
    expect(findRef('ชาย', 1)).toBeNull();   // far below 24
    expect(findRef('ชาย', 999)).toBeNull(); // far above max
  });
  it('respects gender split', () => {
    expect(findRef('หญิง', 24)).toEqual(AGE_DATA['F-24']);
  });
});
```

- [ ] **Step 2: Run tests to verify failure**

Run: `npx vitest run tests/domain/find-ref.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement `src/domain/nutrition/reference/index.ts`**

```ts
import type { Gender } from '../../types';
import { AGE_DATA, type AgeRef } from './age-data';

export function findRef(gender: Gender, ageMonths: number): AgeRef | null {
  const g = gender === 'ชาย' ? 'M' : 'F';
  let best: AgeRef | null = null;
  let bestDiff = 999;
  for (const key of Object.keys(AGE_DATA)) {
    const [gk, am] = key.split('-');
    if (gk !== g) continue;
    const diff = Math.abs(+am - ageMonths);
    if (diff < bestDiff) { bestDiff = diff; best = AGE_DATA[key]; }
  }
  return bestDiff <= 6 ? best : null;
}

export type { AgeRef };
```

- [ ] **Step 4: Run tests to verify pass**

Run: `npx vitest run tests/domain/find-ref.test.ts`
Expected: PASS.

---

