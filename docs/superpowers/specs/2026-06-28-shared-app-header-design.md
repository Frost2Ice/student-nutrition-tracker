# Shared App Header — Design

## Problem

Each main shell view renders its own header: a left-aligned `<h1 class="page-title">`
+ `page-sub` inside content, plus ad-hoc inline `← back` buttons for drill-downs
(student detail, measure room results, promotion steps). The AppShell `.topbar` is a
thin strip with only a logo (left) and academic-year chip (right) — no title, no back.
Result: inconsistent navigation, titles in different places, back affordances styled
and positioned per-view.

## Goal

One shared header structure used by every main shell screen:

- **Left:** Back button when applicable; empty placeholder otherwise (preserves alignment).
- **Center:** Current page title, always visually centered regardless of back presence.
- **Right:** Context info — academic-year chip everywhere; Measure room-results expands
  to session detail (term · round).

Consistent height, typography, spacing, alignment across all screens.

## Scope

In scope — the six main shell views rendered inside AppShell `.main`:
Home, Students, Students (POC), Measure, Reports, Settings.

Out of scope — focused full-screen flows that intentionally hide app chrome and have
their own dedicated bars: onboarding overlay, promotion overlay, wizards
(`inWizardFlow`). These keep their existing headers.

## Architecture

### `useHeader` store — `src/stores/header.ts`

A small reactive store (Pinia, matching `src/stores/data.ts`) holding the active
screen's header intent:

```ts
interface HeaderState {
  title: string;
  back: (() => void) | null;   // null => no in-view back; AppShell may substitute "go home"
  context: 'year' | 'session'; // right-side content selector
}
```

API:
- `setHeader(partial: Partial<HeaderState>)` — merge/replace current state.
- `resetHeader()` — back to defaults (`{ title: '', back: null, context: 'year' }`).

Decoupling rationale: emitting header state up through `@go` props would thread
title/back through every emit signature across 7 views (brittle). A static title map in
AppShell cannot observe in-view drill-down state. A store lets each screen declare its
header and lets a single `<AppHeader>` render it; both are independently testable.

### `<AppHeader>` component — `src/components/AppHeader.vue`

Replaces the current `.topbar`. Rendered once by AppShell (when not `inWizardFlow`).

Layout: three zones.
- Left: fixed-width back zone. Renders back button when an effective back handler exists;
  otherwise an equal-width empty spacer so the center stays put.
- Center: title, **absolutely centered** within the bar so left/right widths never shift
  it. Truncates with ellipsis if too long.
- Right: context zone. `context === 'year'` → academic-year chip (`📅 ปีการศึกษา X`).
  `context === 'session'` → expanded session line (term · round), reusing the existing
  `periodShort` / `periodLine` logic from AppShell.

Single token set governs height, font size/weight, horizontal padding, and bottom border —
one source of truth so every page matches.

Props/wiring: AppHeader reads `useHeader()` for `title` / `back` / `context`, and
`useData()` for the period values. Effective back = view-supplied `back`, else (if
`dest !== 'home'`) a "go home" handler passed from AppShell, else none.

### AppShell changes

- Replace `<header class="topbar">…</header>` markup with `<AppHeader />`.
- Provide the "go home" fallback handler to AppHeader (e.g. `() => go('home')`).
- `go()` calls `resetHeader()` on top-level navigation so stale drill-down state never
  leaks between pages.
- Keep `periodShort` / `periodLine` (now consumed by AppHeader).

### View changes

Each in-scope view:
- Remove its `<h1 class="page-title">` from the top of content; the title now lives in
  the shared bar via `setHeader({ title })` on mount.
- `page-sub` instructional sentences stay as the first line of page **content** — they are
  long Thai helper text and do not belong in a centered bar.
- Drill-down screens replace inline `← back` buttons by calling
  `setHeader({ title, back: () => <pop one level> })` when entering the drill-down and
  restoring the list-level header when leaving.

Specific drill-downs:
- **MeasureView:** rooms list (`back: go-home`/null, title "บันทึกการวัด", context 'year')
  → room results (`back: () => view='rooms'`, title "ผลการวัด · ห้อง {picked}",
  context 'session'). Removes the inline `← เลือกห้องอื่น`.
- **StudentsView:** list (title "นักเรียน") → student detail (`back: () => open=null`,
  title = student name). Removes inline `← กลับรายชื่อ`.
- **Home / Reports / Settings / Students(POC):** single level — `setHeader({ title })`,
  `back: null`, `context: 'year'`.

## Testing

- `useHeader` unit tests: defaults, `setHeader` merge, `resetHeader`, back handler invocation.
- `AppHeader` component tests: title centered with and without back button; back button
  present only when effective handler exists; `context` switch renders year vs session;
  clicking back calls the handler.

## Out of scope / non-goals

- No change to wizard / onboarding / promotion bars.
- No per-page arbitrary context slot (year-everywhere + session-on-Measure only).
- No restyling of in-content `page-sub` copy beyond relocation.
