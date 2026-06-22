# Measure: per-classroom session config + always show the four official criteria

## Global constraints
- `noUnusedLocals`. No git. No server start/kill (:5173). Editor tools only, no heredoc/echo.
- Labels ONLY from `calcNutrition`. Don't break the charts-consistency test.
- The four official criteria, in THIS order, always shown together (never combined):
  1. **น้ำหนัก/อายุ** = `r.wfa`  2. **ส่วนสูง/อายุ** = `r.hfa`  3. **น้ำหนัก/ส่วนสูง** = `r.wfh`
  4. **สูงดีสมส่วน** = `r.tall ? 'สูงดีสมส่วน' : 'ไม่สมส่วน'`.
  Colours: wfa/hfa/wfh via the existing class maps; สูงดีสมส่วน → good if tall else warn.

## Part 1 — MeasureView.vue: classroom → session → record
Reorder so the measurement context belongs to the classroom's session (rooms aren't all measured
the same day).

New steps (Stepper):
- manual: `['เลือกห้อง','ตั้งค่ารอบการวัด','บันทึกการวัด','ตรวจทาน','เสร็จสิ้น']`
- excel: `['เลือกห้อง','ตั้งค่ารอบการวัด','นำเข้าไฟล์','ตรวจ/แก้','เสร็จสิ้น']`

Session refs (replace the global `data.period` usage in this view):
`sessYear` (default `data.period.year`), `sessTerm` (default `data.period.term`), `sessRound`
(default `'1'`), `sessDate` (''). Use these everywhere measurements are built, the dup check, and
`periodLine`.

- **step 0 เลือกห้อง**: room list only (click a room → set picked room + `mode='manual'` → step 1).
  Keep an "นำเข้า Excel" affordance per room that sets `mode='excel'` → step 1. Remove the
  year/round/date config from this step.
- **step 1 ตั้งค่ารอบการวัด**: show the picked ห้อง; fields **ปีการศึกษา** (default sessYear),
  **ภาคเรียน** (select 1/2), **ครั้งที่วัด** (select 1/2), **วันที่วัด** (`ThaiDateField`, year range
  ~sessYear−1…sessYear+1). "ถัดไป" disabled until date valid (`validateThaiDate(sessDate,false)`).
  Back → step 0.
- **step 2 record/import**: manual entry rows OR excel upload, using the session values.
  Manual live result per row must show ALL FOUR criteria (order above), not 3.
  dup check uses `data.findDuplicate(id, sessYear, sessTerm, sessRound)`.
- **step 3 review/preview**: manual review is the results table — show the FOUR criteria columns
  (น้ำหนัก/อายุ, ส่วนสูง/อายุ, น้ำหนัก/ส่วนสูง, สูงดีสมส่วน) per student. (Excel preview keeps its
  validity columns.)
- **step 4 done**.
- Saves build `Measurement` with sessYear/sessTerm/sessRound/sessDate, snapshot grade/room, savedAt.

## Part 2 — StudentsView.vue: four-criteria history (on-screen + PDF)
- On-screen measurement history table: replace the 2 result columns (น้ำหนัก/ส่วนสูง + สูงดีสมส่วน)
  with the FOUR columns in order: น้ำหนัก/อายุ, ส่วนสูง/อายุ, น้ำหนัก/ส่วนสูง, สูงดีสมส่วน — each a
  pill from `calcNutrition` of that row. Keep ปี/ภาค/ครั้ง, วันที่, ชั้น, นน., สส., and the row
  edit/delete actions.
- PDF history table (`exportPdf` HTML): same four columns (text, no pills needed) in the same order.
- Latest-assessment block already shows the four pills — keep; ensure order matches (wfa, hfa, wfh,
  สูงดีสมส่วน). Add small helpers `rowWfa/rowHfa/...` + class fns as needed (reuse `nutritionCls`).

## Verify
- `npx vue-tsc --noEmit` clean; `npm test` green; `npm run build` ok.
- On :5173 (mock data loaded): บันทึกการวัด → pick a room → ตั้งค่ารอบ (year/term/round/date) →
  record: live results show 4 criteria; review shows 4 columns. Open a profile: history table shows
  the 4 criteria columns; Export PDF history shows 4 columns. Screenshots
  `.playwright-mcp/measure-session.png`, `.playwright-mcp/measure-4crit.png`,
  `.playwright-mcp/profile-4crit.png`.

## Report contract
Write full report to `docs/superpowers/briefs/phase3-measure-session-4crit-report.md`. Return short
summary + status.
