# Task 4A — Chart zone ↔ classification exactness (HARD requirement, BRD §6.2)

The official source is สำนักโภชนาการ กรมอนามัย, B.E. 2564 growth reference (ages 2–18).
The chart zones and the textual nutrition classification MUST match exactly. Today the chart
renders zone boundaries with spline `tension: 0.3` and draws HFA/WFA boundaries with linear
interpolation, but the engine snaps ages to the nearest row (`findRef`). That can put a point
in a different zone than the text. Fix the rendering to the engine's exact math and lock it
with an automated invariant test.

## Absolute rules
- Do NOT change classification behavior in `engine.ts`. Only `charts.ts` rendering changes
  (and, if you need a helper exported, export it without altering logic).
- `noUnusedLocals`. No git. No server start/kill. Editor tools only (no heredoc/echo).
- Keep `animation: false` on all chart options.

## How the engine actually classifies (read these files first)
- `src/domain/nutrition/engine.ts`:
  - `classifyWFH(gender, heightCm, weightKg)`: picks WFH table (`WFH_M`/`WFH_F`), clamps to
    first/last row outside range, else **linearly interpolates each cutoff column between the
    two bracketing height rows**, then: `<row[0]`→ผอม, `<row[1]`→ค่อนข้างผอม, `<row[2]`→สมส่วน,
    `<row[3]`→ท้วม, `<row[4]`→เริ่มอ้วน, else อ้วน. (row = `T[i].slice(1)`, so cutoffs are
    columns 1..5 of each row = `b0..b4`.)
  - `classifyWFA(ref, w)` / `classifyHFA(ref, h)`: compare against `AgeRef` SD fields
    (`sd2w,sd15w,sd15pw,sd2pw` / `sd2h,sd15h,sd15ph,sd2ph`). `ref` comes from
    `findRef(gender, ageMonths)` which selects the **nearest** age row within ±6 months
    (NOT interpolated). `getAgeMonths` returns INTEGER months.
- `src/features/charts.ts`: `buildWfh` draws bands from `col(1..5)` (= `b0..b4`) — correct
  columns. `buildHfa/buildWfa` draw bands from the SD fields — correct fields. The `zones()`
  helper currently sets `tension: 0.3` on every band. `buildHfa/buildWfa` connect monthly age
  rows with straight (linear) segments.

## Required fix (rendering only)
1. **All zone bands: `tension: 0`** (remove the 0.3). Reason: `classifyWFH` interpolates
   LINEARLY between height rows; a curved boundary diverges from the text for off-grid heights.
2. **HFA/WFA zone bands: add `stepped: 'middle'`** (in addition to `tension:0`). Reason: the
   engine snaps to the nearest age row (`findRef`), so the boundary is a nearest-row step
   function, not a line. `stepped:'middle'` steps at the midpoint between consecutive monthly
   rows = nearest-row selection. WFH bands must NOT be stepped (WFH interpolates by height).
3. Keep the boundary columns/fields exactly as they are (they already equal the engine cutoffs).
   Do not change the student-point dataset.

## Required invariant test — `tests/features/charts-consistency.test.ts`
This is the deliverable that locks the requirement. It must FAIL before the fix and PASS after.

Behavioral checks (evaluate the SAME boundary arrays the chart builds, with the matching
render math, and assert the resulting band label === the engine label):
- **WFH** (both genders): build `buildWfh(student, [])`; extract the 5 boundary datasets
  (`ผอม,ค่อนข้างผอม,สมส่วน,ท้วม,เริ่มอ้วน`) as arrays of `{x:height,y:cutoff}`. For heights
  from first to last table height in **0.25 cm** steps, and for several weights bracketing the
  cutoffs (e.g. each cutoff ±0.05 and midpoints), compute the band by **linear** interpolation
  of those boundary arrays at the height, then the same `< ` ladder, and assert it equals
  `classifyWFH(gender, height, weight)`.
- **HFA** and **WFA** (both genders): for each age-row month `mo` present in `AGE_DATA`, take
  `ref = findRef(gender, mo)`; test values around each SD threshold (±0.05) and assert the band
  from the **nearest-row stepped** boundary (at age `mo`, the boundary = that row's field, i.e.
  just compare against `ref`'s fields directly) equals `classifyHFA(ref, h)` / `classifyWFA(ref, w)`.
  (Because points land on integer-month vertices, the stepped boundary at that age = `ref`'s
  value; this verifies the chart fields map to the right labels in the right order.)

Structural checks (lock the render math so future edits can't reintroduce drift):
- Every zone-band dataset (exclude the `_base` and `นักเรียน` datasets) in `buildWfh`,
  `buildHfa`, `buildWfa` has `tension === 0`.
- In `buildHfa` and `buildWfa`, every zone-band dataset has `stepped === 'middle'`.
- In `buildWfh`, zone-band datasets do NOT set `stepped` (or it is falsy).

## TDD order
1. Write the test. 2. `npm test -- charts-consistency` → FAIL. 3. Fix `charts.ts`.
4. `npm test -- charts-consistency` → PASS. 5. `npx vue-tsc --noEmit` clean + `npm test` full green.

## Report contract
Write full report to `docs/superpowers/briefs/phase3-task-4A-report.md` (status, files,
exact test result lines, tsc result, concerns — especially any input region where chart and
text still diverge and why). Return short summary + status.
