# Task 5 — Onboarding / Setup (5-step) wired

Part of Phase 3. The first-run setup wizard, ported from the prototype and wired to the
store so finishing it makes `isSetup` true and lands on the home shell.

## Global constraints
- `noUnusedLocals`. No git. No server start/kill (user runs :5173).
- UX parity: copy the prototype `<template>`/`<style>` verbatim; do not redesign.
- Thai BE dates; academic year numbered by start year. Single validation source
  `src/domain/validation/rules.ts`. Write files with editor tools (no heredoc/echo).

## Files
- Create: `src/features/OnboardingView.vue` (port `src/prototype/OnboardingJourney.vue`)
- Modify: `src/AppShell.vue` (render OnboardingView in the `overlay === 'onboarding'` slot,
  replacing the placeholder; pass through its `done`/`exit` emits)
- Delete: `src/features/SetupView.vue` (superseded first-gen; remove only if nothing imports it —
  grep first; if something imports it, leave it and note in the report)

## What exists now (read first)
- `src/prototype/OnboardingJourney.vue` — 5 steps: (1) ข้อมูลโรงเรียน (8 fields), (2) ปีการศึกษา,
  (3) โครงสร้างชั้นเรียน, (4) นำเข้านักเรียน (per-room), (5) พร้อมใช้งาน. Emits `done`, `exit`.
  Uses mock data only.
- `src/stores/data.ts`: `saveSetup(setup: Setup)`, `setPeriod({year,term,round})`,
  `addStudent(s: Student)`, `isSetup`. `Setup` fields: school, ministry, department,
  subdistrict, district, province, teacher, maxGrade. `Student` fields: id, firstName,
  lastName, dob, gender, grade, room.
- `src/AppShell.vue`: has `overlay` ref + an onboarding placeholder; `go('onboarding')` opens it.
  Welcome "เริ่มใช้งานครั้งแรก" should open this overlay.

## Required wiring
1. Port template/style verbatim into `OnboardingView.vue`.
2. Replace mock writes with store calls:
   - Step ข้อมูลโรงเรียน: bind a local `form` (the 8 Setup fields incl `maxGrade`), call
     `data.saveSetup(form)` on completion/finish.
   - Step ปีการศึกษา: call `data.setPeriod({ year, term, round: '1' })` from the form
     (round defaults '1'; onboarding does not ask round).
   - Step นำเข้านักเรียน (per-room): each added student → `data.addStudent({...})` with a
     valid `Student` (id, firstName, lastName, dob, gender, grade, room). Validate id is not
     already in `data.students`; validate dob via `validateThaiDate(dob, true)`.
   - Step โครงสร้างชั้นเรียน: this is LOCAL UI only (the app derives `structure` from added
     students; there is no separate structure store field). Use it to let the teacher set up
     the grade/room choices that the per-room add step uses. Do NOT invent a store field.
     Note in your report that declared-but-empty rooms won't persist until they have a student.
3. On `done`: ensure `saveSetup`/`setPeriod` have run (so `isSetup` is true); AppShell closes
   the overlay and routes to `home`.
4. AppShell: import OnboardingView, render it for `overlay === 'onboarding'`, wire `@done` to
   close overlay + set `dest='home'`, `@exit` to close overlay.

## Verify
- `npx vue-tsc --noEmit` → clean. `npm run build` → succeeds.
- On :5173: clear app data first (in devtools: `localStorage.clear()` then reload) so the
  WELCOME screen shows. Click เริ่มใช้งานครั้งแรก → walk all 5 steps → finishing lands on the
  home shell with your entered school name in the sidebar. Screenshot to
  `.playwright-mcp/p3-t5-onboarding.png`.

## Report contract
Write full report to `docs/superpowers/briefs/phase3-task-5-report.md`. Return short
summary + status.
