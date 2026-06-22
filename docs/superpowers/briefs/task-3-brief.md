## Task 3: Thai date module

**Files:**
- Create: `src/domain/date/thai-date.ts`
- Test: `tests/domain/thai-date.test.ts`

**Interfaces:**
- Produces:
  ```ts
  function parseThaiDate(str: string): Date | null;     // accepts BE (y>2500 ⇒ -543) or CE
  function formatThaiDate(d: Date): string;             // "D/M/YYYY" BE
  function getAgeMonths(dob: string, measureDate: string): number | null;
  function todayThai(): string;                          // "D/M/YYYY" BE today
  ```

- [ ] **Step 1: Write failing tests**

```ts
// tests/domain/thai-date.test.ts
import { describe, it, expect } from 'vitest';
import { parseThaiDate, formatThaiDate, getAgeMonths, todayThai } from '../../src/domain/date/thai-date';

describe('parseThaiDate', () => {
  it('parses BE date (year > 2500 → -543)', () => {
    const d = parseThaiDate('15/5/2556')!;
    expect(d.getFullYear()).toBe(2013);
    expect(d.getMonth()).toBe(4); // May = index 4
    expect(d.getDate()).toBe(15);
  });
  it('returns null for malformed input', () => {
    expect(parseThaiDate('2013-05-15')).toBeNull();
    expect(parseThaiDate('')).toBeNull();
  });
});

describe('formatThaiDate', () => {
  it('formats to D/M/YYYY in BE', () => {
    expect(formatThaiDate(new Date(2013, 4, 15))).toBe('15/5/2556');
  });
});

describe('getAgeMonths', () => {
  it('computes whole months between dob and measurement', () => {
    expect(getAgeMonths('15/5/2556', '15/5/2560')).toBe(48);
  });
  it('subtracts a month when measurement day precedes birth day', () => {
    expect(getAgeMonths('15/5/2556', '14/5/2560')).toBe(47);
  });
  it('returns null for negative age', () => {
    expect(getAgeMonths('15/5/2560', '15/5/2556')).toBeNull();
  });
  it('returns null for bad dates', () => {
    expect(getAgeMonths('bad', '15/5/2560')).toBeNull();
  });
});
```

- [ ] **Step 2: Run tests to verify failure**

Run: `npx vitest run tests/domain/thai-date.test.ts`
Expected: FAIL ("Cannot find module" / functions undefined).

- [ ] **Step 3: Implement `src/domain/date/thai-date.ts`**

```ts
export function parseThaiDate(str: string): Date | null {
  if (!str) return null;
  const p = str.split('/');
  if (p.length !== 3) return null;
  const d = +p[0], m = +p[1], y = +p[2];
  if (isNaN(d) || isNaN(m) || isNaN(y)) return null;
  const ce = y > 2500 ? y - 543 : y;
  return new Date(ce, m - 1, d);
}

export function formatThaiDate(d: Date): string {
  return `${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear() + 543}`;
}

export function getAgeMonths(dob: string, measureDate: string): number | null {
  const b = parseThaiDate(dob), m = parseThaiDate(measureDate);
  if (!b || !m) return null;
  let months = (m.getFullYear() - b.getFullYear()) * 12 + (m.getMonth() - b.getMonth());
  if (m.getDate() < b.getDate()) months--;
  return months < 0 ? null : months;
}

export function todayThai(): string {
  return formatThaiDate(new Date());
}
```

- [ ] **Step 4: Run tests to verify pass**

Run: `npx vitest run tests/domain/thai-date.test.ts`
Expected: PASS.

---

