# Student Nutrition Tracking System — Rewrite Design

**Date:** 2026-06-19
**Status:** Approved design (pre-implementation)
**Supersedes runtime of:** `nutrition_tracker 18062026.html` (behavior reference only)
**Source requirements:** `Business_Requirements.md` (BRD v1.0, app v1.1.0)

> Thai-language, single-user, single-device, fully offline web app for school health
> teachers to manage a student registry and monitor nutrition against the Thai
> Department of Health growth reference (B.E. 2564, ages 2–18).

---

## 1. Goal & Approach

Full **rewrite** of the existing single-file app with a clean, maintainable
architecture. The old HTML is kept only as a behavior/reference source (notably the
embedded growth-reference values and the verified classification logic).

Locked decisions (from brainstorming):

| Decision | Choice |
|---|---|
| Intent | Full rewrite, better architecture |
| Source layout | Modular source, **bundled + inlined to one self-contained `index.html`** |
| Framework | **Vue 3** (`<script setup>`, Composition API) + TypeScript + Vite |
| Data compatibility | **Clean slate** — no obligation to old localStorage keys / file formats |
| PDF | **Hidden-iframe browser print** + system Thai fonts |
| Reference data | **Port old values verbatim** into typed reference modules |
| UI direction | **Full redesign** (via `/impeccable` + `/frontend-design` during impl) |
| Graduated students | **Export-out**: download Excel record, then remove from app |
| Import | Tolerant pipeline with **inline-edit + auto-fix** review screen |
| Promotion safety | **Both** forced full backup AND required graduate export + confirm |

---

## 2. Architecture & Build

- **Stack:** Vue 3 + TypeScript + Vite. Chart.js v4 (npm dependency) for charts.
  Pinia for state (replaces old global arrays).
- **Single-file output:** `vite build` with `vite-plugin-singlefile` inlines all
  JS/CSS/fonts/reference data into one `dist/index.html`. Double-click → runs fully
  offline, no network calls (satisfies NFR-1.1, §6.5).
- **Old-tablet support (NFR-1.4):** Vite `build.target` set to a conservative
  baseline (≈ `es2017` / Safari 11–12). Source uses modern syntax; build transpiles
  down. No untranspiled optional chaining / top-level await in output.
- **Offline assets:** Chart.js bundled, not copy-pasted. Fonts use the **system Thai
  stack** (`'Sarabun','Leelawadee UI','Tahoma',sans-serif`) — no web-font fetch; the
  print iframe uses system fonts too (§5.11, FR-11.3).
- **Distribution:** repo holds modular source + `npm run build`; teachers receive the
  built `index.html`.

---

## 3. Source Structure

```
src/
  domain/                      # PURE logic — no Vue, fully unit-tested
    nutrition/
      engine.ts                # classifyWFH/WFA/HFA, calcNutrition, tall-proportionate
      reference/
        wfh-male.ts wfh-female.ts   # weight-for-height bands (ported verbatim)
        age-male.ts age-female.ts   # WFA + HFA sd2/sd1.5 bands by month (ported)
        index.ts                    # findRef(gender, ageMonths) + ±6mo tolerance
      latest.ts                # latest-measurement comparator (year→term→round→savedAt)
    date/thai-date.ts          # BE parse/format D/M/YYYY, age-in-months
    grade/ladder.ts            # canonical grade order + promote/demote helpers
    validation/rules.ts        # SINGLE source: weight 5–150, height 40–210, ranges
    import/normalize.ts        # tolerant cell parsing (numbers, dates, gender, spaces)
  stores/                      # Pinia: students, measurements, setup, ui
  services/
    persistence.ts            # localStorage load/save
    backup.ts                 # full backup/restore (JSON)
    csv.ts                    # roster/full export + import (uses domain/import + validation)
    excel-export.ts           # graduate/transfer record export, report spreadsheet
    pdf.ts                    # hidden-iframe print
  features/                    # Vue screens: dashboard, registry, promotion,
                               #   measure, charts, reports, settings
  components/  ui/             # shared UI (modal, table, form fields, toast, datepicker)
  i18n/th.ts                   # all Thai copy (labels, helper text, error messages)
  main.ts  App.vue
```

**Core consistency principle (FR-5.x, §6.2):** every classification — results table,
dashboard, charts, PDF, CSV, graduate export — imports the **same**
`domain/nutrition/engine.ts`, fed by the **same reference tables that draw the chart
zones**. No alternate or BMI-threshold path anywhere. `domain/` is framework-free and
is the primary unit-test target.

---

## 4. Data Model & Persistence

Clean-slate schema (camelCase, no cryptic keys).

**Student** (current-state master — everyone in-app is currently enrolled):
```ts
{ id: string, firstName: string, lastName: string,
  dob: string /* BE D/M/YYYY */, gender: 'ชาย' | 'หญิง',
  grade: string, room: string }
```
> Note: **no `graduated` flag.** Students leave the app only via export-out (§7).

**Measurement** (historical, immutable per period):
```ts
{ studentId: string, year: string, term: '1' | '2', round: '1' | '2',
  date: string /* BE D/M/YYYY */,
  weightKg: number, heightCm: number, savedAt: number /* epoch ms tie-breaker */ }
```
> Grade/room are **not** stored on measurements — derived from the current student
> master at display time (§6.3 accepted limitation; reports show a notice).

**Setup** (school profile): `school, ministry, department, subdistrict, district,
province, teacher, maxGrade`.

**Precision rule:** weight/height are rounded to **1 decimal at the validation
boundary** (single choke-point in `validation/rules.ts`), so storage, display, charts,
and exports never disagree.

**Persistence:** Pinia stores ↔ `persistence.ts` ↔ localStorage (students,
measurements, setup, + last-backup-time, + reminder-snooze keys). Autosave on
mutation. Backup file = `{ version, setup, students, measurements }` single JSON;
restore replaces all (confirm); restore back-fills missing `savedAt` (FR-9.4).

---

## 5. Nutrition Engine (shared, tested)

Ported verbatim from the existing verified logic:

- **WFH:** interpolate the gender weight-for-height table at the child's exact height
  to get the 6 band boundaries, then place weight into ผอม / ค่อนข้างผอม / สมส่วน / ท้วม /
  เริ่มอ้วน / อ้วน. **Same table that renders chart zones** (FR-5.2).
- **WFA:** age/gender reference → น้ำหนักน้อย / ค่อนข้างน้อย / ตามเกณฑ์ / ค่อนข้างมาก / มาก.
- **HFA:** เตี้ย / ค่อนข้างเตี้ย / สูงตามเกณฑ์ / ค่อนข้างสูง / สูง.
- **สูงดีสมส่วน:** "ใช่" only when HFA ≥ สูงตามเกณฑ์ AND WFH ∈ {สมส่วน, ท้วม}.
- **Eligibility (FR-5.1):** age ≥ 24 months and within reference range; else **not
  assessable** (excluded from classified outputs, never defaulted to สมส่วน).
- **Reference lookup tolerance (FR-5.6):** nearest age entry within ±6 months; beyond
  that → not assessable.
- **Latest-per-student (FR-5.7):** compare year → term → round, `savedAt` tie-breaker.

Reference data lives as typed modules (`reference/*.ts`), one table per
gender/metric, easy to diff and re-verify (REQ-8.3 specialist check still pending).

---

## 6. Screens (full redesign, intent-driven IA)

Tabs by teacher intent (Thai labels), single task per screen:

1. **หน้าหลัก (Dashboard):** summary counts (total students, total measurements,
   normal count, follow-up count), at-risk list from each student's latest
   measurement, getting-started guide on first run.
2. **ทะเบียนนักเรียน (Registry):** add/edit/delete, search by ID, list with grade/room.
   Per-student "นำออกจากทะเบียน" (export-out) action.
3. **เลื่อนชั้น (Promotion):** annual promotion wizard (§7).
4. **บันทึกการวัด (Measurement):** record weight/height per year/term/round/date,
   sticky context, live classification preview, duplicate-period detection.
5. **กราฟการเจริญเติบโต (Charts):** 3 per-student charts (WFH, HFA, WFA) with colored
   zones + measurement trend + legend; export charts+data to PDF.
6. **รายงาน (Reports):** agency-facing summary PDF (filter by year) + summary CSV;
   current-registry notice (§6.3).
7. **ตั้งค่าโปรแกรม (Settings):** school profile, backup/restore, CSV data transfer
   (new-year/handoff), clear-all, backup reminder.

---

## 7. Student Lifecycle & Promotion

### 7.1 Lifecycle model
The app holds **only currently-enrolled students**. There is **one exit path**:
**export-out** — the student's record + measurements are written to an Excel file the
teacher keeps, then removed from the app. "Held/repeater" and "graduating" are
**transient promotion-run states**, never persisted.

> **BRD deviation (intentional):** the BRD modeled graduation as an in-app
> `graduated` soft-flag (FR-2.9, FR-3.5, FR-9.4, FR-10.6). This design instead
> exports graduates out and removes them. Consequence: graduated cohorts are **not**
> queryable in-app; their records live in the exported Excel files. Reports cover the
> current registry only (consistent with §6.3). This simplifies the data model and
> keeps the active registry focused on enrolled students.

### 7.2 Grade ladder
Canonical order: `อ.1 อ.2 อ.3 ป.1 ป.2 ป.3 ป.4 ป.5 ป.6 ม.1 ม.2 ม.3 ม.4 ม.5 ม.6`.
Promotion = +1 step along the ladder (crosses bands, e.g. อ.3 → ป.1).
`setup.maxGrade` (อ.3 / ป.6 / ม.3 / ม.6) is the graduation cutoff: students at
maxGrade graduate instead of advancing. Handles any school size.

### 7.3 Promotion wizard (4 steps, both safety gates)
1. **Pre-flight + forced full backup (gate 1).** Explains in plain Thai what will
   happen (advance all one grade; students in maxGrade graduate and leave). Requires
   "สำรองข้อมูลทั้งหมด" download before continuing.
2. **Review table.** Every enrolled student: current → proposed grade/room. Defaults:
   all +1, maxGrade flagged "กำลังจะจบ". Per row: **คงชั้นเดิม** (repeater — no change),
   edit grade/room (transfers/corrections), mark/unmark graduating. Bulk: "เลื่อนทั้งหมด
   +1", "ลดทั้งหมด −1" (mistake correction).
3. **Graduate export (gate 2).** If any graduating: enter graduation academic year
   (default current BE); **download graduate Excel required** — Confirm disabled until
   saved.
4. **Confirm + apply.** Update grades; remove exported graduates (+ their
   measurements); summary toast (เลื่อน N, คงชั้น N, จบ N).

### 7.4 Export-out (graduate / transfer / other, any time)
One generic flow, reused by the wizard and by the per-student "นำออกจากทะเบียน" action:
choose reason (จบการศึกษา / ย้ายโรงเรียน / อื่น ๆ) → build Excel → remove student +
measurements. **Excel content:** one row per measurement with student fields +
computed WFH/WFA/HFA/สูงดีสมส่วน status + reason + academic year + school-profile
header — a complete standalone record (Excel-openable, no re-import needed).

---

## 8. UX Principles (target: non-technical / older teachers, no IT support)

- **Plain friendly Thai everywhere.** No format names or technical terms surfaced.
  Actions named by intent ("สำรองข้อมูล", "นำข้อมูลออก (Excel)", "เลื่อนชั้นนักเรียน").
- **Prevent > correct.** Manual entry uses numeric steppers / 1-decimal masks, a Thai
  BE **date picker** (no free-text date parsing for manual entry), grade/room
  dropdowns. Out-of-range blocked at the field.
- **Destructive actions** confirm with *what happens*, *how many records*, and *how to
  recover* ("สำรองข้อมูลก่อน"). Promotion / clear-all / restore are gated.
- **Errors = problem + fix**, in Thai, near the field
  (e.g. "น้ำหนักต้องอยู่ระหว่าง 5–150 กก.").
- **First-run / empty states** guide the next action.
- **Big touch targets, high contrast, large readable type** for tablets / older users
  (delivered in the `/impeccable` + `/frontend-design` pass).
- All copy centralized in `i18n/th.ts` for consistency and easy wording tweaks.

---

## 9. Tolerant Import Pipeline (Excel/CSV)

Real-world files are messy. Stages: **Parse → Normalize → Validate → Review/Fix →
Merge.** The whole file never fails; invalid rows are skipped + reported, valid rows
proceed.

- **Column mapping:** fuzzy header match (trim, case-insensitive, Thai+English
  aliases, any order). Unknown extra columns ignored. If a required column can't be
  found, show a friendly "จับคู่คอลัมน์" (map-your-columns) step.
- **Normalize per cell** (`domain/import/normalize.ts`): trim spaces; weight/height →
  loose numeric parse (`"32,5"` → `32.5`, strip units) rounded to 1 decimal; dates →
  accept multiple formats and **auto-detect BE vs CE** (year > 2400 ⇒ BE; else CE
  +543), normalize to BE `D/M/YYYY`; gender synonyms (ช/ชาย/M → ชาย).
- **Validate** using the **same** `validation/rules.ts` as manual entry (FR-10.5).
- **Review screen (before any save):** all rows, color-coded — ✅ ok / ⚠️ auto-fixed
  (shows what changed) / ❌ invalid (Thai reason, e.g. "ไม่มีรหัสนักเรียน — ข้ามแถวนี้").
  Invalid rows are **inline-editable** to rescue. Orphan measurements (no matching
  student) flagged + counted (FR-10.7). Per-row include/exclude.
- **Merge** on explicit confirm (FR-10.4): add new students, update existing students,
  skip duplicate-period measurements; distinct from "restore" (which replaces all).
  Summary toast ("เพิ่ม 12, อัปเดต 3, ข้าม 2").

---

## 10. PDF Generation

Per FR-11: render report HTML into a **hidden in-page iframe** and call `print()`
(user chooses "Save as PDF"). No new window (popup-blocker-proof), no freeze on
iPad/tablet, fully offline using **system Thai fonts**, dialog triggered once content
(including embedded chart images) has loaded. Layout via dedicated print CSS.
Chart images captured from Chart.js canvases.

Two reports: **per-student** (charts + data) and **agency summary** (by year/term,
school profile + criteria source/version in footer).

---

## 11. Testing

- **Vitest** unit tests on `domain/` — the correctness core:
  - nutrition engine: WFH interpolation + 6-band boundaries, WFA/HFA bands,
    สูงดีสมส่วน rule, not-assessable cases, ±6mo tolerance edges.
  - latest-per-student comparator (incl. `savedAt` tie-break).
  - Thai date parse/format + age-in-months across BE/CE.
  - grade ladder promote/demote + maxGrade graduation.
  - validation rules (boundary values 5/150/40/210, precision rounding).
  - import normalizer (messy dates, numbers, spaces, gender synonyms).
- **Consistency test:** assert the classification used by table/dashboard/charts/PDF/
  CSV all originate from the engine (no divergent path) — guards §6.2.
- Component/interaction tests for the import review and promotion wizard flows.

---

## 12. Reference / Criteria Display

Footer + reports show source/owner + version: สำนักโภชนาการ กรมอนามัย กระทรวงสาธารณสุข,
"เกณฑ์การเจริญเติบโตเด็กอายุ 2–18 ปี พ.ศ. 2564". App + criteria versions embedded in
backup files (NFR-6.1, REQ-8.2). Reference values pending specialist verification
(REQ-8.3).

---

## 13. Phased Roadmap

1. **Foundation:** Vite + Vue 3 + TS + Pinia scaffold, single-file build proven,
   `domain/` skeleton, port reference data, i18n shell.
2. **Nutrition engine + tests:** engine, date, validation, latest, grade ladder — all
   unit-tested. (No UI yet; correctness locked first.)
3. **Persistence + registry:** stores, localStorage, add/edit/delete/search students,
   school profile setup.
4. **Measurement recording:** entry form, sticky context, live preview, duplicate
   handling, measurement list (filter/paginate/search).
5. **Dashboard + charts:** summary, at-risk list, 3 growth charts with zones.
6. **Promotion + lifecycle:** promotion wizard (4 steps, both gates), export-out flow,
   graduate Excel.
7. **Import/export + backup:** tolerant import pipeline + review screen, CSV
   roster/full export, full backup/restore, clear-all, backup reminder.
8. **Reports + PDF:** hidden-iframe print, per-student + agency summary, summary CSV.
9. **UX/visual pass:** `/impeccable` + `/frontend-design` redesign, accessibility,
   responsive (≤820px → 2 col, ≤520px → 1 col), cross-browser/device check.

Each phase: own implementation plan → build → review.

---

## 14. Accepted Limitations / Deviations

| # | Item | Note |
|---|---|---|
| L-1 | Historical grade/room not stored per measurement | Current-state design; notice shown (§6.3) |
| L-2 | localStorage only, no cloud/encryption/audit | Single-file offline tool; mitigated by backup |
| L-3 | No multi-device sync / concurrent editing | File-based transfer instead |
| L-4 | Students outside 2–18 yrs not classified | Reference data doesn't cover them |
| D-1 | Graduates exported out + removed (no in-app soft-flag) | Deviates from BRD §5.3/§5.9; see §7.1 |
| D-2 | Graduated cohorts not queryable in-app | They live in exported Excel files |
