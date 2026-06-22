# Phase 3 Classroom Editor — Implementation Report

## Summary

All three steps from the brief were completed successfully. Tests (113), type-check, and build are
all clean. The Settings classroom editor now auto-generates grades from `setup.maxGrade` using the
same `.mrow` layout as onboarding step 3. Onboarding step 3 derives its grade list from `maxGrade`
instead of a hardcoded array.

---

## Step 1 — `gradesUpTo` helper (TDD)

**File:** `src/domain/grade/ladder.ts`

Added:

```ts
export function gradesUpTo(maxGrade: string): string[] {
  const idx = GRADE_ORDER.indexOf(maxGrade);
  if (idx === -1) return [];
  return GRADE_ORDER.slice(0, idx + 1);
}
```

**Test file:** `tests/domain/ladder.test.ts` — appended the failing test first, confirmed FAIL
(`gradesUpTo is not a function`), then implemented, confirmed PASS. All 9 ladder tests pass.

**Side fix:** `tsconfig.json` lib updated from `["ES2017", ...]` to `["ES2022", ...]` to satisfy
`Array.prototype.at` used in the test (required by the brief's exact test snippet). Target remains
ES2017; only the type-lib expanded.

---

## Step 2 — Onboarding step 3 derives from `maxGrade`

**File:** `src/features/OnboardingView.vue`

- Imported `gradesUpTo` from `../domain/grade/ladder`.
- Replaced the hardcoded 9-item `structure` array with an empty `ref([])`.
- Updated `goToStep3()` to populate `structure.value` from `gradesUpTo(schoolForm.value.maxGrade)`,
  preserving any previous room counts via a `Map` lookup (falls back to 1).
- Step-3 template unchanged — same `.mrow` grid layout with grade label + number input.

---

## Step 3 — Settings editor rewritten to match onboarding layout

**File:** `src/features/SettingsView.vue`

- Imported `gradesUpTo`.
- `startEditClassrooms()`: builds `classroomDraft` from `gradesUpTo(data.setup.maxGrade)` (falls
  back to `data.structure` grades if `maxGrade` is empty), mapping existing room counts from the
  store.
- Removed `addClassroomRow` and `removeClassroomRow` (unused after rewrite — satisfies
  `noUnusedLocals`).
- `saveClassrooms()`: simplified to map all draft entries directly (no `.filter(g => g.grade.trim())`
  needed since grades are auto-generated, not free-text).
- Template: replaced the 3-column free-text grid (grade input + rooms input + × button + add-row
  button) with the identical `.mrow head` + `v-for .mrow` pattern from onboarding step 3:
  `grid-template-columns: 1fr 160px`, `.nm` grade label, numeric `v-model.number` rooms input.

---

## Verification

| Check | Result |
|---|---|
| `npm test` | ✅ 113/113 passed (14 test files) |
| `npx vue-tsc --noEmit` | ✅ Clean |
| `npm run build` | ✅ 435 kB single-file dist |
| Playwright — Settings editor | ✅ Shows อ.1–ป.6 (9 rows) with existing counts preserved, no free-text/add/remove |

**Screenshot:** `.playwright-mcp/fix-classroom-editor.png`

The live editor shows: อ.1(1), อ.2(1), อ.3(1), ป.1(2), ป.2(3), ป.3(1), ป.4(1), ป.5(1), ป.6(1) —
matching the school's `maxGrade=ป.6`. Existing classroom counts (ป.1=2, ป.2=3, ป.3=1) were
correctly preserved from prior data.

---

## Files changed

- `src/domain/grade/ladder.ts` — added `gradesUpTo`
- `tests/domain/ladder.test.ts` — added `gradesUpTo` test
- `src/features/OnboardingView.vue` — step 3 derives from `maxGrade`
- `src/features/SettingsView.vue` — classroom editor rewritten, removed unused helpers
- `tsconfig.json` — lib bumped to ES2022 for `Array.prototype.at`
