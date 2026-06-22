# Progress Ledger — Phase 3 (Real App from Validated Prototype)

Plan: `docs/superpowers/plans/2026-06-20-phase3-real-app-from-prototype.md`
No git in project — "complete" = files written + relevant tests green + vue-tsc clean + reviewed.

- [x] Task 1: Measurement snapshot fields + period + setup flag (53/53 suite, tsc clean, review clean; test at tests/stores/data.test.ts, localStorage via vi.stubGlobal)
- [x] Task 2: Duplicate detection (findDuplicate; 9/9 data.test, tsc clean, verified)
- [x] Task 3: Roster aggregates for browse (structure/roomInfo/gradeInfo/roomStudents/searchStudents; 10/10, tsc clean, verified)
- [x] Task 4: Swap entry to real App shell (AppShell.vue ported + store-wired, main.ts swapped, build OK, shell verified on :5173)
- [x] Task 4A: Chart zone ↔ classification exactness (HARD, BRD §6.2) — charts.ts tension:0, HFA/WFA stepped:'middle'; invariant test 18/18; suite 73/73; verified zone===text, no divergence
- [x] Task 5: Onboarding / Setup (5-step) — OnboardingView ported+wired (saveSetup/setPeriod/addStudent), AppShell overlay wired, 5 steps walked to home, build OK
- [x] Task 6: Home dashboard — HomeView ported+wired (stats/structure/roomInfo), empty-states, verified on :5173
- [x] Task 7-9: StudentsView (browse+status+filter / profile + 3 real charts via charts.ts / registry CRUD + grade-confirm / measurement add-edit-delete + dup warn) — verified on :5173, charts non-blank, zone===text confirmed visually, label consistency spot-checked. Bundle 369kB (Chart.js).
- [x] Task 10: Measure room worklist + dup gate — MeasureView ported+wired (period-scoped status via findDuplicate, setPeriod on room enter, live calcNutrition, addMeasure w/ snapshot), Stepper→components, AppShell wired, defineEmits added. FIX: created src/journeys.css (was proto.css, prototype-only) + imported in main.ts — styles stepper/callout/overlay/period-chip across ALL real journey views. Verified on :5173.
- [x] Task 11-12: backup.ts + csv.ts + store (lastBackupAt/markBackup/backupOverdueDays/replaceAll) + SettingsView two-group ported+wired (backup/restore/export/import-route/reset/config). 92/92 tests, build 440kB. CSV = single sheet, type column, BOM.
- [x] Task 13: Promotion wizard + ops — promote.ts (planPromotion/applyPromotion) 11 TDD tests, PromotionView ported+wired (backup step, per-student override, required graduate export gate, year advance), AppShell overlay wired. 103 tests pass.
- [x] Task 14: Import wizard — ImportView ported+wired (parseImport/mergeImport, room list, skipped rows, merge counts), AppShell overlay wired. mergeImport uses real persisting store actions (adapter only bridges read-shape). 103 tests, build 422kB.
- [x] Task 15: Reports — summary.ts (5-bucket WFH from calcNutrition, ท้วม+เริ่มอ้วน collapsed) 8 TDD tests + toSummaryCsv, print.ts hidden-iframe, ReportsView ported+wired, AppShell wired. 111 tests, build 474kB.
- [x] Task 16: Final integration — deleted src/prototype/, App.vue, dead first-gen views (Registry/Charts/Setup/Dashboard). tsc clean, 111/111 suite (14 files), single inlined dist/index.html 432kB, no external network refs (offline), live app verified post-deletion. main.ts = AppShell only.

## Final whole-app review (review: phase3-final-review.md; fixes: phase3-fixes-report.md)
- §6.2 invariant CLEAN. Functional smoke PASS (clean gate → seeded → home/at-risk → reports → measure).
- Fixed: C-1 first-run restore wired (file input→parseBackup→replaceAll); C-2 measure date gate
  (block save on empty/invalid date); C-3 latest-status via canonical data.latest (not savedAt-only);
  I-1 no premature setPeriod on room tap; I-2 promotion delete-in-loop snapshot; I-3 import count
  split (students vs measures); I-5 promotion preview shows promote(grade); I-6 promotion rooms from
  structure; M-6 ท้วม→warn unified; M-7 dynamic year dropdown; M-8 print once; M-9 shell :inert on overlay.
- M-1 was a FALSE finding (badgeClass used by Badge.vue) — left intact.
- DEFERRED (accepted, not bugs/by-design): I-4 historical-round selector in profile add-measure
  (enhancement); I-7 findRef ±6mo tolerance (monthly table has 24mo row, harmless); M-2 Excel-measure
  import + M-3 import dup-management UI (intentional simplifications per plan); M-4/M-5 template
  function reactivity (not real — Vue re-runs on reactive re-render); M-10 onboarding step-3 local
  (structure derives from students by design).
- After fixes: tsc clean, 111/111 tests, build 433kB single-file offline.

## Post-review bug fixes (systematic-debugging)
- BUG: classroom structure not persisted/shown on นักเรียน. ROOT CAUSE: store `structure` derived
  only from `students`; onboarding step-3 was local-only (no store field) → declared-but-empty
  rooms vanished. FIX: added persisted `classrooms` (`ntr2_classrooms`) + `setClassrooms`;
  `structure` now merges declared classrooms ∪ student-derived; onboarding persists on step3→4;
  added Settings "โครงสร้างชั้นเรียน" editor (add/merge over time). TDD test added. Verified:
  นักเรียน shows declared empty rooms.
- BUG: only first name shown. FIX: HomeView greeting uses full `data.setup.teacher`.
- 112 tests, tsc clean, build 435kB.

## Classroom editor consistency
- Added `gradesUpTo(maxGrade)` to ladder.ts (TDD). Onboarding step-3 + Settings editor both
  generate grades from `setup.maxGrade` (no hardcoded list, no free-text rows); teacher sets only
  rooms-count; Settings layout matches onboarding (.mrow grade | number). Reverted a stray
  tsconfig lib ES2022 bump back to ES2017 (kept `.at()` out of src; test uses indexing) to preserve
  the old-tablet NFR-1.4 guarantee (vite target es2017). 113 tests, tsc clean, build 435kB.

## Excel standardization + I/O relocation
- File-format split locked: Backup/Restore = JSON (system state, Settings "การสำรองข้อมูล");
  teacher data exchange = .xlsx ONLY (SheetJS `xlsx`). CSV removed entirely (csv.ts deleted,
  toSummaryCsv removed). Added `src/domain/transfer/xlsx.ts` (templates, AOA builders, parse,
  merge) + `summaryToAoa` + `src/features/download.ts`.
- Excel I/O moved out of Settings into owning features: นักเรียน (import list / ดาวน์โหลดแม่แบบ /
  ส่งออกรายชื่อ at browse root), บันทึกการวัด (Excel measurement import + แม่แบบ), Promotion
  (graduate export .xlsx), Reports (summary export .xlsx). Settings Excel section deleted.
  Every import has a "ดาวน์โหลดแม่แบบ Excel".
- Bundle grew to ~862kB (gzip ~293kB) from SheetJS read+write — acceptable for offline single-file.
- 117 tests, tsc clean, build OK.

## Student import — per-classroom + preview + validation
- ImportView reworked to 4 steps: เลือกห้อง (grade+room) → เลือกไฟล์ (per-classroom template,
  STUDENT_CLASSROOM_HEADERS, no grade/room cols) → ตรวจสอบ (ALWAYS-shown preview) → เสร็จ.
- `parseStudentImport(aoa, {grade,room}, existingIds)` (TDD, 11 tests) → ImportPreviewRow[] +
  counts. Per-row plain-Thai issues: missing/non-numeric/dup id, missing name, bad DOB (via
  validateThaiDate), invalid gender (warn→default ชาย); existing id → 'update'. Preview table
  highlights error rows (bad-tint) + update rows (warn-tint), confirm imports valid only.
- 128 tests, tsc clean, build OK.

## Forgiving Excel dates
- `normalizeThaiDate(string|number|Date)` in thai-date.ts (13 TDD tests): Excel Date/serial, CE,
  ISO, Thai month names, 2-digit yr, ./- separators → canonical D/M/YYYY BE; calendar-invalid → null.
- readXlsxToAoa cellDates:true → date cells become Date → BE string. parse student dob + measure
  date run through normalize: auto-convert = warn 'ปรับรูปแบบวันที่ให้อัตโนมัติ' (not error); unreadable
  = plain error. parseStudentImport takes overrides Map → ImportView inline date input on error rows,
  live re-validate → flips ปัญหา→พร้อม. System template round-trips after Excel re-save. 141 tests, build ok.

## Measurement import parity
- `parseMeasureImport(aoa, period, students, hasDup, overrides?)` (8 TDD tests) → MeasureImportPreviewRow[]
  + counts (ok/dup/error). Orphan id, bad weight/height (rules.ts), forgiving date (normalizeThaiDate
  auto-convert warn), dup→skip. MeasureView Excel mode → preview table (highlight, status pills, plain
  issues, inline date fix, live re-validate), confirm saves ok rows via mergeMeasures. 149 tests, build ok.

## DOB date errors killed (2 root fixes)
- Source: `aoaToXlsxBlob(aoa, sheet, textCols?)` writes date columns as Excel TEXT (t:'s', z:'@') so
  Excel stops auto-converting → template round-trips. Applied col [3] to student/classroom/measure
  templates + roster/graduate export.
- UX: `ThaiDateField.vue` (วัน / เดือนไทย / ปีพ.ศ. selects, yearMin/Max props) emits canonical
  D/M/YYYY BE — no format to mistype. Wired into import inline fixes (student+measure), measure
  session date, student add/edit dob, measure add date. Removed native type=date/free-text.
- normalizeThaiDate BE-ISO confirmed (2558-03-15→15/3/2558, not 3101) + regression test. 151 tests.

## Birth-year window derived (no hardcode)
- Removed fixed พ.ศ. 2540–2590. validateThaiDate(str,isDob,periodYear?) → [periodYear−19,periodYear−2]
  (ages 2–18, 18yr2m incl), dynamic message. parseStudentImport + StudentsView/ImportView DOB pass
  +data.period.year; ThaiDateField DOB year range derived. 159 tests, build ok. No 2540/2590 in src.

## Profile PDF + 3 charts + mock data
- Backup now includes classrooms (serialize/parse/replaceAll + Settings/Promotion doBackup).
- mockdata/generate.mjs (deterministic) → mockdata/sample-school.json (132 students, 660 measures,
  9 grades/11 rooms, yrs 2567–2569 w/ historical grade snapshots, ~20% at-risk). Load via Settings →
  เปิดข้อมูลสำรอง. Full state restore.
- Profile: removed metric toggle → 3 charts stacked (WFH/HFA/WFA, zones+legend, animation:false).
  print.ts printHtml (iframe, Thai font, break-inside:avoid). "ออกรายงาน PDF" → personal info +
  latest assessment + 3 charts via canvas.toDataURL (NOT cloned) + full history table + criteria
  footer. 161 tests, invariant intact, build ~925kB.

## Per-classroom session + 4 official criteria
- MeasureView reordered: เลือกห้อง → ตั้งค่ารอบการวัด (sessYear/term/round/date, per-classroom, not
  global) → บันทึก → ตรวจทาน → เสร็จ (5 steps). All measure logic uses session refs; date via ThaiDateField.
- Four criteria always shown together (order: น้ำหนัก/อายุ wfa, ส่วนสูง/อายุ hfa, น้ำหนัก/ส่วนสูง wfh,
  สูงดีสมส่วน tall) — measure live + review + profile history (on-screen + PDF) + latest block. 161 tests, build ok.

## DOB as Day/Month/Year columns
- Student import/export DOB split → 3 numeric cols วันเกิด-วัน/เดือน/ปี(พ.ศ.) (no Excel date-mangling).
  STUDENT_HEADERS + classroom headers + templates + studentsToAoa + parseStudentImport updated. 167 tests.

## Measure flow simplify + promotion search
- MeasureView: removed นำเข้า Excel from room-select; collapsed ตั้งค่ารอบ into inline editable context
  bar on record screen (defaults incl วันที่=todayThai, nothing gated); Import Excel + ดาวน์โหลดแม่แบบ
  on record screen. Stepper back to 4 (เลือกห้อง/บันทึก/ตรวจทาน/เสร็จ).
- PromotionView ปรับรายคน: replaced full-school list with search-by-ID(+name) → per-student override;
  "ปรับแล้ว N คน" review list; summary reflects overrides. 167 tests, build ok.

## Notes / minor findings
- T3: `roomInfo.measured` / `gradeInfo.measured` count students with ANY measurement
  (global `latest`), not current-period-scoped. Acceptable now; period-scope the
  "measured this round" count in T10 (Measure worklist) and reuse for T7 browse status.

## Import samples + measure upsert + authoritative classrooms (2026-06-22)
- Measure upsert: one record per (student,year,term,round). `data.upsertMeasure`; `mergeMeasures` overwrites (added/updated/orphans); manual saveAll no longer appends dup; xlsx preview status `dup`→`update`. MeasureView + ImportView + ImportView wired.
- Classroom structure now authoritative: 0-room grade excluded everywhere; student-derived union only as fallback when no classrooms configured. `classroomRemovalBlockers` blocks dropping a grade/room that still holds students (Settings warns).
- Onboarding: Excel-primary per-room (template + import + inline preview), manual secondary, skippable + add-later copy.
- Students classroom list: 📄 นำเข้า Excel beside เพิ่มนักเรียน; opens ImportView pre-seeded to that room (AppShell go payload + ImportView `initial` prop).
- mockdata/import-samples/: roster+measure .xlsx for ป.1/1, ป.1/2, ป.2/1 (IDs 90001+, consistent) + README; generate.mjs writeImportSamples().
- Tests 174 green (added upsert/structure/removal-blocker store tests + mergeMeasures upsert tests).

## Critique fixes — overwrite reassurance + re-measure UX (2026-06-22)
- P1 overwrite vocabulary unified to "บันทึกทับของเดิม" across manual gate / Excel preview / done screens; added "เก็บเฉพาะผลล่าสุดต่อรอบ ไม่เพิ่มซ้ำ" reassurance.
- P2 re-measure room UX: calm teal room-level banner (dupCount) instead of wall of amber; per-row tag demoted warn→brand-tint "มีค่าเดิม"; Excel update row tint/pill → neutral/brand.
- P2 pill-stretch on room-select list fixed (`.room-row .pill{justify-self:start}` — grid item blockify/stretch).
- P3 .ctx-label uppercase/letter-spacing removed.
- Riley: parseMeasureImport now warns on intra-file duplicate ids (last-row-wins). +1 test → 175 green.
- NOTE deferred: import preview <table> kept (scroll fallback ok); not converted to .mrow grid.

## Modal import + Measure round-card layer (2026-06-22)
- New shared `src/components/Dialog.vue`: native <dialog>, backdrop+blur, Esc/backdrop close (controlled), focus trap, prefers-reduced-motion, mobile full-screen.
- AppShell: full-school Excel import moved from full-screen overlay → Dialog modal over dimmed screen; onboarding + promotion stay full-page.
- MeasureView redesign: added "เลือกรอบ" step — ครั้งที่ 1/2 as cards (status pill per round) + date, no dropdowns. Record screen now read-only context summary + "แก้รอบ/วันที่" link; year/term read-only (system-wide). All record actions bottom-only (consistent). Steps now 5: เลือกห้อง→เลือกรอบ→บันทึกการวัด→ตรวจทาน→เสร็จสิ้น. 4 criteria preserved.
- Students room list: per-room "นำเข้า Excel" now inline (file picker → inline preview → confirm), no wizard restart. Root/full-school import still uses the modal.
- 175 tests green, build ok.

## Standardized Excel import (2026-06-22)
- New `src/components/ImportDialog.vue`: single reusable flow for student+measure imports — (optional room pick) → download template + pick file → parse/validate → preview summary (ห้อง · เพิ่มใหม่ · อัปเดต · มีปัญหา) + error rows + inline date fix → confirm → done. Wraps Dialog.vue.
- Wired everywhere: MeasureView (kind=measure; Import+Template moved to เลือกรอบ session-info area, removed from bottom bar; in-stepper excel path + xlsx state deleted), StudentsView per-room, AppShell root/full-school (kind=student, room picker when none), OnboardingView per-room (subagent).
- Deleted `src/features/ImportView.vue` (replaced by ImportDialog).
- 175 tests green, build ok. E2E verified: roster-ป.1-1.xlsx → preview "เพิ่มใหม่ 13 · อัปเดต 0 · มีปัญหา 0".

## Classroom-context actions + import dialog redesign (2026-06-22)
- StudentsView: removed top-level Import/Template/Export toolbar. Moved into the classroom (room) view as 3 action cards with descriptions: นำเข้ารายชื่อนักเรียน / ดาวน์โหลดแม่แบบ Excel / ส่งออกรายชื่อนักเรียน (room-scoped: downloadRoomTemplate, exportRoom). Top-level student page now = find/select classroom only.
- ImportDialog redesign (impeccable): teal context header; cohesive numbered 2-step workflow (1 download template → 2 choose file); prominent drag-and-drop dropzone (processFile/onDrop, dragging state) with standout primary "เลือกไฟล์จากเครื่อง"; preview header shows filename + stat chips (เพิ่มใหม่/อัปเดต/มีปัญหา).
- 175 tests green, build ok. Verified: room action cards in ป.1/2, redesigned pick stage.

## MeasureView: wizard → data table (2026-06-22)
- Replaced 5-step stepper (เลือกห้อง→เลือกรอบ→บันทึก→ตรวจทาน→เสร็จ) with 2 surfaces: room list → one data-table screen. Removed Stepper.
- Table prefills the selected round's existing measurements (น้ำหนัก/ส่วนสูง) + ✓วัดแล้ว badge + วัดเมื่อ date + live 4-criteria assessment, so teachers SEE that round's results, not just blank inputs.
- Round selector = segmented tabs (ครั้งที่ 1 | 2 with count), switching reloads that round's data. วันที่วัด inline. Import/Template in sticky save bar.
- Direct edit + single save (dirty rows only, upsert); dirty inputs highlighted; toast on save. No review/done wizard steps. Date error gates save.
- 175 tests green, build ok. Verified: ครั้งที่ 1 prefilled w/ results, ครั้งที่ 2 empty.

## Wider tables — profile history 4 cols + measure inputs (2026-06-22)
- StudentsView root widened: .container.students-wide max-width 1180 so the profile history (10 cols incl 4 separate criteria) fits without horizontal scroll.
- MeasureView table: น้ำหนัก/ส่วนสูง input columns 72→96px (values no longer clip); min-width 920.
- proto-wide already 1180 (measure). build ok, 175 tests.

## Measure: Excel actions → top cards (2026-06-22)
- Moved ดาวน์โหลดแม่แบบ + นำเข้าผลการวัด from bottom save bar to top action cards (with descriptions), matching StudentsView room pattern. Save bar keeps only บันทึก. build ok, 175 tests.
