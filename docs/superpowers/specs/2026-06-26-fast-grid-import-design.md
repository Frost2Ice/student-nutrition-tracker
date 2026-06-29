# Fast-Grid Student Import (POC) — Design

**Date:** 2026-06-26
**Status:** Approved (brainstorm), pending spec review
**Type:** UX experiment / proof-of-concept

## ⚠️ POC disclaimer

This is a deliberate **experiment** that contradicts `PRODUCT.md`. The user
explicitly chose to break two anti-references as a new way-of-working POC:

- **"Spreadsheet-as-UI (rows of inputs, no hierarchy)"** — the fast-grid IS a
  spreadsheet of inputs.
- **"Playful/childish styling that undercuts trust"** — the "game-like" framing
  (live count, satisfying confirm rhythm).

Documented here so reviewers know the conflict is intentional, not an oversight.
If the POC validates, revisit PRODUCT.md; if not, fall back to the focused
quick-add card alternative discussed during brainstorm.

## Problem

The Excel import is the pain point. Free-text columns let non-technical teachers
enter garbage: DOB split across 3 columns (day/month/year), month typed as
"May" / "พ.ค." instead of `5`, free-text gender. Errors surface only after
upload, in the preview.

## Goal

Replace the file-first bulk-add with an in-app **fast-grid** of controlled
inputs so most errors are impossible by construction, while keeping Excel as a
demoted secondary path. Bulk speed via paste-to-fill. A light "game" feel
(live valid-count, per-row confirm states) to make data entry less tedious.

## Scope

### In scope
- **StudentsView**: remove the `ดาวน์โหลดแม่แบบ Excel` action card
  (`StudentsView.vue:702-708`) and the now-unused `downloadRoomTemplate`
  function (`StudentsView.vue:98`). Template download moves into the import
  dialog's Excel section.
- **ImportDialog** (`src/components/ImportDialog.vue`): for `kind === 'student'`,
  add a new default `grid` stage. Excel file path demoted to a link.
- Single-add form (`+ เพิ่มนักเรียน`) — **untouched**.
- Measure-kind import flow — **untouched** (still file → preview → done).

### Out of scope
- No new validation/classification logic. Reuse `parseStudentImport` /
  `mergeStudents` (`src/domain/transfer/xlsx.ts`) — single source of truth.
- No changes to the data model or domain types.
- Measure import grid (student-only POC).

## UX flow (student kind)

Stages: `room` → **`grid`** (new, default) → `preview` → `done`.

- `room`: unchanged room picker (only when no room in props).
- `grid`: the new fast-grid (below).
- `preview`: unchanged table with inline date-fix and counts.
- `done`: unchanged success summary.

The room context banner (existing `.sess` block) stays above the grid.

## The fast-grid

Editable roster table. Columns:

| col | input | notes |
|-----|-------|-------|
| รหัส | text | student id, required, unique |
| ชื่อ | text | firstName |
| สกุล | text | lastName |
| เพศ | segmented toggle ช \| ญ | maps to `'ชาย'` / `'หญิง'`, default unset |
| วันเกิด | `ThaiDateField` | date-picker, BE, `year-min/max` per existing form |
| (action) | ✕ | remove row |

Behavior:
- Starts with ~5 blank rows. `+ เพิ่มแถว` adds one.
- `Tab` moves across cells left-to-right, top-to-bottom (native order is enough).
- `Enter` on the last row's last meaningful cell appends a new row.
- ✕ removes a row. Fully-blank trailing rows are ignored on confirm.
- Per-row live validation: invalid cell tinted + reason text, mirroring the
  preview's pill states (`ok` / `update` / `error`). Reuses parse output.

### Game feel (intentional, POC)
- Live valid-count somewhere in the footer: "พร้อม 12 · อัปเดต 3 · ปัญหา 1",
  updating as rows are edited (reuse `counts` from `parseStudentImport`).
- Per-row status uses the same pill vocabulary as preview (✓ พร้อม / ✏️ อัปเดต /
  ⚠️ ปัญหา) so a row "resolves" with a satisfying flip as the teacher fixes it.
- Keep within existing design tokens — no new colors, no childish iconography
  beyond what the app already uses. The "playful" part is the rhythm, not chrome.

### Paste-to-fill
- Listen for `paste` on a grid cell. If clipboard is multi-cell TSV/CSV, fill
  starting from the focused cell, creating rows as needed.
- Auto-skip a leading header row if its first cell is non-numeric / matches a
  known header word (รหัส, id, etc.).
- After paste, run validation; flagged cells fixed inline.

## Validation reuse (single source)

Grid rows are serialized into an `aoa: string[][]` in the **classroom-template
column order** (`STUDENT_CLASSROOM_HEADERS`), with DOB split into day/month/year
cells from the canonical `ThaiDateField` value (`D/M/YYYY`). This AoA is fed to
the existing `parseStudentImport(aoa, {grade, room}, existingIds, overrides,
periodYear)`. Output `rows`/`counts` drive both the live grid status and the
preview. Confirm path reuses `mergeStudents` exactly as today.

This means: **no new domain code**. The grid is a controlled-input front end that
produces the same AoA the Excel reader produces.

## Excel demotion

Below the grid: a quiet link `หรือนำเข้าจากไฟล์ Excel`. Expanding it reveals the
existing dropzone + a `ดาวน์โหลดแม่แบบ` button (moved here from StudentsView).
On file select, parsed rows **load into the grid** (not straight to preview) so
both paths converge on the same review surface, then the same confirm.

## Components & boundaries

- `ImportDialog.vue` gains the `grid` stage markup + grid state (rows array,
  cell edit handlers, paste handler, serialize-to-aoa).
- Grid row type: `{ id, firstName, lastName, gender, dob }` (plain strings;
  `dob` canonical from `ThaiDateField`).
- Serialize helper: `gridRowsToAoa(rows): string[][]` — pure, unit-testable,
  lives in the domain transfer module next to the parsers (framework-free).
- Everything else (parse, merge, preview, done) unchanged.

## Testing

- Unit-test `gridRowsToAoa`: column order, DOB split, blank-row trimming,
  empty input.
- Unit-test paste parsing helper (TSV/CSV split, header skip) if extracted as a
  pure function.
- Existing `parseStudentImport` / `mergeStudents` tests cover classification —
  no change.
- Manual: dev server, add rows, paste a block, fix a flagged row, confirm; Excel
  link loads into grid.

## Error handling / edge cases

- Empty grid (all blank) → confirm disabled (reuse `canConfirm`).
- Duplicate id within grid or against existing → `parseStudentImport` already
  flags; row shows ⚠️ ปัญหา.
- Paste with more columns than the grid → extra columns ignored.
- Bad DOB cannot really occur (date-picker), but if a pasted DOB is unparseable
  it flows through the same date-error path as Excel.

## Open questions

None blocking. POC nature accepted by user.
