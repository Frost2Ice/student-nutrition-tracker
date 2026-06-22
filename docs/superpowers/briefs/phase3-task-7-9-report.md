# Phase 3 Tasks 7–9 — StudentsView Implementation Report

**Status: DONE**
**Date: 2026-06-20**

---

## Files

- **Created:** `src/features/StudentsView.vue`
- **Modified:** `src/AppShell.vue` (import + `<StudentsView v-else-if="dest === 'students'" key="students" />`)

---

## Type Check & Build

- `npx vue-tsc --noEmit` — **clean** (zero errors)
- `npm run build` — **succeeded** (dist/index.html 369.41 kB gzip: 131.08 kB)

---

## What Was Implemented

### Task 7 — Browse
- Grade cards from `data.structure` showing total students + room count + measured progress bar
- Room cards showing `roomInfo(grade, room)` totals + progress pill (วัดครบแล้ว/วัดแล้ว N/T/ยังไม่วัด)
- Student list table with `ภาวะล่าสุด` column: computed via `calcNutrition(student, latestMeasure)` → `wfh` label; pill colored good/warn/bad/neutral
- `เฉพาะกลุ่มเสี่ยง` chip filter (risk = ค่อนข้างผอม/เริ่มอ้วน/ผอม/อ้วน) with roomRiskCount badge
- School-wide search via `data.searchStudents(q)`
- Breadcrumb nav: grades → rooms → students

### Task 8 — Profile
- Header: firstName + lastName, รหัส, gender, dob (Thai BE), age via `getAgeMonths` formatted as "X ปี Y เดือน", current class pill
- Latest assessment pills: wfh, wfa, hfa, tall label ("สูงดีสมส่วน"/"ไม่สมส่วน") — all from `calcNutrition` only
- Three growth charts (WFH/HFA/WFA) rendered with `buildWfh`/`buildHfa`/`buildWfa` from `charts.ts`; `<canvas>` + `new Chart()`; destroy-before-recreate on student/measure change; segmented metric toggle shows one at a time (all three always instantiated)
- Registry edit (แก้ไขข้อมูล) / delete (ลบ) with confirm dialogs
- Grade/room change → `gradeConfirm` dialog before `updateStudent`
- Add student ("+ เพิ่มนักเรียน") from room list, prefilled grade/room

### Task 9 — Measurement Management
- History table: `measuresFor(open.id)` sorted newest-first (year → term → round → savedAt desc); shows gradeAtMeasure
- Per-row WFH and tall labels from `calcNutrition` (not hardcoded)
- Per-row แก้ไข / ลบ with confirm
- "+ บันทึกการวัด" dialog: date (pre-filled todayThai()), weightKg, heightCm; validation via `validateThaiDate` / `validateWeight` / `validateHeight`
- On add: checks `findDuplicate(id, period)` → shows inline warn with "ยืนยัน บันทึกเพิ่ม" before proceeding
- On edit: `deleteMeasure(old)` + `addMeasure(new)` with current grade/room snapshot
- Charts re-render after any measure change

---

## Verification Results

### Browse Screenshot
Saved to `.playwright-mcp/p3-t79-browse.png`

- Drilled ทุกชั้น → ป.3 → ห้อง 1 (ป.3/1)
- Student list showed:
  - 10001 สมชาย ใจดี — pill **สมส่วน** (green/good)
  - 10002 สมหญิง รักเรียน — pill **เริ่มอ้วน** (warn)
- Risk filter badge showed **1** (สมหญิง is at risk)

### Profile Screenshot
Saved to `.playwright-mcp/p3-t79-profile.png`

- Profile opened for สมชาย ใจดี (10001)
- Latest pills: สมส่วน / น้ำหนักน้อย / เตี้ย / ไม่สมส่วน
- Three chart canvases confirmed **non-blank** via pixel data check: all `nonZero: true` (1820×520 each)
- Metric toggle buttons present (น้ำหนักตามส่วนสูง / ส่วนสูงตามอายุ / น้ำหนักตามอายุ)

### Measurement Add → Row + Chart Update
- Clicked "+ บันทึกการวัด", filled weight 24 / height 124 / date 1/6/2569
- Duplicate warning appeared (period 2569/1/1 already existed) → confirmed → saved
- History table updated from 2 rows to **3 rows** ✓
- Charts remained non-blank after re-render ✓

### Grade/Room Change Confirm
- Clicked แก้ไขข้อมูล for สมชาย, changed room from "1" to "2", clicked บันทึก
- **"ย้ายชั้น/ห้องของนักเรียน?"** dialog appeared correctly ✓
- Cancelled to leave data unchanged

### Label Consistency Spot-Check (BRD §6.2)
**Student: สมชาย ใจดี (10001) — measurement: weight 22.5 kg / height 122 cm / date 15/6/2569**

- Room list ภาวะล่าสุด pill: **สมส่วน**
- Profile WFH label (latest pills): **สมส่วน**
- Both derived from the same call path: `statusOf(s)` → `calcNutrition(student, latestMeasure)?.wfh` (browse) and `latestNutrition.wfh` (profile). **Labels match exactly.** ✓

---

## Architecture Notes

- All nutrition labels flow exclusively through `calcNutrition` — no hand-written labels anywhere.
- All growth charts use `buildWfh`/`buildHfa`/`buildWfa` from `charts.ts` — no custom zones.
- Canvas chart lifecycle: `renderScheduled` debounce guard coalesces `watch(open)` and `watch(openMeasures)` into a single `nextTick` render, with `Chart.getChart(canvas)` defensive cleanup to avoid the "canvas already in use" error on rapid navigation.
- `animation: false` is already set in `charts.ts` base options — honored.

---

## Concerns

None. All verification items passed.
