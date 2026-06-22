# Phase 3 — Final-review fixes (one batch)

Apply these fixes from the final review (`docs/superpowers/briefs/phase3-final-review.md`).
Read that file for full context. Fix ALL items below. Do not touch items not listed.

## Global constraints
- `noUnusedLocals`. No git. No server start/kill (:5173). Editor tools only, no heredoc/echo.
- Nutrition labels ONLY from `calcNutrition`; charts ONLY from `charts.ts`. Don't break the
  §6.2 invariant or its test (`tests/features/charts-consistency.test.ts`).
- After fixes: `npx vue-tsc --noEmit` clean, `npm test` green, `npm run build` ok.

## Critical
- **C-1 restore on first run** (`src/AppShell.vue`, welcome "restore" panel): the
  "เลือกไฟล์สำรอง" button does nothing. Wire it: add a hidden `<input type="file" accept=".json,.ntr,application/json">`,
  button triggers it, on change read the file text → `parseBackup(text)` (from
  `src/domain/transfer/backup.ts`) → `data.replaceAll(parsed)` (try/catch → show the
  "ไฟล์สำรองไม่ถูกต้อง" error). On success `isSetup` becomes true → shell appears.
- **C-2 measure date validation** (`src/features/MeasureView.vue`): a teacher can reach review
  + saveAll with empty/invalid `measureDate`, saving `Measurement.date = ''` (→ calcNutrition
  null forever). Add a `dateError` computed via `validateThaiDate(measureDate.value, false)`;
  block advancing to review AND saving when it's set (disable the button + show the error).
- **C-3 latest-status ordering** (`src/features/StudentsView.vue` `statusOf` + wherever the
  profile "latest" is picked): do NOT pick latest by `savedAt` alone. Use the canonical order
  year→term→round with `savedAt` as tie-breaker. Reuse the domain: import `isNewerMeasure` from
  `src/domain/nutrition/latest.ts` (or `latestPerStudent`) to select the latest measurement.

## Important
- **I-1 premature period write** (`src/features/MeasureView.vue` `start()`): it calls
  `setPeriod(...)` when a room is tapped, persisting the round before any entry (abandoning the
  wizard still overwrites the stored round). Remove the `setPeriod` call from `start()`. Use a
  local `round` ref for dup-checks/saves (build the period object inline:
  `{ year: data.period.year, term: data.period.term, round: round.value }`); only the
  individual `addMeasure` calls need `round.value`. Do not mutate store period on room tap.
- **I-2 promotion delete-in-loop** (`src/domain/promotion/promote.ts` `applyPromotion`):
  iterating `for...of store.students` while calling `deleteStudent` shifts indices and skips
  students. Snapshot first: collect the student list (or graduate ids) into a local array, then
  apply updates/deletes over the snapshot.
- **I-3 merge count breakdown** (`src/domain/transfer/csv.ts` `mergeImport` + `ImportView.vue`):
  `added` lumps new students and new measures. Return distinct counts (e.g.
  `addedStudents`, `addedMeasures`) and show both in ImportView's done step. Keep existing
  fields if other code uses them; add the split.
- **I-5 wrong "next grade" shown** (`src/features/PromotionView.vue` ~line 223): the per-student
  preview shows `s.grade` as the next grade. Use `promote(s.grade)` (from `grade/ladder`) for
  students being promoted.
- **I-6 hard-coded promotion rooms** (`src/features/PromotionView.vue` ~234): room options are
  hard-coded 1/2. Derive room choices from the target grade in `data.structure`
  (fallback to a free text input if the grade has no rooms yet).

## Minor
- **M-1 dead code** (`src/ui/labels.ts`): `badgeClass` is exported but never imported. Remove it
  (and the file if nothing else in it is used). Verify nothing imports it first.
- **M-6 inconsistent ท้วม colour**: `StudentsView` maps `ท้วม`→good, `MeasureView`→warn. Unify to
  **warn** in both (ท้วม is mild over-weight, a follow-up tint).
- **M-7 hard-coded year dropdown** (`src/features/ReportsView.vue` ~69): generate the year
  options dynamically from `data.period.year` (e.g. current year and the two prior) instead of
  literal 2567–2569.
- **M-8 double print** (`src/features/print.ts` ~53): the `onload` handler and the timeout
  fallback can both call `win.print()`. Guard with a `printed` flag so it fires once.
- **M-9 overlay not inert** (`src/AppShell.vue`): when `overlay` is open, the shell behind it is
  still interactive. Add `:inert="!!overlay"` (or `pointer-events:none`) to the `.shell` wrapper
  while an overlay is shown.

## Verify
- `npx vue-tsc --noEmit` clean; `npm test` green; `npm run build` ok.
- On :5173 spot-check: (a) first-run restore button opens a file picker; (b) Measure blocks
  save with an empty date; (c) Promotion preview shows the promoted (next) grade.

## Report contract
Write full report to `docs/superpowers/briefs/phase3-fixes-report.md` (per-item: fixed + how,
file:line; test/tsc/build results). Return a short summary + status.
