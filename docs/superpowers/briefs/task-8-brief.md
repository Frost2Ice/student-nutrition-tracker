## Task 8: Nutrition engine

**Files:**
- Create: `src/domain/nutrition/engine.ts`
- Test: `tests/domain/engine.test.ts`

**Interfaces:**
- Consumes: `WFH_M`/`WFH_F`, `findRef`, `getAgeMonths`, `Student`, `Measurement`, `Gender`.
- Produces:
  ```ts
  type WfhLabel = 'ผอม'|'ค่อนข้างผอม'|'สมส่วน'|'ท้วม'|'เริ่มอ้วน'|'อ้วน';
  type WfaLabel = 'น้ำหนักน้อย'|'น้ำหนักค่อนข้างน้อย'|'น้ำหนักตามเกณฑ์'|'น้ำหนักค่อนข้างมาก'|'น้ำหนักมาก';
  type HfaLabel = 'เตี้ย'|'ค่อนข้างเตี้ย'|'สูงตามเกณฑ์'|'ค่อนข้างสูง'|'สูง';
  function classifyWFH(gender: Gender, heightCm: number, weightKg: number): WfhLabel | null;
  function classifyWFA(ref: AgeRef, weightKg: number): WfaLabel;
  function classifyHFA(ref: AgeRef, heightCm: number): HfaLabel;
  function isTallProportionate(hfa: HfaLabel, wfh: WfhLabel): boolean;
  interface NutritionResult { wfa: WfaLabel; hfa: HfaLabel; wfh: WfhLabel; tall: boolean; ageMonths: number; bmi: number; }
  function calcNutrition(student: Student, m: Measurement): NutritionResult | null;
  ```

- [ ] **Step 1: Write failing tests**

```ts
// tests/domain/engine.test.ts
import { describe, it, expect } from 'vitest';
import { classifyWFH, calcNutrition } from '../../src/domain/nutrition/engine';
import type { Student, Measurement } from '../../src/domain/types';

const boy: Student = { id: '1', firstName: 'ก', lastName: 'ข', dob: '15/5/2556', gender: 'ชาย', grade: 'ป.1', room: '1' };

describe('classifyWFH', () => {
  // WFH_M[0] = [65, 6.3, 6.5, 8.45, 8.8, 9.6, 11]; bands at height 65
  it('classifies below first band as ผอม', () => { expect(classifyWFH('ชาย', 65, 6.0)).toBe('ผอม'); });
  it('classifies into สมส่วน band', () => { expect(classifyWFH('ชาย', 65, 7.0)).toBe('สมส่วน'); });
  it('classifies above last band as อ้วน', () => { expect(classifyWFH('ชาย', 65, 12)).toBe('อ้วน'); });
  it('interpolates between rows', () => {
    // smoke: a value at an interpolated height returns a valid label
    expect(['ผอม','ค่อนข้างผอม','สมส่วน','ท้วม','เริ่มอ้วน','อ้วน']).toContain(classifyWFH('ชาย', 70.25, 9.0));
  });
});

describe('calcNutrition', () => {
  it('returns null when age < 24 months', () => {
    const m: Measurement = { studentId: '1', year: '2557', term: '1', round: '1', date: '15/5/2557', weightKg: 10, heightCm: 75, savedAt: 1 };
    expect(calcNutrition(boy, m)).toBeNull(); // 12 months old
  });
  it('returns a full result for an assessable measurement', () => {
    const m: Measurement = { studentId: '1', year: '2560', term: '1', round: '1', date: '15/5/2560', weightKg: 16, heightCm: 104, savedAt: 1 };
    const r = calcNutrition(boy, m)!;
    expect(r).not.toBeNull();
    expect(r.ageMonths).toBe(48);
    expect(['ผอม','ค่อนข้างผอม','สมส่วน','ท้วม','เริ่มอ้วน','อ้วน']).toContain(r.wfh);
    expect(['เตี้ย','ค่อนข้างเตี้ย','สูงตามเกณฑ์','ค่อนข้างสูง','สูง']).toContain(r.hfa);
    expect(typeof r.tall).toBe('boolean');
  });
});
```

- [ ] **Step 2: Run tests to verify failure**

Run: `npx vitest run tests/domain/engine.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement `src/domain/nutrition/engine.ts`**

```ts
import type { Gender, Student, Measurement } from '../types';
import { WFH_M } from './reference/wfh-male';
import { WFH_F } from './reference/wfh-female';
import { findRef, type AgeRef } from './reference/index';
import { getAgeMonths } from '../date/thai-date';
import { round1 } from '../validation/rules';

export type WfhLabel = 'ผอม' | 'ค่อนข้างผอม' | 'สมส่วน' | 'ท้วม' | 'เริ่มอ้วน' | 'อ้วน';
export type WfaLabel = 'น้ำหนักน้อย' | 'น้ำหนักค่อนข้างน้อย' | 'น้ำหนักตามเกณฑ์' | 'น้ำหนักค่อนข้างมาก' | 'น้ำหนักมาก';
export type HfaLabel = 'เตี้ย' | 'ค่อนข้างเตี้ย' | 'สูงตามเกณฑ์' | 'ค่อนข้างสูง' | 'สูง';

export function classifyWFH(gender: Gender, heightCm: number, weightKg: number): WfhLabel | null {
  const T = gender === 'ชาย' ? WFH_M : WFH_F;
  if (!T || !T.length) return null;
  let row: number[];
  if (heightCm <= T[0][0]) row = T[0].slice(1);
  else if (heightCm >= T[T.length - 1][0]) row = T[T.length - 1].slice(1);
  else {
    let a = T[0], b = T[T.length - 1];
    for (let i = 0; i < T.length - 1; i++) {
      if (T[i][0] <= heightCm && heightCm <= T[i + 1][0]) { a = T[i]; b = T[i + 1]; break; }
    }
    const t = (heightCm - a[0]) / (b[0] - a[0]);
    row = [];
    for (let c = 1; c <= 6; c++) row.push(a[c] + (b[c] - a[c]) * t);
  }
  if (weightKg < row[0]) return 'ผอม';
  if (weightKg < row[1]) return 'ค่อนข้างผอม';
  if (weightKg < row[2]) return 'สมส่วน';
  if (weightKg < row[3]) return 'ท้วม';
  if (weightKg < row[4]) return 'เริ่มอ้วน';
  return 'อ้วน';
}

export function classifyWFA(ref: AgeRef, weightKg: number): WfaLabel {
  if (weightKg < ref.sd2w) return 'น้ำหนักน้อย';
  if (weightKg < ref.sd15w) return 'น้ำหนักค่อนข้างน้อย';
  if (weightKg <= ref.sd15pw) return 'น้ำหนักตามเกณฑ์';
  if (weightKg <= ref.sd2pw) return 'น้ำหนักค่อนข้างมาก';
  return 'น้ำหนักมาก';
}

export function classifyHFA(ref: AgeRef, heightCm: number): HfaLabel {
  if (heightCm < ref.sd2h) return 'เตี้ย';
  if (heightCm < ref.sd15h) return 'ค่อนข้างเตี้ย';
  if (heightCm <= ref.sd15ph) return 'สูงตามเกณฑ์';
  if (heightCm <= ref.sd2ph) return 'ค่อนข้างสูง';
  return 'สูง';
}

export function isTallProportionate(hfa: HfaLabel, wfh: WfhLabel): boolean {
  const tall = hfa === 'สูงตามเกณฑ์' || hfa === 'ค่อนข้างสูง' || hfa === 'สูง';
  const norm = wfh === 'สมส่วน' || wfh === 'ท้วม';
  return tall && norm;
}

export interface NutritionResult {
  wfa: WfaLabel; hfa: HfaLabel; wfh: WfhLabel; tall: boolean; ageMonths: number; bmi: number;
}

export function calcNutrition(student: Student, m: Measurement): NutritionResult | null {
  const ageMonths = getAgeMonths(student.dob, m.date);
  if (ageMonths === null || ageMonths < 24) return null;
  const ref = findRef(student.gender, ageMonths);
  if (!ref) return null;
  const wfh = classifyWFH(student.gender, m.heightCm, m.weightKg);
  if (!wfh) return null; // not assessable — never default to สมส่วน
  const wfa = classifyWFA(ref, m.weightKg);
  const hfa = classifyHFA(ref, m.heightCm);
  const bmi = round1(m.weightKg / (m.heightCm / 100) ** 2);
  return { wfa, hfa, wfh, tall: isTallProportionate(hfa, wfh), ageMonths, bmi };
}
```

- [ ] **Step 4: Run tests to verify pass**

Run: `npx vitest run tests/domain/engine.test.ts`
Expected: PASS.

---

