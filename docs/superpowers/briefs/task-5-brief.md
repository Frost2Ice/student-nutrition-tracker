## Task 5: Grade ladder module

**Files:**
- Create: `src/domain/grade/ladder.ts`
- Test: `tests/domain/ladder.test.ts`

**Interfaces:**
- Produces:
  ```ts
  const GRADE_ORDER: string[]; // ['อ.1',...,'ม.6']
  function promote(grade: string): string;        // next grade; same grade if at top/unknown
  function demote(grade: string): string;          // previous grade; same if at bottom/unknown
  function isMaxGrade(grade: string, maxGrade: string): boolean;
  ```

- [ ] **Step 1: Write failing tests**

```ts
// tests/domain/ladder.test.ts
import { describe, it, expect } from 'vitest';
import { GRADE_ORDER, promote, demote, isMaxGrade } from '../../src/domain/grade/ladder';

describe('grade ladder', () => {
  it('has 15 grades in order', () => {
    expect(GRADE_ORDER[0]).toBe('อ.1');
    expect(GRADE_ORDER[GRADE_ORDER.length - 1]).toBe('ม.6');
    expect(GRADE_ORDER).toHaveLength(15);
  });
  it('promotes across bands (อ.3 → ป.1)', () => { expect(promote('อ.3')).toBe('ป.1'); });
  it('promotes within band (ป.1 → ป.2)', () => { expect(promote('ป.1')).toBe('ป.2'); });
  it('does not promote past the top', () => { expect(promote('ม.6')).toBe('ม.6'); });
  it('returns same grade for unknown input', () => { expect(promote('zzz')).toBe('zzz'); });
  it('demotes (ป.1 → อ.3)', () => { expect(demote('ป.1')).toBe('อ.3'); });
  it('does not demote past the bottom', () => { expect(demote('อ.1')).toBe('อ.1'); });
  it('detects max grade', () => {
    expect(isMaxGrade('ป.6', 'ป.6')).toBe(true);
    expect(isMaxGrade('ป.5', 'ป.6')).toBe(false);
  });
});
```

- [ ] **Step 2: Run tests to verify failure**

Run: `npx vitest run tests/domain/ladder.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement `src/domain/grade/ladder.ts`**

```ts
export const GRADE_ORDER: string[] = [
  'อ.1', 'อ.2', 'อ.3',
  'ป.1', 'ป.2', 'ป.3', 'ป.4', 'ป.5', 'ป.6',
  'ม.1', 'ม.2', 'ม.3', 'ม.4', 'ม.5', 'ม.6',
];

export function promote(grade: string): string {
  const i = GRADE_ORDER.indexOf(grade);
  if (i === -1 || i === GRADE_ORDER.length - 1) return grade;
  return GRADE_ORDER[i + 1];
}

export function demote(grade: string): string {
  const i = GRADE_ORDER.indexOf(grade);
  if (i <= 0) return grade;
  return GRADE_ORDER[i - 1];
}

export function isMaxGrade(grade: string, maxGrade: string): boolean {
  return grade === maxGrade;
}
```

- [ ] **Step 4: Run tests to verify pass**

Run: `npx vitest run tests/domain/ladder.test.ts`
Expected: PASS.

---

