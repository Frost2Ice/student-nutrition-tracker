# Phase 3 Task 5 Report — Onboarding / Setup (5-step) wired

## Status: DONE

## What was done

### Files created
- `src/features/OnboardingView.vue` — Full port of `src/prototype/OnboardingJourney.vue` template/style, wired to the Pinia `useData` store.

### Files modified
- `src/AppShell.vue` — Added `import OnboardingView from './features/OnboardingView.vue'`; replaced the `overlay === 'onboarding'` placeholder `<div>` with `<OnboardingView @done="closeOverlay(); dest = 'home'" @exit="closeOverlay" />`.

### Files NOT deleted
- `src/features/SetupView.vue` — Kept in place. `src/App.vue` imports and renders it for the `tab === 'setup'` route. Deleting it would break the build.

---

## Wiring details

### Step 1 — ข้อมูลโรงเรียน
- Local `schoolForm` ref holds all 8 `Setup` fields (`school`, `ministry`, `department`, `subdistrict`, `district`, `province`, `teacher`, `maxGrade`).
- On "ถัดไป": calls `data.saveSetup(schoolForm)` — this sets `isSetup` to `true` (since `school` is non-empty) and persists to localStorage. Step advances to 2.

### Step 2 — ปีการศึกษา
- Local `yearForm` ref with `year` and `term` fields (defaults to `2569` / `1`).
- On "ถัดไป": calls `data.setPeriod({ year, term, round: '1' })` — round defaults to `'1'` as specified.

### Step 3 — โครงสร้างชั้นเรียน (LOCAL UI ONLY)
- Local `structure` ref (array of `{ grade, rooms }`) initialised with the same default grades as the prototype's `STRUCTURE` mock.
- No store field exists for class structure; the store derives `structure` as a computed from added students. Declared-but-empty rooms do **not persist** until they have at least one student.
- The step is used to drive which grade/room rows appear in the step-4 per-room add UI.

### Step 4 — นำเข้านักเรียน (per room)
- Each row in the structure grid shows count of students in that room from the store.
- Clicking "เพิ่มนักเรียน" opens an inline form (id, firstName, lastName, dob, gender, grade, room pre-filled).
- Validation:
  - `id` must be non-empty and not duplicate an existing `data.students` id.
  - `dob` validated via `validateThaiDate(dob, true)` from `src/domain/validation/rules.ts`.
  - `firstName`, `lastName`, `grade`, `room` must be non-empty.
- On success: calls `data.addStudent({...})` with a valid `Student` object.

### Step 5 — พร้อมใช้งาน
- Shows total students imported from `data.students.length`.
- Both "เริ่มบันทึกการวัด" and "ไปหน้าหลัก" emit `done` → AppShell closes overlay and sets `dest = 'home'`.

### AppShell `@done` handler
- `closeOverlay()` sets `overlay = null`.
- `dest = 'home'` ensures the shell lands on the home tab.
- By the time `done` is emitted, `saveSetup` and `setPeriod` have already been called (in steps 1 and 2 respectively), so `isSetup` is `true` and the shell renders.

---

## Verification

### Type-check
```
npx vue-tsc --noEmit  →  (no output, exit 0)
```

### Build
```
npm run build  →  dist/index.html  126.42 kB │ gzip: 49.37 kB  ✓ built in 381ms
```

### Browser walkthrough (http://localhost:5173)
1. Cleared localStorage via `localStorage.clear()` + reload — welcome screen appeared.
2. Clicked "เริ่มใช้งานครั้งแรก" — onboarding overlay opened with stepper at step 1.
3. Filled school form (school = "โรงเรียนบ้านทดสอบ", etc.) → clicked "ถัดไป: ปีการศึกษา".
4. Step 2 defaults (2569, ภาคเรียน 1) accepted → clicked "ถัดไป: โครงสร้างชั้นเรียน".
5. Step 3 structure grid displayed → clicked "ถัดไป: นำเข้านักเรียน".
6. Step 4 per-room grid displayed → clicked "เสร็จสิ้นการตั้งค่า" (0 students added, valid per brief).
7. Step 5 "พร้อมใช้งานแล้ว!" displayed — stepper showed ✓ on all 4 prior steps.
8. Clicked "เริ่มบันทึกการวัด" — overlay closed, landed on home shell.
9. Sidebar showed "โรงเรียนบ้านทดสอบ" confirming `saveSetup` was persisted.
10. Screenshot saved to `.playwright-mcp/p3-t5-onboarding.png`.

---

## Notes / Concerns

- **SetupView.vue not deleted**: `src/App.vue` imports it. Brief says "remove only if nothing imports it — grep first". Left in place; noted here.
- **Declared-but-empty rooms**: Step 3 structure is local UI state only. Rooms defined there but with no students added will not appear in the store's `structure` computed (which derives from actual students). This is per spec and noted in the brief requirement.
- **Stepper inlined**: The prototype imports `./Stepper.vue` from the prototype directory. To keep `OnboardingView.vue` self-contained in `src/features/` without a cross-directory prototype import, the stepper markup was inlined directly in the template. The rendered output is identical.
