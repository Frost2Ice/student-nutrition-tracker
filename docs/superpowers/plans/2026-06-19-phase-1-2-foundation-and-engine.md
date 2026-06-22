# Phase 1–2: Foundation & Nutrition Engine — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stand up the Vue 3 + TypeScript + Vite single-file build and deliver a fully unit-tested, framework-free nutrition `domain/` core (dates, validation, grade ladder, reference data, classification engine, latest-measurement comparator).

**Architecture:** Pure logic lives in `src/domain/` with zero Vue imports, making it independently testable with Vitest. Reference growth tables are ported verbatim from the legacy `nutrition_tracker 18062026.html` into typed modules. Every consumer (later UI phases) will import the single `calcNutrition` engine so table/dashboard/chart/PDF/CSV classifications can never diverge.

**Tech Stack:** Vue 3 (`<script setup>`), TypeScript, Vite, `vite-plugin-singlefile`, Pinia, Chart.js v4, Vitest.

## Global Constraints

- Single self-contained `dist/index.html` output — no runtime network/CDN calls.
- Vite `build.target: 'es2017'` (backward-compatible syntax for older tablets).
- Weight range 5–150 kg; height range 40–210 cm; both stored at **1 decimal**.
- Dates are Thai Buddhist era `D/M/YYYY`; birth year B.E. 2540–2590.
- Minimum classification age 24 months; supported reference age 2–18 years; reference age match tolerance ±6 months.
- Gender values are exactly `'ชาย'` (male) / `'หญิง'` (female).
- A record that is not assessable returns `null` — never default to `'สมส่วน'`.
- **No VCS in this project.** "Commit" steps are replaced by a green-tests checkpoint. Do not run `git`.
- Legacy reference file: `nutrition_tracker 18062026.html` (read-only source for porting values).

---

## File Structure

```
package.json                         # deps + scripts
tsconfig.json                        # TS config
vite.config.ts                       # Vue + singlefile plugin, target es2017
vitest.config.ts                     # test config (jsdom not needed for domain)
index.html                           # Vite entry
src/
  main.ts                            # Vue bootstrap (minimal placeholder)
  App.vue                            # placeholder shell (proves build)
  domain/
    types.ts                         # Student, Measurement, Gender, Setup, Grade types
    date/thai-date.ts                # parseThaiDate, formatThaiDate, getAgeMonths, todayThai
    validation/rules.ts             # round1, weight/height/date/dob validation
    grade/ladder.ts                  # GRADE_ORDER, promote, demote, isMaxGrade
    nutrition/
      reference/wfh-male.ts          # WFH_M (ported verbatim)
      reference/wfh-female.ts        # WFH_F (ported verbatim)
      reference/age-data.ts          # AGE_DATA map (ported verbatim) + AgeRef type
      reference/index.ts             # findRef(gender, ageMonths)
      engine.ts                      # classifyWFH, classifyWFA, classifyHFA, isTallProportionate, calcNutrition
      latest.ts                      # isNewerMeasure, latestPerStudent
tests/domain/                        # mirror of domain/ test files
scripts/extract-reference.mjs        # one-off porting helper
```

---

## Task 1: Project scaffold + single-file build proof

**Files:**
- Create: `package.json`, `tsconfig.json`, `vite.config.ts`, `vitest.config.ts`, `index.html`, `src/main.ts`, `src/App.vue`
- Test: `tests/build.test.ts`

**Interfaces:**
- Produces: working `npm run dev`, `npm run build` (emits single `dist/index.html`), `npm test` (Vitest).

- [ ] **Step 1: Create `package.json`**

```json
{
  "name": "nutrition-tracker",
  "private": true,
  "version": "2.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vue-tsc --noEmit && vite build",
    "preview": "vite preview",
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "dependencies": {
    "chart.js": "^4.4.1",
    "pinia": "^2.1.7",
    "vue": "^3.4.0"
  },
  "devDependencies": {
    "@vitejs/plugin-vue": "^5.0.0",
    "typescript": "^5.4.0",
    "vite": "^5.2.0",
    "vite-plugin-singlefile": "^2.0.1",
    "vitest": "^1.5.0",
    "vue-tsc": "^2.0.0"
  }
}
```

- [ ] **Step 2: Create `tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2017",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "strict": true,
    "noUnusedLocals": true,
    "noImplicitReturns": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "lib": ["ES2017", "DOM", "DOM.Iterable"],
    "types": ["vitest/globals"]
  },
  "include": ["src", "tests"]
}
```

- [ ] **Step 3: Create `vite.config.ts`**

```ts
import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import { viteSingleFile } from 'vite-plugin-singlefile';

export default defineConfig({
  plugins: [vue(), viteSingleFile()],
  build: { target: 'es2017', cssCodeSplit: false, assetsInlineLimit: 100000000 },
});
```

- [ ] **Step 4: Create `vitest.config.ts`**

```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: { globals: true, environment: 'node', include: ['tests/**/*.test.ts'] },
});
```

- [ ] **Step 5: Create `index.html`**

```html
<!DOCTYPE html>
<html lang="th">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>ระบบติดตามภาวะโภชนาการนักเรียน</title>
  </head>
  <body>
    <div id="app"></div>
    <script type="module" src="/src/main.ts"></script>
  </body>
</html>
```

- [ ] **Step 6: Create `src/App.vue`**

```vue
<script setup lang="ts"></script>

<template>
  <main style="font-family: 'Sarabun','Leelawadee UI','Tahoma',sans-serif">
    ระบบติดตามภาวะโภชนาการนักเรียน
  </main>
</template>
```

- [ ] **Step 7: Create `src/main.ts`**

```ts
import { createApp } from 'vue';
import { createPinia } from 'pinia';
import App from './App.vue';

createApp(App).use(createPinia()).mount('#app');
```

- [ ] **Step 8: Install dependencies**

Run: `npm install`
Expected: completes, creates `node_modules/` and `package-lock.json`.

- [ ] **Step 9: Write the single-file build assertion test**

```ts
// tests/build.test.ts
import { existsSync, readFileSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { describe, it, expect } from 'vitest';

describe('single-file build', () => {
  it('emits one self-contained index.html with no external script/link refs', () => {
    execSync('npm run build', { stdio: 'inherit' });
    const path = 'dist/index.html';
    expect(existsSync(path)).toBe(true);
    const html = readFileSync(path, 'utf8');
    // no external bundle references — everything inlined
    expect(html).not.toMatch(/<script[^>]+src="\.?\/assets/);
    expect(html).not.toMatch(/<link[^>]+href="\.?\/assets/);
    expect(html).toContain('ระบบติดตามภาวะโภชนาการนักเรียน');
  });
});
```

- [ ] **Step 10: Run the build test**

Run: `npx vitest run tests/build.test.ts`
Expected: PASS (build succeeds, single inlined file present).

- [ ] **Step 11: Checkpoint**

Run: `npm test`
Expected: all tests PASS.

---

## Task 2: Domain types

**Files:**
- Create: `src/domain/types.ts`

**Interfaces:**
- Produces:
  ```ts
  type Gender = 'ชาย' | 'หญิง';
  type Term = '1' | '2';
  type Round = '1' | '2';
  interface Student { id: string; firstName: string; lastName: string; dob: string; gender: Gender; grade: string; room: string; }
  interface Measurement { studentId: string; year: string; term: Term; round: Round; date: string; weightKg: number; heightCm: number; savedAt: number; }
  interface Setup { school: string; ministry: string; department: string; subdistrict: string; district: string; province: string; teacher: string; maxGrade: string; }
  ```

- [ ] **Step 1: Create `src/domain/types.ts`**

```ts
export type Gender = 'ชาย' | 'หญิง';
export type Term = '1' | '2';
export type Round = '1' | '2';

export interface Student {
  id: string;
  firstName: string;
  lastName: string;
  dob: string; // Thai BE D/M/YYYY
  gender: Gender;
  grade: string;
  room: string;
}

export interface Measurement {
  studentId: string;
  year: string;
  term: Term;
  round: Round;
  date: string; // Thai BE D/M/YYYY
  weightKg: number;
  heightCm: number;
  savedAt: number; // epoch ms tie-breaker
}

export interface Setup {
  school: string;
  ministry: string;
  department: string;
  subdistrict: string;
  district: string;
  province: string;
  teacher: string;
  maxGrade: string;
}
```

- [ ] **Step 2: Type-check**

Run: `npx vue-tsc --noEmit`
Expected: no errors.

---

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

## Task 6: Port reference data (WFH tables + AGE_DATA)

**Files:**
- Create: `scripts/extract-reference.mjs`
- Create: `src/domain/nutrition/reference/wfh-male.ts`
- Create: `src/domain/nutrition/reference/wfh-female.ts`
- Create: `src/domain/nutrition/reference/age-data.ts`
- Test: `tests/domain/reference-data.test.ts`

**Interfaces:**
- Produces:
  ```ts
  // wfh-male.ts / wfh-female.ts
  const WFH_M: number[][]; // each row [heightCm, b0,b1,b2,b3,b4,b5]
  const WFH_F: number[][];
  // age-data.ts
  interface AgeRef { mw:number; sdw:number; sd2w:number; sd15w:number; sd15pw:number; sd2pw:number; mh:number; sdh:number; sd2h:number; sd15h:number; sd15ph:number; sd2ph:number; }
  const AGE_DATA: Record<string, AgeRef>; // keys like 'M-24', 'F-72'
  ```

> Port values **verbatim** from `nutrition_tracker 18062026.html`. Do not hand-retype; extract programmatically so digits cannot drift.

- [ ] **Step 1: Write the extraction helper `scripts/extract-reference.mjs`**

```js
// Reads the legacy HTML, pulls the WFH_M / WFH_F array literals and the AGE_DATA
// raw CSV string, and writes the three reference TS modules verbatim.
import { readFileSync, writeFileSync } from 'node:fs';

const html = readFileSync('nutrition_tracker 18062026.html', 'utf8');

function grabArray(name) {
  const start = html.indexOf(`const ${name}=[`);
  if (start === -1) throw new Error(`${name} not found`);
  const open = html.indexOf('[', start);
  // find matching closing bracket of the outer array
  let depth = 0, i = open;
  for (; i < html.length; i++) {
    if (html[i] === '[') depth++;
    else if (html[i] === ']') { depth--; if (depth === 0) break; }
  }
  return html.slice(open, i + 1); // the literal "[[...],[...]]"
}

const wfhM = grabArray('WFH_M');
const wfhF = grabArray('WFH_F');

writeFileSync('src/domain/nutrition/reference/wfh-male.ts',
  `// Ported verbatim from legacy reference. Each row: [heightCm, b0,b1,b2,b3,b4,b5].\nexport const WFH_M: number[][] = ${wfhM};\n`);
writeFileSync('src/domain/nutrition/reference/wfh-female.ts',
  `// Ported verbatim from legacy reference. Each row: [heightCm, b0,b1,b2,b3,b4,b5].\nexport const WFH_F: number[][] = ${wfhF};\n`);

// AGE_DATA raw string lives inside: const raw=`...`;
const rawStart = html.indexOf('const raw=`');
const rawOpen = html.indexOf('`', rawStart);
const rawClose = html.indexOf('`', rawOpen + 1);
const raw = html.slice(rawOpen + 1, rawClose);

writeFileSync('src/domain/nutrition/reference/age-data.ts',
`// Ported verbatim from legacy reference (B.E. 2564 growth reference, ages 2–18).
export interface AgeRef {
  mw: number; sdw: number; sd2w: number; sd15w: number; sd15pw: number; sd2pw: number;
  mh: number; sdh: number; sd2h: number; sd15h: number; sd15ph: number; sd2ph: number;
}
const RAW = \`${raw}\`;
export const AGE_DATA: Record<string, AgeRef> = {};
RAW.split('\\n').forEach((line) => {
  const p = line.split(',');
  if (p.length < 13) return;
  AGE_DATA[p[0]] = {
    mw: +p[1], sdw: +p[2], sd2w: +p[3], sd15w: +p[4], sd15pw: +p[5], sd2pw: +p[6],
    mh: +p[7], sdh: +p[8], sd2h: +p[9], sd15h: +p[10], sd15ph: +p[11], sd2ph: +p[12],
  };
});
`);

console.log('Reference modules written.');
```

- [ ] **Step 2: Run the extraction helper**

Run: `node scripts/extract-reference.mjs`
Expected: prints "Reference modules written."; the three files exist under `src/domain/nutrition/reference/`.

- [ ] **Step 3: Write the porting-integrity tests**

```ts
// tests/domain/reference-data.test.ts
import { describe, it, expect } from 'vitest';
import { WFH_M } from '../../src/domain/nutrition/reference/wfh-male';
import { WFH_F } from '../../src/domain/nutrition/reference/wfh-female';
import { AGE_DATA } from '../../src/domain/nutrition/reference/age-data';

describe('WFH tables', () => {
  it('male rows have 7 numeric columns and ascending height', () => {
    expect(WFH_M.length).toBeGreaterThan(100);
    for (const row of WFH_M) {
      expect(row).toHaveLength(7);
      row.forEach((v) => expect(typeof v).toBe('number'));
    }
    for (let i = 1; i < WFH_M.length; i++) expect(WFH_M[i][0]).toBeGreaterThan(WFH_M[i - 1][0]);
  });
  it('first male row matches the legacy anchor value', () => {
    expect(WFH_M[0]).toEqual([65, 6.3, 6.5, 8.45, 8.8, 9.6, 11]);
  });
  it('female table is present', () => {
    expect(WFH_F.length).toBeGreaterThan(100);
    expect(WFH_F[0][0]).toBe(65);
  });
});

describe('AGE_DATA', () => {
  it('parses keyed rows for both genders', () => {
    expect(AGE_DATA['M-24']).toBeDefined();
    expect(AGE_DATA['F-72']).toBeDefined();
  });
  it('maps columns correctly for M-24', () => {
    expect(AGE_DATA['M-24']).toEqual({
      mw: 12.35, sdw: 1.4, sd2w: 9.7, sd15w: 10.25, sd15pw: 14.45, sd2pw: 15.3,
      mh: 87.12, sdh: 3.05, sd2h: 81.0, sd15h: 82.55, sd15ph: 91.7, sd2ph: 93.2,
    });
  });
});
```

- [ ] **Step 4: Run tests to verify pass**

Run: `npx vitest run tests/domain/reference-data.test.ts`
Expected: PASS. (If the anchor assertions fail, the extraction mis-parsed — fix the helper, do not edit values by hand.)

---

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

## Task 10: Full suite + build green checkpoint

**Files:** none (verification only).

- [ ] **Step 1: Run the whole test suite**

Run: `npm test`
Expected: all tests PASS.

- [ ] **Step 2: Type-check the project**

Run: `npx vue-tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Build the single file**

Run: `npm run build`
Expected: `dist/index.html` produced, single self-contained file.

---

## Self-Review (completed)

- **Spec coverage:** Build/offline (§2) → Task 1. Data model (§4) → Task 2. Date logic (§5, §6.1) → Task 3. Validation single-source + precision (§4, §6.1) → Task 4. Grade ladder (§7.2) → Task 5. Reference data port (§5, §8) → Task 6. Reference lookup ±6mo (FR-5.6) → Task 7. Engine + consistency (§5, §6.2) → Task 8. Latest-per-student (FR-5.7) → Task 9. Phases 3–9 (UI, persistence, promotion, import, reports) are intentionally out of this plan and get their own plans.
- **Placeholder scan:** none — all steps carry real code/commands.
- **Type consistency:** `AgeRef` defined in Task 6, re-exported via Task 7, consumed by Task 8 with identical field names (`sd2w/sd15w/sd15pw/sd2pw/sd2h/sd15h/sd15ph/sd2ph`). `Measurement.savedAt`/`studentId` consistent across Tasks 2/8/9. Label union types in Task 8 match the band order in the legacy engine.
