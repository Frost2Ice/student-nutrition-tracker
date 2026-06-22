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

