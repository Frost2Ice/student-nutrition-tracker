# Design: School Code + Round-level report drill-down

Date: 2026-07-02

## Problem

Two gaps in the current reporting flow:

1. **School Code** isn't captured anywhere in the school profile, so it can't appear on
   printed/exported reports even though schools reference it on official paperwork.
2. Reports today only filter by **year + term**. Within a term, `summarize()` always
   collapses both measurement rounds into "latest measurement per student" — there's no way
   to see round 1 or round 2 in isolation, so the requested **Academic Year → Semester →
   Round** hierarchy isn't actually enforceable as a data-filtering concept, only a label.

## Decisions (from brainstorming)

- **Semester = existing `Term`.** No new domain type. `Term = '1'|'2'` already models
  ภาคเรียน; the hierarchy is Year → Term → Round using types that already exist.
- **Round becomes a real filter, not cosmetic.** `summarize()` takes an explicit `round`
  parameter and returns only that round's measurements — no `'latest'` sentinel, no dual
  behavior. Every call site must decide a round.
- **UX convenience lives in the UI, not the domain function.** `ReportsView.vue` auto-selects
  the latest available term/round for the chosen year (reusing the existing
  `defaultRound()`/`SESSION_ORDER` logic from `src/domain/measure/default-round.ts`) as the
  initial dropdown values. The user can then change any of the three selects freely.
- **Report scope stays single-round.** One report = one explicit (year, term, round). No
  rollup/aggregate-across-rounds report is being added.
- **School Code**: free-text, unbounded, optional (`code?: string` on `SchoolIdentity`/
  `Setup`). Added to `OnboardingView.vue`'s existing school-info step, and to
  `SettingsView.vue`'s existing school-edit panel (same `Setup`-typed draft, so it's a
  natural extension of an existing form, not a new screen).
- **Report header** prints every populated `SchoolIdentity` field: school, code, ministry,
  department, subdistrict, district, province. Blank fields are omitted rather than printed
  empty (legacy profiles won't have a code yet).

## Data model

`src/domain/types.ts`:

```ts
export interface Setup {
  school: string;
  code?: string;       // NEW
  ministry: string;
  department: string;
  subdistrict: string;
  district: string;
  province: string;
  teacher: string;
  maxGrade: string;
}

export interface SchoolIdentity {
  school: string;
  code?: string;        // NEW
  ministry: string;
  department: string;
  subdistrict: string;
  district: string;
  province: string;
}
```

`splitSetup()` (`src/domain/school/migrate.ts`) uses rest-spread destructuring
(`const { teacher, maxGrade, ...identity } = s`) — `code` flows into `identity` automatically,
no change needed there. Optional field means existing localStorage/backups without `code`
deserialize fine (`undefined`, treated as blank).

`Term`/`Round`/`Measurement` — **unchanged**. Hierarchy is presentational/filtering
convention over existing fields, not a new type.

## Components

### 1. `src/domain/report/summary.ts`

- `summarize(students, measures, year, term, round)` — add required `round: Round` param.
  Filter becomes `m.year === year && m.term === term && m.round === round`. Drop the
  `latestPerStudent` collapse across rounds — filtering to one round already yields at most
  one measurement per student for that round (a student may still have re-measures within the
  same round; keep `latestPerStudent` applied to the round-filtered set to pick the
  latest-saved record if a room re-measured someone twice in the same round).
- `summaryToAoa(setup, summary, year, term, round)` — add `round` param, extend header rows:
  ```
  โรงเรียน        <school>
  รหัสโรงเรียน     <code>          (omitted if blank)
  สังกัดกระทรวง    <ministry>       (omitted if blank)
  สังกัดกรม/หน่วยงาน <department>    (omitted if blank)
  ตำบล/แขวง        <subdistrict>    (omitted if blank)
  อำเภอ/เขต        <district>       (omitted if blank)
  จังหวัด          <province>       (omitted if blank)
  ปีการศึกษา       <year>
  ภาคเรียน         <term>
  ครั้งที่วัด       <round>
  นักเรียนทั้งหมด   <enrolled>
  นักเรียนที่วัด    <measured>
  ```
  A small local `headerLine(label, value)` helper pushes a row only when `value` is
  truthy — avoids repeating the same `if` six times.

### 2. `src/features/ReportsView.vue`

- New `round` ref (`Round`, default `'1'`) alongside existing `selectedYear`/`term`.
- On mount and whenever `selectedYear` changes: call `defaultRound()` (already exists in
  `src/domain/measure/default-round.ts`) against that year's measures to pick the
  term+round with the most recent data, and set `term`/`round` to that as the starting
  point. User can still override via the dropdowns.
- Filter bar gets a third `<select>` for ครั้งที่วัด (round 1 / round 2), cascaded after year
  and term — matches the requested Year → Semester → Round drill-down visually.
- `summary` computed and `handleXlsx()` both pass `round.value` through to `summarize()` /
  `summaryToAoa()`.
- `.doc-head` template: extend the school info line to show all populated `SchoolIdentity`
  fields (school, code, ministry, department, subdistrict, district, province), each
  rendered only if present — mirrors the xlsx header logic conceptually but is separate
  markup (existing pattern in this file; no shared header-string builder exists today and
  introducing one is unnecessary duplication-avoidance for ~7 short conditional spans).
- `.doc-period` line adds round: `ปีการศึกษา {{ selectedYear }} · ภาคเรียน {{ term }} · ครั้งที่ {{ round }}`.
- Filename in `handleXlsx()` includes round: `รายงานสรุป ${selectedYear} ภาค${term} ครั้งที่${round}.xlsx`.

### 3. `src/features/OnboardingView.vue`

- `schoolForm` ref adds `code: ''`.
- Step 1 form-grid: new field `<div class="field"><label>รหัสโรงเรียน</label><input v-model="schoolForm.code" /></div>` placed after ชื่อโรงเรียน. No `maxlength`/pattern — plain text input, no validation.
- Step 4 summary panel: add a matching `<div class="field"><label>รหัสโรงเรียน</label><div>{{ schoolForm.code || '—' }}</div></div>`.
- `persistAll()`: `data.saveSetup({ ...schoolForm.value, ... })` already spreads the whole
  form, so `code` is included automatically — no change to that line.

### 4. `src/features/SettingsView.vue`

- `schoolDraft` is already typed `Setup` and initialized `{ ...data.setup }` — `code` is
  already present in the ref once the type changes; only the template needs a new input row
  next to the existing school/province/teacher fields:
  ```html
  <div class="field"><label>รหัสโรงเรียน</label><input class="search" v-model="schoolDraft.code" style="width: 100%" /></div>
  ```
- Display line (`{{ data.setup.school }} · จ.{{ data.setup.province }} · ครูอนามัย {{ data.setup.teacher }}`)
  — leave as-is; code isn't part of this compact summary line (keeps it short), it's visible
  in the edit panel and on reports.

## Data flow

```
OnboardingView / SettingsView ──saveSetup──> data.setup { ...identity incl. code, teacher, maxGrade }
                                                     │
ReportsView: selectedYear + term + round (3 selects, term+round auto-defaulted per year)
                                                     │
summarize(students, measures, year, term, round) ──> ReportSummary (single round's data)
                                                     │
              ┌──────────────────────────────────────┴───────────────────────────────┐
        .doc-head template (print)                                         summaryToAoa (xlsx)
        shows setup fields + year/term/round                              same fields + year/term/round
```

## Error handling / edge cases

- **No measurements for selected (year, term, round)**: `summarize()` returns
  `{ measured: 0, enrolled, byGrade: [], tall: 0 }` — existing template already renders this
  (coverage line shows `0 จาก N คน`, table has no grade rows). This is the existing empty
  state; no new component needed, per the "display the existing empty state" requirement.
- **Legacy school profile with no `code`**: `undefined`/`''` → omitted from report header and
  xlsx export, not printed as blank line.
- **Legacy report data (measurements exist without explicit round selection previously
  possible)**: no migration needed — `Measurement.round` has always been recorded per-record;
  only the report *query* is changing to filter on it.
- **`defaultRound()` for a year with zero measures**: falls back to whatever
  `default-round.ts` already returns as its base case (term 1/round 1) — reused as-is, no new
  fallback logic.

## Testing

Unit (Vitest, `src/domain/report/summary.test.ts` or new file):

1. **Round filtering** — measurements exist for a student in both round 1 and round 2 of the
   same term; `summarize(..., round: '1')` counts only the round-1 record, `round: '2'` only
   the round-2 record.
2. **Same-round re-measure** — two measurements for one student both tagged round 1 (re-entry
   correction) — `summarize()` picks the latest-saved (`savedAt`) one, not both.
3. **Header omits blank fields** — `summaryToAoa()` with a `Setup` missing `code` (undefined)
   does not include a `รหัสโรงเรียน` row; with `code` set, it does.
4. **Header includes all populated identity fields** — full `Setup` with every field set
   produces all corresponding header rows in `summaryToAoa()`.

Manual/UI check (no component test infra beyond domain unit tests per CLAUDE.md):

- Onboarding: enter a school code with unusual characters/length, confirm it saves and
  round-trips through Settings.
- Reports: switch year → term/round auto-update to latest available session; manually pick
  round 1 vs round 2 and confirm the grade table changes; print preview and xlsx both show
  school code + full address fields when present, and cleanly omit them when blank.

## Out of scope

- No rollup/aggregate report spanning multiple rounds or semesters.
- No new "School Setup" screen — reusing Onboarding + existing Settings school panel.
- No change to `Term`/`Round`/`Measurement` types or nutrition engine.
- No education-office (เขตพื้นที่การศึกษา) field — not present in current `SchoolIdentity` and
  not requested as a new field, only "existing school metadata" should be surfaced.
