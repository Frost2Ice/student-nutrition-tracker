# Fix — classroom editor: auto-generate grades from maxGrade, match onboarding layout

The Settings "โครงสร้างชั้นเรียน" editor currently allows arbitrary free-text grade rows. It should
instead AUTO-GENERATE the grade list from the configured highest grade (`setup.maxGrade`), let the
teacher set only the NUMBER OF CLASSROOMS per grade, and use the SAME layout as the onboarding
step-3 screen. Onboarding step-3 also currently hardcodes อ.1–ป.6 and must derive from maxGrade too,
so both screens stay consistent.

## Global constraints
- `noUnusedLocals`. No git. No server start/kill (:5173). Editor tools only, no heredoc/echo.
- Don't break existing tests/invariants. After: `npx vue-tsc --noEmit` clean, `npm test` green,
  `npm run build` ok.

## Step 1 — shared grade generator (domain, TDD)
File: `src/domain/grade/ladder.ts` (+ append to `tests/domain/ladder.test.ts` — create if absent,
match the existing test style for ladder).
- Add `export function gradesUpTo(maxGrade: string): string[]` — returns `GRADE_ORDER` from the
  start through `maxGrade` inclusive; if `maxGrade` not found, return `[]`.
- Failing test first:
```ts
import { gradesUpTo } from '../../src/domain/grade/ladder'; // adjust path to match existing tests
it('generates grades up to the configured max', () => {
  expect(gradesUpTo('อ.3')).toEqual(['อ.1', 'อ.2', 'อ.3']);
  expect(gradesUpTo('ป.6')).toEqual(['อ.1','อ.2','อ.3','ป.1','ป.2','ป.3','ป.4','ป.5','ป.6']);
  expect(gradesUpTo('ม.3').at(-1)).toBe('ม.3');
  expect(gradesUpTo('นonsense')).toEqual([]);
});
```
Run `npm test -- ladder` → FAIL → implement → PASS.

## Step 2 — onboarding step 3 derives from maxGrade (`src/features/OnboardingView.vue`)
- The local step-3 `structure` ref is currently a hardcoded list (อ.1–ป.6). Instead, generate it
  from `gradesUpTo(schoolForm.maxGrade)` when entering step 3 (e.g. in `goToStep3()`): set
  `structure.value = gradesUpTo(schoolForm.value.maxGrade).map((grade) => ({ grade, rooms:
  <previous count for that grade if any, else 1> }))`. Keep the existing `{grade, rooms:number}`
  shape and the existing step-3 `.mrow` (grade label | number input) layout — do NOT change the
  visual pattern. Persist on step3→4 as it already does (`setClassrooms`).

## Step 3 — Settings editor matches onboarding (`src/features/SettingsView.vue`)
- Replace the arbitrary-rows editor (free-text grade input + add/remove row buttons) with the
  onboarding pattern:
  - `startEditClassrooms()` builds `classroomDraft` from `gradesUpTo(data.setup.maxGrade)`, each
    `{ grade, rooms: <existing count from data.structure for that grade, else 1> }`.
  - Render one row per generated grade using the SAME markup/classes as onboarding step 3:
    `.mrow` with `grid-template-columns: 1fr 160px`, a `.nm` grade label, and a numeric rooms input
    (`v-model.number`, min 0). No free-text grade field, no add-row / remove-row buttons.
  - `saveClassrooms()` → `data.setClassrooms(classroomDraft.map((g) => ({ grade: g.grade, rooms:
    Array.from({ length: Math.max(0, g.rooms) }, (_, i) => String(i + 1)) })))`. Keep the toast.
  - Remove now-unused `addClassroomRow`/`removeClassroomRow` (and any free-text-only helpers) to
    satisfy noUnusedLocals.
- If `data.setup.maxGrade` is empty, fall back to showing the current `data.structure` grades (so
  legacy data without maxGrade still edits), but the normal path is generated-from-maxGrade.

## Verify
- `npx vue-tsc --noEmit` clean; `npm test` green (incl ladder test); `npm run build` ok.
- On :5173: Settings → แก้ไข โครงสร้างชั้นเรียน shows auto-generated grades up to the school's max
  grade with only a rooms-count input each, visually matching the onboarding step-3 screen. Saving
  reflects on นักเรียน. Screenshot `.playwright-mcp/fix-classroom-editor.png` (and optionally the
  onboarding step-3 for side-by-side consistency).

## Report contract
Write full report to `docs/superpowers/briefs/phase3-classroom-editor-report.md`. Return short
summary + status.
