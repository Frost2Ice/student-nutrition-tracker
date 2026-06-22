# Fix Report — Persisted Classroom Structure + Full Teacher Name

Date: 2026-06-21

## Summary

Both bugs confirmed in the brief were fixed. All tests pass, type-check is clean, build succeeds.

---

## Bug 1 — Persisted classroom structure

### Root cause
`src/stores/data.ts` `structure` computed derived only from `students`; onboarding step 3
kept its structure in a local ref and never wrote it to the store or `localStorage`.

### Changes made

**`src/stores/data.ts`**
- Added `ntr2_classrooms` storage key.
- Added `classrooms` ref (`{ grade: string; rooms: string[] }[]`) loaded from `localStorage`,
  fallback `[]`.
- Added `setClassrooms(list)` — assigns the ref and calls `persist()`.
- Updated `persist()` to include `classrooms` under `ntr2_classrooms`.
- Changed `structure` computed to seed from `classrooms.value` first, then union in
  student-derived grade/room pairs (so declared-but-empty rooms show, and undeclared student
  rooms still appear).
- Exposed `classrooms` and `setClassrooms` in the store return.

**`src/features/OnboardingView.vue`**
- Added `persistStructure()` helper that converts the local `{grade, rooms:number}` shape to
  `{grade, rooms:string[]}` and calls `data.setClassrooms(...)`.
- Added `goToStep4()` that calls `persistStructure()` then `next()` — wired to the
  "ถัดไป: นำเข้านักเรียน" button on step 3.
- `finish()` also calls `persistStructure()` in case teacher adjusted room counts after step 4.

**`src/features/SettingsView.vue`**
- Added "โครงสร้างชั้นเรียน" panel listing current structure (e.g. "ป.1 (2 ห้อง) · ป.2 (3 ห้อง)").
- Edit mode shows a grid with grade name input + room count input per row, plus Add/Remove row
  controls; save calls `data.setClassrooms(...)`.

### TDD
Failing test appended to `tests/stores/data.test.ts` per brief spec, confirmed failing before
implementation, confirmed passing after.

---

## Bug 2 — Full teacher name on Home

### Root cause
`HomeView.vue` line 8 computed `teacherFirst` with `.split(' ')[0]`, showing only first token.

### Changes made

**`src/features/HomeView.vue`**
- Replaced `teacherFirst` computed with `teacherName` (plain `data.setup.teacher`).
- Updated greeting template: shows `สวัสดี คุณครู{{ teacherName }} 👋` when name is set,
  falls back to `สวัสดีคุณครู 👋` when empty.

---

## Verification

| Check | Result |
|---|---|
| `npm test` (112 tests) | ✅ all pass |
| `npx vue-tsc --noEmit` | ✅ clean |
| `npm run build` | ✅ 435 kB single-file dist |
| นักเรียน page shows declared empty rooms | ✅ ป.1 0 คน 2 ห้อง · ป.2 0 คน 3 ห้อง · ป.3 0 คน 1 ห้อง |
| Home greeting shows full name | ✅ "สวัสดี คุณครูสมหญิง รักเรียน 👋" |

### Screenshots
- `.playwright-mcp/fix-classrooms.png` — นักเรียน page with declared empty rooms visible
- `.playwright-mcp/fix-teacher-name.png` — Home page with full teacher name in greeting

---

## Scope

No scope creep. No git operations. Dev server untouched. Editor tools only.
