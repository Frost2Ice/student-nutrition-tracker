# Promotion: redesign "ปรับรายคน (กรณีพิเศษ)" as search-by-ID, not a full-school list

Listing every student school-wide doesn't scale. Special-case per-student adjustment is uncommon, so
replace the full list with a search (Student ID primary, name optional) → adjust only that student.

## Global constraints
- `noUnusedLocals`. No git. No server start/kill (:5173). Editor tools only, no heredoc/echo.

## Files
- Modify: `src/features/PromotionView.vue`

## What exists
- Step ตรวจสอบ shows a grouped summary (เลื่อนปกติ / ซ้ำชั้น / จบการศึกษา counts) AND a per-student
  list of the WHOLE school with override controls writing into a `decisions` map (studentId →
  `{ action: 'promote'|'repeat'|'graduate'; room? }`). `planPromotion` + `applyPromotion` already exist.

## Redesign (same step)
- KEEP the grouped summary (counts of promote/repeat/graduate, default plan) — that's the at-a-glance.
- REMOVE the full-school per-student list.
- Add a **"ปรับรายคน (กรณีพิเศษ)"** panel with a search box: match by exact/partial **Student ID**
  (primary) OR name (optional) over `data.students`; cap results (e.g. 20). Show matches in a small
  list; selecting one reveals its override controls:
  - current grade → next grade (show `promote(grade)`), action radio/toggle **เลื่อนปกติ / ซ้ำชั้น /
    จบการศึกษา**, and (when moving) a **ห้องใหม่** picker derived from the target grade's rooms in
    `data.structure` (fallback free input).
  - Save → set `decisions[id]` accordingly; if reset to default, delete the override. Show a small
    list of "ปรับแล้ว N คน" (students with an explicit override) so the teacher can review/undo what
    they changed without scrolling the whole school.
- The summary counts should reflect `planPromotion` defaults merged with `decisions` overrides.
- Everything else in the wizard (backup step, required graduate export, confirm/apply) unchanged.

## Verify
- `npx vue-tsc --noEmit` clean; `npm test` green; `npm run build` ok.
- On :5173 (mock data): open เลื่อนชั้น → ตรวจสอบ shows summary + a search box (no giant list);
  searching an ID reveals that student's override controls; setting ซ้ำชั้น shows in "ปรับแล้ว" list
  and updates the summary. Screenshot `.playwright-mcp/promotion-search.png`.

## Report contract
Write full report to `docs/superpowers/briefs/phase3-promotion-search-report.md`. Return short summary + status.
