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
- **Student Workspace migration (2026-06-29):** `StudentsPocView.vue` (nav: นักเรียน)
  is the live student+measurement surface. Legacy `StudentsView.vue` + `MeasureView.vue`
  are hidden from nav but still routed/mounted (StudentsView renders the student
  profile via a `focus` deep-link from the Workspace). They're an intentional safety
  net — not dead code — until a dedicated cleanup phase removes them.
- `tsconfig` has `noUnusedLocals` — unused imports fail the build.
- Chart.js: set `animation: false` (headless/screenshots capture mid-animation = blank charts).
- Thai Buddhist-era dates `D/M/YYYY`; academic year (ปีการศึกษา) ≠ calendar year
  (ภาคเรียน 2 spans Jan–Mar of the next calendar year).
- **Playwright MCP "Browser is already in use"**: a stale MCP-owned Chrome holds the
  profile lock (`mcp-chrome-*`), NOT your personal browser. Fix:
  `ps aux | grep mcp-chrome` → kill the PID named in the profile's `SingletonLock`.

## Conventions
- **Questions ≠ build orders.** This repo brainstorms→spec→plan before code
  (`docs/superpowers/`). Confirm scope before implementing, especially new UI;
  don't add features the user only asked about.
- **Dev server is the user's.** They keep `npm run dev` running on **http://localhost:5173**. NEVER kill it (`pkill -f vite`), never start your own. To test, just open localhost:5173 — Vite HMR already picked up your edits.
- Write files with the Write/Edit tools, never shell heredoc/echo.
- **Playwright/browser screenshots:** save to `.playwright-mcp/` (gitignored), never the
  repo root. Pass `filename: ".playwright-mcp/<name>.png"`. Keep root clean.

<!-- code-review-graph MCP tools -->
## MCP Tools: code-review-graph

**IMPORTANT: This project has a knowledge graph. ALWAYS use the
code-review-graph MCP tools BEFORE using Grep/Glob/Read to explore
the codebase.** The graph is faster, cheaper (fewer tokens), and gives
you structural context (callers, dependents, test coverage) that file
scanning cannot.

### When to use graph tools FIRST

- **Exploring code**: `semantic_search_nodes` or `query_graph` instead of Grep
- **Understanding impact**: `get_impact_radius` instead of manually tracing imports
- **Code review**: `detect_changes` + `get_review_context` instead of reading entire files
- **Finding relationships**: `query_graph` with callers_of/callees_of/imports_of/tests_for
- **Architecture questions**: `get_architecture_overview` + `list_communities`

Fall back to Grep/Glob/Read **only** when the graph doesn't cover what you need.

### Key Tools

| Tool | Use when |
|------|----------|
| `detect_changes` | Reviewing code changes — gives risk-scored analysis |
| `get_review_context` | Need source snippets for review — token-efficient |
| `get_impact_radius` | Understanding blast radius of a change |
| `get_affected_flows` | Finding which execution paths are impacted |
| `query_graph` | Tracing callers, callees, imports, tests, dependencies |
| `semantic_search_nodes` | Finding functions/classes by name or keyword |
| `get_architecture_overview` | Understanding high-level codebase structure |
| `refactor_tool` | Planning renames, finding dead code |

### Workflow

1. The graph auto-updates on file changes (via hooks).
2. Use `detect_changes` for code review.
3. Use `get_affected_flows` to understand impact.
4. Use `query_graph` pattern="tests_for" to check coverage.
