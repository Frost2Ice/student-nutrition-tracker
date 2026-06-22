# Phase 3 — Student Profile: 3 Stacked Growth Charts + Export PDF
## Implementation Report

**Date:** 2026-06-21
**Status:** DONE

---

## What Was Implemented

### 1. print.ts — `printHtml` function added

Added `export function printHtml(innerHtml: string, title: string): void` to
`src/features/print.ts`. Uses a hidden iframe (same mechanism as `printElement`).
Writes a full HTML document with:
- Thai font stack: `'Sarabun','Leelawadee UI','Tahoma',sans-serif`
- `@page { margin: 18mm 16mm }` for clean page margins
- Clean table borders (`border-collapse: collapse`, alternating row tint)
- `break-inside: avoid` on `.section`, `.chart-img` to prevent page-breaks inside charts
- One-shot guard (`printed` boolean) same as `printElement`
- `printElement` preserved unchanged (still used by other features)

### 2. StudentsView.vue — 3 stacked charts (replaced metric toggle)

Removed:
- `ChartMetric` type
- `metric` ref
- `METRICS` array
- The segmented `.seg` toggle buttons in the template and their CSS

Added:
- Three always-visible `<div class="chart-card">` containers, stacked vertically
- Each card: a heading (`น้ำหนักตามเกณฑ์ส่วนสูง (WFH)` / `ส่วนสูงตามเกณฑ์อายุ (HFA)` /
  `น้ำหนักตามเกณฑ์อายุ (WFA)`), a 280px canvas inside a `position:relative` wrapper
- `.chart-card` / `.chart-heading` CSS for card framing (border, shadow, spacing)
- All three `<canvas>` elements always rendered and visible; Chart.js can size them correctly
- Charts destroy/recreate on student change via existing `renderCharts()` / `watch(open, ...)` logic
- `animation: false` already set in `charts.ts` `baseOpts` — unchanged

### 3. StudentsView.vue — Export PDF button + `exportPdf()` function

Added `import { printHtml } from './print'` to the script.

Added `exportPdf()` function that builds an HTML string with:
- **Personal info**: name, รหัส, เพศ, วันเกิด, อายุ (via `getAgeMonths` + `todayThai()`),
  ชั้นปัจจุบัน, criteria line (กรมอนามัย พ.ศ. 2564)
- **Latest nutrition assessment**: wfh, wfa, hfa, สูงดีสมส่วน pills from `calcNutrition`
  of `latestMeasure`
- **Growth charts**: `canvas.toDataURL('image/png')` from all three on-screen canvases
  embedded as `<img>` — NOT cloned canvases (which would be blank)
- **Measurement history table**: all measurements newest-first with columns
  ปี/ภาค/ครั้ง, วันที่, ชั้น, น้ำหนัก, ส่วนสูง, น้ำหนัก/ส่วนสูง (wfh label), สูงดีสมส่วน —
  `calcNutrition` called per row
- **Footer**: criteria source (กรมอนามัย พ.ศ. 2564 / REF-8.2)

Button "🖨️ ออกรายงาน PDF" added to `.prof-actions` in the profile header.

### 4. On-screen history table

Existing table already showed all measurements newest-first (sorted by year/term/round/savedAt desc).
Columns already matched the PDF requirement. Edit/delete row actions preserved on screen only (not in PDF HTML).

---

## Verification

### Tests
- `npx vue-tsc --noEmit` — clean (0 errors)
- `npm test` — 161 tests passed (14 test files), including `tests/features/charts-consistency.test.ts` (18 tests — zone↔label invariant intact)
- `npm run build` — clean build, 925 kB single-file dist/index.html

### Screenshots (Playwright, ป.6/1 — วรวุฒิ รักดี, multi-year history)

- `.playwright-mcp/profile-3charts.png` — full page showing all 3 growth charts stacked with colored zone bands and the student's measurement trend dots
- `.playwright-mcp/profile-pdf.png` — PDF report preview div showing: student header, WFH/HFA/WFA chart images from `toDataURL` (non-blank, verified: 125 kB / 115 kB / 103 kB respectively)

Canvas `toDataURL` lengths confirmed non-zero/non-blank before screenshot was taken.

---

## Files Modified

- `src/features/print.ts` — added `printHtml` export (prepended before `printElement`)
- `src/features/StudentsView.vue` — removed metric toggle, added 3 stacked chart cards, added `exportPdf()`, added Export PDF button, added `.chart-card`/`.chart-heading` CSS, removed `.seg` CSS
