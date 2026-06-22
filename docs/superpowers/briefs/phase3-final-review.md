# Phase 3 Final Code Review

**Scope:** `src/main.ts`, `src/AppShell.vue`, `src/stores/data.ts`,
`src/domain/**`, `src/features/*.vue`, `src/features/charts.ts`, `src/features/print.ts`

**Verification:** `npm test` — **111/111 passed**. `npx vue-tsc --noEmit` — **0 errors**.
Build produces single-file `dist/index.html` (474 kB, 165 kB gzip).

---

## Critical (must fix before go-live)

**C-1** `src/AppShell.vue:87–89` — The "restore from backup" button in the first-run screen has no
file-input element wired to it. The `<button class="btn primary">เลือกไฟล์สำรอง</button>` renders
but does nothing when clicked — there is no `<input type="file">` and no `@click` handler. A user
who chooses "มีข้อมูลเดิมอยู่แล้ว" cannot actually restore their backup from the welcome screen.
Suggested fix: wire up the same `parseBackup` / `data.replaceAll` flow used in `SettingsView`
(a hidden `<input type="file">` + reader, exactly as in `SettingsView.vue:84–116`).

**C-2** `src/features/MeasureView.vue:125–126, 310–313` — `dateError` is computed against
`measureDate.value`, but `saveAll()` (line 131–146) does not gate on `dateError`. A teacher can
reach the review step (step 2) and click "บันทึกการวัด" while `measureDate` is empty or invalid:
`goToReview()` (line 127) simply sets `i.value = 2` without checking the date. Every saved
`Measurement.date` would be an empty string `''`, breaking `calcNutrition` (which calls
`parseThaiDate(m.date)` → returns `null` → nutrition result is `null` for every affected record).
Suggested fix: validate `!dateError.value` (and optionally that `measureDate.value !== ''`) inside
`goToReview()` before advancing.

**C-3** `src/features/StudentsView.vue:34` — `statusOf` falls back to
`data.measuresFor(s.id).sort((a,b) => b.savedAt - a.savedAt)[0]` when `data.latest` has no entry
for the student. But `data.latest` (the store's `latest` computed) already covers all measurements;
the only case where a student has measures but no `latest` entry would be a bug in `latestPerStudent`.
The bigger issue is the sort: `b.savedAt - a.savedAt` is correct, but the fallback path
entirely bypasses `latestPerStudent` ordering (year/term/round) and uses wall-clock only, which
can silently pick an older record if `savedAt` timestamps from an import are wrong. This is a
correctness risk for the status badge shown in the student list.
Suggested fix: drop the fallback branch; if `data.latest` has no entry the student genuinely
has no measurements and `{ label: 'ยังไม่วัด', cls: 'neutral', risk: false }` is correct.

---

## Important (correctness / data-safety issues)

**I-1** `src/features/MeasureView.vue:57–58` — `start()` calls `data.setPeriod(...)` with the
currently selected `round.value` every time a room is chosen (before any data is entered). This
overwrites the persisted period `round` immediately on room selection, even if the teacher clicks
"เลือกห้องอื่น" and abandons the session. The intended round is a per-wizard-session value; it
should not be written to the store / localStorage until measurements are actually saved.
Suggested fix: remove the `data.setPeriod` call from `start()`; call it (or just use the local
`round.value`) at save time inside `saveAll()`.

**I-2** `src/domain/promotion/promote.ts:43` — `applyPromotion` iterates `store.students` directly
and calls `store.deleteStudent` inside the loop. Pinia's reactive array mutates in-place: deleting
student at index `k` shifts subsequent elements left, so the loop index advances past the next
element. In practice the `for...of` snapshot behaviour depends on when Vue makes the array reactive
vs. when `filter` is applied inside `deleteStudent`. The store's `deleteStudent` reassigns
`students.value` (a new filtered array), but `for...of store.students` captured the original
`students` ref's `.value` proxy — subsequent iteration may skip elements or hit stale data.
Suggested fix: collect IDs to delete first, then apply them; or snapshot
`[...store.students]` before the loop.

**I-3** `src/domain/transfer/csv.ts:182–184` — `mergeImport` counts a measure addition in
`added` (not `updated`) even though measure-level stats are separate from student stats. More
importantly, after the merge the caller (ImportView) shows `mergeResult.added` as a single number
covering both new students and new measures, which can confuse teachers. This is a UX/reporting
bug — the number shown may represent mixed entity types without disclosure.
Suggested fix: use separate counters (`studentsAdded`, `measuresAdded`) or clarify the label in
`ImportView.vue:161`.

**I-4** `src/features/StudentsView.vue:311–327` — When adding a measure via the profile dialog,
`saveMeasure` uses `data.period` (the global period, including `round`) to key the measurement.
There is no UI to select a different round in this dialog; the teacher is silently locked to the
current global round. If the global period round does not match the historical round of the
measurement being entered, the record will be stored under the wrong key.
Suggested fix: add a round selector to the measure dialog, or document the constraint in the UI.

**I-5** `src/features/PromotionView.vue:223` — The "grade preview" column shows
`s.decision.action === 'promote' ? s.grade : ...` — but for promoted students it shows the
*current* grade, not the *next* grade. Teachers see "ป.2 → ป.2" instead of "ป.2 → ป.3".
Suggested fix: compute next grade via `promote(s.grade)` from `ladder.ts` and display that.

**I-6** `src/features/PromotionView.vue:234–236` — The room-assignment UI in the promotion wizard
offers only rooms 1 and 2. If a grade has 3+ rooms the teacher cannot assign a student to room 3+.
The room options are hard-coded rather than derived from `data.structure`.
Suggested fix: derive available rooms from `data.structure.find(g => g.grade === s.grade)?.rooms`.

**I-7** `src/domain/nutrition/reference/index.ts:12` — `findRef` accepts ±6 months tolerance.
A child aged 24 months (minimum accepted by `calcNutrition`) could match an 18-month reference row
if no 24-month row exists, which would be outside the valid reference range. The reference data
should be checked to confirm rows start at 24 months; if not, the tolerance must be bounded by the
engine's 24-month minimum.
(Low-risk if reference tables start at 24 months — verify by inspecting `age-data.ts`.)

**I-8** `src/features/ReportsView.vue:27` — `pct` returns a `number`, not a string. When rendered
as `{{ pct(n, summary.measured) }}%` this displays correctly, but `toSummaryCsv` in
`summary.ts:92–93` has its own `pct` function that calls `.toFixed(1)` which is correct. The view's
`pct` uses `Math.round(... * 1000) / 10` producing up to 1 decimal but may emit extra decimals for
edge values (e.g., 33.333... → 33.3, fine); however `pct(0, 0)` returns `0` where the CSV returns
`'0.0'` — minor inconsistency but not a bug.

---

## Minor (UX / dead code / edge-case gaps)

**M-1** `src/ui/labels.ts` — Exported `badgeClass` is defined but **not imported anywhere** in the
codebase (each view defines its own inline color-map: `wfhClass`, `hfaClass`, `wfaClass` in
MeasureView; `nutritionCls` in StudentsView). This is dead code that duplicates existing inline
maps. Suggested fix: either use `badgeClass` everywhere and delete the inline maps, or delete `ui/labels.ts`.

**M-2** `src/features/MeasureView.vue:304–334` — The Excel import path (mode = 'excel') is a
placeholder: the file picker is `disabled`, both steps 2 and 3 show "เชื่อมต่อในขั้นถัดไป" callouts,
and the "บันทึกผลการวัด" button is disabled. This is dead UI. If Task 12 is not planned for
immediate release, the "นำเข้า Excel" entry point (`start(c.grade, c.room, 'excel')` on line 214)
should be hidden or removed to avoid confusing teachers.

**M-3** `src/features/ImportView.vue:56–57` — The wizard skips directly from step 3 (preview,
`i = 2`) to step 4 (confirm, `i = 3`), then `confirmImport` advances to `i = 4` (done). The
Stepper component shows 5 steps but `i` only reaches 4. The "step 3 → confirm" button label says
"ถัดไป: จัดการรายการซ้ำ" but step 3 (`i = 3`) only shows a static summary — there is no actual
per-row duplicate management UI despite the button label and the Stepper label "รายการซ้ำ".
This is a UX mismatch that may confuse teachers expecting to manage duplicates.

**M-4** `src/features/MeasureView.vue:105–111` — `filledCount()` is called as a function
(not a computed ref) inside the template (lines 261, 270–272). Because it's a plain function, Vue
cannot track it reactively; the count will not update as users type. It will only re-render when
something else in the template triggers re-render. Suggested fix: make it a `computed`.

**M-5** `src/features/MeasureView.vue:149–150` — `periodLine()` is similarly a plain function
called in the template (lines 168, 341) rather than a computed. Same reactivity risk.

**M-6** `src/features/StudentsView.vue:99` — `nutritionCls` maps 'ค่อนข้างผอม' to neither `bad`
nor `good` buckets, so it falls through to `'warn'` — correct. But 'ท้วม' is in the `good` set
(line 99) while MeasureView's `wfhClass` maps 'ท้วม' to `'warn'`. This creates a visual
inconsistency: the same WFH label renders as a green pill in the profile view and a yellow pill
during entry. Suggested fix: align both maps — the domain definition of 'ท้วม' is borderline
(between normal and overweight), so 'warn' is the safer choice.

**M-7** `src/features/ReportsView.vue:69–71` — The year dropdown is hard-coded to `2569`, `2568`,
`2567`. Schools using this in 2570+ will not be able to select the current year for reports.
Suggested fix: generate the dropdown from `(currentYear - 1)` to `(currentYear + 1)` dynamically.

**M-8** `src/features/print.ts:53–65` — The fallback `setTimeout` (200ms) unconditionally calls
`win.print()` even if the `onload` event already triggered and printed. This can result in the
print dialog appearing twice. The `onload` path and the timeout path lack mutual exclusion.
Suggested fix: use a `printed` flag to guard the second call.

**M-9** `src/AppShell.vue:130–134` — The bottom navigation shows all 5 tabs on mobile but the
overlay close button is "✕ ปิด" fixed in the overlay bar. When an overlay is open, the bottom
nav and sidebar are still rendered behind the overlay (no `pointer-events: none` or `inert` on
them). A fast tap could trigger a nav button behind the overlay.
Suggested fix: add `pointer-events: none` or `aria-hidden="true"` to `.shell` when `overlay !== null`.

**M-10** `src/features/OnboardingView.vue` — Step 3 ("โครงสร้างชั้นเรียน") allows the teacher
to define rooms, but the `structure` ref is local to the component and is not saved to the store.
It is only used as a UI scaffold for step 4's "add per room" list. If the teacher navigates back
and forward, the room counts reset to defaults. This is intentional per the comment at line 44, but
the UX is surprising — teachers who customise the room list and then go back will lose their edits.

---

## BRD §6.2 Classification Invariant Check

All nutrition labels rendered in the UI are derived exclusively from `calcNutrition` return values.
No view re-derives a label independently. Chart zone boundaries in `charts.ts` pull directly from
`WFH_M`, `WFH_F`, and `AGE_DATA` — the same reference tables used by the engine. The zone ordering
and label strings in `buildWfh`, `buildHfa`, `buildWfa` match the engine's classification
thresholds exactly (confirmed by the 18 chart-consistency tests in `tests/features/charts-consistency.test.ts`).
**No §6.2 violation found.**

---

## Summary

| Severity | Count |
|---|---|
| Critical | 3 |
| Important | 8 |
| Minor | 10 |

**Top priorities:**
- C-1: Restore button on first-run screen is dead (no file input wired up).
- C-2: `saveAll()` in MeasureView does not validate the measurement date — empty dates will corrupt every saved measurement.
- C-3: `statusOf` fallback sort in StudentsView bypasses canonical ordering.
- I-1: `start()` persists the session's `round` to the store immediately on room selection.
- I-2: `applyPromotion` mutates store array mid-loop (iterator safety risk).
- I-5: Promotion preview shows current grade as "next" grade for promoted students.
