# Mock dataset (full school) + backup-includes-classrooms

Create a realistic whole-school sample that loads via the existing restore flow, so the app can be
reset and reloaded for testing. Also fix backup to include classroom config (it's app state).

## Global constraints
- `noUnusedLocals`. No git. No server start/kill (:5173). Editor tools only, no heredoc/echo.
- Dates Thai BE `D/M/YYYY`. Weights 5–150, heights 40–210. Births in [year−19, year−2].

## Part A — backup includes classrooms (full state)
- `src/domain/transfer/backup.ts`: add `classrooms: { grade: string; rooms: string[] }[]` to BOTH the
  `serializeBackup` state arg and the `parseBackup` return (default `[]` if absent — back-compat).
- `src/stores/data.ts` `replaceAll(parsed)`: also set `classrooms.value = parsed.classrooms ?? []`
  and persist.
- `src/features/SettingsView.vue`: `doBackup` passes `classrooms: data.classrooms`; restore already
  calls `replaceAll(parsed)` so it now restores classrooms too.
- Test (backup test): round-trip preserves classrooms; missing classrooms → [].

## Part B — generator + sample JSON
- Create `mockdata/generate.mjs` — a standalone Node script (no app imports needed; plain JS) that
  DETERMINISTICALLY builds and writes `mockdata/sample-school.json` in the backup format:
  `{ version: 'ntr2-1', setup, period, classrooms, students, measures }`.
- Also commit the generated `mockdata/sample-school.json`.
- Content:
  - `setup`: school 'โรงเรียนบ้านหนองสมบูรณ์', ministry 'กระทรวงศึกษาธิการ', department 'สพฐ.',
    subdistrict/district/province (เชียงใหม่ ok), teacher 'สมศรี ใจดี', maxGrade 'ป.6'.
  - `period`: `{ year: '2569', term: '1', round: '1' }`.
  - `classrooms`: อ.1, อ.2, อ.3 (1 room each); ป.1, ป.2 (2 rooms); ป.3–ป.6 (1 room). rooms as
    `['1']` / `['1','2']`.
  - `students`: 10–15 per room (deterministic Thai names from a pool, alternating gender), unique
    numeric ids (e.g. grade-coded), `dob` valid for the student's age (grade → approx age:
    อ.1≈3y … ป.6≈12y; dob year = 2569 − age, within [2550,2567]). grade/room = current.
  - `measures`: for each student, records across academic years **2567, 2568, 2569**, each year
    term 1 (round 1) and term 2 (round 1) — ~6 measurements/student. For earlier years use the
    student's HISTORICAL grade (current grade minus the year offset, clamped at อ.1) as
    `gradeAtMeasure`/`roomAtMeasure` (snapshot). weight/height increase with age along a plausible
    curve; vary a deterministic subset into ผอม / เริ่มอ้วน / เตี้ย so dashboards + reports show
    at-risk cases. `date` within that year/term; `savedAt` strictly increasing.
- Keep totals reasonable (~100–140 students, ~600–800 measures).

## Verify
- `node mockdata/generate.mjs` writes the JSON; `npm test` green (incl backup classrooms test);
  `npx vue-tsc --noEmit` clean; `npm run build` ok.
- On :5173: ล้างข้อมูล (or fresh), then Settings → เปิดข้อมูลสำรอง → pick `mockdata/sample-school.json`
  → app loads: นักเรียน shows all grades/rooms with students, profiles have multi-year history,
  dashboard/reports show at-risk. Screenshot `.playwright-mcp/mockdata-loaded.png` (นักเรียน) and
  `.playwright-mcp/mockdata-profile.png` (a profile with history).

## Report contract
Write full report to `docs/superpowers/briefs/phase3-mockdata-report.md` (counts, how to load).
Return short summary + status.
