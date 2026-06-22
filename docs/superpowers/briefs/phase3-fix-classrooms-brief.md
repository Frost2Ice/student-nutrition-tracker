# Fix — persisted classroom structure + full teacher name

Two bugs found in the running app. Root causes already established:

- **Bug 1:** No persisted classroom structure. `src/stores/data.ts` `structure` computed derives
  ONLY from `students`; `OnboardingView` step 3 keeps its structure in a LOCAL ref (comment
  "no store field"). So classrooms a teacher configures at setup but hasn't added students to do
  NOT appear on the นักเรียน page, and there is no way to edit classrooms later.
- **Bug 2:** `src/features/HomeView.vue:8` shows only the teacher's first name
  (`teacher.split(' ')[0]`). Should show the full name.

## Global constraints
- `noUnusedLocals`. No git. No server start/kill (:5173). Editor tools only, no heredoc/echo.
- Don't break the §6.2 invariant or any test. After: `npx vue-tsc --noEmit` clean, `npm test`
  green, `npm run build` ok.

## Fix 1 — persisted classrooms (root cause), TDD

### Store (`src/stores/data.ts`)
- Add `classrooms` ref `{ grade: string; rooms: string[] }[]`, persisted under new key
  `ntr2_classrooms`, fallback `[]`. Include in `persist()` and the store return.
- Add `setClassrooms(list: { grade: string; rooms: string[] }[])` — assign + persist.
- Change the `structure` computed to MERGE declared classrooms with student-derived grades/rooms:
  start the grade→rooms map from `classrooms.value`, then union in every student's grade/room
  (so students in not-yet-declared rooms still appear, and declared-but-empty rooms still show).
  Keep the existing sort: grades by `GRADE_ORDER` (unknown last), rooms numeric ascending.
- `roomInfo`/`gradeInfo`/`roomStudents` stay as-is (they filter students; an empty declared room
  correctly yields `{ total: 0, measured: 0 }`).

### Failing test first (`tests/stores/data.test.ts`, append)
```ts
it('persists declared classrooms and merges them into structure', () => {
  const d = useData();
  d.setClassrooms([{ grade: 'ป.1', rooms: ['1', '2'] }, { grade: 'ป.2', rooms: ['1'] }]);
  expect(d.structure.find((s) => s.grade === 'ป.1')?.rooms).toEqual(['1', '2']);
  expect(d.roomInfo('ป.1', '2')).toEqual({ total: 0, measured: 0 }); // declared, empty
  d.addStudent({ id: '1', firstName: 'ก', lastName: 'ข', dob: '1/1/2560', gender: 'ชาย', grade: 'ป.3', room: '1' });
  expect(d.structure.some((s) => s.grade === 'ป.3')).toBe(true); // undeclared room from student still shows
});
```
Run `npm test -- data.test` → FAIL, then implement → PASS.

### Onboarding (`src/features/OnboardingView.vue`)
- When leaving step 3 (structure) — i.e. the Next that goes to step 4 — call
  `data.setClassrooms(structure.value.map((g) => ({ grade: g.grade, rooms: Array.from({ length: g.rooms }, (_, i) => String(i + 1)) })))`
  so the declared rooms persist and drive step 4's per-room list (and the นักเรียน page afterward).
  Also call it again on final finish in case the teacher changed counts. Keep the local
  `structure` ref shape `{grade, rooms:number}` for the step-3 UI; only convert at persist time.

### Settings editor (`src/features/SettingsView.vue`)
- Add a "โครงสร้างชั้นเรียน" panel (schools add/merge classrooms over time). List
  `data.structure` grades with an editable room count per grade + ability to add a new grade
  row; on save call `data.setClassrooms(...)` with the same `{grade, rooms:string[]}` shape.
  Keep it simple and consistent with the existing Settings panels. (Merging a classroom away =
  reducing its room count; students already in a removed room still appear via the student-derived
  union, which is correct — don't delete students here.)

## Fix 2 — full teacher name (`src/features/HomeView.vue`)
- Replace the first-name-only greeting: use the full `data.setup.teacher`. Greeting becomes
  e.g. `สวัสดี คุณครู{{ data.setup.teacher }} 👋` (guard empty → just `สวัสดีคุณครู`). Remove the
  now-unused `teacherFirst`/split. Scan for any other shortened teacher display; there is only
  this one (SettingsView already shows the full name).

## Verify
- `npx vue-tsc --noEmit` clean; `npm test` green; `npm run build` ok.
- On :5173: (a) after onboarding (or via Settings editor) the configured classrooms appear on the
  นักเรียน page even with zero students; (b) editing classroom structure in Settings updates นักเรียน;
  (c) Home greeting shows the full teacher name. Screenshot `.playwright-mcp/fix-classrooms.png`
  (นักเรียน showing declared empty rooms) and `.playwright-mcp/fix-teacher-name.png`.

## Report contract
Write full report to `docs/superpowers/briefs/phase3-fix-classrooms-report.md`. Return short
summary + status.
