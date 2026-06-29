# Year-Based Dataset Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restructure storage so each Academic Year is a self-contained, immutable snapshot (one active + N archived read-only), replacing the single mutable rolling roster.

**Architecture:** Domain-first. Pure framework-free transforms (`migrateV1`, `buildNextYear`, year/school backup) are built and unit-tested before any store/UI. A new thin `useSchool` Pinia store owns the manifest + per-year localStorage keys; the existing `useData` store is retargeted to operate on the *active* year's snapshot while holding its public API stable so views barely change. UI adds a year switcher (on the existing period-chip), a read-only "archived" skin, evolves the Promotion Wizard into the New Academic Year flow, and adds a scoped Backup & Restore menu.

**Tech Stack:** Vue 3 + TS, Pinia, Vite, Vitest. localStorage persistence. No new runtime deps.

**Spec:** `docs/superpowers/specs/2026-06-29-year-based-dataset-design.md` · **UI:** `…-ui-design.md` · **Decisions/blockers:** `…-OPEN-QUESTIONS.md`

## Global Constraints

- **NO GIT. EVER.** The user does all commits. No subagent or step runs `git add/commit/push/stash/checkout` or any state-changing git. "Commit" steps below are **CHECKPOINT** markers: stop, report, let the user commit. Stay on branch `master`.
- **Write files with Write/Edit tools, never shell heredoc/echo.**
- `tsconfig` has `noUnusedLocals` — no unused imports (build fails).
- Domain (`src/domain/**`) stays framework-free + unit-tested (Vitest). No Vue/Pinia imports there.
- Chart.js keep `animation: false`. Thai BE dates `D/M/YYYY`.
- Storage keys namespaced `ntr2_v2_*`; legacy `ntr2_*` keys left intact (migration source / rollback).
- Verify type-check with `npx vue-tsc --noEmit` and tests with `npm test`. Dev server is the user's on :5173 — never start/kill it.
- Thai-first copy: archived = **เก็บถาวร**; active = **กำลังใช้งาน**.
- Reuse existing domain: `planPromotion`/`applyPromotion` (`src/domain/promotion/promote.ts`), `promote`/`isMaxGrade`/`GRADE_ORDER` (`src/domain/grade/ladder.ts`).

---

## File Structure

- `src/domain/types.ts` — split `Setup`; add `SchoolIdentity`, `YearSnapshot`, `YearStatus`, `YearMeta`, `SchoolManifest`, `SchoolFile`, `ReadonlyYearError`.
- `src/domain/school/migrate.ts` (new) — `migrateV1(v1) → SchoolFile`.
- `src/domain/year/rollover.ts` (new) — `buildNextYear(prev, decisions, meta) → YearSnapshot`.
- `src/domain/transfer/backup.ts` (modify) — add year-bundle + school serialize/parse; keep v1 fns for migration import.
- `src/stores/school.ts` (new) — manifest + per-year + identity localStorage; create/archive/delete/setActive, import/export orchestration.
- `src/stores/data.ts` (modify) — retarget to active snapshot; `isReadonly`, `assertWritable`; reassemble `Setup` view.
- `src/components/YearSwitcher.vue` (new) — sheet opened from period-chip.
- `src/components/ArchivedBanner.vue` (new) — read-only banner.
- `src/components/AppHeader.vue` (modify) — chip opens switcher; archived chip variant.
- `src/features/PromotionView.vue` (modify) — evolve into New Academic Year flow over `buildNextYear`.
- `src/features/SettingsView.vue` (modify) — Backup & Restore scoped menu.
- `src/journeys.css` (modify) — archived skin + switcher styles.

---

## Task 1: Types — split Setup, add year-model types

**Files:**
- Modify: `src/domain/types.ts`
- Test: `tests/domain/types.test.ts` (new)

**Interfaces:**
- Produces:
  - `interface SchoolIdentity { school, ministry, department, subdistrict, district, province: string }`
  - `interface YearSnapshot { year: string; createdAt: number; teacher: string; maxGrade: string; classrooms: { grade: string; rooms: string[] }[]; students: Student[]; measures: Measurement[] }`
  - `type YearStatus = 'active' | 'archived'`
  - `interface YearMeta { year: string; status: YearStatus; createdAt: number }`
  - `interface SchoolManifest { schemaVersion: 2; years: YearMeta[] }`
  - `interface SchoolFile { schemaVersion: 2; identity: SchoolIdentity; years: YearSnapshot[] }`
  - `class ReadonlyYearError extends Error`
  - Keep existing `Setup` (used by legacy backup import + as the reassembled view shape).

- [ ] **Step 1: Write failing test**

```ts
// tests/domain/types.test.ts
import { describe, it, expect } from 'vitest';
import { ReadonlyYearError } from '../../src/domain/types';

describe('ReadonlyYearError', () => {
  it('is an Error with the year in its message', () => {
    const e = new ReadonlyYearError('2568');
    expect(e).toBeInstanceOf(Error);
    expect(e.name).toBe('ReadonlyYearError');
    expect(e.message).toContain('2568');
  });
});
```

- [ ] **Step 2: Run, verify fail** — `npm test -- types` → FAIL (no export `ReadonlyYearError`).

- [ ] **Step 3: Implement** — append to `src/domain/types.ts`:

```ts
export interface SchoolIdentity {
  school: string;
  ministry: string;
  department: string;
  subdistrict: string;
  district: string;
  province: string;
}

export interface YearSnapshot {
  year: string;
  createdAt: number;
  teacher: string;
  maxGrade: string;
  classrooms: { grade: string; rooms: string[] }[];
  students: Student[];
  measures: Measurement[];
}

export type YearStatus = 'active' | 'archived';
export interface YearMeta { year: string; status: YearStatus; createdAt: number }
export interface SchoolManifest { schemaVersion: 2; years: YearMeta[] }
export interface SchoolFile { schemaVersion: 2; identity: SchoolIdentity; years: YearSnapshot[] }

export class ReadonlyYearError extends Error {
  constructor(year: string) {
    super(`ปีการศึกษา ${year} เก็บถาวรแล้ว (อ่านอย่างเดียว)`);
    this.name = 'ReadonlyYearError';
  }
}
```

- [ ] **Step 4: Run, verify pass** — `npm test -- types` → PASS. Then `npx vue-tsc --noEmit` → clean.
- [ ] **Step 5: CHECKPOINT** — stop; user commits.

---

## Task 2: `migrateV1` — legacy flat state → SchoolFile

**Files:**
- Create: `src/domain/school/migrate.ts`
- Test: `tests/school/migrate.test.ts` (new)

**Interfaces:**
- Consumes: types from Task 1; `Setup` (legacy).
- Produces:
  - `interface V1State { students: Student[]; measures: Measurement[]; setup: Setup; period: { year: string }; classrooms: { grade: string; rooms: string[] }[] }`
  - `function migrateV1(v1: V1State): SchoolFile` — one active `YearSnapshot` (`year = v1.period.year`, `createdAt = Date.now()`, `teacher`/`maxGrade` lifted from `setup`); identity = remaining setup fields.
  - `function splitSetup(s: Setup): { identity: SchoolIdentity; teacher: string; maxGrade: string }` (exported; reused by store boot).

- [ ] **Step 1: Write failing test**

```ts
// tests/school/migrate.test.ts
import { describe, it, expect } from 'vitest';
import { migrateV1, splitSetup } from '../../src/domain/school/migrate';
import type { Setup } from '../../src/domain/types';

const setup: Setup = {
  school: 'รร.ทดสอบ', ministry: 'ศธ', department: 'สพฐ',
  subdistrict: 'ต', district: 'อ', province: 'จ',
  teacher: 'ครูเอ', maxGrade: 'ป.6',
};

describe('splitSetup', () => {
  it('separates identity from year-specific teacher/maxGrade', () => {
    const r = splitSetup(setup);
    expect(r.teacher).toBe('ครูเอ');
    expect(r.maxGrade).toBe('ป.6');
    expect(r.identity.school).toBe('รร.ทดสอบ');
    expect('teacher' in r.identity).toBe(false);
  });
});

describe('migrateV1', () => {
  it('builds one active year from flat v1 state', () => {
    const s = migrateV1({
      students: [{ id: '1', firstName: 'ก', lastName: 'ข', dob: '1/1/2560', gender: 'ชาย', grade: 'ป.1', room: '1' }],
      measures: [],
      setup,
      period: { year: '2568' },
      classrooms: [{ grade: 'ป.1', rooms: ['1'] }],
    });
    expect(s.schemaVersion).toBe(2);
    expect(s.identity.province).toBe('จ');
    expect(s.years).toHaveLength(1);
    const y = s.years[0];
    expect(y.year).toBe('2568');
    expect(y.teacher).toBe('ครูเอ');
    expect(y.maxGrade).toBe('ป.6');
    expect(y.students).toHaveLength(1);
    expect(y.classrooms).toEqual([{ grade: 'ป.1', rooms: ['1'] }]);
  });
});
```

- [ ] **Step 2: Run, verify fail** — `npm test -- migrate` → FAIL.

- [ ] **Step 3: Implement** `src/domain/school/migrate.ts`:

```ts
import type { Setup, SchoolIdentity, SchoolFile, Student, Measurement } from '../types';

export interface V1State {
  students: Student[];
  measures: Measurement[];
  setup: Setup;
  period: { year: string };
  classrooms: { grade: string; rooms: string[] }[];
}

export function splitSetup(s: Setup): { identity: SchoolIdentity; teacher: string; maxGrade: string } {
  const { teacher, maxGrade, ...identity } = s;
  return { identity, teacher, maxGrade };
}

export function migrateV1(v1: V1State): SchoolFile {
  const { identity, teacher, maxGrade } = splitSetup(v1.setup);
  return {
    schemaVersion: 2,
    identity,
    years: [{
      year: v1.period.year,
      createdAt: Date.now(),
      teacher,
      maxGrade,
      classrooms: v1.classrooms,
      students: v1.students,
      measures: v1.measures,
    }],
  };
}
```

- [ ] **Step 4: Run, verify pass** — `npm test -- migrate` → PASS; `npx vue-tsc --noEmit` clean.
- [ ] **Step 5: CHECKPOINT** — user commits.

**Note (blank year):** if `v1.period.year` is `''`, migration still produces a year with `year:''`; the store (Task 5) prompts the teacher to name it on boot. Don't invent a year here.

---

## Task 3: `buildNextYear` — non-destructive rollover

**Files:**
- Create: `src/domain/year/rollover.ts`
- Test: `tests/year/rollover.test.ts` (new)

**Interfaces:**
- Consumes: `Student`, `YearSnapshot` (Task 1); `planPromotion`/`applyPromotion` are NOT reused directly here (they mutate a store); instead reuse pure `promote`/`isMaxGrade` from `grade/ladder.ts`.
- Produces:
  - `type RolloverAction = 'promote' | 'repeat' | 'graduate'`
  - `interface RolloverDecision { action: RolloverAction; room?: string }`
  - `interface NextYearMeta { year: string; teacher: string; maxGrade: string; classrooms: { grade: string; rooms: string[] }[] }`
  - `function buildNextYear(prev: YearSnapshot, decisions: Record<string, RolloverDecision>, meta: NextYearMeta): YearSnapshot` — copies students (same `id`), applies per-student action (default `promote` when no decision), omits graduates, `measures: []`, `createdAt: Date.now()`.

- [ ] **Step 1: Write failing test**

```ts
// tests/year/rollover.test.ts
import { describe, it, expect } from 'vitest';
import { buildNextYear } from '../../src/domain/year/rollover';
import type { YearSnapshot } from '../../src/domain/types';

const prev: YearSnapshot = {
  year: '2568', createdAt: 1, teacher: 'ครูเอ', maxGrade: 'ป.6',
  classrooms: [{ grade: 'ป.1', rooms: ['1'] }, { grade: 'ป.6', rooms: ['1'] }],
  students: [
    { id: 'a', firstName: 'ก', lastName: 'x', dob: '1/1/2560', gender: 'ชาย', grade: 'ป.1', room: '1' },
    { id: 'z', firstName: 'จ', lastName: 'y', dob: '1/1/2555', gender: 'หญิง', grade: 'ป.6', room: '1' },
  ],
  measures: [{ studentId: 'a', year: '2568', term: '1', round: '1', date: '1/6/2568', weightKg: 20, heightCm: 120, savedAt: 1, gradeAtMeasure: 'ป.1', roomAtMeasure: '1' }],
};

describe('buildNextYear', () => {
  it('promotes by default, omits graduates, empties measures, keeps studentId', () => {
    const next = buildNextYear(prev, { z: { action: 'graduate' } }, {
      year: '2569', teacher: 'ครูบี', maxGrade: 'ป.6',
      classrooms: [{ grade: 'ป.2', rooms: ['1'] }],
    });
    expect(next.year).toBe('2569');
    expect(next.teacher).toBe('ครูบี');
    expect(next.measures).toEqual([]);
    expect(next.students.map((s) => s.id)).toEqual(['a']); // z graduated, omitted
    expect(next.students[0].grade).toBe('ป.2'); // promoted ป.1 → ป.2
  });

  it('repeat keeps grade; explicit room override applies', () => {
    const next = buildNextYear(prev, { a: { action: 'repeat', room: '2' }, z: { action: 'graduate' } },
      { year: '2569', teacher: 'ครูเอ', maxGrade: 'ป.6', classrooms: [] });
    expect(next.students[0].grade).toBe('ป.1');
    expect(next.students[0].room).toBe('2');
  });
});
```

- [ ] **Step 2: Run, verify fail** — `npm test -- rollover` → FAIL.

- [ ] **Step 3: Implement** `src/domain/year/rollover.ts`:

```ts
import type { Student, YearSnapshot } from '../types';
import { promote } from '../grade/ladder';

export type RolloverAction = 'promote' | 'repeat' | 'graduate';
export interface RolloverDecision { action: RolloverAction; room?: string }
export interface NextYearMeta {
  year: string; teacher: string; maxGrade: string;
  classrooms: { grade: string; rooms: string[] }[];
}

export function buildNextYear(
  prev: YearSnapshot,
  decisions: Record<string, RolloverDecision>,
  meta: NextYearMeta,
): YearSnapshot {
  const students: Student[] = [];
  for (const s of prev.students) {
    const action = decisions[s.id]?.action ?? 'promote';
    if (action === 'graduate') continue;
    const room = decisions[s.id]?.room ?? s.room;
    const grade = action === 'promote' ? promote(s.grade) : s.grade;
    students.push({ ...s, grade, room });
  }
  return {
    year: meta.year,
    createdAt: Date.now(),
    teacher: meta.teacher,
    maxGrade: meta.maxGrade,
    classrooms: meta.classrooms,
    students,
    measures: [],
  };
}
```

- [ ] **Step 4: Run, verify pass** — `npm test -- rollover` → PASS; `npx vue-tsc --noEmit` clean.
- [ ] **Step 5: CHECKPOINT** — user commits.

---

## Task 4: Backup — year-bundle + whole-school serialize/parse

**Files:**
- Modify: `src/domain/transfer/backup.ts`
- Test: `tests/transfer/backup-v2.test.ts` (new)

**Interfaces:**
- Consumes: `SchoolFile`, `SchoolIdentity`, `YearSnapshot` (Task 1).
- Produces:
  - `interface YearBundle { version: 'ntr2-year-1'; identity: SchoolIdentity; year: YearSnapshot }`
  - `function serializeYearBundle(identity: SchoolIdentity, year: YearSnapshot): string`
  - `function parseYearBundle(text: string): { identity: SchoolIdentity; year: YearSnapshot }`
  - `function serializeSchool(file: SchoolFile): string`
  - `function parseSchool(text: string): SchoolFile`
  - All apply the existing `savedAt ?? Date.now()` backfill on measures. Keep existing `serializeBackup`/`parseBackup` untouched (legacy import path).

- [ ] **Step 1: Write failing test**

```ts
// tests/transfer/backup-v2.test.ts
import { describe, it, expect } from 'vitest';
import { serializeYearBundle, parseYearBundle, serializeSchool, parseSchool } from '../../src/domain/transfer/backup';
import type { SchoolFile, SchoolIdentity, YearSnapshot } from '../../src/domain/types';

const identity: SchoolIdentity = { school: 'ร', ministry: 'ศ', department: 'ส', subdistrict: 'ต', district: 'อ', province: 'จ' };
const year: YearSnapshot = { year: '2569', createdAt: 1, teacher: 'ค', maxGrade: 'ป.6', classrooms: [], students: [], measures: [{ studentId: 'a', year: '2569', term: '1', round: '1', date: '1/6/2569', weightKg: 20, heightCm: 120, savedAt: 0, gradeAtMeasure: 'ป.1', roomAtMeasure: '1' }] };

describe('year bundle round-trip', () => {
  it('round-trips identity + year', () => {
    const r = parseYearBundle(serializeYearBundle(identity, year));
    expect(r.identity).toEqual(identity);
    expect(r.year.year).toBe('2569');
  });
  it('backfills missing savedAt', () => {
    const raw = JSON.parse(serializeYearBundle(identity, year));
    raw.year.measures[0].savedAt = undefined;
    const r = parseYearBundle(JSON.stringify(raw));
    expect(typeof r.year.measures[0].savedAt).toBe('number');
  });
  it('rejects garbage', () => {
    expect(() => parseYearBundle('not json')).toThrow();
  });
});

describe('school round-trip', () => {
  it('round-trips a full school file', () => {
    const file: SchoolFile = { schemaVersion: 2, identity, years: [year] };
    const r = parseSchool(serializeSchool(file));
    expect(r.years).toHaveLength(1);
    expect(r.identity.school).toBe('ร');
  });
});
```

- [ ] **Step 2: Run, verify fail** — `npm test -- backup-v2` → FAIL.

- [ ] **Step 3: Implement** — append to `src/domain/transfer/backup.ts`:

```ts
import type { SchoolFile, SchoolIdentity, YearSnapshot } from '../types';

const YEAR_VERSION = 'ntr2-year-1';

function backfillMeasures(y: YearSnapshot): YearSnapshot {
  return { ...y, measures: y.measures.map((m) => ({ ...m, savedAt: m.savedAt ?? Date.now() })) };
}

export function serializeYearBundle(identity: SchoolIdentity, year: YearSnapshot): string {
  return JSON.stringify({ version: YEAR_VERSION, identity, year });
}

export function parseYearBundle(text: string): { identity: SchoolIdentity; year: YearSnapshot } {
  let p: Record<string, unknown>;
  try { p = JSON.parse(text); } catch { throw new Error('ไฟล์ปีการศึกษาไม่ถูกต้อง'); }
  if (!p || p.version !== YEAR_VERSION || typeof p.identity !== 'object' || typeof p.year !== 'object') {
    throw new Error('ไฟล์ปีการศึกษาไม่ถูกต้อง');
  }
  return { identity: p.identity as SchoolIdentity, year: backfillMeasures(p.year as YearSnapshot) };
}

export function serializeSchool(file: SchoolFile): string {
  return JSON.stringify(file);
}

export function parseSchool(text: string): SchoolFile {
  let p: Record<string, unknown>;
  try { p = JSON.parse(text); } catch { throw new Error('ไฟล์สำรองทั้งโรงเรียนไม่ถูกต้อง'); }
  if (!p || p.schemaVersion !== 2 || typeof p.identity !== 'object' || !Array.isArray(p.years)) {
    throw new Error('ไฟล์สำรองทั้งโรงเรียนไม่ถูกต้อง');
  }
  return {
    schemaVersion: 2,
    identity: p.identity as SchoolIdentity,
    years: (p.years as YearSnapshot[]).map(backfillMeasures),
  };
}
```

- [ ] **Step 4: Run, verify pass** — `npm test -- backup-v2` → PASS; `npx vue-tsc --noEmit` clean.
- [ ] **Step 5: CHECKPOINT** — user commits.

---

## Task 5: `useSchool` store — manifest + per-year storage

**Files:**
- Create: `src/stores/school.ts`
- Test: `tests/stores/school.test.ts` (new)

**Interfaces:**
- Consumes: Task 1 types; `migrateV1`/`splitSetup` (Task 2); year/school backup (Task 4).
- Produces a Pinia store `useSchool` with:
  - state: `identity: Ref<SchoolIdentity>`, `years: Ref<YearMeta[]>`
  - getters: `activeYear: ComputedRef<string | null>`, `archivedYears`, `hasSchool`
  - `loadYear(year: string): YearSnapshot | null`, `saveYear(y: YearSnapshot): void`
  - `createYear(snapshot: YearSnapshot): void` (appends, sets it active, archives the previous active — enforces single-active invariant)
  - `setActive(year: string)`, `archiveYear(year: string)`, `deleteYear(year: string)`
  - `importYearBundle(text: string): { merged: string; replaced: boolean }`, `importSchool(text: string)`, `exportYear(year)`, `exportSchool()`
  - boot: `ensureMigrated()` — if no `ntr2_v2_manifest` and legacy keys exist, run `migrateV1` and write v2 keys (leave legacy intact).

**Storage keys:** `ntr2_v2_manifest`, `ntr2_v2_identity`, `ntr2_v2_year_<year>`.

- [ ] **Step 1: Write failing test** (use `setActivePinia(createPinia())` + a localStorage mock; follow the pattern in `tests/stores/data.test.ts`):

```ts
// tests/stores/school.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { useSchool } from '../../src/stores/school';
import type { YearSnapshot } from '../../src/domain/types';

const mkYear = (year: string): YearSnapshot => ({ year, createdAt: 1, teacher: 'ค', maxGrade: 'ป.6', classrooms: [], students: [], measures: [] });

beforeEach(() => { localStorage.clear(); setActivePinia(createPinia()); });

describe('useSchool', () => {
  it('createYear archives the prior active and keeps exactly one active', () => {
    const s = useSchool();
    s.createYear(mkYear('2568'));
    s.createYear(mkYear('2569'));
    expect(s.activeYear).toBe('2569');
    const actives = s.years.filter((y) => y.status === 'active');
    expect(actives).toHaveLength(1);
    expect(s.years.find((y) => y.year === '2568')!.status).toBe('archived');
  });

  it('loadYear round-trips a saved snapshot', () => {
    const s = useSchool();
    s.createYear(mkYear('2568'));
    expect(s.loadYear('2568')!.teacher).toBe('ค');
  });

  it('year import into existing school keeps destination identity', () => {
    const s = useSchool();
    s.identity = { school: 'KEEP', ministry: '', department: '', subdistrict: '', district: '', province: '' };
    s.createYear(mkYear('2568'));
    // build a bundle with a different identity
    const bundle = JSON.stringify({ version: 'ntr2-year-1', identity: { school: 'OTHER', ministry: '', department: '', subdistrict: '', district: '', province: '' }, year: mkYear('2570') });
    s.importYearBundle(bundle);
    expect(s.identity.school).toBe('KEEP');
    expect(s.years.some((y) => y.year === '2570')).toBe(true);
  });
});
```

- [ ] **Step 2: Run, verify fail** — `npm test -- school` → FAIL.

- [ ] **Step 3: Implement** `src/stores/school.ts`. Key rules:
  - `load<T>` / `save` helpers mirror `data.ts`.
  - `createYear(y)`: `saveYear(y)`; set every existing meta `status:'archived'`; push `{ year: y.year, status:'active', createdAt: y.createdAt }`; if year already in manifest, replace its meta + snapshot; persist manifest **last**.
  - `importYearBundle`: `parseYearBundle`; if `!hasSchool` adopt incoming identity, else keep current; if year exists return `{ merged: year, replaced: true }` only after caller confirmed (store just overwrites — the confirm prompt lives in UI Task 10); else add. Use `createYear` semantics but DO NOT auto-archive when merging an *older* archived year — only the imported year's own status: imported years come in as `archived` unless there is no active year. (Simplest correct rule: a freshly imported single year is `archived` if an active year already exists, else `active`.)
  - `importSchool`: `parseSchool`; replace identity + all years; rewrite all keys; newest year (max by `GRADE`/string compare on `createdAt`) becomes `active`, rest `archived`. Clear orphaned `ntr2_v2_year_*` keys not in the new manifest.
  - `ensureMigrated()`: if `localStorage.getItem('ntr2_v2_manifest')` is null and any `ntr2_*` legacy key exists, read legacy via existing `data.ts` key names, `migrateV1`, write v2 keys. Idempotent.

Implementer: keep this store thin and framework-thin; all transforms already live in domain. Persist on every mutation.

- [ ] **Step 4: Run, verify pass** — `npm test -- school` → PASS; `npx vue-tsc --noEmit` clean.
- [ ] **Step 5: CHECKPOINT** — user commits.

---

## Task 6: Retarget `useData` to the active snapshot

**Files:**
- Modify: `src/stores/data.ts`
- Test: `tests/stores/data.test.ts` (extend)

**Interfaces:**
- Consumes: `useSchool` (Task 5); `ReadonlyYearError` (Task 1).
- Produces: same public API as today, plus `isReadonly: ComputedRef<boolean>`, `viewingYear: Ref<string | null>` (which year is on screen; defaults to active), `viewYear(year)` / `viewActive()`. Mutations call private `assertWritable()` → throws `ReadonlyYearError` when `isReadonly`.
- The reassembled `setup` view = `{ ...school.identity, teacher, maxGrade }` of the **viewed** year, so existing reads of `data.setup.school/teacher/maxGrade` keep working.

**Behavior:** `students`/`measures`/`classrooms`/`setup` now derive from `useSchool().loadYear(viewingYear)`. `persist()` writes back via `school.saveYear(...)` **only when not readonly** (active year). `viewingYear === activeYear` ⇒ writable; archived ⇒ readonly.

- [ ] **Step 1: Write failing tests** (add to `tests/stores/data.test.ts`):

```ts
it('isReadonly true when viewing an archived year, and mutations throw', () => {
  const school = useSchool();
  school.createYear(/* 2568 active */); school.createYear(/* 2569 active, 2568 archived */);
  const data = useData();
  data.viewYear('2568');
  expect(data.isReadonly).toBe(true);
  expect(() => data.addStudent(/* any */)).toThrow('เก็บถาวร');
});

it('writes land in the active year snapshot', () => {
  const data = useData();
  data.addStudent(/* s */);
  expect(useSchool().loadYear(data.viewingYear!)!.students).toHaveLength(1);
});
```

- [ ] **Step 2: Run, verify fail.**
- [ ] **Step 3: Implement** — rewire `data.ts`:
  - Replace the six `load(KX,…)` refs with derived state from `useSchool`. Keep refs but hydrate them from `school.loadYear(viewingYear)`; on `persist()`, assemble a `YearSnapshot` and `school.saveYear(it)`.
  - Add `assertWritable()` at the top of every mutation (`addStudent`, `updateStudent`, `deleteStudent`, `addMeasure`, `upsertMeasure`, `deleteMeasure`, `setClassrooms`, `setPeriod`, `saveSetup`).
  - `isSetup`/`stats`/`structure`/`latest`/etc. unchanged (operate on the now-derived arrays).
  - On boot, `school.ensureMigrated()` then `viewActive()`.
- [ ] **Step 4: Run full suite** — `npm test` → all green (proves API hold: nutrition/report/charts/xlsx tests still pass). `npx vue-tsc --noEmit` clean.
- [ ] **Step 5: CHECKPOINT** — user commits.

**Risk note:** this is the blast center. If `replaceAll` (used by legacy import) still exists, keep it working by routing through `school.importSchool` semantics or migrate its single caller. Verify `tests/transfer/*` stay green.

---

## Task 7: Year switcher on the period-chip

**Files:**
- Create: `src/components/YearSwitcher.vue`
- Modify: `src/components/AppHeader.vue`, `src/journeys.css`
- Verify: manual (no component test harness in repo).

**Interfaces:**
- Consumes: `useSchool` (years, activeYear, setActive), `useData` (viewYear/viewActive).
- Behavior: tapping `.period-chip` opens `YearSwitcher` (use the accessible `Dialog.vue` pattern — native `<dialog>`, Esc, focus). Rows: active (brand-tint, `กำลังใช้งาน`, `[แก้ไขอยู่]`) + archived (`เก็บถาวร` + student count, `ดู →`). Footer button `+ ขึ้นปีการศึกษาใหม่` → routes to the New Academic Year wizard (Task 9). Selecting archived → `data.viewYear(year)` + close. Selecting active → `data.viewActive()`.

- [ ] **Step 1: Build `YearSwitcher.vue`** per `…-ui-design.md` §1. Real buttons, keyboard nav, `aria-label`. Counts from `school.loadYear(y).students.length`.
- [ ] **Step 2: Wire `AppHeader.vue`** — make the chip a `<button>` opening the switcher; show 🔒 + desaturated variant when `data.isReadonly`.
- [ ] **Step 3: Styles** in `journeys.css` (switcher rows, accent-aware, reduced-motion).
- [ ] **Step 4: Verify** — `npx vue-tsc --noEmit` clean; open localhost:5173, screenshot to `.playwright-mcp/year-switcher.png`; confirm active/archived rendering + keyboard.
- [ ] **Step 5: CHECKPOINT** — user commits.

---

## Task 8: Archived read-only skin

**Files:**
- Create: `src/components/ArchivedBanner.vue`
- Modify: `src/AppShell.vue` (mount banner under header when `data.isReadonly`), `src/journeys.css`
- Verify: manual.

- [ ] **Step 1: Build `ArchivedBanner.vue`** — `role="status"`, 🔒 + `กำลังดูปีการศึกษา {{year}} (เก็บถาวร · อ่านอย่างเดียว)` + `[กลับไปปีปัจจุบัน]` (quiet button → `data.viewActive()`). `surface-2` bg, hairline, NOT red.
- [ ] **Step 2: Gate mutation controls** — in `StudentsView.vue` / `MeasureView.vue`, wrap add/edit/delete/measure controls in `v-if="!data.isReadonly"` so they don't render in archived view (don't rely solely on `assertWritable`). Reports/charts/export stay.
- [ ] **Step 3: Styles + 180ms crossfade** with `prefers-reduced-motion` instant fallback.
- [ ] **Step 4: Verify** — type-check; screenshot archived view `.playwright-mcp/archived-skin.png`; confirm no mutation controls render, banner announced.
- [ ] **Step 5: CHECKPOINT** — user commits.

---

## Task 9: Evolve Promotion Wizard → New Academic Year flow

**Files:**
- Modify: `src/features/PromotionView.vue`
- Reuse: `Stepper.vue`, order-ticket classes (`journeys.css`), `buildNextYear` (Task 3), `planPromotion` (display split), `useSchool.createYear`.
- Verify: manual + a domain test already covers `buildNextYear`.

- [ ] **Step 1: Add steps** per `…-ui-design.md` §3: explain → mandatory backup → name year + carry settings (default active+1, reject duplicate vs manifest) → promote students (existing per-student UI) → graduates export (existing filename pattern) → confirm ticket.
- [ ] **Step 2: Wire confirm** → `buildNextYear(activeSnapshot, decisions, meta)` then `school.createYear(next)` (auto-archives prior active) → `data.viewActive()` → success summary → land on new year home.
- [ ] **Step 3: Copy** — Thai, reassuring ("ปีนี้จะถูกเก็บไว้ดูได้เสมอ"). Verb+object buttons (`ขึ้นปีการศึกษาใหม่`).
- [ ] **Step 4: Verify** — type-check; run the flow on localhost:5173: old year becomes `เก็บถาวร`, new year active+empty measures, graduates omitted; screenshot `.playwright-mcp/new-year-wizard.png`. Confirm `npm test` green.
- [ ] **Step 5: CHECKPOINT** — user commits.

---

## Task 10: Backup & Restore scoped menu

**Files:**
- Modify: `src/features/SettingsView.vue`; reuse `ImportDialog.vue` + existing confirm pattern.
- Verify: manual.

- [ ] **Step 1: Build the menu** per `…-ui-design.md` §4: ส่งออก (ปีการศึกษาเดียว / ทั้งโรงเรียน), นำเข้า (ปีการศึกษาเดียว / ทั้งโรงเรียน), single `panel`, plain-Thai one-line consequences, no jargon.
- [ ] **Step 2: Wire exports** — `school.exportYear(year)` (download `serializeYearBundle`), `school.exportSchool()` (`serializeSchool`). Filenames in Thai, e.g. `ปีการศึกษา 2569.json` is fine but prefer a friendly name; reuse existing download util.
- [ ] **Step 3: Wire imports** — year import: `parseYearBundle`; if year exists, **confirm overwrite/skip** (existing confirmation pattern, state year + student count + recovery); else merge. Full import: strong confirm "จะแทนที่ข้อมูลปัจจุบัน… ไฟล์เดิมของคุณยังอยู่" → `school.importSchool`.
- [ ] **Step 4: Verify** — type-check; round-trip a single year + full school between exports on localhost:5173; confirm merge vs replace behavior; screenshot `.playwright-mcp/backup-restore.png`.
- [ ] **Step 5: CHECKPOINT** — user commits.

---

## Final verification

- [ ] `npm test` — all green (domain + stores + regression).
- [ ] `npx vue-tsc --noEmit` — clean (watch `noUnusedLocals`).
- [ ] `npm run build` — single `dist/index.html` builds.
- [ ] Manual end-to-end on localhost:5173: migrate legacy data → run New Academic Year wizard → old year frozen (`เก็บถาวร`, read-only, mutation controls absent) → new year editable, empty measures → switch back via period-chip → export single year + full school, re-import (merge vs replace).
- [ ] Update `CLAUDE.md` Architecture note if storage-key/store shape description drifts.

## Self-review (done while writing)

- **Spec coverage:** data model→T1; storage layout→T5; migration→T2/T5; rollover→T3; `useData` hold→T6; backup scopes→T4/T10; year switcher→T7; archived skin→T8; wizard→T9. All sections mapped.
- **Type consistency:** `YearSnapshot`/`SchoolIdentity`/`YearMeta` names identical across T1–T10; `buildNextYear`/`createYear`/`importYearBundle`/`parseYearBundle`/`serializeSchool` signatures consistent.
- **Deferred (per decisions):** storage meter (Q5) — not in plan. Enrollment normalization — out of scope.
- **Open risk:** T6 is the riskiest (retargeting the central store); its step 4 runs the full suite as the gate.
