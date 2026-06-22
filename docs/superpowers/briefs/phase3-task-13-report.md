# Task 13 — Promotion Wizard + Promotion Ops — Report

## Status: DONE

## What was implemented

### 1. Domain logic — `src/domain/promotion/promote.ts`

- `planPromotion(students, maxGrade)` — splits students into `promote` vs `graduate` buckets using `isMaxGrade` from `ladder.ts`
- `applyPromotion(store, decisions)` — applies per-student decisions (`promote` / `repeat` / `graduate`):
  - `promote` → calls `updateStudent(id, { grade: nextGrade, room? })`
  - `repeat` → calls `updateStudent(id, { room })` only if room override provided; otherwise no-op
  - `graduate` → calls `deleteStudent(id)`
  - Default (no decision) → promotes

### 2. TDD — `tests/promotion/promote.test.ts`

11 tests written test-first. Confirmed red → green cycle:
- `planPromotion` splits correctly including empty lists and all-max cases
- `applyPromotion` covers promote, promote+room, repeat (no-op), repeat+room, graduate, default promotion, and no auto-graduation without explicit decision

### 3. Feature component — `src/features/PromotionView.vue`

Ported from `src/prototype/PromotionJourney.vue` verbatim template/style. Real data wired:

| Step | Wiring |
|------|--------|
| 1 เริ่มต้น | Shows `fromYear`/`toYear` from store period |
| 2 สำรองข้อมูล | `serializeBackup(...)` → file download → `markBackup()` gates Next |
| 3 ตรวจสอบ | `planPromotion` drives summary table; per-student `decisions` ref for overrides; search filter |
| 4 ผู้จบการศึกษา | `toCsv(graduateStudents, theirMeasures)` → download with filename `รายชื่อนักเรียนจบการศึกษา ปีการศึกษา <year>.xlsx`; Next disabled until downloaded |
| 5 ยืนยัน | Shows live counts; Confirm calls `applyPromotion` then `setPeriod(year+1, term='1', round='1')` |
| 6 เสร็จสิ้น | Emits `done` |

Graduate export gate is preserved exactly as in prototype (`exportDone` ref, `:disabled="!exportDone"`).

### 4. AppShell — `src/AppShell.vue`

Replaced placeholder `<div>` for `overlay === 'promotion'` with `<PromotionView @done="closeOverlay" @exit="closeOverlay" />`.

## Verification

- `npx vue-tsc --noEmit` — clean (0 errors)
- `npm test` — 103 tests across 13 test files, all passing (includes build test)
- `npm run build` — passes inside test suite
- Browser: opened http://localhost:5173, clicked "🎓 เลื่อนชั้นปีใหม่", wizard rendered with correct year (2568→2569), 6-step stepper active

Screenshot: `.playwright-mcp/p3-t13-promotion.png`

## Files created/modified

| File | Action |
|------|--------|
| `src/domain/promotion/promote.ts` | Created |
| `tests/promotion/promote.test.ts` | Created |
| `src/features/PromotionView.vue` | Created |
| `src/AppShell.vue` | Modified (import + overlay wiring) |
