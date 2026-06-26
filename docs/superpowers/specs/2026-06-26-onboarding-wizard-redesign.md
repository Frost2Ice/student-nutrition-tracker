# Onboarding Wizard Redesign

**Date:** 2026-06-26  
**File:** `src/features/OnboardingView.vue`

## Summary

Simplify เริ่มตั้งค่าระบบ from 5 steps to 4. Remove import step entirely. Merge grade-range config into structure step. Strip ภาคเรียน from year step. Add summary screen as final step.

---

## New Step Structure

| Step | Label | Key changes |
|------|-------|-------------|
| 1 | ข้อมูลโรงเรียน | Remove `ชั้นสูงสุดของโรงเรียน` field |
| 2 | ปีการศึกษา | Remove ภาคเรียน select; remove auto-guess callout; year pre-fills from today's BE year |
| 3 | โครงสร้างชั้นเรียน | Add minGrade + maxGrade selectors; auto-generate grade list; user sets rooms per grade |
| 4 | สรุปการตั้งค่า | Read-only summary of all data; Confirm → finish |

`steps` array: `['ข้อมูลโรงเรียน', 'ปีการศึกษา', 'โครงสร้างชั้นเรียน', 'สรุปการตั้งค่า']`

---

## Step 1 — ข้อมูลโรงเรียน

**Remove:** `maxGrade` field from `schoolForm` and its `<select>` in the template.

`schoolForm` fields: `school`, `ministry`, `department`, `subdistrict`, `district`, `province`, `teacher`.

`goToStep2()` calls `data.saveSetup({ ...schoolForm.value })` — no `maxGrade`.

---

## Step 2 — ปีการศึกษา

**Remove:** ภาคเรียน `<select>` and the `callout info` block ("ระบบเดาให้แล้วจากวันที่วันนี้").

`yearForm` reduced to `{ year: string }` only.

Year pre-fills to current BE year (today CE year + 543, computed once on mount).

`goToStep3()` calls `data.setPeriod({ year: yearForm.value.year, term: '1', round: '1' })` — term hardcoded to `'1'`; system always has 2 terms per year, user never sets this in wizard.

Then regenerates `structure` using `gradesUpTo(structureForm.maxGrade)` sliced from `structureForm.minGrade`.

---

## Step 3 — โครงสร้างชั้นเรียน

**Add** `structureForm` ref: `{ minGrade: string; maxGrade: string }` defaulting to `{ minGrade: 'ป.1', maxGrade: 'ป.6' }`.

Two `<select>` dropdowns (both from `GRADE_ORDER`) for minGrade and maxGrade. Changing either triggers `rebuildStructure()`.

`rebuildStructure()`:
```ts
function rebuildStructure() {
  const minIdx = GRADE_ORDER.indexOf(structureForm.value.minGrade);
  const maxIdx = GRADE_ORDER.indexOf(structureForm.value.maxGrade);
  if (minIdx === -1 || maxIdx === -1 || minIdx > maxIdx) return;
  const prevMap = new Map(structure.value.map((g) => [g.grade, g.rooms]));
  structure.value = GRADE_ORDER.slice(minIdx, maxIdx + 1).map((grade) => ({
    grade,
    rooms: prevMap.get(grade) ?? 1,
  }));
}
```

Rooms-per-grade table unchanged from current design.

`goToStep4()` calls `persistStructure()` then `next()`.

`maxGrade` from `structureForm` replaces the old `schoolForm.maxGrade` for promotion logic. `saveSetup` must also store `maxGrade` — add it back at persist time: `data.saveSetup({ ...schoolForm.value, maxGrade: structureForm.value.maxGrade })`.

---

## Step 4 — สรุปการตั้งค่า

Read-only summary panel. No editing — user clicks ย้อนกลับ to fix anything.

Sections:
1. **ข้อมูลโรงเรียน** — table of all school fields
2. **ปีการศึกษา** — year value
3. **โครงสร้างชั้นเรียน** — grade range (minGrade–maxGrade), then table: grade | rooms
4. Confirm button → `finish()` (calls `persistStructure()` + `emit('done')`)

---

## Removed

- `maxGrade` from `schoolForm` (moved to `structureForm`)
- `yearForm.term` ref and ภาคเรียน `<select>`
- Auto-guess callout in step 2
- Entire step 4 (นำเข้านักเรียนทีละห้อง): `importOpen`, `importGrade`, `importRoom`, `openImport`, `addErrors`, `studentForm`, `showAddForm`, `openAddForm`, `cancelAdd`, `submitStudent`, `roomCount`, `totalImported`
- `ImportDialog` import and component usage
- Old step 5 (done screen with hero + whatnext buttons)

---

## Store interface impact

`saveSetup` must accept `maxGrade`. Verify `data.saveSetup` signature allows it — if it already accepts arbitrary fields via spread, no change needed. If typed strictly, add `maxGrade: string` to the setup type.

---

## Out of scope

- Changing how ภาคเรียน is switched post-onboarding (SettingsView handles that)
- Student import (remains in StudentsView / SettingsView)
