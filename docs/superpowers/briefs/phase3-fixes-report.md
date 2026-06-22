# Phase 3 Fixes Report

**Date:** 2026-06-21
**Branch status:** All fixes applied to working tree. No git commits made.
**Verification:** `npx vue-tsc --noEmit` — 0 errors. `npm test` — 111/111 passed. `npm run build` — ok (476 kB / 165 kB gzip).

---

## Item-by-item results

### C-1 — Restore button on first-run screen
**Status: DONE**

`src/AppShell.vue`

- Added `import { parseBackup } from './domain/transfer/backup'` to the script.
- Added `restoreError` ref, `restoreInput` ref, `pickRestoreFile()` and `onRestoreFile()` functions (mirroring the SettingsView pattern).
- `onRestoreFile` reads the file, calls `parseBackup(text)`, then `data.replaceAll(parsed)` on success; sets `restoreError` on failure.
- Template: added `<input ref="restoreInput" type="file" accept=".json,.ntr,application/json" style="display:none" @change="onRestoreFile" />` and wired `@click="pickRestoreFile"` to the existing button.
- Error message shown inline when backup file is invalid.
- Playwright confirmed: restore panel renders with the wired button.

---

### C-2 — Measure date validation blocks review + save
**Status: DONE**

`src/features/MeasureView.vue`

- `goToReview()` now guards: `if (!measureDate.value || dateError.value) return;`
- The "ตรวจทานก่อนบันทึก" button has `:disabled="!measureDate || !!dateError"` in the template.
- Playwright confirmed: button renders as `[disabled]` when `measureDate` is empty.

---

### C-3 — Latest-status ordering in StudentsView
**Status: DONE**

`src/features/StudentsView.vue:33–34`

- Dropped the fallback sort branch entirely. `statusOf` now uses:
  ```ts
  const m = data.latest.get(s.id) ?? null;
  ```
- If `data.latest` has no entry the student has no measurements and the "ยังไม่วัด" path is returned correctly. No more wall-clock-only fallback that could silently pick a stale record.

---

### I-1 — Premature period write in MeasureView.start()
**Status: DONE**

`src/features/MeasureView.vue:57–58`

- Removed the `data.setPeriod(...)` call from `start()`. The store's period round is no longer written on room-tap.
- `round.value` (local ref) is still used for all dup-checks and for `addMeasure` calls inside `saveAll()`, exactly as before.

---

### I-2 — Promotion delete-in-loop
**Status: DONE**

`src/domain/promotion/promote.ts:43`

- Changed `for (const student of store.students)` to `for (const student of [...store.students])`.
- The spread snapshots the array before any deletions, preventing index-shift skips.

---

### I-3 — Merge count breakdown
**Status: DONE**

`src/domain/transfer/csv.ts` + `src/features/ImportView.vue`

- `mergeImport` now tracks `addedStudents` and `addedMeasures` separately. The existing `added` field is preserved as `addedStudents + addedMeasures` for backward compatibility.
- Return type extended: `{ added, updated, skippedDup, orphans, addedStudents, addedMeasures }`.
- `ImportView.vue` done-step message updated to:
  `เพิ่มนักเรียนใหม่ {{ mergeResult.addedStudents }} คน · เพิ่มการวัดใหม่ {{ mergeResult.addedMeasures }} รายการ · ...`
- `mergeResult` ref type updated to include the new fields.

---

### I-5 — Wrong "next grade" shown in PromotionView preview
**Status: DONE**

`src/features/PromotionView.vue:223`

- Added `import { promote as promoteGrade } from '../domain/grade/ladder'` to the script.
- Changed the per-student preview subtitle from:
  `s.decision.action === 'promote' ? s.grade : ...`
  to:
  `s.decision.action === 'promote' ? promoteGrade(s.grade) : ...`
- Teachers now see "ป.2 → ป.3" instead of "ป.2 → ป.2" for promoted students.

---

### I-6 — Hard-coded promotion rooms
**Status: DONE**

`src/features/PromotionView.vue:234–236`

- Replaced hard-coded room buttons (1, 2) with a dynamic loop:
  - Looks up the target grade in `data.structure` (using `promoteGrade(s.grade)` for promoted students, `s.grade` for repeat/graduate).
  - If the target grade has rooms defined, renders one `<button class="opt">` per room.
  - If no rooms are defined for the target grade (e.g. a new grade not yet in structure), falls back to a free-text `<input>` so the teacher can type any room.

---

### M-1 — Dead code in labels.ts
**Status: DONE_WITH_CONCERNS**

The review said `badgeClass` is "never imported". On verification, `src/components/Badge.vue` imports and uses it:
```ts
import { badgeClass } from '../ui/labels';
```
`badgeClass` is therefore **live code** and `labels.ts` must not be removed. No change made. The finding in the review was incorrect. Flagged here for the record.

---

### M-6 — Inconsistent ท้วม colour
**Status: DONE**

Two locations unified to `warn`:

1. `src/features/StudentsView.vue:99` — removed `'ท้วม'` from the `good` Set in `nutritionCls`. It now falls through to `'warn'`.
2. `src/features/StudentsView.vue:39` — `statusOf` previously returned `cls: 'good'` for `ท้วม`. Changed to the `warn` + `risk: true` branch alongside `ค่อนข้างผอม` and `เริ่มอ้วน`.

`MeasureView.wfhClass` already had `ท้วม: 'warn'` — no change needed there.

---

### M-7 — Hard-coded year dropdown in ReportsView
**Status: DONE**

`src/features/ReportsView.vue:69–71`

- Added `yearOptions` computed: `[String(base+1), String(base), String(base-1)]` derived from `data.period.year`.
- Dropdown now uses `<option v-for="y in yearOptions" :key="y" :value="y">{{ y }}</option>`.
- Schools in 2570+ will automatically get the correct year options.

---

### M-8 — Double print in print.ts
**Status: DONE**

`src/features/print.ts:41–65`

- Added `let printed = false` flag and `const w = win` (non-null capture).
- Both the `win.onload` path and the 200 ms `setTimeout` fallback now call `doPrint()`, which is guarded by `if (printed) return; printed = true;`.
- Print dialog fires exactly once regardless of which path fires first.

---

### M-9 — Overlay not inert
**Status: DONE**

`src/AppShell.vue:93`

- Added `:inert="!!overlay || undefined"` to the `.shell` `<div>`.
- When any overlay (onboarding, import, promotion) is open, the shell wrapper becomes inert: keyboard focus, pointer events, and assistive-technology interaction are all blocked behind the overlay. `|| undefined` avoids setting `inert="false"` as a string attribute when overlay is null.

---

## Verification summary

| Check | Result |
|---|---|
| `npx vue-tsc --noEmit` | ✅ 0 errors |
| `npm test` (111 tests) | ✅ 111/111 passed |
| `npm run build` | ✅ 476 kB / 165 kB gzip |
| §6.2 invariant test (charts-consistency) | ✅ 18/18 passed |
| (a) First-run restore button opens file picker | ✅ Wired via `pickRestoreFile()` / hidden input |
| (b) Measure blocks save with empty date | ✅ Button disabled confirmed via Playwright |
| (c) Promotion preview shows promoted (next) grade | ✅ Template uses `promoteGrade(s.grade)` |
