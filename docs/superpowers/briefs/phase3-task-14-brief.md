# Task 14 — Import wizard (per-classroom) wired

Part of Phase 3. Port the prototype Import journey and wire it to the CSV pipeline (Task 12).

## Global constraints (HARD)
- `noUnusedLocals`. No git. No server start/kill (:5173). Editor tools only, no heredoc/echo.
- UX parity: port prototype `<template>`/`<style>` verbatim; do not redesign.
- Import = MERGE via `mergeImport` (add new, update existing, skip duplicate measurements,
  count orphans). Validation of measurement rows is already inside `parseImport` (rules.ts).

## Files
- Create: `src/features/ImportView.vue` (port `src/prototype/ImportJourney.vue`)
- Modify: `src/AppShell.vue` (render `ImportView` for `overlay === 'import'`, replace placeholder)

## What exists now (read first)
- `src/prototype/ImportJourney.vue` — steps: เลือกห้อง → เลือกไฟล์ → ตรวจ/แก้ (review, inline edit,
  skipped rows w/ reasons) → รายการซ้ำ (merge resolution) → เสร็จ. Emits `done`, `exit`. Mock data.
- `src/domain/transfer/csv.ts`: `parseImport(text): { rows, skipped }`,
  `mergeImport(store, parsed): { added, updated, skippedDup, orphans }`.
- `src/stores/data.ts`: `structure` (room choices).

## Wiring spec
1. Port template/style verbatim.
2. เลือกห้อง: list rooms from `data.structure` (clickable rows like the prototype).
3. เลือกไฟล์: file input → read text → `parseImport(text)`.
4. ตรวจ/แก้: show `rows` (valid) and `skipped` (row number + reason) from parseImport.
   Inline edit may stay visual/local (prototype-level); the commit uses the parsed result.
5. รายการซ้ำ: surface that duplicate measurements will be skipped (counts come from mergeImport).
6. เสร็จ: on confirm call `mergeImport(data, parsed)`; show the returned counts
   (added/updated/skippedDup/orphans). Emit `done`.
7. AppShell: render `ImportView` for `overlay==='import'`, `@done="closeOverlay"`, `@exit="closeOverlay"`.

## Verify
- `npx vue-tsc --noEmit` clean; `npm run build` succeeds; `npm test` still green.
- On :5173: open นำเข้ารายชื่อ (Home quick link or Settings 📥) → walk the steps with a small
  CSV (you can craft one matching `toCsv`'s format from Settings export) → invalid rows show
  reason+row; finishing shows merge counts. Screenshot `.playwright-mcp/p3-t14-import.png`.

## Report contract
Write full report to `docs/superpowers/briefs/phase3-task-14-report.md`. Return short summary + status.
