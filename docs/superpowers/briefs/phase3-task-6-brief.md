# Task 6 — Home dashboard wired

Part of Phase 3. Port the prototype Home into the real app, wired to the store's aggregates.

## Global constraints
- `noUnusedLocals`. No git. No server start/kill (:5173 is the user's). Editor tools only.
- UX parity: copy prototype `<template>`/`<style>` verbatim; do not redesign.
- ALL classification via the store's `stats` (which uses `calcNutrition`) — never re-derive labels.

## Files
- Create: `src/features/HomeView.vue` (port `src/prototype/HomeDashboard.vue`; this OVERWRITES
  intent of the first-gen `HomeView` if one exists in `src/features/` — if a `HomeView.vue`
  already exists there, replace its contents entirely with the port)
- Modify: `src/AppShell.vue` (render `HomeView` for `dest === 'home'`, replacing the placeholder;
  wire its `@go` to the shell's `go()`)

## What exists now (read first)
- `src/prototype/HomeDashboard.vue` — hero ("วันนี้ควรทำอะไร" + incomplete-room count +
  at-risk count), 4 quick links, follow-up table. Emits `go`. Uses mock `SCHOOL/AT_RISK/CLASSES`.
- `src/stores/data.ts`:
  - `setup.teacher` (greeting), `stats` computed: `{ totalStudents, totalMeasures, normal,
    followUp, atRiskList: { student, flags }[] }` (atRiskList already engine-derived).
  - `structure` + `roomInfo(grade, room)` for the "rooms not yet complete this round" count.
- `src/AppShell.vue`: `go(target)` handles dest + overlays (`import`/`promotion`).

## Required wiring
1. Port template/style verbatim into `HomeView.vue`.
2. Replace mocks:
   - Greeting: `data.setup.teacher` (first word, as the prototype does).
   - At-risk count + follow-up table rows: `data.stats.atRiskList` → each row: name =
     `student.firstName + ' ' + student.lastName`, class = `student.grade + '/' + student.room`,
     condition pill = the first entry of `flags` (or join). Clicking a row emits
     `go('students')` (profile open from Home is wired later; routing to students is enough now).
   - Incomplete-room count in the hero: count rooms in `structure` where
     `roomInfo(grade,room).measured < roomInfo(grade,room).total`.
   - Quick links emit `go` for: `measure`, `students`, `reports`, and overlays `import`,
     `promotion` (match the prototype's four links).
3. Empty-state: if `data.students.length === 0`, the hero/table should degrade gracefully
   (e.g. show a "ยังไม่มีข้อมูลนักเรียน" hint). Keep it simple; reuse `.empty` if handy.
4. AppShell: import + render `HomeView` for `dest==='home'`, `@go="go"`.

## Verify
- `npx vue-tsc --noEmit` clean; `npm run build` succeeds.
- On :5173 (set up a school + a few students/measures via onboarding or existing data): the
  hero count, at-risk count, follow-up table render from real data; quick links navigate.
  Screenshot `.playwright-mcp/p3-t6-home.png`.

## Report contract
Write full report to `docs/superpowers/briefs/phase3-task-6-report.md`. Return short summary + status.
