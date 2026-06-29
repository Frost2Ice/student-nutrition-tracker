# Product

## Register

product

## Users
School health teachers in Thailand who manage nutrition records for an entire
school. Often older, frequently non-technical, sometimes uneasy with software,
and working with **no IT support**. They use the tool on a PC, tablet, or iPad,
fully offline, often while measuring many students in one sitting. Thai language
throughout.

## Product Purpose
A **Student Nutrition Tracking System** — **not** a Student Information System, a
school clinic system, or a medical record system. It helps Thai school health
teachers: manage the current student registry, record weight/height, evaluate
nutritional status against the Thai Department of Health growth reference
(B.E. 2564, ages 2–18), track growth over time, generate reports, and handle annual
academic-year transitions. Everything else exists only to support these goals.

**The litmus for every decision:** *"Does this help teachers measure and track
student nutrition more effectively?"* If no, it is out of scope. Success = a
non-technical teacher runs the whole termly cycle confidently, alone, without fear
of breaking or losing anything.

## Brand Personality
Calm, clinical-friendly, trustworthy. A reassuring health tool, not a government
form and not a toy. Three words: **calm, caring, dependable.** The interface
should lower anxiety: never shout, never overwhelm, always show the next step.

## Anti-references
- The previous build: cramped tabs, flat blue header, dense tables, no guidance,
  generic stat cards. Do not reuse its UX or layout.
- Spreadsheet-as-UI (rows of inputs, no hierarchy).
- Government-portal density and jargon.
- Playful/childish styling that undercuts trust.
- Generic SaaS dashboard with the big-number hero-metric template.

## Design Principles
1. **Hold the user's hand.** Every screen must answer four questions in plain Thai:
   *ฉันกำลังทำอะไร? · ทำไปทำไม? · จะเกิดอะไรต่อ? · กดต่อได้อย่างปลอดภัยไหม?* Clarity and
   confidence outrank exposing functionality quickly. Fewer features done
   excellently beats many that confuse.
2. **Guide, don't present.** Every screen leads to the next action; the home is a
   guide, not a wall of stats.
3. **One task in focus.** Each surface has a single clear job, big targets, no
   redundant inputs.
4. **Prevent mistakes; never trap.** Validate before submit; confirm destructive
   actions with plain-language stakes; always leave a way back. Guide away from
   errors, but never trap the user in an incorrect state. The **active** year is
   always fully editable; **archived** years are intentionally read-only (to protect
   the historical snapshot), but never a dead end — they stay browsable, exportable,
   and recoverable, and a new year can always be created.
5. **Reassure about data.** Destructive-sounding actions (graduation, transfer-out)
   must make clear data is *moved, not lost*: export first, show the saved
   filename, then remove.
6. **Workflow-first, not CRUD-first.** Design real teacher journeys (first-time
   setup, import roster, record measurements, review status, change academic year,
   export reports), never "list / add / edit / delete" screens.
7. **Thai-first.** Design every label, helper text, dialog, empty state, and
   confirmation in realistic Thai from the start — never English-then-translate. It
   should feel like software made for Thai users.
8. **Readable first.** Large Thai type, high contrast, generous spacing.
9. **Quietly trustworthy.** Motion and color convey state, never decorate.

Priority order when principles conflict: confidence > efficiency · guidance >
documentation · simplicity > flexibility · nutrition tracking > student
administration. *(The former "current data > historical administration" rule is
retired: historical years are now first-class immutable snapshots, preserved and
browsable read-only — they are still never **administered**, only kept.)*

## The Dashboard
A **workflow dashboard**, not an administration dashboard. It answers one question:
*"วันนี้ฉันควรทำอะไร?"* — surfacing the next real task (record measurements, import
roster, change academic year, export reports), not a wall of stats.

## Flagship Workflows
The **New Academic Year flow** (the evolved Promotion Wizard) is the product's most
important UX flow, not just a feature. It is the once-a-year moment a non-technical
teacher most fears breaking things. It must be unhurried, fully explained step by
step, and must prove no data is lost: it **creates** the next year rather than
overwriting the current one. Canonical flow: explain (this year is kept forever, a
new year is created) → mandatory backup → name the new year + carry settings →
review promotion → review graduating → export graduates (with full measurement
history) → confirm → freeze the current year as a read-only archive + open the new
active year → clear success summary. The prior year is never deleted, only archived,
so the flow is inherently recoverable.

## Student Lifecycle — snapshot-first, year as the data boundary
*(Supersedes the earlier rolling-roster model. Decision 2026-06-29: each Academic
Year is the primary data boundary and an immutable snapshot — not a side effect of a
single mutated live roster. See `docs/superpowers/specs/2026-06-29-year-based-dataset-design.md`.)*

- **The Academic Year is the unit of data.** The school holds one **active** year
  (editable) plus any number of **archived** years (`เก็บถาวร`, read-only). Each
  year is a self-contained snapshot: its own students, classrooms, measurements,
  teacher, and max-grade setting. School identity (name, ministry, district…) is a
  single shared root, not copied per year.
- **Promotion creates the next year; it never mutates the current one.** Rolling to
  a new year copies students forward (carrying a stable `studentId`), advances
  grades, and starts with empty measurements. The previous year freezes into a
  read-only archive — nothing is overwritten or deleted to move forward.
- **Within the active year, the registry is current state** (id, name, gender, dob,
  grade/room). No enrolment *timeline* inside a year. History lives across years as
  whole frozen snapshots, browsable read-only — never an administrative audit log.
- **Measurements stay immutable**, each stamping year / term / round / grade /
  classroom; they belong to their year's snapshot.
- **Cross-year history is lightweight, via `studentId`.** To show a student across
  years, collect measures from each year's snapshot where `studentId` matches. No
  Enrollment entity, no normalized relational model — the year count is small.
- **New students:** manual add or Excel import (into the active year).
- **Graduated / transfer-out:** during year rollover, graduates are simply not
  copied into the new year; the frozen prior year keeps them with full history.
  Export-then-remove reassurance still applies for mid-year departures.
- **Returning student:** duplicate รหัส detected; re-import / restore. Student IDs
  unique within a year.
- **Import** is a primary workflow: preview, validation, plain-Thai error
  explanation, duplicate detection, bulk conflict resolution; handle messy real
  Excel files gracefully.
- **Backup/restore is year-aware:** export a single Academic Year (self-contained,
  portable) or the whole school; year-import merges, full-import replaces.

## Out of Scope
Student Information System, medical records, clinic visits, symptom logging,
medication, vaccination, treatment history, attendance, behavioral records, general
school administration. Keep the app focused on nutrition tracking throughout.

## Accessibility & Inclusion
- Target WCAG 2.1 AA: body text ≥4.5:1, large text ≥3:1, visible focus rings.
- Base font ≥17px; comfortable tap targets (≥44px).
- Full `prefers-reduced-motion` support.
- Status never encoded by color alone (always paired with a Thai label).
- Works keyboard-only; works on tablet/phone in portrait and landscape.
