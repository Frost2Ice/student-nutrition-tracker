# Student profile: 3 stacked growth charts + Export PDF

## Global constraints
- `noUnusedLocals`. No git. No server start/kill (:5173). Editor tools only, no heredoc/echo.
- Charts MUST use `src/features/charts.ts` (`buildWfh/buildHfa/buildWfa`) — reference zones from the
  engine tables, `animation:false`. Don't break the §6.2 zone↔label invariant or its test.
- Labels only from `calcNutrition`.

## Files
- Modify: `src/features/StudentsView.vue` (profile section)
- Modify: `src/features/print.ts` (add an HTML-string print path)

## 1. Show all three charts on one page (remove tabs/toggle)
- In the profile, replace the metric toggle with all three charts rendered together, stacked
  vertically: **น้ำหนักตามเกณฑ์ส่วนสูง (WFH)**, **ส่วนสูงตามเกณฑ์อายุ (HFA)**, **น้ำหนักตามเกณฑ์อายุ (WFA)**.
- Each chart: its own `<canvas>` + a heading + the zone legend (charts.ts already provides legend
  datasets). Give each a consistent height (e.g. 260–300px), card framing, and spacing so it reads
  like an official growth-chart sheet. Keep them legible (axis titles, gridlines).
- Instantiate 3 `Chart` instances; destroy/recreate on student change; `animation:false`.

## 2. print.ts — HTML print path
- Add `export function printHtml(innerHtml: string, title: string): void` — hidden iframe (reuse the
  existing mechanism), write a full document: `<title>`, minimal inline print CSS (system Thai font
  stack 'Sarabun','Leelawadee UI','Tahoma'; clean table borders; page margins; avoid page-break
  inside a chart/section via `break-inside: avoid`), then `innerHtml`. Print once (keep the existing
  printed-once guard). Keep `printElement` if still used elsewhere.

## 3. Export PDF button on the profile
- Add a button "🖨️ ออกรายงาน PDF" in the profile header actions.
- On click build the report HTML string and call `printHtml(html, 'รายงานนักเรียน <name>')`:
  - **Personal info**: name, รหัส, เพศ, วันเกิด, อายุ (getAgeMonths → ปี/เดือน), ชั้นปัจจุบัน,
    school name + criteria line (กรมอนามัย พ.ศ. 2564).
  - **Latest nutrition assessment** (from `calcNutrition` of latest measure): the 4 results
    (wfh/wfa/hfa/สูงดีสมส่วน) as labeled text.
  - **Growth charts**: convert each on-screen chart `<canvas>` to an image via
    `canvas.toDataURL('image/png')` and embed as `<img>` (cloning a canvas yields a BLANK canvas, so
    you MUST use toDataURL images in the print HTML — do not clone the canvases).
  - **Measurement history**: a clear table (timeline) of ALL measurements, newest first:
    ปี/ภาค/ครั้ง, วันที่, ชั้น(ณ เวลาวัด), น้ำหนัก, ส่วนสูง, ผล (wfh) , สูงดีสมส่วน. Use `calcNutrition`
    per row for the labels.
  - Footer: criteria source/version (REQ-8.2).
- Ensure charts are rendered before reading toDataURL (they are, on the visible profile).

## 4. History table on screen
- The on-screen history is already a table; ensure it shows ALL measurements newest-first with the
  same columns as the PDF (timeline/table). Keep the existing edit/delete row actions on screen
  (NOT in the PDF).

## Verify
- `npx vue-tsc --noEmit` clean; `npm test` green; `npm run build` ok.
- On :5173 with the loaded mock data, open a ป.6 student with multi-year history: all 3 charts show
  with zones + the student's trend; Export PDF opens the print dialog with personal info, the 3
  charts as images (NOT blank), and the full history table. Screenshots
  `.playwright-mcp/profile-3charts.png` and `.playwright-mcp/profile-pdf.png` (the print preview or
  the built report element).

## Report contract
Write full report to `docs/superpowers/briefs/phase3-profile-pdf-report.md`. Return short summary + status.
