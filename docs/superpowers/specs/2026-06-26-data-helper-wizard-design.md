# Data Helper Wizard (ผู้ช่วยจัดการข้อมูล) — Design Spec

**Date:** 2026-06-26
**Status:** Approved design, pre-plan
**Scope:** POC. Add a new nav destination below ตั้งค่า that hosts a hub of
guided, Excel-centric **add-data** wizards for non-technical teachers.

## Problem

The single teacher per school is weak with technology. The recurring work —
get the student roster in, record measurements each round, export for the
team — already exists in the app but is spread across dense views
(`StudentsView`, `MeasureView`, `ReportsView`). Teachers need comfortable,
hand-held, one-thing-per-screen flows for the *adding data* part.

Teachers already keep their data in **Excel**. The wizard must lean on Excel
(download a prefilled template → fill in the familiar tool → upload), not push
manual in-app entry.

## Goals

- One new nav item (`dest: 'wizard'`) below ตั้งค่า → `WizardHubView`.
- Hub of 3 big cards, each a step-by-step wizard reusing the existing
  `Stepper` chrome:
  1. **เพิ่มรายชื่อนักเรียน** — import roster.
  2. **บันทึกการวัด** — add a measurement batch.
  3. **ส่งออกรายงาน** — export (thin wrapper over existing exporters).
- Wizards own only *guidance chrome + orchestration*. All parsing, merging,
  templating reuse `src/domain/transfer/xlsx.ts`. Store = `useData`.

## Non-Goals (scope guard)

- **Add-data only.** Viewing/editing existing lists stays in current views.
- No new parse/merge/classification logic beyond two small tested helpers
  (below). Nutrition classification stays in `domain/nutrition/engine.ts`.
- Existing `OnboardingView` untouched (user is keeping first-run onboarding).
- No router; follows the existing `dest`/`overlay` switch in `AppShell.vue`.

## Domain background — how teachers measure

A Thai academic year has **2 semesters (ภาคเรียน)**, each measured in **2 rounds**
→ **4 measurement batches per year**. Measuring is a batch event: a whole
room is lined up in roster order and weighed/measured one after another, numbers
written onto a paper/Excel roster sheet, then entered into a computer later.

So the system's job in the measure flow is **ingest the Excel they already
filled**, classify, store, and tag the batch with its period
`{year, term, round}`. The academic year is fixed from settings
(`data.period.year`); the wizard picks only term + round per batch.
(Note: semester/round currently also live in Settings — user will revise that
separately; the wizard reads/sets the period it stamps onto the batch
independently via the `parseMeasureAoa` period argument.)

## Data-model rationale (single roster, not per-year)

The app keeps **one living roster** (`students`, current grade/room only) plus an
**immutable measurement history** (each record stamps `year/term/round` and
snapshots `gradeAtMeasure`/`roomAtMeasure`). The school runs the app endlessly:
promotion rolls every student forward a grade each academic year, graduation
evicts the top grade (export leavers first, then remove). The roster is therefore
a bounded rolling window of currently-enrolled students, never an
ever-growing multi-year store.

A per-year roster model (create year N, copy/promote a separate roster into it —
e.g. 2569 G2/1 → 2570 G3/1) was considered and **rejected**:

- Promotion + graduation already implement the year roll (`PromotionView` /
  `domain/promotion`); the single-roster model needs no new structure.
- Historical reporting is already correct — measurements snapshot grade/room/year,
  so a student's status in a past year is answerable without duplicating rosters.
- Per-year rosters would rework `stores/data.ts` and every consumer (Students,
  Measure, Reports, Home, backup format, promotion), and introduce duplicate
  student records across years with id-collision and edit-propagation problems —
  high risk, against YAGNI, especially for a POC.

Consequence for this wizard: the academic **year is fixed from settings**
(`data.period.year`); the measure wizard picks only term + round and stamps the
batch via the existing `parseMeasureAoa` period argument. If multi-year *browsing*
is ever needed, derive it read-only from measurement history — do not duplicate
rosters.

## Architecture

### New files

```
src/features/wizard/
  WizardHubView.vue       # 3 cards, picks active wizard
  AddStudentsWizard.vue   # roster import
  AddMeasuresWizard.vue   # measurement batch
  ExportWizard.vue        # export wrapper
```

Wiring in `src/AppShell.vue`:
- Extend `type Dest` with `'wizard'`.
- Add nav entry `{ id: 'wizard', label: 'ผู้ช่วยจัดการข้อมูล', ico: '🧭' }`
  after the `settings` entry in the `nav` array (renders below ตั้งค่า in both
  sidebar and bottomnav automatically).
- Render `<WizardHubView v-else-if="dest === 'wizard'" key="wizard" @go="go" />`
  in the `<Transition>` block.

### Domain additions (`src/domain/transfer/xlsx.ts`, unit-tested)

`parseMeasureAoa` reads columns **positionally** (`col0=id, 1=weight,
2=height, 3=date`) and `MEASURE_HEADERS` carries no name column. To prefill
names (so the teacher can match rows to the kids in front of them) without
breaking the positional parse, add:

1. `measureRosterTemplateAoa(students: Student[]): string[][]`
   Header: `['รหัสนักเรียน','ชื่อ','นามสกุล','น้ำหนัก(กก.)','ส่วนสูง(ซม.)','วันที่วัด']`.
   One row per student, name columns prefilled, weight/height/date blank.
   Students passed in roster order (sorted as the existing room view sorts).

2. `pickMeasureColumns(aoa: string[][]): string[][]`
   Header-aware adapter: locate the `รหัสนักเรียน / น้ำหนัก / ส่วนสูง / วันที่วัด`
   columns by header text, project each row down to the strict
   `[id, weight, height, date]` order that `parseMeasureAoa` expects, and drop
   the display-only name columns. Falls back to identity (first 4 cols) if the
   sheet already matches `MEASURE_HEADERS`. This keeps the id effectively
   locked — the teacher only fills weight/height/date.

No other domain changes. `studentTemplateAoa`, `aoaToXlsxBlob`,
`readXlsxToAoa`, `parseStudentAoa`, `mergeStudents`, `mergeMeasures`,
`graduatesToAoa`, and the existing export/print helpers are reused as-is.

## Wizard flows

### A. AddStudentsWizard — เพิ่มรายชื่อนักเรียน

Steps (Stepper):
1. **ดาวน์โหลดแม่แบบ** — optional grade/room context; download
   `studentTemplateAoa()` (or classroom template) via `aoaToXlsxBlob`.
2. **อัปโหลดไฟล์** — drag-drop xlsx → `readXlsxToAoa` → `parseStudentAoa`.
3. **ตรวจสอบ** — show parsed rows in the existing student-table markup, plus a
   list of skipped rows with reasons.
4. **บันทึก** — `mergeStudents` → store; show `{added, updated}` then Done.

### B. AddMeasuresWizard — บันทึกการวัด

Steps (Stepper):
1. **เลือกข้อมูล (one page)** — pickers on a single screen, small option sets:
   - ชั้น (Grade) → ห้อง (Room) — from `data.structure`.
   - ภาคเรียน (Semester: 1 | 2).
   - ครั้งที่ (Round: 1 | 2).
   Year is fixed (`data.period.year`, shown read-only).
2. **กรอกข้อมูล** —
   - Download prefilled `measureRosterTemplateAoa(roomStudents)`
     (names already in, roster order).
   - Upload filled xlsx → `readXlsxToAoa` → `pickMeasureColumns` →
     `parseMeasureAoa(aoa, { year, term, round })` using the picked term/round.
3. **สรุปการเปลี่ยนแปลง** — review screen using existing measure-table markup +
   nutrition result badges; show counts of **new vs updated** (derived from
   `mergeMeasures`'s `{added, updated}`) and **orphans** (ids not in roster —
   typo'd id, listed so the teacher can fix the Excel and re-upload).
   Re-uploading an already-measured batch **overwrites** (one record per
   student+year+term+round, per `mergeMeasures`/`upsertMeasure`).
4. **เสร็จสิ้น** — Done screen with a link back to the room.

### C. ExportWizard — ส่งออกรายงาน

Steps (Stepper):
1. **เลือกขอบเขต** — all / grade / room / graduates.
2. **เลือกรูปแบบ** — xlsx (`studentsToAoa`/`graduatesToAoa` + `aoaToXlsxBlob`) or
   pdf/print (reuse existing `ReportsView` / `print.ts` exporters).
3. **ดาวน์โหลด** — produce the file; Done.

Card C is intentionally thin — it wraps existing exporters to complete the
import → measure → export loop, adding only the scope/format picker chrome.

## Error handling

- Parse errors (`parseStudentAoa` / `parseMeasureAoa` skipped rows) are shown
  in the review step with row number + Thai reason; teacher fixes Excel and
  re-uploads. Nothing is saved until the explicit save action on the review step.
- Orphan measurement rows (unknown student id) are surfaced, not saved.
- Bad/unreadable file → friendly Thai error on the upload step, same pattern as
  the existing welcome-screen restore handler.

## Testing

- Unit tests (Vitest, `tests/transfer/`):
  - `measureRosterTemplateAoa` — correct headers, one row per student, names
    prefilled, measurement columns blank, roster order preserved.
  - `pickMeasureColumns` — reorders by header, drops name columns, output feeds
    `parseMeasureAoa` correctly; identity fallback for strict `MEASURE_HEADERS`.
- Wizard components are thin orchestration over tested domain + store; covered
  by existing domain tests plus manual verification on localhost:5173.

## Open items (deferred, not blocking)

- Settings will stop owning semester/round later (user-owned change); the
  wizard already takes its period from the picker, so no rework needed there.
