# Year-Based Dataset (REVISED) — Implementation Plan

> Execute task-by-task. Each task ends with an independently testable deliverable. Steps use `- [ ]`.

**Goal:** Apply the corrected model — active year = default editing/display context, NOT a read boundary. Remove the global year-switcher; add cross-year read paths + lifecycle/backup UI.

**Branch:** `dev`. **NO GIT COMMITS** (user does all commits). Dev server is the user's on :5173 — never start/kill it. Write files with Write/Edit, never heredoc. `noUnusedLocals` — no unused imports. Verify each task: `npx vue-tsc --noEmit` + `npx vitest run` (+ relevant subset).

**Spec:** `docs/superpowers/specs/2026-06-29-year-based-dataset-REVISED-design.md`

**Principle:** Editing = active year only (already true by construction). Reading = free across all years via `useSchool` read helpers; each screen defaults to active.

---

## Task 1: `useSchool` cross-year read helpers (TDD)

**Files:** Modify `src/stores/school.ts`; Test `tests/stores/school-reads.test.ts` (new).

**Add (read-only, never change active year):**
- `listYears(): YearMeta[]` — return `years` (already sortable by `createdAt`).
- `snapshotForYear(year: string): YearSnapshot | null` — alias/use existing `loadYear`.
- `measuresForStudent(studentId: string): Measurement[]` — concat `measures` from **every** year snapshot where `m.studentId === studentId`, sorted ascending by `savedAt` (stable chronological).

**Steps:**
- [ ] Write failing test: seed 2 years via `createYear`, each with a measure for student `'a'`; assert `measuresForStudent('a')` returns both, sorted by `savedAt`, and `listYears()` has both metas.
- [ ] Run `npx vitest run school-reads` → FAIL.
- [ ] Implement helpers in `school.ts`; export them in the store return.
- [ ] Run → PASS; `npx vue-tsc --noEmit` clean.
- [ ] CHECKPOINT (user commits).

---

## Task 2: Hide the global year-switcher (no delete)

**Files:** Modify `src/AppShell.vue`, `src/components/AppHeader.vue`. Leave `YearSwitcher.vue` / `ArchivedBanner.vue` files in place (unmounted). Leave `useData.viewYear/viewActive/isReadonly` in the store (now inert: nothing switches `viewingYear`, so `isReadonly` is always false).

**Steps:**
- [ ] `AppShell.vue`: remove the `<YearSwitcher .../>` and `<ArchivedBanner />` mounts and the `yearSwitcherOpen` state + `@open-year` handler. Keep imports out (avoid `noUnusedLocals` failure — remove the now-unused imports).
- [ ] Revert both period chips (sidebar in `AppShell`, `AppHeader`) to **display-only** (no `@click`, no archived variant): show `📅 {{ periodLine / contextText }}`. Keep them as a styled element; drop the switcher wiring. Remove `AppHeader`'s `openYear` emit.
- [ ] The `isReadonly` `v-if` guards in `StudentsView.vue` / `MeasureView.vue` may stay (always-true now → controls always render); leave them to honor "hide not delete." MeasureView's read-only notice branch is now unreachable — leave it.
- [ ] Verify: `npx vue-tsc --noEmit` clean; `npx vitest run` all green; open :5173 — no switcher, chip is plain, editing works on active year.
- [ ] CHECKPOINT.

---

## Task 3: Reports — Academic Year selector (read any year)

**Files:** Modify `src/features/ReportsView.vue`. Read it first.

**Behavior:** Add a year `<select>` (options = `school.listYears()` years, **default = active**) alongside existing term/round. On change, read `school.snapshotForYear(year)` and run the existing `summarize(snapshot.students, snapshot.measures, year, term)` over that snapshot instead of `useData`'s active arrays. Default selection = active year reproduces today's output.

**Steps:**
- [ ] Read `ReportsView.vue` to see how it currently calls `summarize` / sources students+measures.
- [ ] Add `useSchool`; add a reactive `selectedYear` (default `school.activeYear`); derive students/measures from `snapshotForYear(selectedYear)` (fallback to active `useData` when it equals active year is fine).
- [ ] Add the year `<select>` to the toolbar; Thai label ปีการศึกษา.
- [ ] Verify: `vue-tsc` clean; tests green; :5173 — switch year → summary recomputes; default = active unchanged.
- [ ] CHECKPOINT.

---

## Task 4: Student Workspace — cross-year history

**Files:** Modify `src/features/StudentsView.vue`. Read the student-profile/measure-history section first (~line 600–640, the `openMeasures` table).

**Behavior:** The open student's measurement history table + growth charts use `school.measuresForStudent(open.id)` (across ALL years) instead of active-year-only `measuresFor(id)`. Each row already shows `r.year`; keep that as the year label. Edit/delete controls on a row only for rows belonging to the **active** year (others render read-only — they live in archived snapshots). Roster/room navigation stays active-year (editing context).

**Steps:**
- [ ] Read the relevant section of `StudentsView.vue` (`openMeasures`, the history table, chart build calls).
- [ ] Add `useSchool`; compute `openMeasures` from `measuresForStudent(open.id)` sorted; pass to charts.
- [ ] Gate per-row edit/delete: show only when `r.year === data.period.year` (active). Other years' rows: show values, no edit/delete.
- [ ] Verify: `vue-tsc` clean; tests green; :5173 — a student with measures in 2 years shows both; only active-year rows editable.
- [ ] CHECKPOINT.

---

## Task 5: Academic Year Management panel (Settings)

**Files:** Modify `src/features/SettingsView.vue`. (Default placement: a Settings panel titled **จัดการปีการศึกษา**.)

**Behavior:** List every year from `school.listYears()` (newest first): `year · สถานะ (กำลังใช้งาน/เก็บถาวร) · N นักเรียน · M ผลการวัด`. Per row:
- **ส่งออก** → download `school.exportYear(year)` as `ปีการศึกษา ${year}.json` (any year).
- **ลบ** → archived years only; confirm with the export-then-remove reassurance (state year + counts + "สำรองก่อน"); on confirm `school.deleteYear(year)`.
Active year row: ส่งออก only (no delete). Creating the next year is NOT here — point to the "เลื่อนชั้นปีการศึกษา" wizard (existing `งานประจำปี` panel).

**Steps:**
- [ ] Add the panel; reuse `.goal`/`.panel` styles + `downloadBlob`. Counts via `school.loadYear(year)`.
- [ ] Delete confirm reuses the existing `callout bad` confirm pattern.
- [ ] Verify: `vue-tsc` clean; tests green; :5173 — list shows all years; export any; delete archived (guarded).
- [ ] CHECKPOINT.

---

## Task 6: Backup & Restore Assistant (wizard)

**Files:** Modify `src/features/SettingsView.vue` (replace the flat Backup&Restore panel built earlier with a guided assistant). Reuse `Stepper.vue`. May extract to `src/features/BackupAssistant.vue` if SettingsView grows unwieldy — decide while implementing.

**Flow (one decision per step):**
1. **ทำอะไร?** → สำรองข้อมูล / กู้คืนข้อมูล.
2a. Backup → ปีการศึกษาปัจจุบัน · ปีการศึกษาอื่น (เลือกปีจากรายการ) · ทั้งโรงเรียน → triggers `exportYear(active)` / `exportYear(picked)` / `exportSchool()` (+ `markBackup` on whole-school).
2b. Restore → นำเข้าปีการศึกษา (file → `parseYearBundle`; if year exists, overwrite/skip confirm → `importYearBundle`) · กู้คืนทั้งโรงเรียน (file → strong replace confirm → `importSchool` → reload).
3. Done summary.

**Steps:**
- [ ] Build the assistant (Stepper + one-choice-per-step). Plain-Thai, verb+object buttons. Year picker reuses `listYears()`.
- [ ] Wire to existing `school` export/import fns; keep the overwrite-confirm + replace-confirm patterns already written.
- [ ] Verify: `vue-tsc` clean; tests green; :5173 — each branch (backup current/other/school; restore year/school) works; screenshot `.playwright-mcp/backup-assistant.png`.
- [ ] CHECKPOINT.

---

## Final verification
- [ ] `npx vitest run` all green; `npx vue-tsc --noEmit` clean; `npm run build` OK.
- [ ] :5173 end-to-end: edit active year; Reports + Workspace read other years; Management export/delete; Backup Assistant all branches. No global context switch anywhere.

## Self-review
- Spec coverage: principle→all; remove switcher→T2; cross-year reads→T1/T3/T4; Management→T5; Backup Assistant→T6. Mapped.
- Type consistency: `listYears`/`snapshotForYear`/`measuresForStudent` names consistent T1↔T3/4/5/6.
- Honors "hide not delete": switcher components + inert `useData` methods kept.
