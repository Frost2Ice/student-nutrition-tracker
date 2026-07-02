# Single DOB Column — Import Refactor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Collapse student-import date-of-birth from three columns (`วันเกิด-วัน/เดือน/ปี`) to a single tolerant `วันเกิด` column parsed through `normalizeThaiDate`.

**Architecture:** `Student.dob` model is already a single canonical BE `D/M/YYYY` string. Work is in the import layer: extend `normalizeThaiDate` (Thai numerals, whitespace, 2-digit BE years), switch all headers/builders/parsers/templates to one column, reject legacy 3-column files, and regenerate mock samples.

**Tech Stack:** Vue 3 + TypeScript + Vite, Vitest, SheetJS (`xlsx`). Framework-free domain in `src/domain/**`.

## Global Constraints

- DOB is ALWAYS Day / Month / Year order — never silently reorder D and M.
- Display + canonical form is BE `D/M/YYYY` (e.g. `2/10/2565`).
- Hard cutover: legacy 3-column files are rejected, not auto-migrated.
- `normalizeThaiDate` return contract stays `{ value: string; converted: boolean } | null` — additive changes only.
- No confidence tier / no import-blocking ambiguity gate. Only `null` (impossible/unparseable) is a hard error, fixable inline via the existing preview override path.
- Do NOT run `git commit`/`git add`/`git push` in any task (user handles commits via a final review script). Each task ends when its tests pass.
- `tsconfig` has `noUnusedLocals` — remove any import you orphan.
- Run type-check with `npx vue-tsc --noEmit` and tests with `npm test`.

---

## File Structure

- `src/domain/date/thai-date.ts` — parse enhancements (Task 1).
- `src/domain/transfer/xlsx.ts` — single-column headers, template builders, AoA builders, parsers, legacy guard (Task 2).
- `src/components/ImportDialog.vue` + `src/features/wizard/AddStudentsWizard.vue` — single-column consumers + legacy guard wiring + copy (Task 3).
- `mockdata/generate.mjs` + regenerated `mockdata/import-samples/roster-*.xlsx` (Task 4).
- Tests: `tests/domain/thai-date.test.ts`, `tests/transfer/xlsx.test.ts`.

---

## Task 1: Extend `normalizeThaiDate` (Thai numerals, whitespace, 2-digit BE)

**Files:**
- Modify: `src/domain/date/thai-date.ts:13-19` (`resolveYearToBE`), `:40-100` (`normalizeThaiDate`)
- Test: `tests/domain/thai-date.test.ts`

**Interfaces:**
- Consumes: nothing new.
- Produces: `normalizeThaiDate(input: string | number | Date): { value: string; converted: boolean } | null` — now also handles Thai digits `๐–๙`, irregular whitespace, and 2-digit years (`65` → BE `2565`). Return type unchanged.

- [ ] **Step 1: Write the failing tests**

Add to `tests/domain/thai-date.test.ts` (import `normalizeThaiDate` if not already imported):

```ts
describe('normalizeThaiDate — extended formats', () => {
  const val = (s: string) => normalizeThaiDate(s)?.value ?? null;

  it('parses dot and dash separators', () => {
    expect(val('02.10.2565')).toBe('2/10/2565');
    expect(val('02-10-2565')).toBe('2/10/2565');
  });
  it('parses Thai month names', () => {
    expect(val('02 ต.ค. 2565')).toBe('2/10/2565');
    expect(val('2 ตุลาคม 2565')).toBe('2/10/2565');
  });
  it('converts CE years to BE', () => {
    expect(val('02-10-2022')).toBe('2/10/2565');
  });
  it('parses Thai numerals', () => {
    expect(val('๐๒-๑๐-๒๕๖๕')).toBe('2/10/2565');
  });
  it('parses mixed Thai/Arabic numerals', () => {
    expect(val('๒ ต.ค. 2565')).toBe('2/10/2565');
  });
  it('tolerates irregular whitespace', () => {
    expect(val('  2  ต.ค.  2565 ')).toBe('2/10/2565');
  });
  it('expands 2-digit years to BE and marks converted', () => {
    expect(val('02/10/65')).toBe('2/10/2565');
    expect(val('02-10-65')).toBe('2/10/2565');
    expect(val('2 ต.ค. 65')).toBe('2/10/2565');
    expect(val('๒ ต.ค. ๖๕')).toBe('2/10/2565');
    expect(normalizeThaiDate('02/10/65')?.converted).toBe(true);
  });
  it('rejects impossible or unparseable values', () => {
    expect(normalizeThaiDate('32/13/2565')).toBeNull();
    expect(normalizeThaiDate('2565')).toBeNull();
    expect(normalizeThaiDate('abc')).toBeNull();
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run tests/domain/thai-date.test.ts -t "extended formats"`
Expected: FAIL — Thai numerals return `null`, 2-digit year yields wrong BE (`2608`).

- [ ] **Step 3: Add a Thai-digit helper and use it + whitespace normalization**

In `src/domain/date/thai-date.ts`, add near the top (after the month maps):

```ts
// Thai digit → Arabic digit
function normalizeDigits(s: string): string {
  return s.replace(/[๐-๙]/g, (ch) => String('๐๑๒๓๔๕๖๗๘๙'.indexOf(ch)));
}
```

In `normalizeThaiDate`, replace the string-setup line (currently `const s = input.trim();`):

```ts
  // String handling — normalize Thai digits and collapse whitespace first
  const s = normalizeDigits(input).trim().replace(/\s+/g, ' ');
  if (!s) return null;
```

- [ ] **Step 4: Fix 2-digit year resolution to BE-short**

In `resolveYearToBE` (`src/domain/date/thai-date.ts:13-19`), replace the 2-digit branch:

```ts
function resolveYearToBE(y: number): { year: number; wasConverted: boolean } {
  if (y >= 2400) return { year: y, wasConverted: false };
  if (y >= 100 && y <= 2200) return { year: y + 543, wasConverted: true };
  if (y >= 0 && y < 100) return { year: 2500 + y, wasConverted: true }; // 2-digit → BE short (65 → 2565)
  return { year: y, wasConverted: false };
}
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npx vitest run tests/domain/thai-date.test.ts`
Expected: PASS (all, including existing cases).

- [ ] **Step 6: Type-check**

Run: `npx vue-tsc --noEmit`
Expected: no errors.

---

## Task 2: Single `วันเกิด` column in `xlsx.ts` + legacy guard

**Files:**
- Modify: `src/domain/transfer/xlsx.ts` — `STUDENT_HEADERS` (`:20-29`), `STUDENT_CLASSROOM_HEADERS` (`:31-40`), `studentTemplateAoa` (`:62-67`), `studentClassroomTemplateAoa` (`:69-74`), `injectGradeRoom` (`:111-119`), `studentsToAoa` (`:164-171`), `gridRowsToAoa` (`:187-196`), `parseClipboardGrid` (`:203-215`), `parseStudentAoa` (`:267-319`), `parseStudentImport` (`:399-523`); add new `hasLegacyDobColumns`.
- Test: `tests/transfer/xlsx.test.ts`

**Interfaces:**
- Consumes: `normalizeThaiDate` (Task 1), `validateThaiDate`.
- Produces:
  - `STUDENT_HEADERS = ['รหัสนักเรียน','ชื่อ','นามสกุล','วันเกิด','เพศ','ชั้น','ห้อง']` (DOB at index 3).
  - `STUDENT_CLASSROOM_HEADERS = ['รหัสนักเรียน','ชื่อ','นามสกุล','วันเกิด','เพศ']` (DOB at index 3).
  - `hasLegacyDobColumns(headerRow: string[]): boolean` — true if any legacy `วันเกิด-วัน|เดือน|ปี(พ.ศ.)` header present.
  - `parseStudentAoa` / `parseStudentImport` read a single DOB cell (`cells[3]`), normalize via `normalizeThaiDate`, then `validateThaiDate`. Preview `rawDob` = the raw cell.
  - Consuming layouts shift: `injectGradeRoom` output = `[id, ชื่อ, นามสกุล, วันเกิด, เพศ, grade, room]`.

- [ ] **Step 1: Write the failing tests**

Add to `tests/transfer/xlsx.test.ts`:

```ts
import {
  STUDENT_HEADERS, STUDENT_CLASSROOM_HEADERS, hasLegacyDobColumns,
  studentsToAoa, parseStudentAoa, parseStudentImport, gridRowsToAoa, parseClipboardGrid,
} from '../../src/domain/transfer/xlsx';

describe('single-column DOB', () => {
  it('headers use one วันเกิด column', () => {
    expect(STUDENT_HEADERS).toEqual(['รหัสนักเรียน','ชื่อ','นามสกุล','วันเกิด','เพศ','ชั้น','ห้อง']);
    expect(STUDENT_CLASSROOM_HEADERS).toEqual(['รหัสนักเรียน','ชื่อ','นามสกุล','วันเกิด','เพศ']);
  });

  it('detects legacy 3-column header', () => {
    expect(hasLegacyDobColumns(['รหัสนักเรียน','ชื่อ','นามสกุล','วันเกิด-วัน','วันเกิด-เดือน','วันเกิด-ปี(พ.ศ.)','เพศ'])).toBe(true);
    expect(hasLegacyDobColumns([...STUDENT_HEADERS])).toBe(false);
  });

  it('parseStudentAoa reads a single DOB cell', () => {
    const aoa = [[...STUDENT_HEADERS], ['10001','สมชาย','ใจดี','2/10/2558','ชาย','ป.1','1']];
    const { rows, skipped } = parseStudentAoa(aoa);
    expect(skipped).toHaveLength(0);
    expect(rows[0].dob).toBe('2/10/2558');
  });

  it('round-trips studentsToAoa → parseStudentAoa', () => {
    const s = { id: '10001', firstName: 'สมชาย', lastName: 'ใจดี', dob: '2/10/2558', gender: 'ชาย' as const, grade: 'ป.1', room: '1' };
    const aoa = studentsToAoa([s]);
    expect(aoa[0]).toEqual([...STUDENT_HEADERS]);
    expect(parseStudentAoa(aoa).rows[0]).toMatchObject({ id: '10001', dob: '2/10/2558' });
  });

  it('preview normalizes a single DOB cell and flags unparseable as error', () => {
    const aoa = [[...STUDENT_CLASSROOM_HEADERS],
      ['10001','สมชาย','ใจดี','2 ต.ค. 2558','ชาย'],
      ['10002','สมหญิง','ใจงาม','ไม่รู้','หญิง']];
    const { rows } = parseStudentImport(aoa, { grade: 'ป.1', room: '1' }, new Set(), undefined, 2569);
    expect(rows[0].dob).toBe('2/10/2558');
    expect(rows[1].status).toBe('error');
    expect(rows[1].hasDateError).toBe(true);
  });

  it('parseClipboardGrid reads a single DOB cell', () => {
    const grid = parseClipboardGrid('10001\tสมชาย\tใจดี\t2/10/2558\tชาย');
    expect(grid[0].dob).toBe('2/10/2558');
  });

  it('gridRowsToAoa emits one DOB column', () => {
    const aoa = gridRowsToAoa([{ id: '10001', firstName: 'ส', lastName: 'ใจดี', gender: 'ชาย', dob: '2/10/2558' }]);
    expect(aoa[0]).toEqual([...STUDENT_CLASSROOM_HEADERS]);
    expect(aoa[1]).toEqual(['10001','ส','ใจดี','2/10/2558','ชาย']);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run tests/transfer/xlsx.test.ts -t "single-column DOB"`
Expected: FAIL — old 9/7-col headers, `hasLegacyDobColumns` undefined.

- [ ] **Step 3: Update headers + template builders**

Replace `STUDENT_HEADERS` (`:20-29`) and `STUDENT_CLASSROOM_HEADERS` (`:31-40`) DOB entries:

```ts
export const STUDENT_HEADERS = [
  'รหัสนักเรียน', 'ชื่อ', 'นามสกุล', 'วันเกิด', 'เพศ', 'ชั้น', 'ห้อง',
] as const;

/** Per-classroom import template — no grade/room columns (taken from picker). */
export const STUDENT_CLASSROOM_HEADERS = [
  'รหัสนักเรียน', 'ชื่อ', 'นามสกุล', 'วันเกิด', 'เพศ',
] as const;
```

Replace the two template sample rows (`:62-74`):

```ts
export function studentTemplateAoa(): string[][] {
  return [
    [...STUDENT_HEADERS],
    ['10001', 'สมชาย', 'ใจดี', '15/3/2558', 'ชาย', 'ป.1', '1'],
  ];
}

export function studentClassroomTemplateAoa(): string[][] {
  return [
    [...STUDENT_CLASSROOM_HEADERS],
    ['10001', 'สมชาย', 'ใจดี', '15/3/2558', 'ชาย'],
  ];
}
```

- [ ] **Step 4: Add the legacy guard**

Add after the header constants (e.g. after `:40`):

```ts
const LEGACY_DOB_HEADERS = ['วันเกิด-วัน', 'วันเกิด-เดือน', 'วันเกิด-ปี(พ.ศ.)'];

/** True when a header row still uses the old 3-column DOB layout. */
export function hasLegacyDobColumns(headerRow: string[]): boolean {
  const trimmed = headerRow.map((h) => (h ?? '').trim());
  return LEGACY_DOB_HEADERS.some((h) => trimmed.includes(h));
}
```

- [ ] **Step 5: Update `injectGradeRoom` reindex**

Replace the per-row map in `injectGradeRoom` (`:114-117`):

```ts
  for (let i = 1; i < aoa.length; i++) {
    const c = aoa[i];
    // classroom layout: id, ชื่อ, นามสกุล, วันเกิด, เพศ → append grade/room
    out.push([c[0] ?? '', c[1] ?? '', c[2] ?? '', c[3] ?? '', c[4] ?? '', grade, room]);
  }
```

- [ ] **Step 6: Update `studentsToAoa`, `gridRowsToAoa`, `parseClipboardGrid`**

`studentsToAoa` (`:164-171`):

```ts
export function studentsToAoa(students: Student[]): string[][] {
  const rows: string[][] = [[...STUDENT_HEADERS]];
  for (const s of students) {
    rows.push([s.id, s.firstName, s.lastName, s.dob, s.gender, s.grade, s.room]);
  }
  return rows;
}
```

`gridRowsToAoa` body (`:189-194`):

```ts
  for (const r of rows) {
    const blank = !r.id.trim() && !r.firstName.trim() && !r.lastName.trim() && !r.gender.trim() && !r.dob.trim();
    if (blank) continue;
    aoa.push([r.id.trim(), r.firstName.trim(), r.lastName.trim(), r.dob.trim(), r.gender.trim()]);
  }
```

`parseClipboardGrid` body (`:210-214`) — update the docblock above it too (single DOB cell):

```ts
  return body.map((line) => {
    const [id = '', firstName = '', lastName = '', dobCell = '', gender = ''] = cellsOf(line);
    const norm = dobCell.trim() ? normalizeThaiDate(dobCell) : null;
    return { id, firstName, lastName, gender, dob: norm ? norm.value : dobCell.trim() };
  });
```

- [ ] **Step 7: Update `parseStudentAoa` (bulk parser)**

Replace the destructure + DOB block (`:278-301`):

```ts
    const [id, firstName, lastName, dobRaw, gender, grade, room] = cells.map((c) =>
      (c ?? '').trim(),
    );

    if (!id) {
      skipped.push({ row: rowNum, reason: 'กรุณากรอกรหัสนักเรียน' });
      continue;
    }
    if (!firstName) {
      skipped.push({ row: rowNum, reason: 'กรุณากรอกชื่อ' });
      continue;
    }

    if (!dobRaw) {
      skipped.push({ row: rowNum, reason: 'กรอกวันเกิด (วัน/เดือน/ปี พ.ศ.)' });
      continue;
    }
    const normDob = normalizeThaiDate(dobRaw);
    if (!normDob) {
      skipped.push({ row: rowNum, reason: 'อ่านวันเกิดไม่ได้ — ใช้รูปแบบ วัน/เดือน/ปีพ.ศ.' });
      continue;
    }
    const dob = normDob.value;
    const dobErr = validateThaiDate(dob, true);
    if (dobErr) {
      skipped.push({ row: rowNum, reason: dobErr });
      continue;
    }
```

- [ ] **Step 8: Update `parseStudentImport` (preview parser)**

Replace the raw-cell reads (`:421-426`):

```ts
    const dobRaw = (cells[3] ?? '').trim();
    const genderRaw = (cells[4] ?? '').trim();
    const rawDob = dobRaw;
```

Replace the DOB build block (`:443-466`) with single-column + override:

```ts
    // dob: use override if present, else the single DOB column — both normalized
    const overrideDob = overrides?.get(rowNum)?.dob;
    const dobInput = overrideDob !== undefined ? overrideDob : dobRaw;
    let dob = '';
    if (!dobInput.trim()) {
      issues.push({ message: 'กรอกวันเกิด (วัน/เดือน/ปี พ.ศ.)', severity: 'error' });
    } else {
      const normDob = normalizeThaiDate(dobInput);
      if (!normDob) {
        issues.push({ message: 'อ่านวันเกิดไม่ได้ — แก้ไขในช่องด้านล่าง หรือใช้รูปแบบ วัน/เดือน/ปีพ.ศ.', severity: 'error' });
      } else {
        dob = normDob.value;
        if (normDob.converted) issues.push({ message: 'ปรับรูปแบบวันที่ให้อัตโนมัติ', severity: 'warn' });
        const dobErr = validateThaiDate(dob, true, periodYear);
        if (dobErr) issues.push({ message: dobErr, severity: 'error' });
      }
    }
```

The `hasDateError` detection (`:508-515`) already matches `'กรอกวันเกิด'` via substring — leave as-is (it uses `.includes('กรอกวันเกิดให้ครบ')`; change that one substring to `'กรอกวันเกิด'` so the shortened message still matches):

```ts
        is.message.includes('กรอกวันเกิด') ||
```

- [ ] **Step 9: Run the tests to verify they pass**

Run: `npx vitest run tests/transfer/xlsx.test.ts`
Expected: PASS. Fix any pre-existing xlsx tests that assumed 3-column layout (update their fixtures to single `วันเกิด`).

- [ ] **Step 10: Type-check**

Run: `npx vue-tsc --noEmit`
Expected: no errors (watch for now-unused locals).

---

## Task 3: Single-column consumers in Vue (ImportDialog + AddStudentsWizard)

**Files:**
- Modify: `src/components/ImportDialog.vue` — imports (add `hasLegacyDobColumns` to xlsx import; add `normalizeThaiDate` from `../domain/date/thai-date`), new `dobFileErr` ref, `loadExcelIntoGrid` (`:212-232`), dropzone template error slot (`:525-530`), paste hint copy (`:540`).
- Modify: `src/features/wizard/AddStudentsWizard.vue:60-72` (`process` legacy guard), `:191` (copy).

**Interfaces:**
- Consumes: `hasLegacyDobColumns` (Task 2), `normalizeThaiDate`, updated `STUDENT_CLASSROOM_HEADERS`.
- Produces: no new exports — behavioral only.

- [ ] **Step 1: Add imports + an error ref**

In `src/components/ImportDialog.vue`, add `hasLegacyDobColumns` to the existing `../domain/transfer/xlsx` import block. Add a new import for the date helper (ImportDialog does NOT currently import it):

```ts
import { normalizeThaiDate } from '../domain/date/thai-date';
```

Add a ref alongside `const fileName = ref('');` (`:288`):

```ts
const dobFileErr = ref('');
```

- [ ] **Step 2: Update `loadExcelIntoGrid` to read one DOB cell + reject legacy files**

Replace the grid-read loop body in `loadExcelIntoGrid` (`:215-228`, inside `reader.onload`):

```ts
  reader.onload = () => {
    dobFileErr.value = '';
    const aoa = readXlsxToAoa(reader.result as ArrayBuffer);
    if (aoa.length && hasLegacyDobColumns(aoa[0])) {
      dobFileErr.value = 'ไฟล์รูปแบบเก่า (วันเกิดแยก 3 ช่อง) — ดาวน์โหลดแม่แบบใหม่ที่ใช้ช่อง "วันเกิด" ช่องเดียว';
      return;
    }
    const rows: GridRow[] = [];
    for (let i = 1; i < aoa.length; i++) {
      const c = aoa[i];
      const id = (c[0] ?? '').trim();
      const fn = (c[1] ?? '').trim();
      const ln = (c[2] ?? '').trim();
      if (!id && !fn && !ln) continue;
      const dobCell = (c[3] ?? '').trim();
      const g = (c[4] ?? '').trim();
      const norm = dobCell ? normalizeThaiDate(dobCell) : null;
      rows.push({ id, firstName: fn, lastName: ln, gender: g === 'ชาย' || g === 'หญิง' ? g : '', dob: norm ? norm.value : dobCell });
    }
    gridRows.value = rows.length ? rows : [blankRow()];
    stage.value = 'grid';
  };
```

- [ ] **Step 3: Render the error under the dropzone**

In the template, add an error line right after the `</label>` closing the dropzone (`:530`):

```html
          </label>
          <p v-if="dobFileErr" class="dz-err">{{ dobFileErr }}</p>
```

Add a matching style near the other `.dz-*` rules:

```css
.dz-err { margin-top: var(--s2); color: var(--bad); font-size: 0.85rem; }
```

- [ ] **Step 4: Update the paste-hint copy**

In the template (`:539-540`), change the 3-part column hint to single DOB:

```html
          ใช้คอลัมน์เรียงตามแม่แบบ เริ่มจาก <b>รหัสนักเรียน</b> เป็นคอลัมน์แรก:
          รหัส · ชื่อ · นามสกุล · วันเกิด · เพศ
```

- [ ] **Step 5: Reject legacy files in the wizard `process`**

In `src/features/wizard/AddStudentsWizard.vue`, add `hasLegacyDobColumns` to the `xlsx` import (`:10-11`), then guard at the top of `process` (`:61`):

```ts
function process(classroomAoa: string[][]) {
  parsed.value = [];
  skipped.value = [];
  if (classroomAoa.length && hasLegacyDobColumns(classroomAoa[0])) {
    fileErr.value = 'ไฟล์รูปแบบเก่า (วันเกิดแยก 3 ช่อง) — ดาวน์โหลดแม่แบบใหม่ที่ใช้ช่อง "วันเกิด" ช่องเดียว';
    return;
  }
  const out = parseStudentAoa(injectGradeRoom(classroomAoa, grade.value, room.value));
```

- [ ] **Step 6: Update wizard paste-placeholder copy**

In `src/features/wizard/AddStudentsWizard.vue:191`, the current placeholder reads `…(รหัส ชื่อ นามสกุล วัน เดือน ปี เพศ)…`. Change it to single DOB:

```
placeholder="คัดลอกแถวข้อมูลจาก Excel (รหัส ชื่อ นามสกุล วันเกิด เพศ) แล้ววางที่นี่"
```

(Line `:173` already reads "…วันเกิด เพศ…" — leave it.)

- [ ] **Step 7: Type-check + build**

Run: `npx vue-tsc --noEmit`
Expected: no errors.

- [ ] **Step 8: Manual smoke (dev server already running on :5173)**

Open http://localhost:5173, go to เพิ่มรายชื่อนักเรียน → download template (confirm one `วันเกิด` column), paste `10001<TAB>สมชาย<TAB>ใจดี<TAB>2 ต.ค. 2558<TAB>ชาย`, confirm preview shows `2/10/2558`. Then upload one of the OLD `roster-*.xlsx` samples (pre-regeneration) and confirm the legacy-format rejection message appears.

---

## Task 4: Regenerate mock data with single DOB column

**Files:**
- Modify: `mockdata/generate.mjs:270` (`ROSTER_HEADERS`), `:283-301` (roster row build), `:350` header check.
- Regenerate: `mockdata/import-samples/roster-*.xlsx`.
- Delete: `mockdata/import-samples/~$roster-ป.1-1.xlsx` (stale Excel lock file).

**Interfaces:**
- Consumes: existing `thaiDate(ceYear, month, day)` (already emits single `D/M/BE`).
- Produces: roster sample sheets with header `[...,'วันเกิด','เพศ']` and a single DOB cell per row.

- [ ] **Step 1: Update `ROSTER_HEADERS`**

In `mockdata/generate.mjs:270`, replace the three DOB headers with one:

```js
    'วันเกิด',
```

so the array reads `[..., 'นามสกุล', 'วันเกิด', 'เพศ']`.

- [ ] **Step 2: Emit a single DOB cell in the roster row**

Replace the DOB build (`:296-301`) to use `thaiDate`:

```js
      const dobCeYear = CURRENT_CE - age;
      const dobMonth = ri2(1, 12);
      const dobDay = ri2(1, 28);
      const dob = thaiDate(dobCeYear, dobMonth, dobDay); // D/M/BE
      rosterRows.push([id, firstName, lastName, dob, gender]);
```

(Remove the now-unused `dobBeYear` line if present.)

- [ ] **Step 3: Regenerate the sample files**

Run: `node mockdata/generate.mjs`
Expected: console prints per-classroom summary and `Header verification OK`. The inline header check (`:350`) compares against the updated `ROSTER_HEADERS`, so it validates the single-column layout automatically.

- [ ] **Step 4: Delete the stale lock file**

Run: `rm -f "mockdata/import-samples/~\$roster-ป.1-1.xlsx"`
Expected: file removed (it is an Excel temp lock, not real data).

- [ ] **Step 5: Verify a regenerated file parses cleanly**

Run: `npx vitest run tests/transfer/xlsx.test.ts`
Expected: PASS. Optionally re-run the Task 3 manual smoke uploading a freshly-regenerated `roster-ป.1-1.xlsx` — it should import WITHOUT the legacy-format error.

---

## Full verification (after all tasks)

- [ ] `npm test` — all green.
- [ ] `npx vue-tsc --noEmit` — clean.
- [ ] `npm run build` — single `dist/index.html` produced.

---

## Self-Review

- **Spec coverage:** §1 parse enhancements → Task 1. §2 single-column headers/builders/parsers → Task 2. §3 preview error-fix path → covered by unchanged override flow + Task 2 Step 8. §4 legacy hard cutover → Task 2 (`hasLegacyDobColumns`) + Task 3 wiring. §5 validation → unchanged (verified in Task 2 tests). §6 templates + mock regen + lock-file delete → Task 2 (template builders) + Task 4. All spec sections mapped.
- **Type consistency:** `normalizeThaiDate` contract unchanged; `hasLegacyDobColumns(string[]): boolean` used identically in Tasks 2/3; DOB always at cell index 3 across `parseStudentAoa`, `parseStudentImport`, `injectGradeRoom`, `loadExcelIntoGrid`, `parseClipboardGrid`, `gridRowsToAoa`.
- **Placeholders:** none — every code step shows full replacement code. The one `NOTE` (ImportDialog error-ref name) instructs a grep-verify because the exact ref name must be confirmed against the live file.
