# Student Nutrition Tracker — Project Notes

Offline single-file web app for Thai school health teachers. Vue 3 + TS + Vite,
bundled to one self-contained `dist/index.html` (no network at runtime).

## Commands
- `npm run dev` — Vite dev server
- `npm run build` — `vue-tsc --noEmit && vite build` → single inlined `dist/index.html`
- `npm test` — Vitest (domain unit tests)
- `npx vue-tsc --noEmit` — type-check only

## Architecture
- `src/domain/**` is framework-free + unit-tested. ALL nutrition classification
  flows through `src/domain/nutrition/engine.ts` (single source) fed by the same
  reference tables that draw chart zones. No alternate/BMI path.
- Reference growth data is ported verbatim from the legacy HTML; never hand-retype.
- Specs/plans live in `docs/superpowers/`; product/visual docs: `PRODUCT.md`, `DESIGN.md`.

## Gotchas
- `tsconfig` has `noUnusedLocals` — unused imports fail the build.
- Chart.js: set `animation: false` (headless/screenshots capture mid-animation = blank charts).
- Thai Buddhist-era dates `D/M/YYYY`; academic year (ปีการศึกษา) ≠ calendar year
  (ภาคเรียน 2 spans Jan–Mar of the next calendar year).

## Conventions
- **Dev server is the user's.** They keep `npm run dev` running on **http://localhost:5173**. NEVER kill it (`pkill -f vite`), never start your own. To test, just open localhost:5173 — Vite HMR already picked up your edits.
- Write files with the Write/Edit tools, never shell heredoc/echo.
- **Playwright/browser screenshots:** save to `.playwright-mcp/` (gitignored), never the
  repo root. Pass `filename: ".playwright-mcp/<name>.png"`. Keep root clean.
