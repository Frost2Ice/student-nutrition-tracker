# Registry Foundation: Domain & Data Model — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the framework-free domain layer for the student registry foundation: snapshotted measurements, Thai academic-period logic, the promotion engine, import merge/dedup, and archive serialization — all unit-tested, ready for the (Stitch-designed) UI to consume.

**Architecture:** Pure TypeScript modules under `src/domain/` with zero Vue imports, fully unit-tested with Vitest. The Pinia store and Vue screens (registry list, promotion wizard, import review) are built in later UI plans once Stitch designs land; this plan also wires the new snapshot behavior into the existing measurement flow so nothing regresses.

**Tech Stack:** TypeScript, Vitest. (Vue 3 + Pinia exist but are only touched in the final integration task.)

## Global Constraints

- **No git in this project.** Replace every "commit" with a green-tests checkpoint. Never run `git`.
- Student record is **current-state only**: `id, firstName, lastName, dob, gender, grade, room`. No status/history fields.
- Measurement is **immutable** and **self-describing**: it stores `year, term, round, grade, room` (snapshot at record time) plus `date, weightKg, heightCm, savedAt`.
- Weight/height stored at **1 decimal** (use existing `round1` from `src/domain/validation/rules.ts`).
- Thai Buddhist-era years (`พ.ศ.`). Academic year is numbered by its starting year; **ภาคเรียน 2 spans Jan–Mar of the next calendar year** (the off-by-one rule).
- Student `id` (รหัสนักเรียน) is unique in the active registry; import is the one place duplicates are reconciled.
- All user-facing strings are **Thai**.
- Grade ladder + `promote`/`demote`/`isMaxGrade` already exist in `src/domain/grade/ladder.ts` — reuse, do not reimplement.

---

## File Structure

```
src/domain/
  types.ts                       # MODIFY: add grade/room to Measurement; add AcademicPeriod
  period/academic-period.ts      # CREATE: defaultPeriod, formatPeriod
  measurement/create.ts          # CREATE: createMeasurement (snapshots grade/room/period)
  promotion/plan.ts              # CREATE: computePromotionPlan, applyPromotion
  import/merge.ts                # CREATE: reconcileImport, applyImport
  archive/export.ts              # CREATE: archive rows, CSV, filenames
src/stores/data.ts               # MODIFY (final task): wire domain into the store
src/features/MeasureView.vue     # MODIFY (final task): snapshot via createMeasurement
tests/domain/                    # CREATE: one test file per module above
```

---

## Task 1: Measurement snapshot fields + AcademicPeriod type + createMeasurement

**Files:**
- Modify: `src/domain/types.ts`
- Create: `src/domain/measurement/create.ts`
- Test: `tests/domain/create-measurement.test.ts`

**Interfaces:**
- Consumes: `round1` from `src/domain/validation/rules.ts`.
- Produces:
  ```ts
  interface AcademicPeriod { year: string; term: Term; round: Round; }
  // Measurement gains: grade: string; room: string;
  interface MeasurementInput { date: string; weightKg: number; heightCm: number; }
  function createMeasurement(student: Student, period: AcademicPeriod, input: MeasurementInput, now?: number): Measurement;
  ```

- [ ] **Step 1: Modify `src/domain/types.ts`** — add `grade`/`room` to `Measurement` and add `AcademicPeriod`.

Add the two fields to the `Measurement` interface (after `round`) and append the new type:

```ts
export interface Measurement {
  studentId: string;
  year: string;
  term: Term;
  round: Round;
  grade: string; // snapshot of ชั้น at record time
  room: string;  // snapshot of ห้อง at record time
  date: string;
  weightKg: number;
  heightCm: number;
  savedAt: number;
}

export interface AcademicPeriod {
  year: string;
  term: Term;
  round: Round;
}
```

- [ ] **Step 2: Write the failing test** — `tests/domain/create-measurement.test.ts`

```ts
import { describe, it, expect } from 'vitest';
import { createMeasurement } from '../../src/domain/measurement/create';
import type { Student, AcademicPeriod } from '../../src/domain/types';

const student: Student = {
  id: '101', firstName: 'ก', lastName: 'ข', dob: '15/5/2559', gender: 'ชาย', grade: 'ป.1', room: '2',
};
const period: AcademicPeriod = { year: '2569', term: '1', round: '1' };

describe('createMeasurement', () => {
  it('snapshots grade/room from the student and period fields', () => {
    const m = createMeasurement(student, period, { date: '1/6/2569', weightKg: 18, heightCm: 112 }, 1000);
    expect(m).toEqual({
      studentId: '101', year: '2569', term: '1', round: '1',
      grade: 'ป.1', room: '2', date: '1/6/2569',
      weightKg: 18, heightCm: 112, savedAt: 1000,
    });
  });
  it('rounds weight and height to one decimal', () => {
    const m = createMeasurement(student, period, { date: '1/6/2569', weightKg: 18.04, heightCm: 112.55 }, 1);
    expect(m.weightKg).toBe(18);
    expect(m.heightCm).toBe(112.6);
  });
  it('does not change if the student grade later changes (snapshot is a copy)', () => {
    const m = createMeasurement(student, period, { date: '1/6/2569', weightKg: 18, heightCm: 112 }, 1);
    student.grade = 'ป.2';
    expect(m.grade).toBe('ป.1');
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx vitest run tests/domain/create-measurement.test.ts`
Expected: FAIL (module not found).

- [ ] **Step 4: Implement `src/domain/measurement/create.ts`**

```ts
import type { Student, Measurement, AcademicPeriod } from '../types';
import { round1 } from '../validation/rules';

export interface MeasurementInput {
  date: string;
  weightKg: number;
  heightCm: number;
}

export function createMeasurement(
  student: Student,
  period: AcademicPeriod,
  input: MeasurementInput,
  now: number = Date.now(),
): Measurement {
  return {
    studentId: student.id,
    year: period.year,
    term: period.term,
    round: period.round,
    grade: student.grade,
    room: student.room,
    date: input.date,
    weightKg: round1(input.weightKg),
    heightCm: round1(input.heightCm),
    savedAt: now,
  };
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run tests/domain/create-measurement.test.ts`
Expected: PASS.

- [ ] **Step 6: Checkpoint** — `npm test` all green; `npx vue-tsc --noEmit` no errors.

---

## Task 2: Thai academic-period logic

**Files:**
- Create: `src/domain/period/academic-period.ts`
- Test: `tests/domain/academic-period.test.ts`

**Interfaces:**
- Consumes: `AcademicPeriod` from `src/domain/types`.
- Produces:
  ```ts
  function defaultPeriod(d?: Date): AcademicPeriod;  // term/year derived from Thai calendar
  function formatPeriod(p: AcademicPeriod): string;  // "ปีการศึกษา 2569 · ภาคเรียน 1 · ครั้งที่ 1"
  ```

- [ ] **Step 1: Write the failing test** — `tests/domain/academic-period.test.ts`

```ts
import { describe, it, expect } from 'vitest';
import { defaultPeriod, formatPeriod } from '../../src/domain/period/academic-period';

// Months are 0-indexed in JS Date.
describe('defaultPeriod', () => {
  it('May–Oct → current BE year, term 1', () => {
    expect(defaultPeriod(new Date(2026, 5, 15))).toEqual({ year: '2569', term: '1', round: '1' }); // June
    expect(defaultPeriod(new Date(2026, 9, 1))).toEqual({ year: '2569', term: '1', round: '1' });  // Oct
  });
  it('Nov–Dec → current BE year, term 2', () => {
    expect(defaultPeriod(new Date(2026, 10, 1))).toEqual({ year: '2569', term: '2', round: '1' }); // Nov
  });
  it('Jan–Mar → PREVIOUS BE year, term 2 (the off-by-one rule)', () => {
    expect(defaultPeriod(new Date(2026, 0, 20))).toEqual({ year: '2568', term: '2', round: '1' }); // Jan
    expect(defaultPeriod(new Date(2026, 2, 31))).toEqual({ year: '2568', term: '2', round: '1' }); // Mar
  });
  it('April (break) → upcoming BE year, term 1', () => {
    expect(defaultPeriod(new Date(2026, 3, 10))).toEqual({ year: '2569', term: '1', round: '1' }); // Apr
  });
});

describe('formatPeriod', () => {
  it('formats Thai period label', () => {
    expect(formatPeriod({ year: '2569', term: '1', round: '1' }))
      .toBe('ปีการศึกษา 2569 · ภาคเรียน 1 · ครั้งที่ 1');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/domain/academic-period.test.ts`
Expected: FAIL (module not found).

- [ ] **Step 3: Implement `src/domain/period/academic-period.ts`**

```ts
import type { AcademicPeriod } from '../types';

// Thai academic year is numbered by its starting (BE) year.
// ภาคเรียน 1 ≈ พ.ค.–ต.ค., ภาคเรียน 2 ≈ พ.ย.–มี.ค. (crosses into the next calendar year),
// เม.ย. = ปิดเทอมใหญ่ (between years).
export function defaultPeriod(d: Date = new Date()): AcademicPeriod {
  const be = d.getFullYear() + 543;
  const month = d.getMonth() + 1; // 1–12
  if (month >= 5 && month <= 10) return { year: String(be), term: '1', round: '1' };
  if (month >= 11) return { year: String(be), term: '2', round: '1' };
  if (month >= 1 && month <= 3) return { year: String(be - 1), term: '2', round: '1' };
  // April: between years → default to the upcoming year's term 1
  return { year: String(be), term: '1', round: '1' };
}

export function formatPeriod(p: AcademicPeriod): string {
  return `ปีการศึกษา ${p.year} · ภาคเรียน ${p.term} · ครั้งที่ ${p.round}`;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/domain/academic-period.test.ts`
Expected: PASS.

- [ ] **Step 5: Checkpoint** — `npm test` all green.

---

## Task 3: Promotion engine

**Files:**
- Create: `src/domain/promotion/plan.ts`
- Test: `tests/domain/promotion.test.ts`

**Interfaces:**
- Consumes: `Student` from `src/domain/types`; `promote`, `isMaxGrade` from `src/domain/grade/ladder.ts`.
- Produces:
  ```ts
  type PromotionAction = 'promote' | 'hold' | 'graduate';
  interface PromotionRow { studentId: string; action: PromotionAction; nextGrade: string; nextRoom: string; }
  interface PromotionResult { continuing: Student[]; graduates: Student[]; }
  function computePromotionPlan(students: Student[], maxGrade: string): PromotionRow[];
  function applyPromotion(students: Student[], rows: PromotionRow[]): PromotionResult;
  ```

- [ ] **Step 1: Write the failing test** — `tests/domain/promotion.test.ts`

```ts
import { describe, it, expect } from 'vitest';
import { computePromotionPlan, applyPromotion } from '../../src/domain/promotion/plan';
import type { Student } from '../../src/domain/types';

const mk = (id: string, grade: string, room = '1'): Student => ({
  id, firstName: 'n', lastName: 'l', dob: '1/1/2559', gender: 'ชาย', grade, room,
});

describe('computePromotionPlan', () => {
  it('defaults each student to +1, and graduates those at max grade', () => {
    const rows = computePromotionPlan([mk('a', 'ป.1'), mk('b', 'ป.6')], 'ป.6');
    expect(rows).toEqual([
      { studentId: 'a', action: 'promote', nextGrade: 'ป.2', nextRoom: '1' },
      { studentId: 'b', action: 'graduate', nextGrade: 'ป.6', nextRoom: '1' },
    ]);
  });
  it('promotes across bands (อ.3 → ป.1)', () => {
    expect(computePromotionPlan([mk('a', 'อ.3')], 'ป.6')[0].nextGrade).toBe('ป.1');
  });
});

describe('applyPromotion', () => {
  it('updates continuing students and separates graduates', () => {
    const students = [mk('a', 'ป.1'), mk('b', 'ป.6'), mk('c', 'ป.3')];
    const rows = computePromotionPlan(students, 'ป.6');
    const res = applyPromotion(students, rows);
    expect(res.graduates.map((s) => s.id)).toEqual(['b']);
    expect(res.continuing.find((s) => s.id === 'a')!.grade).toBe('ป.2');
    expect(res.continuing.find((s) => s.id === 'c')!.grade).toBe('ป.4');
  });
  it('honors a held (repeat) row — grade unchanged', () => {
    const students = [mk('a', 'ป.1')];
    const rows = [{ studentId: 'a', action: 'hold' as const, nextGrade: 'ป.1', nextRoom: '1' }];
    expect(applyPromotion(students, rows).continuing[0].grade).toBe('ป.1');
  });
  it('honors a room override', () => {
    const students = [mk('a', 'ป.1', '1')];
    const rows = [{ studentId: 'a', action: 'promote' as const, nextGrade: 'ป.2', nextRoom: '3' }];
    expect(applyPromotion(students, rows).continuing[0].room).toBe('3');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/domain/promotion.test.ts`
Expected: FAIL (module not found).

- [ ] **Step 3: Implement `src/domain/promotion/plan.ts`**

```ts
import type { Student } from '../types';
import { promote, isMaxGrade } from '../grade/ladder';

export type PromotionAction = 'promote' | 'hold' | 'graduate';

export interface PromotionRow {
  studentId: string;
  action: PromotionAction;
  nextGrade: string;
  nextRoom: string;
}

export interface PromotionResult {
  continuing: Student[];
  graduates: Student[];
}

export function computePromotionPlan(students: Student[], maxGrade: string): PromotionRow[] {
  return students.map((s) => {
    if (isMaxGrade(s.grade, maxGrade)) {
      return { studentId: s.id, action: 'graduate', nextGrade: s.grade, nextRoom: s.room };
    }
    return { studentId: s.id, action: 'promote', nextGrade: promote(s.grade), nextRoom: s.room };
  });
}

export function applyPromotion(students: Student[], rows: PromotionRow[]): PromotionResult {
  const byId = new Map(rows.map((r) => [r.studentId, r]));
  const continuing: Student[] = [];
  const graduates: Student[] = [];
  for (const s of students) {
    const row = byId.get(s.id);
    if (row && row.action === 'graduate') {
      graduates.push(s);
    } else if (row) {
      continuing.push({ ...s, grade: row.nextGrade, room: row.nextRoom });
    } else {
      continuing.push(s); // no row: leave unchanged (safety)
    }
  }
  return { continuing, graduates };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/domain/promotion.test.ts`
Expected: PASS.

- [ ] **Step 5: Checkpoint** — `npm test` all green.

---

## Task 4: Import merge & duplicate reconciliation

**Files:**
- Create: `src/domain/import/merge.ts`
- Test: `tests/domain/import-merge.test.ts`

**Interfaces:**
- Consumes: `Student` from `src/domain/types`.
- Produces:
  ```ts
  type ConflictResolution = 'update' | 'skip';
  interface ImportConflict { existing: Student; incoming: Student; }
  interface ImportReconcile { toAdd: Student[]; conflicts: ImportConflict[]; }
  function reconcileImport(existing: Student[], incoming: Student[]): ImportReconcile;
  function applyImport(existing: Student[], recon: ImportReconcile, resolutions: Record<string, ConflictResolution>): Student[];
  ```

- [ ] **Step 1: Write the failing test** — `tests/domain/import-merge.test.ts`

```ts
import { describe, it, expect } from 'vitest';
import { reconcileImport, applyImport } from '../../src/domain/import/merge';
import type { Student } from '../../src/domain/types';

const mk = (id: string, firstName: string): Student => ({
  id, firstName, lastName: 'x', dob: '1/1/2559', gender: 'ชาย', grade: 'ป.1', room: '1',
});

describe('reconcileImport', () => {
  it('separates new students from id conflicts', () => {
    const existing = [mk('a', 'เก่า')];
    const incoming = [mk('a', 'ใหม่'), mk('b', 'บี')];
    const r = reconcileImport(existing, incoming);
    expect(r.toAdd.map((s) => s.id)).toEqual(['b']);
    expect(r.conflicts).toHaveLength(1);
    expect(r.conflicts[0].existing.firstName).toBe('เก่า');
    expect(r.conflicts[0].incoming.firstName).toBe('ใหม่');
  });
  it('dedupes incoming by id, last row wins', () => {
    const r = reconcileImport([], [mk('a', 'หนึ่ง'), mk('a', 'สอง')]);
    expect(r.toAdd).toHaveLength(1);
    expect(r.toAdd[0].firstName).toBe('สอง');
  });
});

describe('applyImport', () => {
  it('adds new and updates only conflicts resolved as update', () => {
    const existing = [mk('a', 'เก่า'), mk('c', 'ซี')];
    const recon = reconcileImport(existing, [mk('a', 'ใหม่'), mk('b', 'บี')]);
    const result = applyImport(existing, recon, { a: 'update' });
    expect(result.find((s) => s.id === 'a')!.firstName).toBe('ใหม่');
    expect(result.find((s) => s.id === 'b')!.firstName).toBe('บี');
    expect(result.find((s) => s.id === 'c')!.firstName).toBe('ซี');
    expect(result).toHaveLength(3);
  });
  it('skips conflicts resolved as skip (keeps existing)', () => {
    const existing = [mk('a', 'เก่า')];
    const recon = reconcileImport(existing, [mk('a', 'ใหม่')]);
    const result = applyImport(existing, recon, { a: 'skip' });
    expect(result.find((s) => s.id === 'a')!.firstName).toBe('เก่า');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/domain/import-merge.test.ts`
Expected: FAIL (module not found).

- [ ] **Step 3: Implement `src/domain/import/merge.ts`**

```ts
import type { Student } from '../types';

export type ConflictResolution = 'update' | 'skip';
export interface ImportConflict { existing: Student; incoming: Student; }
export interface ImportReconcile { toAdd: Student[]; conflicts: ImportConflict[]; }

export function reconcileImport(existing: Student[], incoming: Student[]): ImportReconcile {
  const existingById = new Map(existing.map((s) => [s.id, s]));
  // dedupe incoming by id, last row wins
  const incomingById = new Map<string, Student>();
  for (const s of incoming) incomingById.set(s.id, s);

  const toAdd: Student[] = [];
  const conflicts: ImportConflict[] = [];
  for (const inc of incomingById.values()) {
    const exist = existingById.get(inc.id);
    if (exist) conflicts.push({ existing: exist, incoming: inc });
    else toAdd.push(inc);
  }
  return { toAdd, conflicts };
}

export function applyImport(
  existing: Student[],
  recon: ImportReconcile,
  resolutions: Record<string, ConflictResolution>,
): Student[] {
  const updates = new Map<string, Student>();
  for (const c of recon.conflicts) {
    if (resolutions[c.incoming.id] === 'update') updates.set(c.incoming.id, c.incoming);
  }
  const merged = existing.map((s) => updates.get(s.id) ?? s);
  return [...merged, ...recon.toAdd];
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/domain/import-merge.test.ts`
Expected: PASS.

- [ ] **Step 5: Checkpoint** — `npm test` all green.

---

## Task 5: Archive serialization (graduates / transfers)

**Files:**
- Create: `src/domain/archive/export.ts`
- Test: `tests/domain/archive.test.ts`

> **Open decision (flag for the user, do not block):** the spec's reassurance copy shows an `.xlsx` filename, but the app has no xlsx library. This task produces **CSV** (opens in Excel) and uses a `.csv` extension. If true `.xlsx` is required for the shown filename, add SheetJS in a later task. Build CSV now.

**Interfaces:**
- Consumes: `Student`, `Measurement` from `src/domain/types`.
- Produces:
  ```ts
  function graduateArchiveFilename(year: string): string;     // "รายชื่อนักเรียนจบการศึกษา ปีการศึกษา 2569.csv"
  function transferArchiveFilename(dateLabel: string): string; // "นักเรียนนำออก 20-6-2569.csv"
  interface ArchiveRow { id; firstName; lastName; gender; dob; grade; room; year; term; round; date; weightKg; heightCm; }
  function buildArchiveRows(students: Student[], measures: Measurement[]): ArchiveRow[];
  function toCsv(rows: ArchiveRow[]): string;
  ```

- [ ] **Step 1: Write the failing test** — `tests/domain/archive.test.ts`

```ts
import { describe, it, expect } from 'vitest';
import { graduateArchiveFilename, transferArchiveFilename, buildArchiveRows, toCsv } from '../../src/domain/archive/export';
import type { Student, Measurement } from '../../src/domain/types';

const s: Student = { id: '101', firstName: 'ก', lastName: 'ข', dob: '15/5/2559', gender: 'ชาย', grade: 'ป.6', room: '1' };
const m: Measurement = { studentId: '101', year: '2569', term: '1', round: '1', grade: 'ป.6', room: '1', date: '1/6/2569', weightKg: 40, heightCm: 150, savedAt: 1 };

describe('filenames', () => {
  it('graduate filename includes the academic year', () => {
    expect(graduateArchiveFilename('2569')).toBe('รายชื่อนักเรียนจบการศึกษา ปีการศึกษา 2569.csv');
  });
  it('transfer filename includes the date label', () => {
    expect(transferArchiveFilename('20-6-2569')).toBe('นักเรียนนำออก 20-6-2569.csv');
  });
});

describe('buildArchiveRows', () => {
  it('emits one row per measurement with snapshot context', () => {
    const rows = buildArchiveRows([s], [m]);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ id: '101', grade: 'ป.6', year: '2569', weightKg: 40 });
  });
  it('emits a measurement-less row for a student with no measurements', () => {
    const rows = buildArchiveRows([s], []);
    expect(rows).toHaveLength(1);
    expect(rows[0].id).toBe('101');
    expect(rows[0].date).toBe('');
  });
});

describe('toCsv', () => {
  it('produces a header row and a data row', () => {
    const csv = toCsv(buildArchiveRows([s], [m]));
    const lines = csv.split('\n');
    expect(lines[0]).toContain('รหัสนักเรียน');
    expect(lines[1]).toContain('101');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/domain/archive.test.ts`
Expected: FAIL (module not found).

- [ ] **Step 3: Implement `src/domain/archive/export.ts`**

```ts
import type { Student, Measurement } from '../types';

export function graduateArchiveFilename(year: string): string {
  return `รายชื่อนักเรียนจบการศึกษา ปีการศึกษา ${year}.csv`;
}

export function transferArchiveFilename(dateLabel: string): string {
  return `นักเรียนนำออก ${dateLabel}.csv`;
}

export interface ArchiveRow {
  id: string; firstName: string; lastName: string; gender: string; dob: string;
  grade: string; room: string;
  year: string; term: string; round: string; date: string;
  weightKg: number | ''; heightCm: number | '';
}

export function buildArchiveRows(students: Student[], measures: Measurement[]): ArchiveRow[] {
  const rows: ArchiveRow[] = [];
  for (const s of students) {
    const ms = measures.filter((m) => m.studentId === s.id);
    if (ms.length === 0) {
      rows.push({
        id: s.id, firstName: s.firstName, lastName: s.lastName, gender: s.gender, dob: s.dob,
        grade: s.grade, room: s.room, year: '', term: '', round: '', date: '', weightKg: '', heightCm: '',
      });
    } else {
      for (const m of ms) {
        rows.push({
          id: s.id, firstName: s.firstName, lastName: s.lastName, gender: s.gender, dob: s.dob,
          grade: m.grade, room: m.room, year: m.year, term: m.term, round: m.round, date: m.date,
          weightKg: m.weightKg, heightCm: m.heightCm,
        });
      }
    }
  }
  return rows;
}

const HEADERS: { key: keyof ArchiveRow; label: string }[] = [
  { key: 'id', label: 'รหัสนักเรียน' },
  { key: 'firstName', label: 'ชื่อ' },
  { key: 'lastName', label: 'นามสกุล' },
  { key: 'gender', label: 'เพศ' },
  { key: 'dob', label: 'วันเกิด' },
  { key: 'grade', label: 'ชั้น' },
  { key: 'room', label: 'ห้อง' },
  { key: 'year', label: 'ปีการศึกษา' },
  { key: 'term', label: 'ภาคเรียน' },
  { key: 'round', label: 'ครั้งที่' },
  { key: 'date', label: 'วันที่วัด' },
  { key: 'weightKg', label: 'น้ำหนัก(กก.)' },
  { key: 'heightCm', label: 'ส่วนสูง(ซม.)' },
];

function escapeCsv(v: string): string {
  return /[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
}

export function toCsv(rows: ArchiveRow[]): string {
  const head = HEADERS.map((h) => h.label).join(',');
  const body = rows.map((r) => HEADERS.map((h) => escapeCsv(String(r[h.key]))).join(','));
  return [head, ...body].join('\n');
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/domain/archive.test.ts`
Expected: PASS.

- [ ] **Step 5: Checkpoint** — `npm test` all green.

---

## Task 6: Wire snapshot into the existing measurement flow (integration)

**Files:**
- Modify: `src/stores/data.ts`
- Modify: `src/features/MeasureView.vue`
- Test: manual (build + type-check); no new unit test (Pinia + localStorage integration).

**Interfaces:**
- Consumes: `createMeasurement` (Task 1), `defaultPeriod`/`formatPeriod` (Task 2), `AcademicPeriod` (Task 1).
- Produces: store exposes a `period` ref and a `recordMeasurement(student, input)` helper that snapshots via `createMeasurement`.

> Context: the prototype's `MeasureView.vue` builds a `Measurement` inline without `grade`/`room`. After Task 1 that object is missing required fields and will not type-check. This task routes measurement creation through `createMeasurement` so snapshots are always set, and gives the store a single global `period`.

- [ ] **Step 1: Add a global period + recorder to `src/stores/data.ts`**

Add imports at the top:

```ts
import type { Student, Measurement, Setup, AcademicPeriod } from '../domain/types';
import { createMeasurement, type MeasurementInput } from '../domain/measurement/create';
import { defaultPeriod } from '../domain/period/academic-period';
```

Add a persisted `period` ref (new localStorage key) inside the store setup, near the other refs:

```ts
const KP = 'ntr2_period';
const period = ref<AcademicPeriod>(load<AcademicPeriod>(KP, defaultPeriod()));
```

Include it in `persist()`:

```ts
localStorage.setItem(KP, JSON.stringify(period.value));
```

Add a recorder and a period setter (place beside `addMeasure`):

```ts
function setPeriod(p: AcademicPeriod) { period.value = p; persist(); }

function recordMeasurement(student: Student, input: MeasurementInput) {
  measures.value.push(createMeasurement(student, period.value, input));
  persist();
}
```

Export `period`, `setPeriod`, `recordMeasurement` in the store's returned object.

- [ ] **Step 2: Update `src/features/MeasureView.vue` to snapshot via the store**

Replace its inline `data.addMeasure({...})` construction in `save()` with the recorder, using the store period instead of the local `ctx.year/term/round` typing. Concretely, change the save body to:

```ts
data.recordMeasurement(student.value!, {
  date: ctx.date,
  weightKg: round1(parseFloat(entry.weight)),
  heightCm: round1(parseFloat(entry.height)),
});
```

And in the duplicate check, compare against `data.period` instead of `ctx`:

```ts
const exists = data.measures.some(
  (m) =>
    m.studentId === ctx.studentId &&
    m.year === data.period.year &&
    m.term === data.period.term &&
    m.round === data.period.round,
);
```

Bind the year/term/round controls in the template to `data.period` (via `setPeriod`) instead of local `ctx`, OR remove them from this screen for now and show the read-only period from `formatPeriod(data.period)`. Keeping the live preview working only requires `student`, `entry.weight`, `entry.height`, and the date.

- [ ] **Step 3: Type-check**

Run: `npx vue-tsc --noEmit`
Expected: no errors (the inline Measurement without grade/room is gone).

- [ ] **Step 4: Build**

Run: `npm run build`
Expected: single `dist/index.html` produced.

- [ ] **Step 5: Manual smoke (optional but recommended)**

Run `npm run dev`, record a measurement, confirm in devtools that the saved record in `localStorage['ntr2_measures']` includes `grade` and `room`. (Screenshots, if any, go to `.playwright-mcp/` per CLAUDE.md.)

- [ ] **Step 6: Checkpoint** — `npm test` all green; `npx vue-tsc --noEmit` clean; build succeeds.

---

## Self-Review (completed)

- **Spec coverage:** Measurement snapshot (§2) → Tasks 1, 6. Academic period + Thai-calendar default (§3) → Task 2 (+ store in Task 6). Promotion engine (§5 steps 3–5 logic) → Task 3. Import merge + duplicate resolution (§7) → Task 4. Archive serialization + filenames (§5 step 4, §6) → Task 5. **UI surfaces** (registry list/filters, promotion wizard screens, import review screen, transfer-out UI, period chip) are intentionally **out of this plan** — they are separate UI plans pending Stitch designs; this plan delivers the logic they will call.
- **Placeholder scan:** none — every step has real code/commands.
- **Type consistency:** `AcademicPeriod` defined in Task 1, consumed by Tasks 2 & 6. `Measurement` (with `grade`/`room`) from Task 1 used by Tasks 5 & 6. `PromotionRow`/`PromotionResult` consistent within Task 3. `ImportReconcile`/`ConflictResolution` consistent within Task 4. `createMeasurement` signature identical in Tasks 1 and 6.
- **Open decision flagged:** archive uses `.csv` (Excel-openable); true `.xlsx` would need SheetJS in a later task — surfaced in Task 5, not silently decided.
