# Year-Based Dataset — REVISED Design

**Date:** 2026-06-29 · **Status:** Approved (brainstorm) · **Branch:** `dev`
**Supersedes:** `2026-06-29-year-based-dataset-ui-design.md` (global year-switcher
approach) and the read-access assumptions in `…-design.md`. Data model + storage
from the original spec stay; the UI/access layer is redesigned.

## The correction that drove this revision

The first design treated the active year as a **hard data boundary for every
screen** — so viewing an old year meant switching the whole app context (global
year switcher + archived read-only skin), which then needed a historical "View"
page. That was wrong.

**Governing principle (locked):**

> **Active Academic Year = default editing context, not the only readable dataset.**
> - **Editing** (add/edit students, record measurements, classroom/setup changes)
>   is restricted to the **active** year.
> - **Reading** is free across **all** years. Each screen **defaults** to the active
>   year and may select another year/term/round when its use case needs it.

With this, the extra navigation disappears: no global switcher, no archived
read-only app mode, no dedicated historical browsing page.

## What this removes (built on `dev`, now to be hidden)

Hide (code preserved, per user preference — do not delete):
- `src/components/YearSwitcher.vue` — global year switcher.
- `src/components/ArchivedBanner.vue` — read-only archived skin.
- Period-chip-as-switcher wiring in `AppShell.vue` + `AppHeader.vue` (chip returns
  to display-only; tapping it can deep-link to Academic Year Management, optional).
- `isReadonly` view-gating in `StudentsView.vue` / `MeasureView.vue` (the
  `v-if="!data.isReadonly"` guards and the MeasureView read-only notice).
- `useData` whole-app context switch (`viewYear` / `viewActive` / `viewingYear` as a
  *navigation* concept). `useData` always represents the **active** year now.

## What stays (already built, still correct)

- Storage: manifest + per-year snapshot keys (`ntr2_v2_*`); one `active` in manifest.
- Domain: `migrateV1`, `buildNextYear`, year/school backup serialize/parse.
- `useSchool` store: manifest + per-year load/save, create/archive/delete, import/export.
- `useData`: the **active** year as the editing context; `assertWritable` still guards
  mutations (defense-in-depth — editing is active-only by construction now).
- "เลื่อนชั้นปีการศึกษา" wizard: non-destructive rollover (`buildNextYear` +
  `school.createYear`) creating the next active year.

## Architecture: read paths vs the editing context

- **`useData` = active year, editable.** Unchanged public API. All add/edit/record
  flows write here. No other year is ever the editing context.
- **Cross-year reads go through `useSchool`** (read-only helpers, no context change):
  - `listYears(): YearMeta[]` — for selectors + management list.
  - `loadYear(year): YearSnapshot | null` — already exists.
  - `measuresForStudent(studentId): Measurement[]` — concatenated across **all** year
    snapshots, sorted by date. Powers Student Workspace longitudinal history.
  - `snapshotForYear(year): YearSnapshot | null` — Reports reads the selected year.
  These never mutate and never change `useData`'s active year.

## Screen-by-screen

### Student Workspace (`StudentsView`)
- **Roster** defaults to the **active** year (today's behavior; editing stays here).
- **Student history**: a student's measurement table + growth charts aggregate
  `measuresForStudent(id)` across **all** years (longitudinal), labelled by year.
  Reading old years' points needs no mode switch.
- Editing controls (add/edit student, record/edit measure) act on the **active** year
  only — they always have, so no gating UI is required; just don't offer "edit" on a
  historical measurement row (those belong to archived snapshots). Show them
  read-only inline with their year label.

### Reports (`ReportsView`)
- Add an **Academic Year selector** (plus existing term/round), **defaulting to
  active**. Selecting a past year reads `snapshotForYear(year)` and runs the same
  `summarize()` over that snapshot's students+measures. No app-context change.

### Academic Year Management (lifecycle only — no browsing)
- A list of all years (active + archived): `year · #students · #measurements ·
  สถานะ`. Per row: **ส่งออก** (any year, active or archived) and **ลบ** (archived
  only; deleting requires prior export — reuse the export-then-remove reassurance).
- **Create next year** is **not** a button here — it's the "เลื่อนชั้นปีการศึกษา"
  wizard (the once-a-year flagship). The list may link to it.
- Placement: a panel in `SettingsView` (or its own entry). Decide at plan time;
  default = Settings panel titled **จัดการปีการศึกษา**.

### Backup & Restore Assistant (guided wizard — the user's idea)
Replaces the flat four-action panel. First asks **what** the teacher wants, then
guides:
- **สำรองข้อมูล (Backup)** → choose: ปีการศึกษาปัจจุบัน · ปีการศึกษาอื่น (เลือกปี) ·
  ทั้งโรงเรียน. "เลือกปี" reuses the same year list as Management.
- **กู้คืนข้อมูล (Restore)** → choose: นำเข้าปีการศึกษา (merge; overwrite-confirm if the
  year exists) · กู้คืนทั้งโรงเรียน (replace; strong confirm).
- One decision per step (matches the order-ticket / Stepper wizard pattern in
  `DESIGN.md`), so teachers never have to understand year-file vs school-file before
  starting. Wires to `school.exportYear` / `exportSchool` / `importYearBundle` /
  `importSchool` (all already built).
- **Export-any-year** is satisfied here AND on the Management list — same underlying
  `exportYear(year)`; two doorways, one action (`DESIGN.md`: "two doorways, not two
  apps").

## Build delta (from current `dev` state)

**Hide:** YearSwitcher, ArchivedBanner, chip-switcher wiring, `isReadonly` gates,
`useData` view-switching.
**Add:** `useSchool` cross-year read helpers; Reports year selector; Student
Workspace cross-year history; Academic Year Management list (export/delete);
Backup & Restore Assistant wizard.
**Keep:** all domain + storage + `useData` active-editing + promotion wizard.

## Verification

- Domain/store unit tests stay green (cross-year read helpers get their own tests:
  `measuresForStudent` aggregates across snapshots, sorted).
- Manual (localhost:5173): record into active year; open a student → see history
  spanning years; Reports → pick a past year → correct summary; Management → export a
  past year + delete an archived year; Backup Assistant → each branch.
- No global context switch anywhere; the active year never changes from reading.

## Out of scope

- In-app browsing of an archived year as a *separate* screen (resolved away —
  Workspace/Reports cover historical reads).
- Cross-year cohort dashboards (door open via `measuresForStudent`, not built now).
