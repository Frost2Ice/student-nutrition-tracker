# Phase 3 — Real App from Validated Prototype — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development
> (recommended) or superpowers:executing-plans to implement this plan task-by-task.
> Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the Phase-0 mock prototype with the real, fully-wired Vue app,
reproducing the validated prototype UX (`src/prototype/**`) on top of the finished
domain engine and Pinia store.

**Architecture:** The prototype components are the layout/interaction source of truth.
Each real view copies its corresponding prototype component's `<template>` + `<style>`
**verbatim**, then swaps the `./mock` imports for the real Pinia store (`src/stores/data.ts`)
and domain modules. New behavior (academic period, duplicate detection, data transfer,
promotion ops) is added to the store/domain test-first. No new framework, no router lib —
the shell keeps the prototype's `dest`/`overlay` state model.

**Tech Stack:** Vue 3 `<script setup>` + TypeScript + Vite + Pinia, Chart.js v4
(`src/features/charts.ts` already builds the 3 growth charts), `vite-plugin-singlefile`.

## Global Constraints

- Single-file offline output: `npm run build` (`vue-tsc --noEmit && vite build`) must
  inline to one `dist/index.html`; no runtime network calls.
- `tsconfig` has `noUnusedLocals` — unused imports/vars fail the build. Remove them.
- ALL nutrition classification flows through `src/domain/nutrition/engine.ts`
  (`calcNutrition`) fed by the same reference tables that draw chart zones. No alternate/
  BMI path anywhere (BRD §6.2). Source: สำนักโภชนาการ กรมอนามัย, B.E. 2564, ages 2–18.
- **Chart zone ↔ text exactness (HARD):** chart boundary lines are the engine's own cutoff
  numbers with the engine's own math — WFH rendered linearly (engine interpolates by height),
  HFA/WFA rendered nearest-row stepped (engine snaps via `findRef`), NO spline tension on
  zone bands. An automated invariant test (Task 4A) must prove the band a point falls into
  equals `calcNutrition`'s label. results table / dashboard / charts / PDF / CSV all call
  `calcNutrition` — never re-derive labels.
- Charts: Chart.js options must set `animation: false` (headless/screenshot blank-render).
- Thai Buddhist-era dates `D/M/YYYY`; academic year numbered by start year; ภาคเรียน 2
  spans Jan–Mar of the next calendar year. Use `src/domain/date/thai-date.ts` only.
- Measurement validation = the single source in `src/domain/validation/rules.ts`
  (weight 5–150, height 40–210, valid Thai date). Manual entry AND CSV import use it.
- Grade/room live ONLY on the current student master record; measurements are immutable
  snapshots (capture grade/room at save time into the measurement row for display).
- UX parity: copy `<template>`/`<style>` verbatim from the named prototype component;
  do not redesign. Verify each view in-browser against its prototype screenshot.
- Dev server is the user's on :5173 — never kill/start it; open localhost:5173 to verify.
- Reference data is ported verbatim; never hand-retype growth tables.

---

## Pre-flight notes for the implementer

- Domain is DONE and tested: `engine.ts` (`calcNutrition` → `{wfh,wfa,hfa,tallProportionate}`),
  `latest.ts` (`latestPerStudent`, `isNewerMeasure`), `reference/index.ts` (`findRef`),
  `grade/ladder.ts` (`promote/demote/isMaxGrade/GRADE_ORDER`), `date/thai-date.ts`,
  `validation/rules.ts`, `features/charts.ts` (`buildWfh/buildHfa/buildWfa`).
- Store DONE basics: `students/measures/setup`, `findStudent/addStudent/updateStudent/
  deleteStudent/addMeasure/deleteMeasure/measuresFor/saveSetup`, `latest`, `stats`.
- First-gen real views exist (`src/features/*View.vue`) but PREDATE the prototype.
  Treat them as scrap to overwrite, not as the target.
- `Measurement` currently has no grade/room fields. Task 1 adds snapshot grade/room.
- Tests live beside source as `*.test.ts`, run with `npm test` (Vitest).

---

## Task 1: Measurement snapshot fields + academic period + setup flag (store/domain)

**Files:**
- Modify: `src/domain/types.ts`
- Modify: `src/stores/data.ts`
- Test: `src/stores/data.test.ts` (create)

**Interfaces:**
- Produces: `Measurement.gradeAtMeasure: string`, `Measurement.roomAtMeasure: string`
  (snapshot of class at save time). `Setup.year/term/round` REMOVED — period is separate.
- Produces store: `period` ref `{ year: string; term: Term; round: Round }`,
  `setPeriod(p)`, `isSetup` computed (`setup.value.school.trim() !== ''`),
  persisted under key `ntr2_period`.

- [ ] **Step 1: Write the failing test**

```ts
import { setActivePinia, createPinia } from 'pinia';
import { describe, it, expect, beforeEach } from 'vitest';
import { useData } from './data';

describe('period + setup flag', () => {
  beforeEach(() => { localStorage.clear(); setActivePinia(createPinia()); });

  it('defaults to not-setup with an empty school', () => {
    const d = useData();
    expect(d.isSetup).toBe(false);
  });

  it('becomes setup once a school is saved', () => {
    const d = useData();
    d.saveSetup({ ...d.setup, school: 'รร.ทดสอบ' });
    expect(d.isSetup).toBe(true);
  });

  it('stores and updates the academic period', () => {
    const d = useData();
    d.setPeriod({ year: '2569', term: '1', round: '1' });
    expect(d.period.year).toBe('2569');
    d.setPeriod({ year: '2569', term: '2', round: '1' });
    expect(d.period.term).toBe('2');
  });
});
```

- [ ] **Step 2: Run test to verify it fails** — `npm test -- data.test` → FAIL (`setPeriod`/`isSetup` undefined).
- [ ] **Step 3: Add `gradeAtMeasure`/`roomAtMeasure` to `Measurement` in `types.ts`; add `period` ref (load `ntr2_period`, fallback `{year:'',term:'1',round:'1'}`), `setPeriod` (assign + persist), `isSetup` computed; include `period`/`setPeriod`/`isSetup` in `persist()` and the store return.**
- [ ] **Step 4: Run test to verify it passes** — `npm test -- data.test` → PASS.
- [ ] **Step 5: `npx vue-tsc --noEmit`** → clean (fix any consumers of removed `Setup` fields).

---

## Task 2: Duplicate detection + period-aware measure add (store)

**Files:**
- Modify: `src/stores/data.ts`
- Test: `src/stores/data.test.ts`

**Interfaces:**
- Consumes: `period`, `addMeasure`.
- Produces: `findDuplicate(studentId, year, term, round): Measurement | null`
  (the existing record for that student+period, ignoring `savedAt`).
- `addMeasure` unchanged (push); duplicates are allowed after UI confirm and resolved by
  `latestPerStudent` via `savedAt` (BRD §6.4 / FR-5.7). No dedupe on write.

- [ ] **Step 1: Write the failing test**

```ts
it('detects a duplicate measurement for the same period', () => {
  const d = useData();
  d.addMeasure({ studentId: '1', year: '2569', term: '1', round: '1', date: '1/6/2569',
    weightKg: 20, heightCm: 115, gradeAtMeasure: 'ป.1', roomAtMeasure: '1', savedAt: 1 });
  expect(d.findDuplicate('1', '2569', '1', '1')?.weightKg).toBe(20);
  expect(d.findDuplicate('1', '2569', '2', '1')).toBeNull();
});
```

- [ ] **Step 2: Run** → FAIL (`findDuplicate` undefined).
- [ ] **Step 3: Implement `findDuplicate` (filter measures by id+year+term+round, return first or null); export it.**
- [ ] **Step 4: Run** → PASS.
- [ ] **Step 5: `npx vue-tsc --noEmit`** → clean.

---

## Task 3: Roster aggregates for browse (store)

**Files:**
- Modify: `src/stores/data.ts`
- Test: `src/stores/data.test.ts`

**Interfaces:**
- Consumes: `students`, `latest`, `setup.maxGrade`, `GRADE_ORDER` from `grade/ladder`.
- Produces:
  - `structure` computed: `{ grade: string; rooms: string[] }[]` (grades present in
    registry, ordered by `GRADE_ORDER`; rooms sorted numerically).
  - `roomInfo(grade, room): { total: number; measured: number }` (measured = students in
    that room with an entry in `latest` for the current `period`).
  - `gradeInfo(grade): { total; measured; rooms }`.
  - `roomStudents(grade, room): Student[]`.
  - `searchStudents(q): Student[]` (id or full name contains q; cap 30).

- [ ] **Step 1: Write the failing test**

```ts
it('aggregates structure and room info from the registry', () => {
  const d = useData();
  d.setPeriod({ year: '2569', term: '1', round: '1' });
  d.addStudent({ id: '1', firstName: 'ก', lastName: 'ข', dob: '1/1/2560', gender: 'ชาย', grade: 'ป.1', room: '1' });
  d.addStudent({ id: '2', firstName: 'ค', lastName: 'ง', dob: '1/1/2560', gender: 'หญิง', grade: 'ป.1', room: '1' });
  d.addMeasure({ studentId: '1', year: '2569', term: '1', round: '1', date: '1/6/2569',
    weightKg: 20, heightCm: 115, gradeAtMeasure: 'ป.1', roomAtMeasure: '1', savedAt: 1 });
  expect(d.structure).toEqual([{ grade: 'ป.1', rooms: ['1'] }]);
  expect(d.roomInfo('ป.1', '1')).toEqual({ total: 2, measured: 1 });
  expect(d.searchStudents('ค')[0].id).toBe('2');
});
```

- [ ] **Step 2: Run** → FAIL.
- [ ] **Step 3: Implement the computeds/functions above; export them. Use `latest` (Map) membership for `measured`; full name = `firstName + ' ' + lastName`.**
- [ ] **Step 4: Run** → PASS.
- [ ] **Step 5: `npx vue-tsc --noEmit`** → clean.

---

## Task 4: Swap entry to the real App shell

**Files:**
- Create: `src/AppShell.vue` (port of `src/prototype/ProtoShell.vue`)
- Modify: `src/main.ts`
- Modify: `src/style.css` (already holds shell + motion tokens — no change expected)

**Interfaces:**
- Produces: app shell with `dest: 'home'|'students'|'measure'|'reports'|'settings'`,
  `overlay: 'onboarding'|'import'|'promotion'|null`, `go(target)`, welcome gate driven by
  store `isSetup`. Renders the real views built in later tasks; until they exist, render a
  placeholder `<div>` per dest so the shell compiles.

- [ ] **Step 1:** Copy `ProtoShell.vue` `<template>`+`<style>` into `AppShell.vue`. Replace
  `import { SCHOOL, CURRENT_PERIOD } from './mock'` with `const data = useData()`; bind
  brand/sub to `data.setup.school`, period chip to `data.period`. Drive the welcome gate
  with `v-if="!data.isSetup"` (remove the prototype's `setUp` ref + the demo ribbon).
- [ ] **Step 2:** In `main.ts` swap `ProtoShell` → `AppShell`. Keep `createPinia()`.
- [ ] **Step 3:** Import the real child views (placeholders for now) so it type-checks.
- [ ] **Step 4: Verify** — `npx vue-tsc --noEmit` clean; open localhost:5173 → with empty
  store the welcome screen shows; toggling a saved school (via later onboarding) reveals the shell.
- [ ] **Step 5:** Confirm no `./mock` import remains in `AppShell.vue`.

---

## Task 4A: Chart zone ↔ classification exactness (domain/charts)

**Files:**
- Modify: `src/features/charts.ts`
- Test: `tests/features/charts-consistency.test.ts` (create)
- (If needed) Modify: `src/domain/nutrition/engine.ts` only to EXPORT existing helpers — do
  not change classification behavior.

**Why:** BRD §6.2 hard requirement — the chart zones and the textual classification must
match exactly. Today `charts.ts` renders zone bands with `tension: 0.3` (curved) and draws
HFA/WFA boundaries with linear interpolation, while the engine snaps ages via `findRef`.
Both can disagree with the text near a boundary. Fix the rendering to the engine's math and
lock it with an invariant test.

**Interfaces:**
- Consumes: `WFH_M/WFH_F`, `AGE_DATA`, `findRef`, `classifyWFH/WFA/HFA`, `calcNutrition`.
- Produces: corrected `buildWfh/buildHfa/buildWfa` (zone bands: `tension:0`; WFH not stepped;
  HFA/WFA `stepped:'middle'`), and a reusable boundary-evaluation the test can call.

- [ ] **Step 1: Write the failing invariant test** `tests/features/charts-consistency.test.ts`:
  - WFH: for each gender, for heights from `T[0][0]` to `T[last][0]` in 0.25 cm steps and
    weights spanning `b0-2 .. b5+3` in 0.1 kg steps (sample, not exhaustive), compute the band
    by evaluating the WFH zone boundary columns with **linear** interpolation (the same code
    path the chart renders), and assert it equals `classifyWFH(gender, h, w)`.
  - HFA/WFA: for each gender and each age row month present in `AGE_DATA`, pick heights/weights
    around each SD threshold (±0.05) and assert the band from the **nearest-row stepped**
    boundary equals `classifyHFA(findRef(...),h)` / `classifyWFA(findRef(...),w)`.
  - Structural: assert every zone-band dataset in `buildWfh/Hfa/Wfa` has `tension === 0`;
    HFA/WFA bands have `stepped === 'middle'`; WFH bands are not stepped.
- [ ] **Step 2: Run** `npm test -- charts-consistency` → expect FAIL (tension 0.3; stepped missing).
- [ ] **Step 3: Fix `charts.ts`:** drop `tension:0.3` (use `tension:0`) on zone bands; add
  `stepped:'middle'` to HFA/WFA zone bands (NOT WFH); keep boundary columns/fields exactly as
  the engine cutoffs (`col(1..5)` for WFH; `sd2h/sd15h/sd15ph/sd2ph`, `sd2w/sd15w/sd15pw/sd2pw`
  for HFA/WFA). Keep `animation:false`. Do not change engine classification.
- [ ] **Step 4: Run** → PASS.
- [ ] **Step 5:** `npx vue-tsc --noEmit` clean; `npm test` full suite green.

---

## Task 5: Onboarding / Setup (5-step) wired

**Files:**
- Create: `src/features/OnboardingView.vue` (port `src/prototype/OnboardingJourney.vue`)
- Delete: `src/features/SetupView.vue` (superseded)
- Modify: `src/AppShell.vue` (mount overlay `onboarding`)

**Interfaces:**
- Consumes: `data.saveSetup`, `data.setPeriod`, `data.addStudent`.
- On finish: writes `Setup` (8 fields incl `maxGrade`), `period`, and any students added in
  the per-room step; emits `done` → shell sets `isSetup` true via the saved school and routes home.

- [ ] **Step 1:** Port template/style verbatim. Replace mock writes: step "ข้อมูลโรงเรียน"
  binds a local `form` then `saveSetup(form)`; "ปีการศึกษา" → `setPeriod`; "นำเข้านักเรียน"
  per-room adds via `addStudent`.
- [ ] **Step 2:** Wire restore path (welcome "มีข้อมูลเดิม") to call the restore action from
  Task 11 if present, else leave the file-picker stub (note in code: wired in Task 11).
- [ ] **Step 3: Verify** — vue-tsc clean; walk the 5 steps on :5173, confirm finishing lands
  on the home shell with the school name in the sidebar. Matches `p0w-onboarding`.

---

## Task 6: Home dashboard wired

**Files:**
- Create: `src/features/HomeView.vue` (overwrite first-gen; port `src/prototype/HomeDashboard.vue`)

**Interfaces:**
- Consumes: `data.setup.teacher`, `data.stats` (`totalStudents/normal/followUp/atRiskList`),
  `data.structure`/`roomInfo` for the "rooms not yet complete" count.
- Emits `go` for quick links (measure/students/reports + overlays import/promotion).

- [ ] **Step 1:** Port template/style. Replace `AT_RISK`/`CLASSES` mock with `data.stats.atRiskList`
  (map `{student, flags}` → row: name `firstName+' '+lastName`, `grade/room`, first flag as the pill)
  and the incomplete-room count from `structure`/`roomInfo`.
- [ ] **Step 2: Verify** — vue-tsc clean; with seeded data the hero count, at-risk table, and quick
  links render; clicking a row routes to that student's profile (Task 8). Matches `p0w-home`.

---

## Task 7: Students browse drill-down wired

**Files:**
- Create: `src/features/StudentsView.vue` (port `src/prototype/StudentProfileView.vue`, browse half first)

**Interfaces:**
- Consumes: `data.structure`, `gradeInfo`, `roomInfo`, `roomStudents`, `searchStudents`,
  `latest` + `calcNutrition` for the room-list `ภาวะล่าสุด` column and `เฉพาะกลุ่มเสี่ยง` filter.
- Produces: `open: Student | null` selection that Task 8 turns into the profile.

- [ ] **Step 1:** Port the browse `<template v-else>` block + crumb/grid styles verbatim. Replace
  mock `STRUCTURE/roomInfo/gradeInfo/roomStudents` with store equivalents; replace the mock
  `statusOf` with: latest measurement for the student → `calcNutrition` → WFH label + good/warn/bad,
  or `ยังไม่วัด` when none. `roomRiskCount` = count of risk in the room.
- [ ] **Step 2:** Keep `stagger-item` entrance + clickable rows.
- [ ] **Step 3: Verify** — vue-tsc clean; drill grade→room→list on :5173; status column + risk
  filter behave; matches `p0l-roomlist-status`.

---

## Task 8: Student profile + 3 growth charts + registry edit/delete

**Files:**
- Modify: `src/features/StudentsView.vue` (profile half)
- Reuse: `src/features/charts.ts` (`buildWfh/buildHfa/buildWfa`)

**Interfaces:**
- Consumes: `data.measuresFor(id)`, `calcNutrition`, `data.updateStudent`, `data.deleteStudent`,
  `validation/rules`, `getAgeMonths`.
- Produces: the profile hub. Renders **three** charts WFH/HFA/WFA via `charts.ts` (Chart.js,
  `animation:false`), each with reference zones + history trend (presentation may use the
  prototype's segmented toggle revealing one at a time, or stack all three — both satisfy the
  locked 3-chart requirement). Student edit/add dialog + the grade/room-change confirm.

- [ ] **Step 1:** Port the `<template v-if="open">` profile block + dialogs + styles verbatim
  from the prototype, including the `gradeConfirm` flow.
- [ ] **Step 2:** Replace the mock SVG chart with real `<canvas>` per metric, instantiating
  `new Chart(canvas, buildWfh(student, measures))` etc.; destroy/rebuild on student or metric
  change; `animation:false`.
- [ ] **Step 3:** Wire the student form: add → `addStudent` (validate id not in `data.students`);
  edit → on grade/room change show confirm, then `updateStudent`; delete → `deleteStudent`.
  Validate via `rules.ts`; show inline errors.
- [ ] **Step 4: Verify** — vue-tsc clean; open a student on :5173, all three charts render with
  zones (not blank), edit renames live, grade-change shows the confirm. Matches `p0l-profile`.

---

## Task 9: Measurement management from the profile

**Files:**
- Modify: `src/features/StudentsView.vue` (measurement add/edit/delete dialogs)

**Interfaces:**
- Consumes: `data.addMeasure`, `data.deleteMeasure`, `data.period`, `validation/rules`,
  `calcNutrition`, `data.findDuplicate`.
- Produces: history rows with แก้ไข/ลบ + "+ บันทึกการวัด"; edit = delete old + add new
  (snapshot grade/room from the student's current class); classification recomputed via engine.

- [ ] **Step 1:** Port the history table actions + measurement dialog verbatim.
- [ ] **Step 2:** Save (add): build a `Measurement` (current `period`, `gradeAtMeasure`/`roomAtMeasure`
  = student's grade/room, `savedAt: Date.now()`), validate, `addMeasure`. Edit: `deleteMeasure(old)`
  then add the edited one. Each row's labels come from `calcNutrition`.
- [ ] **Step 3: Verify** — vue-tsc clean; add a measurement on :5173 → row appears, charts extend;
  edit/delete update the table + charts. Matches `p0l-aftersave`.

---

## Task 10: Measurement room worklist flow + duplicate gate

**Files:**
- Create: `src/features/MeasureView.vue` (overwrite first-gen; port `src/prototype/MeasureJourney.vue`)
- Reuse: `src/prototype/Stepper.vue` → move to `src/components/Stepper.vue`

**Interfaces:**
- Consumes: `data.structure`/`roomInfo` (room list + status), `roomStudents`, `data.period`,
  `setPeriod` (round/date at session start), `calcNutrition` (live result), `findDuplicate`,
  `addMeasure`, `validation/rules`, `getAgeMonths` (age display).
- Produces: pick-room (clickable rows) → entry (live pills) → ตรวจทาน → save; already-measured
  students gated behind explicit "บันทึกทับ" (uses `findDuplicate`).

- [ ] **Step 1:** Move `Stepper.vue` into `src/components/` and update imports. Port MeasureJourney
  template/style verbatim (manual + Excel modes; clickable room rows).
- [ ] **Step 2:** Replace mocks: room list from `structure`/`roomInfo`; rows from `roomStudents`;
  live result from `calcNutrition` against an on-the-fly Measurement; `dup` flag from `findDuplicate`.
  Save writes validated measurements with snapshot grade/room + `savedAt`.
- [ ] **Step 3:** Excel-import mode: route to the import-measurement pipeline (Task 12) or keep the
  review-screen stub clearly noting Task 12 wires it.
- [ ] **Step 4: Verify** — vue-tsc clean; on :5173 tap a room → enter values → live pills → dup gate
  on a re-measured student → save. Matches `p0j-measure-rows`, `p0l-dup`.

---

## Task 11: Backup / Restore + Settings (config + safety group)

**Files:**
- Create: `src/features/SettingsView.vue` (overwrite first-gen; port `src/prototype/SettingsView.vue`)
- Create: `src/domain/transfer/backup.ts`
- Test: `src/domain/transfer/backup.test.ts`

**Interfaces:**
- Produces: `serializeBackup(state): string` (JSON: students+measures+setup+period+version),
  `parseBackup(text): { students; measures; setup; period } ` (throws on bad file; assigns
  `savedAt` to any measure missing one — FR-9.4).
- Store: `lastBackupAt` (persisted `ntr2_backup_at`), `markBackup()`, `backupOverdueDays`
  computed; `replaceAll(parsed)` (restore = replace + persist).

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from 'vitest';
import { serializeBackup, parseBackup } from './backup';

it('round-trips a backup and repairs missing savedAt', () => {
  const state = { students: [], measures: [{ studentId: '1', year: '2569', term: '1',
    round: '1', date: '1/6/2569', weightKg: 20, heightCm: 115, gradeAtMeasure: 'ป.1',
    roomAtMeasure: '1' } as any], setup: { school: 'x' } as any,
    period: { year: '2569', term: '1', round: '1' } as any };
  const back = parseBackup(serializeBackup(state));
  expect(typeof back.measures[0].savedAt).toBe('number');
  expect(back.setup.school).toBe('x');
});
```

- [ ] **Step 2: Run** → FAIL. **Step 3:** Implement `backup.ts`; add store `lastBackupAt/markBackup/
  backupOverdueDays/replaceAll`. **Step 4: Run** → PASS.
- [ ] **Step 5:** Port SettingsView verbatim (two goal groups). Wire 💾 → download
  `serializeBackup` blob + `markBackup()`; ⬇️ restore → file read → `parseBackup` → confirm →
  `replaceAll`; reminder line from `backupOverdueDays`. 📥 routes to import overlay; 📤 to Task 12.
  ขึ้นปีใหม่ → promotion overlay. Reset = type-to-confirm `localStorage.clear()` + reload.
- [ ] **Step 6: Verify** — vue-tsc clean + `npm test`; on :5173 the two groups render, backup
  downloads a file, restore replaces. Matches `p0l-settings`.

---

## Task 12: Data transfer — full CSV export + import-merge

**Files:**
- Create: `src/domain/transfer/csv.ts`
- Test: `src/domain/transfer/csv.test.ts`
- Modify: `src/features/SettingsView.vue` (📤 export), `src/features/ImportView.vue` (Task 14 consumes)

**Interfaces:**
- Produces: `toCsv(students, measures): string` (full data, Excel-openable, BE dates);
  `parseImport(text): { rows: ParsedRow[]; skipped: { row: number; reason: string }[] }`
  where each measurement row is validated with `rules.ts` (FR-10.5) and student rows merge by id;
  `mergeImport(store, parsed)` — add new students, update existing, skip duplicate measurements
  (same student+year+term+round), count orphans (FR-10.4/10.7).

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from 'vitest';
import { parseImport } from './csv';

it('skips an invalid weight row with a reason + row number', () => {
  const csv = 'studentId,year,term,round,date,weightKg,heightCm\n1,2569,1,1,1/6/2569,999,115';
  const { skipped } = parseImport(csv);
  expect(skipped[0]).toMatchObject({ row: 2 });
});
```

- [ ] **Step 2: Run** → FAIL. **Step 3:** Implement `csv.ts` using `validateWeight/validateHeight/
  validateThaiDate`. **Step 4: Run** → PASS.
- [ ] **Step 5:** Wire Settings 📤 to download `toCsv`. **Step 6:** `npx vue-tsc --noEmit` clean.

---

## Task 13: Promotion wizard + promotion ops

**Files:**
- Create: `src/features/PromotionView.vue` (port `src/prototype/PromotionJourney.vue`)
- Create: `src/domain/promotion/promote.ts`
- Test: `src/domain/promotion/promote.test.ts`

**Interfaces:**
- Consumes: `grade/ladder` (`promote`, `isMaxGrade`), `csv.toCsv` (graduate export), store.
- Produces: `planPromotion(students, maxGrade): { promote: Student[]; graduate: Student[] }`;
  `applyPromotion(store, decisions)` — bump grade for promoted, remove graduates (after export),
  honor per-student overrides (เลื่อนปกติ/ซ้ำชั้น/จบการศึกษา + new room).

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from 'vitest';
import { planPromotion } from './promote';

it('separates graduates at the max grade', () => {
  const ss = [{ id: '1', grade: 'ป.6' }, { id: '2', grade: 'ป.1' }] as any;
  const plan = planPromotion(ss, 'ป.6');
  expect(plan.graduate.map((s) => s.id)).toEqual(['1']);
  expect(plan.promote.map((s) => s.id)).toEqual(['2']);
});
```

- [ ] **Step 2: Run** → FAIL. **Step 3:** Implement `promote.ts`. **Step 4: Run** → PASS.
- [ ] **Step 5:** Port PromotionView verbatim (6 steps); wire backup step → Task 11, review →
  `planPromotion` + per-student override UI, graduate step → required `toCsv` download, confirm →
  `applyPromotion` + `setPeriod(next year)`.
- [ ] **Step 6: Verify** — vue-tsc clean + `npm test`; walk the wizard on :5173. Matches `p0w-promotion`.

---

## Task 14: Import wizard (per-classroom) wired

**Files:**
- Create: `src/features/ImportView.vue` (port `src/prototype/ImportJourney.vue`)

**Interfaces:**
- Consumes: `csv.parseImport`/`mergeImport` (Task 12), `data.structure`.
- Produces: เลือกห้อง → เลือกไฟล์ → ตรวจ/แก้ (review, inline edit, skipped rows w/ reasons) →
  รายการซ้ำ (merge resolution) → เสร็จ.

- [ ] **Step 1:** Port template/style verbatim (clickable room rows). Replace mock preview/dup
  data with `parseImport` output; commit via `mergeImport`.
- [ ] **Step 2: Verify** — vue-tsc clean; walk import on :5173, invalid rows show reason+row,
  merge counts shown. Matches `p0w-import`.

---

## Task 15: Reports (agency document) + summary CSV + PDF

**Files:**
- Create: `src/features/ReportsView.vue` (port `src/prototype/ReportsView.vue`)
- Create: `src/domain/report/summary.ts`
- Test: `src/domain/report/summary.test.ts`
- Create: `src/features/print.ts` (hidden-iframe print, FR-11.1)

**Interfaces:**
- Consumes: `latestPerStudent`, `calcNutrition`, `data.setup`, `data.students`.
- Produces: `summarize(students, measures, year, term): { measured; enrolled; byGrade:
  { grade; counts:number[]; tall }[]; tall }` keyed to WFH categories; `toSummaryCsv(...)`
  (school name+location+counts+% — FR-8.2); `printElement(el)` (iframe print — FR-11.1/11.4).

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from 'vitest';
import { summarize } from './summary';

it('counts measured students into WFH categories', () => {
  const ss = [{ id: '1', firstName: 'ก', lastName: 'ข', dob: '1/1/2560', gender: 'ชาย', grade: 'ป.1', room: '1' }] as any;
  const ms = [{ studentId: '1', year: '2569', term: '1', round: '1', date: '1/6/2569',
    weightKg: 20, heightCm: 115, gradeAtMeasure: 'ป.1', roomAtMeasure: '1', savedAt: 1 }] as any;
  const s = summarize(ss, ms, '2569', '1');
  expect(s.measured).toBe(1);
  expect(s.byGrade.reduce((a, g) => a + g.counts.reduce((x, y) => x + y, 0), 0)).toBe(1);
});
```

- [ ] **Step 2: Run** → FAIL. **Step 3:** Implement `summary.ts` (group via engine labels into the
  5 WFH buckets used by the prototype), `toSummaryCsv`, `print.ts`. **Step 4: Run** → PASS.
- [ ] **Step 5:** Port ReportsView verbatim (year+term filter, document preview, criteria footer).
  Wire data from `summarize`; PDF button → `printElement`; CSV → `toSummaryCsv` download.
- [ ] **Step 6: Verify** — vue-tsc clean + `npm test`; on :5173 the document renders from real data,
  PDF opens via iframe (no popup), CSV downloads. Matches `p0j-reports`.

---

## Task 16: Final integration & single-file build

**Files:**
- Delete: `src/prototype/**`, `src/features/charts.ts` stays, remove dead first-gen views, `App.vue` if unused.
- Modify: `src/main.ts` (ensure `AppShell` only).
- Test: full suite + build.

- [ ] **Step 1:** Remove the prototype dir and any now-unused first-gen views/`mock.ts`. Fix imports.
- [ ] **Step 2:** `npx vue-tsc --noEmit` → clean (noUnusedLocals).
- [ ] **Step 3:** `npm test` → full suite green.
- [ ] **Step 4:** `npm run build` → one `dist/index.html`; open it via `file://` → app runs fully
  offline (no network), all journeys reachable.
- [ ] **Step 5:** Cross-journey smoke on :5173: first-run setup → add student → measure (with dup) →
  profile charts → report PDF → backup → promotion. Each matches its prototype screenshot.

---

## Self-review

- **Spec coverage:** registry CRUD (T6/T8/T9), measurement mgmt + dup (T2/T9/T10), 3 charts
  (T8), Reports/Data-transfer split (T11/T12/T15), Settings two-group (T11), promotion (T13),
  import (T14), home vs room filter (T6/T7), grade/room confirm (T8) — all from the validated
  baseline spec are present.
- **No placeholders:** logic tasks carry test + impl direction with exact signatures; UI tasks
  name the exact prototype source to copy and the exact store calls to wire. The two "stub noted
  for later task" points (restore in T5, Excel-measure-import in T10) are explicitly resolved by
  T11/T12.
- **Type consistency:** store names (`isSetup`, `period`, `setPeriod`, `findDuplicate`,
  `structure`, `roomInfo`, `gradeInfo`, `roomStudents`, `searchStudents`, `lastBackupAt`,
  `markBackup`, `backupOverdueDays`, `replaceAll`) and domain modules (`transfer/backup`,
  `transfer/csv`, `promotion/promote`, `report/summary`, `features/print`) are used consistently
  across tasks.

## Execution Handoff

Plan saved. Two execution options:
1. **Subagent-Driven (recommended)** — fresh subagent per task, review between tasks.
2. **Inline Execution** — execute here with checkpoints.
