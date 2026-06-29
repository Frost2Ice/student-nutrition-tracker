# Student Workspace (POC) — Design Spec

**Date:** 2026-06-28
**Status:** Approved for planning
**Scope:** `นักเรียน (POC)` menu (`students-poc` / `StudentsPocView.vue`)

## Goal

Merge the POC's two classroom surfaces — student roster and per-round measurement
results — into a single **Student Workspace** page. One round-scoped table shows
student info and the four assessment results together, cleaner and easier to scan,
without dropping any required assessment column.

## Journey

1. **Map** — grade bands → room cards. Select grade → room.
2. **Workspace** — opens on the selected room. The central classroom page.
3. Click a student row → existing **Student Detail** (individual view/edit).

In-place view swap within `StudentsPocView` (`view: 'map' | 'students'`); no new route.

## Map changes

- Room cards become navigation-only: show `grade/room` + `N คน`.
- **Remove** the measured-count pill and the `⚠️ N เสี่ยง` pill from cards.
  - Rationale: cards summarized *latest* status across all rounds; Workspace scopes
    to one round. Showing both created a latest-vs-round mismatch. Teachers always
    enter a room and work within a specific round, so card summaries add little.

## Workspace layout (top → bottom)

1. **Session selector** — term/round tabs reused from the existing measurement table
   pattern: ภาคเรียนที่ 1 ครั้งที่ 1 / ครั้งที่ 2, ภาคเรียนที่ 2 ครั้งที่ 1 / ครั้งที่ 2.
   Each tab shows a `measured/total` count badge (good/warn/neutral classes).
   - **Default tab:** latest round that has any data for the room; fall back to
     ภาคเรียนที่ 1 ครั้งที่ 1 when the room has no measurements yet.
   - Changing tab refreshes the table to that round only. Never show all four rounds
     in one table.
2. **Room actions** — single card: **ส่งออกรายชื่อ** (export roster to Excel, existing
   `exportRoom` logic). May be inlined beside the room title rather than a full action
   card (layout choice, finalize in plan).
   - **Removed:** นำเข้ารายชื่อ (student import now lives only in the Import Wizard —
     single entry point).
   - **Removed:** บันทึก/แก้ไขผลการวัด → MeasureView (moving away from MeasureView).
3. **Risk-only filter chip** — kept (filters table to at-risk students for the round).
4. **Table** — one table, scoped to the selected round.

## Table — columns

`รหัส · ชื่อ-สกุล · เพศ · น้ำหนัก · ส่วนสูง · [น้ำหนัก/อายุ] [ส่วนสูง/อายุ] [น้ำหนัก/ส่วนสูง] [สูงดีสมส่วน]`

- **น้ำหนัก / ส่วนสูง**: plain text (no inline inputs), with unit (กก. / ซม.);
  `—` when unmeasured this round.
- **Four assessment columns** kept separate, required, never merged:
  - น้ำหนัก/อายุ (WFA)
  - ส่วนสูง/อายุ (HFA)
  - น้ำหนัก/ส่วนสูง (WFH)
  - สูงดีสมส่วน (proportional growth)
- **Per-student empty:** when no record exists for the selected round, show a single
  muted `ยังไม่วัด` across the assessment cells rather than four `—`.
- **Row click** → Student Detail (see below).

### Label shortening (display-only)

Strip the prefix that duplicates the column header. **`engine.ts` is not touched** —
classification still flows through the single engine source; only the rendered text is
shortened in the view. Color class (good/warn/bad) is still derived from the full
engine value.

- น้ำหนัก/อายุ: `น้ำหนักน้อย → น้อย`, `น้ำหนักค่อนข้างน้อย → ค่อนข้างน้อย`,
  `น้ำหนักตามเกณฑ์ → ตามเกณฑ์`, `น้ำหนักค่อนข้างมาก → ค่อนข้างมาก`, `น้ำหนักมาก → มาก`.
- ส่วนสูง/อายุ: `สูงตามเกณฑ์ → ตามเกณฑ์` (เตี้ย / ค่อนข้างเตี้ย / ค่อนข้างสูง / สูง already
  short — keep).
- น้ำหนัก/ส่วนสูง (ผอม / ค่อนข้างผอม / สมส่วน / ท้วม / เริ่มอ้วน / อ้วน): already short —
  **unchanged**.
- **สูงดีสมส่วน: unchanged.**

## Student Detail (reuse)

- Row click → `go('students', <studentId>)`.
- Reuse the existing profile panel in `StudentsView.vue`, which opens an individual
  student via the `focus-id` prop.
- Wiring: extend AppShell `go(target, payload)` to carry a focus-student id and set
  `focusStudent`, then navigate to the `students` dest. Student Detail itself unchanged.

## Whole-school search

- Keep the 🔍 search bar and its jump-to-room behavior.
- **Drop** the "latest status" pill from search results (avoids latest-vs-round
  confusion). Results show id / name / class only.

## Wide-table handling

8–9 columns won't fit a phone. Reuse the existing measurement-table pattern: wider
canvas + horizontal scroll (`min-width`, `overflow-x: auto`). Frozen/sticky left
columns are out of scope.

## Architecture (resulting)

- **Student Workspace** (`students-poc`) = classroom-level review + navigation, one
  round-scoped table combining student info and assessment results.
- **Student Detail** (`StudentsView` profile) = individual student view/edit, reused
  as-is.
- No two classroom-level pages showing the same measurement data within the POC menu.

## Out of scope

- Redesigning Student Detail.
- Historical measurement visualization across academic years.
- School-wide historical browsing.
- Replacing/merging the existing `นักเรียน` (`StudentsView`) module. Overlap between
  `นักเรียน` and `นักเรียน (POC)` during the POC phase is accepted; whether Workspace
  eventually replaces, merges with, or coexists is a post-POC decision.

## Known follow-up (non-blocking)

- Post-POC IA decision on `นักเรียน` vs `นักเรียน (POC)` overlap.
