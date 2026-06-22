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
   errors, but never lock the user into an incorrect state (e.g. the academic year
   stays editable even after promotion).
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
documentation · simplicity > flexibility · current data > historical administration
· nutrition tracking > student administration.

## The Dashboard
A **workflow dashboard**, not an administration dashboard. It answers one question:
*"วันนี้ฉันควรทำอะไร?"* — surfacing the next real task (record measurements, import
roster, change academic year, export reports), not a wall of stats.

## Flagship Workflows
The **Academic Year Promotion Wizard** is the product's most important UX flow,
not just a feature. It is the once-a-year moment a non-technical teacher most fears
breaking things. It must be unhurried, fully explained step by step, reversible
where possible, and must prove no data is lost before removing anyone. Canonical
flow: explain → mandatory backup → review promotion → review graduating → export
graduates (with full measurement history) → show archive filename → remove from
active registry → complete → clear success summary.

## Student Lifecycle (kept deliberately simple)
- **Registry = current state only** (id, name, gender, dob, current grade/room). No
  history, no enrolment timeline. Exists only to support measurements.
- **Measurements = immutable history**, each snapshotting academic year / term /
  round / grade / classroom; never change after promotion or room moves.
- **New students:** manual add or Excel import.
- **Transfer-out / graduated:** export the student with full measurement history,
  then remove from the active registry.
- **Returning student:** duplicate รหัส is detected; re-import / restore from the
  exported archive. Student IDs always unique.
- **Import** is a primary workflow: preview, validation, plain-Thai error
  explanation, duplicate detection, bulk conflict resolution; handle messy real
  Excel files gracefully.

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
