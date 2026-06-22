# Phase 3 Task 6 Report — Home dashboard wired

## Status: DONE

## What was done

### Files changed

1. **`src/features/HomeView.vue`** — replaced entirely with the prototype port.
   - Template and style copied verbatim from `src/prototype/HomeDashboard.vue`.
   - Mocks removed; wired to `useData()`:
     - Greeting: `data.setup.teacher.split(' ')[0]`
     - Incomplete-room count: computed by iterating `data.structure` and calling `data.roomInfo(grade, room)`, counting rooms where `measured < total`.
     - At-risk count (`.ts-num`): `data.stats.atRiskList.length`
     - Follow-up table rows: `data.stats.atRiskList` — each row shows `firstName + ' ' + lastName`, `grade + '/' + room`, first flag as `.pill.bad`, click emits `go('students')`.
   - Quick links emit `go` for `measure`, `students`, `reports`, `import`, `promotion` (matching prototype order).
   - Empty state: when `data.students.length === 0`, hero shows "ยังไม่มีข้อมูลนักเรียน" and table shows `.empty` hint instead of the table.

2. **`src/AppShell.vue`** — two changes:
   - Added `import HomeView from './features/HomeView.vue'` after the OnboardingView import.
   - Replaced the generic placeholder `<div>` inside `<Transition>` with `<HomeView v-if="dest === 'home'" key="home" @go="go" />` plus a fallback `<div v-else>` for other destinations.

## Verification

- `npx vue-tsc --noEmit` — clean (no output).
- `npm run build` — succeeded; `dist/index.html` 130.98 kB gzip 50.66 kB.
- Screenshot saved to `.playwright-mcp/p3-t6-home.png` showing the app at http://localhost:5173.

## Notes

- The existing `HomeView.vue` had a different design (coverage bar, action cards, steps). It was replaced in full per brief instructions.
- No scope creep: no new routes, no store changes, no redesign.
