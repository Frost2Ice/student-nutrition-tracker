## Task 9: Latest-measurement comparator

**Files:**
- Create: `src/domain/nutrition/latest.ts`
- Test: `tests/domain/latest.test.ts`

**Interfaces:**
- Consumes: `Measurement` from `domain/types`.
- Produces:
  ```ts
  function isNewerMeasure(m: Measurement, prev: Measurement | null): boolean; // year→term→round→savedAt
  function latestPerStudent(ms: Measurement[]): Map<string, Measurement>;     // keyed by studentId
  ```

- [ ] **Step 1: Write failing tests**

```ts
// tests/domain/latest.test.ts
import { describe, it, expect } from 'vitest';
import { isNewerMeasure, latestPerStudent } from '../../src/domain/nutrition/latest';
import type { Measurement } from '../../src/domain/types';

const mk = (over: Partial<Measurement>): Measurement => ({
  studentId: '1', year: '2560', term: '1', round: '1', date: '1/1/2560', weightKg: 20, heightCm: 110, savedAt: 1, ...over,
});

describe('isNewerMeasure', () => {
  it('true when prev is null', () => { expect(isNewerMeasure(mk({}), null)).toBe(true); });
  it('compares by year first', () => { expect(isNewerMeasure(mk({ year: '2561' }), mk({ year: '2560' }))).toBe(true); });
  it('then term', () => { expect(isNewerMeasure(mk({ term: '2' }), mk({ term: '1' }))).toBe(true); });
  it('then round', () => { expect(isNewerMeasure(mk({ round: '2' }), mk({ round: '1' }))).toBe(true); });
  it('then savedAt tie-break', () => { expect(isNewerMeasure(mk({ savedAt: 9 }), mk({ savedAt: 5 }))).toBe(true); });
  it('false when older', () => { expect(isNewerMeasure(mk({ year: '2559' }), mk({ year: '2560' }))).toBe(false); });
});

describe('latestPerStudent', () => {
  it('keeps the newest record per student', () => {
    const a1 = mk({ studentId: 'A', round: '1', savedAt: 1 });
    const a2 = mk({ studentId: 'A', round: '2', savedAt: 2 });
    const b1 = mk({ studentId: 'B', savedAt: 1 });
    const map = latestPerStudent([a1, a2, b1]);
    expect(map.get('A')).toBe(a2);
    expect(map.get('B')).toBe(b1);
    expect(map.size).toBe(2);
  });
});
```

- [ ] **Step 2: Run tests to verify failure**

Run: `npx vitest run tests/domain/latest.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement `src/domain/nutrition/latest.ts`**

```ts
import type { Measurement } from '../types';

export function isNewerMeasure(m: Measurement, prev: Measurement | null): boolean {
  if (!prev) return true;
  if (+m.year !== +prev.year) return +m.year > +prev.year;
  if (+m.term !== +prev.term) return +m.term > +prev.term;
  if (+m.round !== +prev.round) return +m.round > +prev.round;
  return (m.savedAt || 0) > (prev.savedAt || 0);
}

export function latestPerStudent(ms: Measurement[]): Map<string, Measurement> {
  const map = new Map<string, Measurement>();
  for (const m of ms) {
    const prev = map.get(m.studentId) ?? null;
    if (isNewerMeasure(m, prev)) map.set(m.studentId, m);
  }
  return map;
}
```

- [ ] **Step 4: Run tests to verify pass**

Run: `npx vitest run tests/domain/latest.test.ts`
Expected: PASS.

---

