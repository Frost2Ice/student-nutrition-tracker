# Task 15 — Reports (agency document) + summary CSV + PDF

Part of Phase 3. The agency-facing Reports screen: one summary document, exportable as PDF
(hidden iframe) and summary CSV. Reports emits documents ONLY (no raw data files).

## Global constraints (HARD)
- `noUnusedLocals`. No git. No server start/kill (:5173). Editor tools only, no heredoc/echo.
- UX parity: port prototype `<template>`/`<style>` verbatim; do not redesign.
- ALL classification via `calcNutrition` (engine) — the report buckets are derived from engine
  WFH labels, never re-computed. Source/criteria footer: สำนักโภชนาการ กรมอนามัย, B.E. 2564.
- PDF via hidden iframe, offline/system fonts (FR-11.1/11.3) — no popup window.

## Files
- Create: `src/domain/report/summary.ts` + `tests/report/summary.test.ts`
- Create: `src/features/print.ts` (hidden-iframe print helper)
- Create: `src/features/ReportsView.vue` (port `src/prototype/ReportsView.vue`)
- Modify: `src/AppShell.vue` (render `ReportsView` for `dest === 'reports'`, replace placeholder)

## What exists now (read first)
- `src/prototype/ReportsView.vue` — year+term filter, document preview (school header, coverage,
  WFH category table per grade-band + % row, สูงดีสมส่วน, §6.3 notice, criteria footer),
  PDF + CSV buttons. Uses mock `REPORT_SUMMARY/WFH_CATEGORIES/CRITERIA`.
- `src/domain/nutrition/engine.ts`: `calcNutrition` → `{ wfh, wfa, hfa, tall, ... }`. WFH labels:
  ผอม, ค่อนข้างผอม, สมส่วน, ท้วม, เริ่มอ้วน, อ้วน.
- `src/domain/nutrition/latest.ts`: `latestPerStudent(measures)`.
- `src/stores/data.ts`: `students`, `measures`, `setup`, `period`.

## Domain — summary.ts (TDD)
- 5 report buckets (map engine WFH labels): `['ผอม','ค่อนข้างผอม','สมส่วน','ท้วม/เริ่มอ้วน','อ้วน']`
  where `ท้วม`+`เริ่มอ้วน` collapse into bucket index 3, `อ้วน` → index 4.
- `summarize(students, measures, year, term): { measured: number; enrolled: number;
  byGrade: { grade: string; counts: number[]; tall: number }[]; tall: number }`
  - Consider only measurements with matching `year`+`term`; take each student's latest within
    that period (`latestPerStudent` on the filtered list). `measured` = count of students with
    such a measurement that `calcNutrition` can classify; `enrolled` = `students.length`.
  - `byGrade` grouped by the student's CURRENT grade (BRD §6.3), `counts` = 5-bucket tallies,
    `tall` = count where `calcNutrition().tall` is true. Top-level `tall` = sum.
- `toSummaryCsv(setup, summary, year, term): string` — school name + location + per-bucket
  counts and percentages (FR-8.2), Excel-openable.
- Test (from plan Task 15): one student with one matching measurement → `measured === 1`, and
  the byGrade bucket totals sum to 1.

## print.ts
- `printElement(el: HTMLElement): void` — clone the element's HTML into a hidden `<iframe>`
  (no new window), copy the page's styles (or inline minimal CSS), call the iframe's
  `print()`, then clean up. Must not require popup permission (FR-11.1/11.2).

## ReportsView wiring
- Port template/style verbatim; bind data from `summarize(data.students, data.measures, year, term)`;
  CRITERIA footer text stays. PDF button → `printElement(documentEl)`; CSV → download `toSummaryCsv`.
- Year/term filter local; default to `data.period`.
- AppShell: render `ReportsView` for `dest==='reports'`, replace placeholder.

## Verify
- `npx vue-tsc --noEmit` clean; `npm test` green (incl summary tests); `npm run build` ok.
- On :5173: Reports shows the document from real data; PDF opens the print dialog via iframe
  (no popup); CSV downloads. Screenshot `.playwright-mcp/p3-t15-reports.png`.

## Report contract
Write full report to `docs/superpowers/briefs/phase3-task-15-report.md`. Return short summary + status.
