# MeasureView: collapse session config into the record screen; Excel actions belong there

Two fixes (impeccable-reviewed flow):
1. Remove "นำเข้า Excel" from the เลือกห้อง (room-select) page — that page only picks a classroom.
2. Collapse the separate "ตั้งค่ารอบการวัด" step into an INLINE, editable context bar on the
   measurement screen, with sensible defaults so nothing is gated/disabled. Import Excel + Download
   Template live on that measurement screen (they belong to the session).

## Global constraints
- `noUnusedLocals`. No git. No server start/kill (:5173). Editor tools only, no heredoc/echo.
- Labels only from `calcNutrition`. Four criteria stay (น้ำหนัก/อายุ, ส่วนสูง/อายุ, น้ำหนัก/ส่วนสูง, สูงดีสมส่วน).

## Files
- Modify: `src/features/MeasureView.vue`

## Target flow
Stepper (both modes): `['เลือกห้อง','บันทึกการวัด','ตรวจทาน','เสร็จสิ้น']`.

### step 0 — เลือกห้อง
- Room list ONLY (cards/rows). Click a room → go to step 1. Remove the per-row "นำเข้า Excel" link
  and any round/date config here.

### step 1 — บันทึกการวัด · <ห้อง>  (record screen, session inline)
- Top: a compact **context bar** (inline, editable, NOT a separate step, NOT gated):
  ปีการศึกษา (default `data.period.year`), ภาคเรียน (select, default `data.period.term`),
  ครั้งที่วัด (select, default '1'), วันที่วัด (`ThaiDateField`, default `todayThai()` so it's valid
  immediately). Show it as a single readable line/row the teacher can tweak; no "ถัดไป" gate.
- Action row: **ตรวจทานก่อนบันทึก** (primary), **นำเข้า Excel** (secondary), **ดาวน์โหลดแม่แบบ Excel**
  (quiet → `downloadBlob(aoaToXlsxBlob(measureTemplateAoa(),'ผลการวัด'),'แม่แบบผลการวัด.xlsx')`).
- Manual entry table below (as today): per-student weight/height + live 4-criteria results; dup gate
  using the inline session values (`data.findDuplicate(id, sessYear, sessTerm, sessRound)`).
- **นำเข้า Excel** click → switch to the Excel import path for THIS session: file picker (.xlsx) →
  `readXlsxToAoa` → `parseMeasureImport(aoa, {year:sessYear,term:sessTerm,round:sessRound}, ...)` →
  show the measure preview (reuse existing preview UI) as step 2 (ตรวจทาน) → confirm `mergeMeasures`.
- Keep session refs `sessYear/sessTerm/sessRound/sessDate` (default as above on entering step 1).
  `sessDate` must default to `todayThai()` (valid) so review/import isn't blocked; still validate on
  change (show inline error only if the teacher clears/breaks it).

### step 2 — ตรวจทาน
- Manual: the 4-criteria review table (as today). Excel: the measure import preview. Confirm → save.

### step 3 — เสร็จสิ้น
- Done summary (saved count). "วัดห้องอื่น" → back to step 0.

## Verify
- `npx vue-tsc --noEmit` clean; `npm test` green; `npm run build` ok.
- On :5173 (mock data): บันทึกการวัด → pick a room → land directly on the record screen with the
  context bar prefilled (today's date, no disabled buttons); can type weights immediately; นำเข้า Excel
  + แม่แบบ present here, NOT on the room list. Screenshots `.playwright-mcp/measure-record-inline.png`,
  `.playwright-mcp/measure-roomlist.png`.

## Report contract
Write full report to `docs/superpowers/briefs/phase3-measure-flow-simplify-report.md`. Return short summary + status.
