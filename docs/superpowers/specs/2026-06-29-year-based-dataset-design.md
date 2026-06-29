# Year-Based Dataset — Design Spec

**Date:** 2026-06-29
**Status:** Approved (brainstorm), pending implementation plan

## Context

The app is an offline, single-school student-nutrition tracker for Thai school
health teachers. The current data model is **flat and not year-scoped**:

- One global `period.year` ("current year"); students live in a single flat
  `students[]` with **mutable** `grade`/`room`.
- All measurements live in one flat `measures[]`, each row stamped with
  `year`/`term`/`round` and a `gradeAtMeasure`/`roomAtMeasure` snapshot.
- Year rollover is **destructive**: `applyPromotion` mutates `student.grade` in
  place and `deleteStudent`s graduates (also wiping their measures). Old grades
  are overwritten; the only surviving history is in old measurement rows.

This blocks complete historical snapshots, makes "what did year N look like"
unanswerable, and couples backup/restore to a single live year.

**Goal:** redesign around the Academic Year as the primary data boundary —
each year a self-contained, immutable snapshot — while keeping cross-year
history possible via a stable `studentId`. Migration effort is explicitly out
of scope as a constraint; we optimize for the right long-term architecture.

## Design Decisions (locked)

1. **Snapshot-first.** Academic Year is the primary data boundary; an archived
   year is a frozen, read-only snapshot.
2. **Cross-year history = lightweight, via `studentId`.** No Enrollment
   normalization, no canonical Student Registry. Students are **copied** between
   years carrying the same `studentId`; longitudinal lookup = collect measures
   across year snapshots where `studentId` matches (year count is small).
3. **Single active year.** Exactly one year has `status: active` (editable);
   all others `archived`. Status lives in the manifest.
4. **School identity is a shared root**, not duplicated per year. Year snapshot
   holds only year-specific data (`teacher`, `maxGrade`, classrooms, students,
   measures). Single-year *export* bundles identity for portability.
5. **New-year creation is a guided wizard**; student promotion is one step,
   reusing the existing promotion domain non-destructively.
6. **Scoped Backup & Restore.** Year import = merge; Full-School import =
   replace. Archived writes fail explicitly.

## Data Model

```ts
// Whole school
interface SchoolFile {
  schemaVersion: 2;
  identity: SchoolIdentity;          // shared root, single source
  years: YearSnapshot[];
}

interface SchoolIdentity {           // long-lived school metadata
  school: string; ministry: string; department: string;
  subdistrict: string; district: string; province: string;
}

interface YearSnapshot {
  year: string;                      // "2570" (Thai BE), unique key
  createdAt: number;                 // epoch ms; status lives in manifest
  teacher: string;                   // year-specific (was in Setup)
  maxGrade: string;                  // year-specific (was in Setup)
  classrooms: { grade: string; rooms: string[] }[];
  students: Student[];               // Student.id stable across years (soft join key)
  measures: Measurement[];           // unchanged shape (keeps year/term/round)
}
```

- `Student`, `Measurement` types in `src/domain/types.ts` are **unchanged** —
  they just move from global arrays into the owning `YearSnapshot`.
- The existing `Setup` type **splits**: identity fields → `SchoolIdentity`;
  `teacher` + `maxGrade` → onto `YearSnapshot`.
- `Measurement.year` is now redundant with the snapshot's `year` (always equal).
  Keep it — denormalized convenience so charts/reports/xlsx stay untouched; not
  a second source of truth.

## Storage Layout (localStorage)

Split keys, namespaced `ntr2_v2_*` (v1 `ntr2_*` keys left intact for migration):

```text
ntr2_v2_manifest   → { schemaVersion: 2,
                       years: [{ year, status: 'active'|'archived', createdAt }] }
ntr2_v2_identity   → SchoolIdentity (shared, tiny)
ntr2_v2_year_2569  → YearSnapshot (full)
ntr2_v2_year_2570  → YearSnapshot
```

**Invariant:** exactly one `years[].status === 'active'`.

Rationale: active-year edits (99% path) rewrite only one key; archived years are
never re-serialized (immutability at the storage layer). Archive-and-delete to
reclaim storage = delete one key. Per-year size = `localStorage[key].length`.
Load = read manifest, then the active year's key (2 reads).

## Store / Domain Changes

**Two-layer Pinia store** (refactor of `src/stores/data.ts`):

- **`useSchool`** (new, thin) — owns the manifest: years list + statuses,
  `createYear()`, `archiveYear()`, `deleteYear()`, `setActive()`, and import/
  export orchestration. Reads/writes the manifest + per-year + identity keys.
- **`useData`** (existing, retargeted) — **public API held stable** (`students`,
  `measures`, `setup`, `classrooms`, `addStudent`, `upsertMeasure`, `structure`,
  `stats`, `latest`, …). Now operates on the **active year's snapshot** loaded
  via `useSchool`; `persist()` writes back into that one year key.
  - Reassembles a `Setup`-shaped view (shared identity + active year's
    `teacher`/`maxGrade`) so consumers reading `setup.school`,
    `setup.teacher`, `setup.maxGrade` are unchanged. The split is at storage,
    not at the view API.
  - Exposes `isReadonly` (true when viewing an archived year). All mutations call
    `assertWritable()`, which **throws `ReadonlyYearError`** when archived (loud
    in dev). UI gates archived views so the action never renders; any leak shows
    "This Academic Year is archived and read-only."

**Domain layer (`src/domain/**`) stays framework-free, near-untouched:**

- `promotion/promote.ts` — `planPromotion`/`applyPromotion` reused. New
  non-destructive copy target: graduate = **omit from copy** (not
  `deleteStudent`); promote/repeat write into the new snapshot.
- `transfer/backup.ts` — extended for two scopes (see Backup & Restore).
- nutrition / report / grade / date / charts — **zero change**.

## New-Year Wizard

Guided flow; promotion is one step. Reuses existing promotion domain.

1. **Name the year** — enter new year (e.g. 2570). Reject duplicate vs manifest.
2. **Carry settings** — copy `identity` reference + `teacher` + `maxGrade` +
   classrooms from the active year, editable (teacher reassignment / maxGrade
   bump happen here).
3. **Promote students** — `planPromotion(students, maxGrade)` →
   per-student `promote / repeat / graduate` + room pick (today's UX).
   Graduates excluded from copy (old year keeps them, frozen).
4. **Confirm** — running summary ticket (preferred wizard pattern):
   "Year 2570 · N students carried · M graduated · empty measurements."

On confirm:
- Build new `YearSnapshot`: copied+promoted students (same `studentId`),
  copied teacher/maxGrade/classrooms, `measures: []`.
- Manifest: set old year `status: archived`, append new year `status: active`.
- Write order: new year key → old year key (final frozen write) → manifest last
  (manifest is source of truth; an orphan year key without a manifest entry is
  harmless).

Pure transform `buildNextYear(prev, decisions, newYearMeta): YearSnapshot` in
`src/domain/year/rollover.ts` — framework-free, unit-tested. Wizard is the Vue
shell over it.

## Backup & Restore

UI groups under a **Backup & Restore** section; menu structure communicates scope:

```text
Backup & Restore
  Export ── Academic Year   → file = { identity, year: YearSnapshot }   (self-contained)
        └─ Full School      → file = whole SchoolFile (identity + all years)
  Import ── Academic Year   → MERGE: add year; if year exists → prompt overwrite / skip
        └─ Full School      → REPLACE: restore entire school (explicit confirm; wipes current)
```

- **Year export** bundles `identity` so the file stands alone on another machine
  (portability without per-year storage duplication).
- **Year import** into an existing school: merge the year into the manifest;
  **keep the destination school's identity** (ignore incoming). If no school
  exists yet (fresh install), **adopt** the incoming identity.
- **Full import** = disaster recovery: replace identity + all years, explicit
  confirm.
- `transfer/backup.ts` extends: `serialize/parseYearBundle` +
  `serialize/parseSchool`. Schema-versioned; reuses existing measure-`savedAt`
  backfill logic.

## Migration (v1 → v2)

Runs once on boot:

- If `ntr2_v2_manifest` absent **and** any v1 key present → migrate.
- Build one `YearSnapshot` from v1: `year = period.year` (if blank, prompt the
  teacher once — cannot be invented), `status: active`; students / measures /
  classrooms carried verbatim; `teacher` + `maxGrade` lifted off old `setup`;
  remaining `setup` fields → `identity`.
- Write `ntr2_v2_identity` + `ntr2_v2_year_<year>` + manifest.
- **Leave v1 keys in place** (rollback safety). Idempotent — guarded by manifest
  presence.
- Fresh install (no v1, no v2) → empty school; first-run setup creates identity
  + first active year.

Pure transform `migrateV1(v1state): SchoolFile` in domain, unit-tested.

## Testing / Verification

**Domain unit tests (Vitest, framework-free):**
- `migrateV1` — v1 flat state → SchoolFile, setup split, blank-year handling.
- `buildNextYear` — promote/repeat/graduate; graduates omitted; `measures: []`;
  `studentId` stable; classrooms carried.
- backup `serialize/parseYearBundle` + `serialize/parseSchool` round-trips.
- year-merge import conflict logic (exists → overwrite/skip; identity ignore vs adopt).

**Store tests:**
- `useSchool` — create/archive/delete/setActive; manifest invariant (exactly one active).
- `useData` retargeted to active snapshot; `assertWritable` throws on archived.

**Regression:** existing nutrition / report / charts / xlsx domain tests stay
green — proves the `useData` API hold.

**Manual end-to-end (dev server, localhost:5173):**
migrate existing data → run new-year wizard → verify old year frozen + new year
editable → cross-year growth chart by `studentId` → export/import both scopes.

## Out of Scope

- Full Enrollment normalization / relational model (explicitly rejected — YAGNI
  for a small-year-count offline app).
- Cross-year cohort dashboards / year-over-year analytics (door left open via
  `studentId`, not built now).
