# Task 4 — Swap entry to the real App shell

Part of Phase 3. Replaces the Phase-0 prototype mount with the real app shell, ported
verbatim (layout/style) from the prototype but wired to the Pinia store. Child views are
placeholders here; later tasks (5–15) replace each placeholder with the real view.

## Global constraints
- `noUnusedLocals`. No git. No server start/kill (user runs :5173).
- UX parity: copy `<template>` + `<style>` from the prototype verbatim; do NOT redesign.
- Write files with editor tools, never shell heredoc/echo.

## Files
- Create: `src/AppShell.vue` (port of `src/prototype/ProtoShell.vue`)
- Modify: `src/main.ts`

## What exists now (read first)
- `src/prototype/ProtoShell.vue` — the prototype shell. It has: a demo ribbon with a
  `setUp` checkbox, a `welcome` two-path screen, sidebar (brand + period chip + nav),
  topbar, bottomnav, `<Transition>` content host, and full-screen overlay host for
  onboarding/import/promotion. Imports `SCHOOL, CURRENT_PERIOD` from `./mock` and child
  prototype journey components.
- `src/stores/data.ts` — `useData()` with `setup` (has `school`), `period`
  (`{year,term,round}`), `isSetup` computed.
- `src/main.ts` — currently mounts `ProtoShell`.

## Required changes
1. Create `src/AppShell.vue`: copy ProtoShell's `<template>` + `<style>` verbatim, then:
   - Remove the demo ribbon entirely (the `.proto-ribbon` block and its `setUp` checkbox).
   - `const data = useData()`. Replace `SCHOOL.name` → `data.setup.school`, the teacher/sub
     line as appropriate, and the period chip text → from `data.period`
     (e.g. `ปีการศึกษา ${data.period.year} · ภาคเรียน ${data.period.term} · ครั้งที่ ${data.period.round}`).
   - Drive the welcome gate with `v-if="!data.isSetup"` (replace the prototype's `setUp` ref).
     Keep the two-path welcome (เริ่มใช้งานครั้งแรก → open onboarding overlay;
     มีข้อมูลเดิม → restore path stub). Keep `dest` and `overlay` refs + `go()` exactly.
   - Remove ALL `./mock` imports.
2. Child views: until the real views exist, render a simple placeholder per dest, e.g.
   `<div class="container"><h1 class="page-title">{{ destLabel }}</h1><p class="page-sub">
   (กำลังพัฒนา)</p></div>`, and placeholder overlays similarly. Do NOT import the prototype
   journey components. (Later tasks swap these placeholders for real imports.)
3. `src/main.ts`: import `AppShell` from `./AppShell.vue` instead of ProtoShell; keep
   `createApp(AppShell).use(createPinia()).mount('#app')`.

## Produces (later tasks depend on these)
- `src/AppShell.vue` with `dest: 'home'|'students'|'measure'|'reports'|'settings'`,
  `overlay: 'onboarding'|'import'|'promotion'|null`, `go(target)`.

## Verify
- `npx vue-tsc --noEmit` → clean.
- `npm run build` → succeeds, one `dist/index.html`.
- On http://localhost:5173 (already running): with an empty store the WELCOME screen shows
  (two choice cards). Clicking "เริ่มใช้งานครั้งแรก" opens the onboarding overlay placeholder.
  (The full shell becomes reachable once Task 5 onboarding can save a school.)
- Take a screenshot to `.playwright-mcp/p3-t4-welcome.png` if you have browser tools;
  otherwise note that vue-tsc + build pass and the welcome renders.

## Report contract
Write full report to `docs/superpowers/briefs/phase3-task-4-report.md` (status, files,
tsc + build results, what you verified). Return short summary + status.
