# Phase 0 — Validated UX Baseline & Gap Resolution

**Date:** 2026-06-20
**Status:** Approved (UX validated in clickable prototype)
**Builds on:** `2026-06-19-nutrition-tracker-rewrite-design.md`,
`2026-06-20-student-registry-foundation-design.md`
**Source requirements:** `Business_Requirements.md` (BRD v1.0)
**Behavior reference:** `nutrition_tracker 18062026.html` (legacy)

> Outcome of Phase 0: a clickable Vue prototype (`src/prototype/**`) walked through
> every user journey. **The prototype is the validated UX baseline** — implementation
> should reproduce its journeys, layouts, and interaction patterns. This doc records
> the decisions that prototype encodes, plus the legacy gap analysis and its
> resolution, so nothing is lost when real implementation begins.

The prototype is mock-only (no real logic). It validates *experience*, not code.
Where prototype detail and the BRD/engine specs disagree on logic, the BRD and the
domain engine win; where they disagree on *journey/layout*, the prototype wins.

---

## 1. Prototype as Baseline — file map

UX source of truth (`src/prototype/`), one component per surface:

| Surface | Component | Journey |
|---|---|---|
| App shell (sidebar/bottom-nav, period chip, overlay host) | `ProtoShell.vue` | persistent destinations + full-screen wizard overlays |
| First run | `ProtoShell.vue` (welcome) + `OnboardingJourney.vue` | two-path welcome → 5-step setup |
| Home | `HomeDashboard.vue` | "today" focus + at-risk follow-up |
| Students (browse + registry + profile) | `StudentProfileView.vue` | drill-down, CRUD, rich profile |
| Measurement | `MeasureJourney.vue` | room worklist → entry → review |
| Reports | `ReportsView.vue` | agency document |
| Settings | `SettingsView.vue` | data-transfer + config |
| Promotion | `PromotionJourney.vue` | 6-step annual wizard |
| Import | `ImportJourney.vue` | per-classroom merge wizard |
| Design tokens / motion | `src/style.css`, `src/prototype/proto.css` | teal "Calm Clinic", state-conveying motion |

---

## 2. Interaction-pattern law (validated)

A workflow gets a **wizard** only if it is **occasional AND sequential AND
high-stakes**. Everything else is a **direct screen / dialog**.

| Workflow | Pattern | Rationale |
|---|---|---|
| Onboarding, Promotion, Import | Wizard (full-screen overlay) | once/occasional, ordered, irreversible-ish |
| Measurement | Light guided flow (pick room → enter → ตรวจทาน → save) | frequent, but has a real save gate |
| Students browse, Profile, Reports, Settings | Direct screens | reference/lookup, no commit gate |
| Student add/edit, Measurement add/edit, confirms | Inline dialog | bounded single task |

Cross-surface conventions: **clickable rows** (tap row = primary action, secondary
action is an explicit in-row link with `@click.stop`); one shared status-pill
vocabulary (good/warn/bad/neutral); calm teal motion that conveys state only
(no page-load choreography); every animation degrades under `prefers-reduced-motion`.

---

## 3. Reports vs Data Transfer — hard boundary

Different goals, different audiences, **must never share a screen or a file**.

| | Reports (`รายงาน`) | Data Transfer (in `ตั้งค่า`) |
|---|---|---|
| Goal | view / print / submit | move working data |
| Audience | teacher's eyes, supervising agency | another teacher / computer / year |
| Output | PDF + summary spreadsheet (counts & %) | the actual student + measurement records |

**Rule:** Reports never emits a data file; Data Transfer never emits a document.

### 3.1 Reports screen (agency-only, BRD §5.8)
One artifact, presented as the printable document it produces:
school header → coverage line (วัดแล้ว X/Y) → **WFH category breakdown** (per grade-band
counts + a % row) → **สูงดีสมส่วน** → §6.3 current-registry notice → criteria footer
(REQ-8.2). Filters: **ปีการศึกษา + ภาคเรียน** only (FR-8.1). Outputs: **PDF** (FR-8.1)
and **summary CSV** (FR-8.2). No report-type picker. Per-student report and at-risk
list are NOT here (they live on the profile and the dashboard).

---

## 4. Settings — outcome-worded, two goal groups

Non-technical teachers think in outcomes, and the only distinction they must feel is
**replace everything** vs **combine with mine**. Jargon ("backup/restore/export/
import") and file formats are never surfaced.

```
ข้อมูลของฉัน  (this device — safety)        แลกข้อมูลกับครูคนอื่น  (between people)
  💾 เก็บข้อมูลกันหาย   (backup)              📤 ส่งข้อมูลให้ครูคนอื่น   (export, Excel)
     + "เก็บล่าสุด N วันก่อน" reminder        📥 รับข้อมูล / นำเข้า Excel (import = MERGE)
  ⬇️ ย้ายมาเครื่องนี้ / กู้คืน (restore = REPLACE, warn)
```
Plus: ข้อมูลโรงเรียน (edit), ปีการศึกษาปัจจุบัน, **งานประจำปี** (→ Promotion wizard),
and a guarded **ล้างข้อมูลทั้งหมด** (type-to-confirm) reset.

- Restore (replace) and Import (merge) sit in *different* groups, each beside its mild
  sibling, so the outcome is obvious from where it lives.
- New-academic-year rollover is the Promotion wizard, **in place** — not a data file.

---

## 5. Gap resolution vs legacy (keep / improve / drop)

Filter applied to every legacy feature: *"Does this make the app genuinely better for
teachers today?"* Not feature-parity.

### 5.1 Build — must-have (legacy had, prototype now has)
- **Student registry CRUD** — add (room-level "+ เพิ่มนักเรียน"), edit & delete (profile
  header). Inline dialog, not a wizard.
- **Measurement edit / delete / add-one** — from the profile history rows + "+ บันทึกการวัด".
- **Duplicate-measurement detection (BRD §6.4)** — already-measured students tagged
  "วัดแล้วรอบนี้"; entering values gates behind explicit "บันทึกทับ". No silent overwrite.
- **Rich student profile** = the hub: demographics, latest assessment, growth charts
  (see §6), full editable history with the §6.3 "class at time of measurement" note.
- **Per-student PDF** (FR-7.6) — on the profile (the per-student output pulled OUT of Reports).
- **Room list nutrition status** — `ภาวะล่าสุด` column + "เฉพาะกลุ่มเสี่ยง" filter
  (improves on legacy's whole-school mega-table by scoping to the room).
- **Backup reminder** — "เก็บล่าสุด N วันก่อน", stale state surfaced.
- **Full-data export + Excel import-merge** (FR-10.1, FR-10.3/10.4) — the 📤/📥 cards.
- **Version + criteria string** (REQ-8.2 / NFR-6.1) — footer + Settings.

### 5.2 Covered already (no gap)
Continuous-entry sticky fields (improved: round/date set once per room session),
counts-by-class (Reports + browse counts), reset, at-risk list (Home), promotion,
onboarding, agency summary, backup/restore.

### 5.3 Dropped — intentionally (not "genuinely better")
- **Roster-only CSV export** — backup moves a whole system; promotion handles the year
  in place. One fewer confusing file.
- **Dedicated คู่มือ guide** — onboarding + inline empty-states carry orientation.
- **Standalone "ลดชั้นทุกคน" (demote-all)** — the Promotion wizard's reviewable per-student
  step + back navigation is the safer home for undoing a promotion.

---

## 6. Student Growth Charts — LOCKED requirement

Core product feature, not decoration. The profile MUST present the **same three charts
as the legacy app**, modernized in presentation but identical in function and
interpretation:

1. **Weight-for-Height (WFH)**
2. **Height-for-Age (HFA)**
3. **Weight-for-Age (WFA)**

Authoritative source (HARD requirement, BRD §6.2): สำนักโภชนาการ กรมอนามัย กระทรวงสาธารณสุข
growth reference, ages 2–18, **B.E. 2564**. ONE classification path (`calcNutrition` /
`classifyWFH/WFA/HFA`) feeds the results table, dashboard, charts, PDF, and CSV. No
simplified or alternate logic anywhere.

**Chart zone ↔ textual classification must match EXACTLY.** The chart boundary lines must
be the *same numbers and the same math* the engine compares against — not an approximation:
- WFH boundaries = the engine's cutoff columns (`b0..b4`), rendered **linearly** (no
  spline tension), because `classifyWFH` interpolates linearly between height rows.
- HFA/WFA boundaries = the engine's `AgeRef` SD fields, rendered as a **nearest-row step**
  (`stepped:'middle'`, no tension), because the engine snaps to the nearest age row
  (`findRef`), it does not interpolate across ages.
- An automated invariant test asserts: for a dense grid of inputs, the band a point falls
  into (evaluated with the chart's own boundary arrays + the matching render math) equals
  `calcNutrition`'s label for that point. If chart zone ≠ text, the build is wrong.

Required behavior (preserve from legacy / BRD §5.7):
- Each chart renders **reference classification zones** (colored areas) drawn from the
  **same reference tables that feed the nutrition engine** — so a student's textual
  classification always matches the zone their point sits in (BRD §6.2 invariant; no
  alternate/BMI path).
- Plot the student's **measurement history as a trend line** over the zones, points
  colored by classification.
- Legend explains each zone (FR-7.5). Render fully **offline** (Chart.js bundled, FR-7.4).
- Charts feed the per-student PDF (FR-7.6).

**Presentation (flexible, validated direction):** the prototype shows one zoned chart
with a WFH/HFA/WFA segmented toggle. The toggle is an acceptable modern presentation of
"three charts," but the requirement is that all three exist with real reference zones +
classification; stacked vs toggled is an implementation choice. The illustrative
3-band mock in the prototype is a placeholder for the real reference zones.

---

## 7. Registry edit semantics (validated)

- **Grade / classroom are directly editable** on the profile — normal year-round
  registry maintenance (students move rooms, fix mistakes). Not a separate workflow.
- Because grade/room live only on the **current** master record (per the registry spec),
  changing them shows a **lightweight confirmation** that states: the student moves from
  now on, and **past measurements keep the class they were recorded under** (immutable
  snapshots). Low friction — one confirm, not a wizard.
- **Home follow-up list and room-level at-risk filter are both kept** — school-wide
  "what needs attention today" vs focused work inside one classroom. Different workflow
  stages, not duplicates.

---

## 8. Open items for implementation (not UX-blocking)
- Real reference-zone geometry for the 3 charts (port legacy values; engine-fed).
- Exact CSV column schemas for export/import (BRD §5.10 + import validation FR-10.5).
- PDF layout for the agency summary and the per-student report (hidden-iframe, §5.11).
- "Downstream impact" set for grade/room change is limited to current-state only
  (snapshots are immutable), so the confirm copy in §7 is the full extent.

---

## 9. Status
UX baseline validated and locked. Next: fold these into implementation plans
(registry CRUD + measurement management + profile/charts + Settings data-transfer +
Reports), reusing the existing domain engine and reference tables. Prototype components
are the layout/interaction reference for each corresponding real view.
