# Student Drill-Down Routing — Design Spec

**Date:** 2026-06-29
**Status:** Approved (brainstorming complete)
**Supersedes:** Amends `2026-06-29-hash-routing-design.md` — specifically its
Decision #2 ("Page-level Back/Forward only … no history entry per sub-screen")
and Constraints line "No nested routes, no dynamic params". The student
drill-down now gets real hash entries with dynamic params. All other constraints
of the prior spec (hash-only, `file://`-safe, **no routing library**, single-file
`dist/index.html`) remain non-negotiable and unchanged.

## Problem

The Student Workspace drill-down — **Class list → Student list → Student detail**
— is driven by two in-page state mechanisms, neither a route:

1. **Class list → Student list:** `view = ref<'map'|'students'>` local to
   `StudentsPocView.vue`, with a custom `toMap` back button.
2. **Student list → Student detail:** `showProfile` / `focusStudent` refs in
   `AppShell.vue`, rendering legacy `StudentsView`. Still under the single
   `#/students` hash.

Result: browser **Back** doesn't walk the drill-down (no history entries exist),
and **refresh / paste** can't restore a class or student.

## Goal

Give each drill-down level its own hash entry so browser Back, refresh, and
in-session deep-linking work naturally — with the **smallest** extension to the
existing custom router. No routing framework.

## Decisions

1. **Session-scoped, not durable.** URLs restore against the **currently viewed
   year** (`data.viewingYear`, ambient state — *not* in the URL). Cross-year-old
   links are not expected to survive; they fall back gracefully (below).
2. **Minimal router extension, not a generic framework.** Keep the `Dest` enum
   and all existing static routes untouched. Add optional params and parse the
   two student routes before the static-map fallback. Revisit the router
   architecture only if many parameterized routes appear later (YAGNI).
3. **Class identity = `(grade, room)` composite.** No numeric class id exists;
   `(grade, room)` uniquely identifies a class *within a year* (`school/migrate.ts`,
   `StudentsPocView` already uses these). Student identity = stable `id`.
4. **Dumb graceful fallback.** If a URL's params don't resolve in the current
   year: student → its class list (if derivable) else class root; missing class →
   class root (`#/students`). No cleverness beyond that.

## URL Scheme

All three levels share `dest: 'students-poc'`, so existing
`route.current === 'students-poc'` checks in `AppShell` keep working unchanged.
The **params** differentiate the level.

| Level | Hash | dest + params |
|-------|------|---------------|
| Class list (map) | `#/students` | `students-poc`, `{}` |
| Student list (class picked) | `#/students/class/<classSlug>` | `students-poc` + `{ classSlug }` |
| Student detail | `#/students/student/<id>` | `students-poc` + `{ studentId }` |

**Class slug (REVISED 2026-06-29).** The class is carried as a single URL-safe
slug, not the raw `(grade, room)` with reserved characters. `classSlug(grade,
room)` replaces `.` and `/` (and whitespace) with `-`:
`(อ.2, 1) → อ-2-1`, `(ป.1, 2) → ป-1-2`. The slug is a **presentation concern at
the routing boundary only** — the domain model keeps `(grade, room)` everywhere.

**Resolution (not reconstruction).** `parseRoute` carries the opaque `classSlug`
string; it does NOT try to invert it. The view resolves the slug against the
current year's known classes via `data.findClassBySlug(slug)` (slugify each known
`(grade, room)` and match). This fits the session-scoped model and needs no
fragile string-inverse. Grades are a closed set (`GRADE_ORDER`, `prefix.digit`)
and rooms are short — no slug collisions in practice. Unresolvable slug → graceful
fallback to class root (Decision #4). The student id stays raw (already URL-safe).

Why a slug, not `encodeURIComponent`: avoids `%E0%B8…`-style noise and the
reserved `/` between segments; keeps the URL clean and shareable long-term.

## Components

> **Components below reflect the REVISED slug design** (see the URL Scheme
> section). The class param is a single `classSlug`, not `{grade, room}`.

### `src/domain/school/class-slug.ts` (pure, unit-tested)

- `classSlug(grade, room): string` — replaces `.`, `/`, and whitespace with `-`
  (`อ.2`,`1` → `อ-2-1`). Minimal; not a generic slug framework.

### `src/stores/data.ts`

- `findClassBySlug(slug): { grade, room } | null` — iterates the viewed year's
  `structure` (grade→rooms), returns the class whose `classSlug` equals `slug`,
  else null. Reactive to `viewingYear` via the `structure` computed.

### `src/router/hashRoutes.ts` (pure, unit-tested)

- Type: `RouteParams = { classSlug?: string; studentId?: string }`.
- `parseRoute(hash) → { dest: Dest; params: RouteParams }` (and `parseHash` kept
  as a thin `→ Dest` back-compat wrapper):
  1. Try `^/students/class/([^/]+)$` → `students-poc` + decoded `{classSlug}`.
  2. Try `^/students/student/([^/]+)$` → `students-poc` + decoded `{studentId}`.
  3. Else existing `PATH_TO_DEST` lookup, `params: {}`. Unknown/empty → `home`.
- `destToHash(dest, params?) → string`: under `students-poc`, build the encoded
  single-segment path from `classSlug` or `studentId`; else existing `DEST_TO_PATH`.

### `src/stores/route.ts`

- `current: Dest` stays; add `params = ref<RouteParams>({})`.
- `sync()` sets both from `parseHash(window.location.hash)`.
- `navigate(dest, params?)`: build next hash via `destToHash(dest, params)`;
  same single-writer logic (set hash; if already equal, `sync()` to settle).

### `src/AppShell.vue`

- **Drop** `showProfile` / `focusStudent` in-page toggle for student detail.
  Render `StudentsView` when `route.params.studentId` is set; otherwise
  `StudentsPocView`. (Keep the `key`s so component identity is stable per level.)
- `go('students', { focus })` → `route.navigate('students-poc', { studentId: id })`.
- **Fallback resolution** (watch on `route.params` / hydrate): if `studentId`
  not in current year → navigate to that student's class list if its `(grade,room)`
  is derivable, else `route.navigate('students-poc')`; if `grade`/`room` not a
  class in the current year → `route.navigate('students-poc')`.

### `src/features/StudentsPocView.vue`

- **Drop** local `view = ref<'map'|'students'>`, `toMap`, and the custom back
  wiring. Derive the level: resolve `route.params.classSlug` via
  `data.findClassBySlug` → if it yields a class, student-list; else map.
- Clicking a class → `route.navigate('students-poc', { classSlug: classSlug(grade, room) })`
  (was mutating `view`).
- Header back button → `route.navigate('students-poc')` (drops to class list);
  browser Back does the same via history.

## Data Flow

```
click class  → navigate(students-poc,{grade,room}) → hash change → sync →
               params={grade,room} → PocView shows student-list
click student→ navigate(students-poc,{studentId})  → hash change → sync →
               params={studentId} → AppShell renders StudentsView (detail)
browser Back → previous hash entry → sync → previous level renders
refresh      → parseHash(location.hash) seeds current+params → resolve vs
               current year → render or graceful fallback
```

## Error / Edge Handling

- **Stale student id** (promoted away / wrong year): fallback to class list or root.
- **Stale class** (room renamed/removed): fallback to class root.
- **Malformed param hash**: regex miss → static-map fallback → `home`.
- **First-run gate** unchanged: while `!data.isSetup`, welcome screen wins over
  any hash (prior spec Decision #4).

## Testing

- **`hashRoutes` unit tests** (extend existing file):
  - Round-trip each level: `parseHash(destToHash(d, p))` deep-equals `{d, p}`.
  - Thai-grade encode/decode (`ป.1` / room `2`).
  - Student route parse.
  - Unknown / empty / trailing-slash → `home`, `params: {}`.
  - Existing static routes still parse unchanged (regression).
- **Manual / Playwright** (save shots to `.playwright-mcp/`):
  - class → student-list → detail; browser Back walks back one level each.
  - Refresh on each of the three URLs restores the right level.
  - Stale link (nonexistent id/class) falls back without error.

## Out of Scope (YAGNI)

- Year in the URL (durable cross-year links).
- Generic router rewrite / route guards / nested layouts.
- Routing legacy `MeasureView`; further legacy `StudentsView` cleanup.
- Surviving room renames for old links.
