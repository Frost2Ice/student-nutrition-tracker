# Task 15 — Reports Implementation Report

## Status: DONE

## Files Created

- `src/domain/report/summary.ts` — domain module: `summarize()`, `toSummaryCsv()`, `WFH_BUCKET_LABELS`
- `tests/report/summary.test.ts` — 8 TDD tests (written before implementation, all pass)
- `src/features/print.ts` — `printElement()` hidden-iframe print helper
- `src/features/ReportsView.vue` — full Reports view, prototype ported verbatim

## Files Modified

- `src/AppShell.vue` — added `import ReportsView` + wired `dest === 'reports'` branch, replacing the placeholder

## Implementation Notes

### summary.ts

- 5 WFH buckets: `ผอม | ค่อนข้างผอม | สมส่วน | ท้วม/เริ่มอ้วน | อ้วน`
- `ท้วม` and `เริ่มอ้วน` both collapse into bucket index 3 via a `wfhBucket()` switch
- `summarize()` filters measures to `year+term`, takes `latestPerStudent()` on the filtered set, calls `calcNutrition()` for each student (never re-classifies), groups by student's current grade (BRD §6.3), sorts by `GRADE_ORDER`
- `toSummaryCsv()` produces UTF-8 BOM CSV (Excel-openable) with school name, province, per-bucket counts and percentages, criteria footer

### print.ts

- Clones element HTML into a hidden `<iframe>` (position fixed, off-screen)
- Copies all `<style>` and `<link rel="stylesheet">` nodes from the page so CSS variables and system fonts render correctly
- Calls `iframe.contentWindow.print()` — no popup window (FR-11.1/11.3)
- Cleans up iframe after 1 second delay

### ReportsView.vue

- Template/style ported verbatim from `src/prototype/ReportsView.vue`
- Replaces mock `REPORT_SUMMARY/WFH_CATEGORIES/SCHOOL/CRITERIA` with real bindings:
  - `summary` computed from `summarize(data.students, data.measures, year, term)`
  - `WFH_CATEGORIES` derived from `WFH_BUCKET_LABELS`
  - `data.setup.school` / `data.setup.province` for school header
  - `CRITERIA` constant with correct attribution text
  - `today` computed in Thai Buddhist-era format
- PDF button → `printElement(documentEl.value)`
- CSV button → `toSummaryCsv()` → Blob download

## Verification

- `npm test`: 111 tests passed (14 test files), including all 8 new summary tests
- `npx vue-tsc --noEmit`: clean (no errors)
- `npm run build`: single-file `dist/index.html` built successfully (474.59 kB)
- Browser: Reports view renders at http://localhost:5173 with real data; screenshot saved to `.playwright-mcp/p3-t15-reports.png`

## Constraints Honoured

- All classification via `calcNutrition()` engine — no re-computation in report layer
- Criteria footer: สำนักโภชนาการ กรมอนามัย พ.ศ. 2564
- No popup window (hidden iframe)
- No server started/killed
- No git operations
- No heredoc/echo file writes
- `noUnusedLocals` — all imports used
