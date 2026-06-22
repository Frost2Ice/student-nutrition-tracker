# Phase 3 Mock Dataset Report

## Status: DONE

## What was done

### Part A — backup includes classrooms

Three files changed:

1. **`src/domain/transfer/backup.ts`**
   - Added `classrooms: { grade: string; rooms: string[] }[]` to `BackupPayload` interface, `serializeBackup` state arg, and `parseBackup` return type.
   - `parseBackup` defaults to `[]` when field is absent (back-compat with old backup files).

2. **`src/stores/data.ts`**
   - `replaceAll` now accepts optional `classrooms` and sets `classrooms.value = parsed.classrooms ?? []` then calls `persist()`.

3. **`src/features/SettingsView.vue`**
   - `doBackup` now passes `classrooms: data.classrooms` to `serializeBackup`.

4. **`src/features/PromotionView.vue`**
   - `downloadBackup` (pre-promotion safety backup) also updated to pass `classrooms: data.classrooms`.

5. **`tests/transfer/backup.test.ts`**
   - Added two new tests:
     - Round-trip preserves classrooms correctly.
     - Missing `classrooms` field in old backup returns `[]` (back-compat).
   - Updated existing `serializeBackup` calls to include `classrooms: []`.

All 161 tests pass, `npx vue-tsc --noEmit` clean, `npm run build` succeeds.

### Part B — generator + sample JSON

**`mockdata/generate.mjs`** — deterministic Node script (no app imports, plain ESM):
- Uses a seeded LCG PRNG (seed=42) for full determinism.
- Generates the complete school structure per the brief.
- Writes `mockdata/sample-school.json` in backup format `version: 'ntr2-1'`.

**`mockdata/sample-school.json`** — generated output:

| Field | Value |
|-------|-------|
| version | ntr2-1 |
| school | โรงเรียนบ้านหนองสมบูรณ์ |
| period | ปีการศึกษา 2569 ภาคเรียน 1 ครั้งที่ 1 |
| classrooms | 9 grades, 11 rooms (อ.1-3: 1 room each; ป.1-2: 2 rooms; ป.3-6: 1 room) |
| students | **132** |
| measures | **660** |

Measurement breakdown per student: years 2567, 2568, 2569 × term 1 + term 2 (except 2569 term 2 which hasn't happened) = 5 measurements each.

At-risk distribution (deterministic by student index):
- Index % 5 == 0 → ผอม (underweight weight curve)
- Index % 7 == 0 → เริ่มอ้วน (overweight weight curve)
- Index % 11 == 0 → เตี้ย (short height curve)

Historical grade snapshots: `gradeAtMeasure` is the student's grade at the time of measurement (current grade minus year offset, clamped at อ.1), correctly reflecting where the student was when each measurement was taken.

## Verify results

- `npm test` → 161/161 pass (including 2 new backup classrooms tests)
- `npx vue-tsc --noEmit` → clean
- `npm run build` → ok (single-file dist/index.html ~920KB)
- `node mockdata/generate.mjs` → writes sample-school.json deterministically

## Screenshots

Both saved to `.playwright-mcp/`:
- `mockdata-loaded.png` — นักเรียน tab showing all 9 grades with student counts
- `mockdata-profile.png` — วรวุฒิ รักดี (ป.6/1, เริ่มอ้วน) profile with multi-year measurement history

## How to load

Settings → เปิดข้อมูลสำรอง → pick `mockdata/sample-school.json` → confirm → app reloads with full school data.

Or for testing: clear localStorage, then inject via the generated file through the restore flow.

## Files changed

- `src/domain/transfer/backup.ts` — classrooms in serialize/parse
- `src/stores/data.ts` — replaceAll handles classrooms
- `src/features/SettingsView.vue` — doBackup passes classrooms
- `src/features/PromotionView.vue` — downloadBackup passes classrooms
- `tests/transfer/backup.test.ts` — 2 new classrooms round-trip tests
- `mockdata/generate.mjs` — NEW: deterministic generator script
- `mockdata/sample-school.json` — NEW: generated full-school dataset
