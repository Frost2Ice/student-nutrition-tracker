## Task 4: Validation rules module

**Files:**
- Create: `src/domain/validation/rules.ts`
- Test: `tests/domain/rules.test.ts`

**Interfaces:**
- Consumes: `parseThaiDate` from `domain/date/thai-date`.
- Produces:
  ```ts
  function round1(n: number): number;                            // 1-decimal rounding
  function validateWeight(kg: number): string | null;            // null = ok, else Thai error
  function validateHeight(cm: number): string | null;
  function validateThaiDate(str: string, isDob: boolean): string | null;
  const WEIGHT_MIN = 5, WEIGHT_MAX = 150, HEIGHT_MIN = 40, HEIGHT_MAX = 210;
  ```

- [ ] **Step 1: Write failing tests**

```ts
// tests/domain/rules.test.ts
import { describe, it, expect } from 'vitest';
import { round1, validateWeight, validateHeight, validateThaiDate } from '../../src/domain/validation/rules';

describe('round1', () => {
  it('rounds to one decimal', () => {
    expect(round1(32.55)).toBe(32.6);
    expect(round1(32.04)).toBe(32);
    expect(round1(100)).toBe(100);
  });
});

describe('validateWeight', () => {
  it('accepts in-range', () => { expect(validateWeight(32.5)).toBeNull(); });
  it('accepts boundaries', () => {
    expect(validateWeight(5)).toBeNull();
    expect(validateWeight(150)).toBeNull();
  });
  it('rejects out-of-range with Thai message', () => {
    expect(validateWeight(250)).toContain('5');
    expect(validateWeight(4)).toContain('5');
  });
});

describe('validateHeight', () => {
  it('accepts boundaries', () => {
    expect(validateHeight(40)).toBeNull();
    expect(validateHeight(210)).toBeNull();
  });
  it('rejects out-of-range', () => { expect(validateHeight(250)).not.toBeNull(); });
});

describe('validateThaiDate', () => {
  it('accepts a valid BE date', () => { expect(validateThaiDate('15/5/2556', false)).toBeNull(); });
  it('rejects wrong segment count', () => { expect(validateThaiDate('2013-05-15', false)).not.toBeNull(); });
  it('rejects BE year out of dob range', () => { expect(validateThaiDate('15/5/2599', true)).not.toBeNull(); });
  it('rejects impossible day in month', () => { expect(validateThaiDate('31/2/2556', false)).not.toBeNull(); });
  it('rejects non-4-digit / pre-2400 year', () => { expect(validateThaiDate('15/5/556', false)).not.toBeNull(); });
});
```

- [ ] **Step 2: Run tests to verify failure**

Run: `npx vitest run tests/domain/rules.test.ts`
Expected: FAIL (module not found).

- [ ] **Step 3: Implement `src/domain/validation/rules.ts`**

```ts
export const WEIGHT_MIN = 5, WEIGHT_MAX = 150;
export const HEIGHT_MIN = 40, HEIGHT_MAX = 210;

export function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

export function validateWeight(kg: number): string | null {
  if (isNaN(kg)) return 'กรุณากรอกน้ำหนักเป็นตัวเลข';
  if (kg < WEIGHT_MIN || kg > WEIGHT_MAX)
    return `น้ำหนักต้องอยู่ระหว่าง ${WEIGHT_MIN}–${WEIGHT_MAX} กก.`;
  return null;
}

export function validateHeight(cm: number): string | null {
  if (isNaN(cm)) return 'กรุณากรอกส่วนสูงเป็นตัวเลข';
  if (cm < HEIGHT_MIN || cm > HEIGHT_MAX)
    return `ส่วนสูงต้องอยู่ระหว่าง ${HEIGHT_MIN}–${HEIGHT_MAX} ซม.`;
  return null;
}

export function validateThaiDate(str: string, isDob: boolean): string | null {
  if (!str) return 'กรุณากรอกวันที่';
  const p = str.split('/');
  if (p.length !== 3) return 'รูปแบบ: วัน/เดือน/ปีพ.ศ. เช่น 15/05/2556';
  const d = +p[0], m = +p[1], y = +p[2];
  if (isNaN(d) || isNaN(m) || isNaN(y)) return 'กรุณากรอกตัวเลขให้ครบถ้วน';
  if (p[2].length !== 4 || y < 2400) return 'ปีพ.ศ. ต้องเป็น 4 หลัก เช่น 2556';
  if (isDob && (y < 2540 || y > 2590)) return 'ปีเกิดต้องอยู่ระหว่าง พ.ศ. 2540–2590';
  if (m < 1 || m > 12) return 'เดือนต้องอยู่ระหว่าง 1–12';
  if (d < 1 || d > 31) return 'วันต้องอยู่ระหว่าง 1–31';
  const daysInMonth = new Date(y - 543, m, 0).getDate();
  if (d > daysInMonth) return `เดือน ${m} มีแค่ ${daysInMonth} วัน`;
  return null;
}
```

- [ ] **Step 4: Run tests to verify pass**

Run: `npx vitest run tests/domain/rules.test.ts`
Expected: PASS.

---

