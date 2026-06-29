---
name: ระบบติดตามภาวะโภชนาการนักเรียน
description: Calm, hand-holding nutrition tracker for Thai school health teachers
colors:
  bg: "#f7fafb"
  surface: "#ffffff"
  surface-2: "#eef3f4"
  ink: "#2a333b"
  ink-muted: "#586470"
  line: "#e2e7ea"
  brand: "#2e98a0"
  brand-strong: "#207680"
  brand-tint: "#e2f2f3"
  brand-ink: "#19606a"
  good: "#2f9d5f"
  good-tint: "#e0f5e8"
  warn: "#9a6f12"
  warn-tint: "#f5edcf"
  bad: "#c13a2e"
  bad-tint: "#fae3df"
typography:
  display:
    fontFamily: "Sarabun, 'Leelawadee UI', Tahoma, sans-serif"
    fontSize: "38px"
    fontWeight: 700
    lineHeight: 1.25
    letterSpacing: "normal"
  headline:
    fontFamily: "Sarabun, 'Leelawadee UI', Tahoma, sans-serif"
    fontSize: "30px"
    fontWeight: 700
    lineHeight: 1.25
  title:
    fontFamily: "Sarabun, 'Leelawadee UI', Tahoma, sans-serif"
    fontSize: "20px"
    fontWeight: 700
    lineHeight: 1.3
  body:
    fontFamily: "Sarabun, 'Leelawadee UI', Tahoma, sans-serif"
    fontSize: "17px"
    fontWeight: 400
    lineHeight: 1.55
  label:
    fontFamily: "Sarabun, 'Leelawadee UI', Tahoma, sans-serif"
    fontSize: "15px"
    fontWeight: 600
    lineHeight: 1.4
rounded:
  sm: "12px"
  md: "16px"
  pill: "999px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "16px"
  lg: "24px"
  xl: "32px"
components:
  button-primary:
    backgroundColor: "{colors.brand}"
    textColor: "{colors.surface}"
    rounded: "{rounded.sm}"
    padding: "0 20px"
    height: "44px"
  button-primary-hover:
    backgroundColor: "{colors.brand-strong}"
    textColor: "{colors.surface}"
    rounded: "{rounded.sm}"
  button-secondary:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.sm}"
    padding: "0 20px"
    height: "44px"
  button-quiet:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.brand-ink}"
    rounded: "{rounded.sm}"
  button-danger:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.bad}"
    rounded: "{rounded.sm}"
  input:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.sm}"
    padding: "10px 14px"
    height: "44px"
  input-invalid:
    backgroundColor: "{colors.bad-tint}"
    textColor: "{colors.ink}"
    rounded: "{rounded.sm}"
  panel:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
    padding: "24px"
  nav-item:
    backgroundColor: "{colors.surface-2}"
    textColor: "{colors.ink-muted}"
    rounded: "{rounded.sm}"
    padding: "12px"
  nav-item-active:
    backgroundColor: "{colors.brand-tint}"
    textColor: "{colors.brand-ink}"
    rounded: "{rounded.sm}"
  action-card:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
    padding: "16px 24px"
  action-card-primary:
    backgroundColor: "{colors.brand}"
    textColor: "{colors.surface}"
    rounded: "{rounded.md}"
    padding: "16px 24px"
  pill-good:
    backgroundColor: "{colors.good-tint}"
    textColor: "{colors.good}"
    rounded: "{rounded.pill}"
    padding: "4px 11px"
  pill-warn:
    backgroundColor: "{colors.warn-tint}"
    textColor: "{colors.warn}"
    rounded: "{rounded.pill}"
    padding: "4px 11px"
  pill-bad:
    backgroundColor: "{colors.bad-tint}"
    textColor: "{colors.bad}"
    rounded: "{rounded.pill}"
    padding: "4px 11px"
  period-chip:
    backgroundColor: "{colors.brand-tint}"
    textColor: "{colors.brand-ink}"
    rounded: "{rounded.pill}"
    padding: "8px 16px"
---

# Design

## Overview

**Creative North Star: "The Calm Clinic."** A reassuring health tool that guides a
non-technical, often older Thai school health teacher through each task by the hand,
never a dense government form and never a childish toy. It is a nutrition tracker,
not a student information system: every surface earns its place by helping a teacher
**measure and track** students.

Mood: calm, caring, dependable. Airy cool-white canvas, healthy-teal accent, soft
rounded panels, large readable Thai type, generous whitespace. Low cognitive load:
one task per screen, big tap targets (≥44px), short friendly sentences.

**The four questions** every screen must answer in plain Thai, used as a layout
checklist: *ฉันกำลังทำอะไร?* (clear title + one-line purpose) · *ทำไมต้องทำ?* (helper
text when not obvious) · *จะเกิดอะไรต่อ?* (preview the result before committing) ·
*กดต่อได้อย่างปลอดภัยไหม?* (confirmations stating stakes + recovery).

Layout: persistent **left sidebar** (icon + Thai label) at ≥900px, collapsing to a
large-target **bottom navigation bar** below 900px. Content centered, max ~960px,
padding 24–32px. The current academic period is always visible as a `period-chip`.
Color strategy is **Restrained**: cool-tinted neutrals + one teal accent for primary
actions and current state; nutrition status uses a small good/warn/bad vocabulary,
always paired with a Thai label (never color alone).

Anti-references: SIS dashboards, spreadsheet-as-UI, government-portal density,
hero-metric stat templates, anything that makes the teacher feel they might break or
lose data.

## Colors

Canonical values are **OKLCH** (the codebase source of truth); the frontmatter
carries hex equivalents for Stitch compatibility.

- **Brand teal** `oklch(0.58 0.085 195)` (#2e98a0) — primary actions, active nav,
  progress, current selection. **Brand strong** `oklch(0.46 0.08 200)` for
  hover/pressed; **brand ink** `oklch(0.38 0.07 200)` for teal text on light;
  **brand tint** `oklch(0.95 0.022 195)` for selected/hover washes and the period
  chip.
- **Neutrals (cool):** canvas `bg` `oklch(0.985 0.005 200)`, content `surface`
  white, inset/sidebar `surface-2` `oklch(0.972 0.008 200)`, hairline `line`
  `oklch(0.91 0.006 210)`.
- **Text:** `ink` `oklch(0.27 0.02 220)` for body (≥4.5:1 on surface), `ink-muted`
  `oklch(0.47 0.02 220)` for secondary (still ≥4.5:1) — never lighter for body.
- **Status:** `good` green, `warn` amber, `bad` red, each with a matching pale tint
  for pill backgrounds. Status meaning is always reinforced by a Thai label.

Accent is for action and state only, never decoration. Gray text never sits on a
teal background; use brand-ink or a tint instead.

## Typography

One family: **Sarabun** (excellent Thai + Latin), with a system Thai fallback
(`'Leelawadee UI', Tahoma, sans-serif`) so it renders fully offline. No display/body
pairing. Fixed rem scale (~1.2 ratio), never fluid: 13 / 15 / **17 (body)** / 20 /
24 / 30 / 38 px. Weights: 400 body, 600 labels & buttons, 700 headings. Base 17px,
nothing below 13px — legibility for older users outranks density. `text-wrap:
balance` on headings; cap prose at 65–75ch.

## Elevation

**Soft and tonal, not heavy.** Panels sit on the canvas with a hairline `line`
border plus a very soft ambient shadow
(`0 1px 2px /0.07`, `0 8px 28px /0.06`); radius 16px. Hover on interactive cards
lifts 2px with a slightly stronger shadow. Sidebar/insets use the `surface-2`
tonal layer rather than shadow. **Never nest panels.** Z-scale is semantic:
nav → sticky → backdrop → modal → toast.

## Components

- **Buttons:** `primary` (teal fill), `secondary` (surface + border), `quiet`
  (teal text), `danger` (red text/border). States: default / hover / focus-visible
  (3px brand ring) / active (1px nudge) / disabled (50%). Radius 12px, min-height
  44px; labels are verb + object ("บันทึกการวัด", "ดาวน์โหลดไฟล์ผู้จบการศึกษา").
- **Inputs:** 44px min height, hairline border, brand focus ring; invalid state uses
  `bad` border + `bad-tint` fill with inline Thai error text beneath; helper text in
  `ink-muted`.
- **Panel:** the one container; soft elevation; holds a `title` + one-line purpose.
- **Period chip:** pill in `brand-tint`, always shows ปีการศึกษา · ภาคเรียน · ครั้งที่;
  tapping opens "เปลี่ยนปีการศึกษา/รอบการวัด".
- **Status pill:** good/warn/bad tint + dot + Thai label; used for nutrition status
  and progress/state.
- **Nav item:** icon + Thai label; active = `brand-tint` bg + `brand-ink`.
- **Action card:** large tappable card (icon + title + sub) for primary home tasks;
  the leading task uses `action-card-primary` (teal fill).
- **Stepper (wizard):** horizontal numbered steps showing all stages and current
  position; used by the Promotion Wizard and Import flow so the teacher always knows
  where they are and what remains.
- **Order-ticket picker (food-order flow):** the preferred pattern for any
  multi-field selection in a wizard (e.g. ชั้น → ห้อง → ภาคเรียน → ครั้งที่วัด in
  บันทึกการวัด, ชั้น → ห้อง in เพิ่มรายชื่อ). Present **one choice at a time**: only the
  active row is open showing selectable tiles; rows ahead are locked/dimmed with a
  number badge; each pick **auto-advances** to the next and **collapses** the chosen
  row into a one-line summary with a ✓ and a **"เปลี่ยน"** edit link. End with a 🧾
  summary ticket of all choices and a full-width confirm button enabled only when
  every choice is made. Why: non-technical teachers read one decision far more
  reliably than a wall of pickers, and the running summary makes the selection state
  unmistakable — like ordering food. Classes: `.order` / `.order-row`
  (active/done/locked) / `.order-ticket` (see `journeys.css`); tiles are `.tile` with
  a `.tile-check` badge. Accent-aware via the wizard's `--accent`.
- **Selectable tile:** `.tile` — emoji glyph + label, accent border + tint + ✓ badge
  when selected, hover lift. The building block inside an order-ticket row (and any
  grade/room/option choice). No cartoon illustrations — offline single-file app, and
  the brand stays calm/clinical.
- **Empty state:** icon + one-sentence explanation + the next-step button; teaches
  the interface, never "no data".
- **Confirmation:** states what happens, how many records, and how to recover; used
  before any removal. Motion is 150–220ms ease-out conveying state only, with a full
  `prefers-reduced-motion` fallback.

## Do's and Don'ts

**Do**
- **Two doorways to the same data, not two apps.** Guided wizards (the
  `ผู้ช่วยจัดการข้อมูล` hub, food-order flow) are the *easy* doorway for adding/common
  tasks; the existing table views (`StudentsView`, `MeasureView`, `ReportsView`) are
  the *advanced* doorway for dense viewing/editing. Link between them (the hub footer
  links to the tables) over one shared store + domain. Never build a global
  easy/advanced mode toggle or a parallel second UI — it doubles the surface and rots.
- Answer the four questions on every screen; preview outcomes before the user
  commits.
- Make destructive-sounding steps prove **data is moved, not lost**: export first,
  show the exact filename (e.g. `รายชื่อนักเรียนจบการศึกษา ปีการศึกษา 2569.xlsx`), then
  remove — only after the export succeeds.
- Treat the **New Academic Year flow** (evolved Promotion Wizard) as the flagship:
  unhurried, step-by-step, forced backup, non-destructive — it *creates* the next
  year and *archives* (never deletes) the current one. The active year is always
  editable; archived years are read-only snapshots, still browsable/exportable.
- Keep copy plain, warm, and Thai; pair every status color with a label.
- Default to the safe path (promote +1, merge-not-replace) and let teachers adjust
  only the exceptions.

**Don't**
- Don't build SIS features (status timelines, enrolment history, attendance) — if it
  doesn't help measure/track, leave it out.
- Don't expose technical terms (JSON/CSV/localStorage) or raw error codes.
- Don't trap the user in an incorrect state or hard-lock the academic year.
- Don't use stat-template hero metrics, nested cards, side-stripe borders, gradient
  text, or color-only status.
- Don't use light-gray body text on tinted white; keep body at `ink`/`ink-muted`
  contrast.
