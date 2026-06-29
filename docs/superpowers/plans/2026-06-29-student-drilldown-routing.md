# Student Drill-Down Routing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give the Student Workspace drill-down (class list → student list → student detail) real hash entries with dynamic params so browser Back, refresh, and in-session deep-linking work without custom back logic.

**Architecture:** Minimal extension of the existing custom hash router. Keep the `Dest` enum and all static routes. Add a `RouteParams` payload and a new `parseRoute` primary parser (with `parseHash` kept as a thin non-breaking wrapper). The route store gains a `params` ref; `navigate` takes optional params. `AppShell` and `StudentsPocView` derive their drill-down level from `route.params` instead of local toggles, with dumb graceful fallback when params don't resolve in the current year.

**Tech Stack:** Vue 3 + TS + Vite, Pinia, Vitest. Hash-only routing (`window.location.hash`), no routing library, single-file `dist/index.html`.

> **REVISION (2026-06-29, post-implementation):** The class route was changed from
> two raw segments `#/students/class/<grade>/<room>` to a single URL-safe **class
> slug** `#/students/class/<classSlug>` (e.g. `อ-2-1`) to drop reserved chars.
> `RouteParams` is now `{ classSlug?; studentId? }` (no grade/room). Added pure
> `src/domain/school/class-slug.ts` (`classSlug(grade,room)`) + `data.findClassBySlug`
> (resolves a slug against the viewed year's classes — not string-inverted).
> `StudentsPocView` derives grade/room from the slug; `openRoom`/`AppShell.go` build it.
> See the spec's revised "URL Scheme" section. Tasks 1–4 below describe the original
> two-segment shape; the slug supersedes the `{grade,room}` param details in them.

## Global Constraints

- Hash routing via `window.location.hash` — never the History API.
- Must work under `file://` (no server). No routing library.
- Session-scoped: URLs resolve against `data.viewingYear` (ambient, not in URL). Year is NOT in the URL.
- Class identity = `(grade, room)` composite. Student identity = stable `id`.
- Each path segment is `encodeURIComponent`'d / `decodeURIComponent`'d.
- `tsconfig` has `noUnusedLocals` — unused imports fail the build.
- Build/verify: `npm test`, `npx vue-tsc --noEmit`. Do NOT start/kill the dev server (user runs it on :5173).
- Commits: user handles all git commits. Do NOT run `git commit`/`git add`. End each task by reporting the diff is ready; the user commits.

---

### Task 1: Extend `hashRoutes.ts` with params

**Files:**
- Modify: `src/router/hashRoutes.ts`
- Test: `tests/router/hashRoutes.test.ts`

**Interfaces:**
- Consumes: existing `Dest`, `PATH_TO_DEST`, `DEST_TO_PATH`.
- Produces:
  - `export type RouteParams = { grade?: string; room?: string; studentId?: string };`
  - `export function parseRoute(hash: string): { dest: Dest; params: RouteParams };`
  - `export function parseHash(hash: string): Dest;` (unchanged signature — now `parseRoute(hash).dest`)
  - `export function destToHash(dest: Dest, params?: RouteParams): string;`

- [ ] **Step 1: Write the failing tests** — append to `tests/router/hashRoutes.test.ts`:

```ts
import { parseRoute } from '../../src/router/hashRoutes';

describe('parseRoute — student params', () => {
  it('parses the class drill-down route', () => {
    expect(parseRoute('#/students/class/' + encodeURIComponent('ป.1') + '/2'))
      .toEqual({ dest: 'students-poc', params: { grade: 'ป.1', room: '2' } });
  });
  it('parses the student detail route', () => {
    expect(parseRoute('#/students/student/s-42'))
      .toEqual({ dest: 'students-poc', params: { studentId: 's-42' } });
  });
  it('returns empty params for static routes', () => {
    expect(parseRoute('#/reports')).toEqual({ dest: 'reports', params: {} });
    expect(parseRoute('#/students')).toEqual({ dest: 'students-poc', params: {} });
  });
  it('falls back to home with empty params for unknown', () => {
    expect(parseRoute('#/nope')).toEqual({ dest: 'home', params: {} });
  });
});

describe('destToHash — student params', () => {
  it('builds the class route, url-encoding segments', () => {
    expect(destToHash('students-poc', { grade: 'ป.1', room: '2' }))
      .toBe('#/students/class/' + encodeURIComponent('ป.1') + '/' + encodeURIComponent('2'));
  });
  it('builds the student route', () => {
    expect(destToHash('students-poc', { studentId: 's-42' }))
      .toBe('#/students/student/' + encodeURIComponent('s-42'));
  });
  it('ignores empty params (plain students route)', () => {
    expect(destToHash('students-poc', {})).toBe('#/students');
    expect(destToHash('students-poc')).toBe('#/students');
  });
  it('round-trips the param routes', () => {
    const cases: { grade?: string; room?: string; studentId?: string }[] = [
      { grade: 'ป.1', room: '2' },
      { studentId: 's-42' },
    ];
    for (const p of cases) {
      const rt = parseRoute(destToHash('students-poc', p));
      expect(rt).toEqual({ dest: 'students-poc', params: p });
    }
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- hashRoutes`
Expected: FAIL — `parseRoute is not a function` / `destToHash` arity.

- [ ] **Step 3: Implement in `src/router/hashRoutes.ts`**

Add the type and the two param patterns. Replace `parseHash` body to delegate, and extend `destToHash`:

```ts
export type RouteParams = { grade?: string; room?: string; studentId?: string };

const CLASS_RE = /^\/students\/class\/([^/]+)\/([^/]+)$/;
const STUDENT_RE = /^\/students\/student\/([^/]+)$/;

/** Normalize a raw location.hash to a routable dest + params. */
export function parseRoute(hash: string): { dest: Dest; params: RouteParams } {
  let p = hash.replace(/^#/, '');
  if (p === '' || p === '/') return { dest: 'home', params: {} };
  if (!p.startsWith('/')) p = '/' + p;
  p = p.replace(/\/+$/, '') || '/';

  const cls = CLASS_RE.exec(p);
  if (cls) return { dest: 'students-poc', params: { grade: decodeURIComponent(cls[1]), room: decodeURIComponent(cls[2]) } };
  const stu = STUDENT_RE.exec(p);
  if (stu) return { dest: 'students-poc', params: { studentId: decodeURIComponent(stu[1]) } };

  return { dest: PATH_TO_DEST[p] ?? 'home', params: {} };
}

/** Back-compat: dest only. */
export function parseHash(hash: string): Dest {
  return parseRoute(hash).dest;
}

/** Dest (+ optional params) -> hash string. Unroutable dests -> '#/'. */
export function destToHash(dest: Dest, params?: RouteParams): string {
  if (dest === 'students-poc' && params) {
    if (params.studentId) return '#/students/student/' + encodeURIComponent(params.studentId);
    if (params.grade && params.room) {
      return '#/students/class/' + encodeURIComponent(params.grade) + '/' + encodeURIComponent(params.room);
    }
  }
  return '#' + (DEST_TO_PATH[dest] ?? '/');
}
```

(Keep the existing `parseHash`/`destToHash` exports — replace their bodies, don't duplicate. Remove the old standalone `parseHash` implementation now superseded by the wrapper.)

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- hashRoutes`
Expected: PASS (new param tests + all pre-existing `parseHash`/`destToHash` tests still green).

- [ ] **Step 5: Type-check**

Run: `npx vue-tsc --noEmit`
Expected: no errors.

- [ ] **Step 6: Report diff ready** — summarize changes; the user commits.

---

### Task 2: Add `params` to the route store

**Files:**
- Modify: `src/stores/route.ts`
- Test: `tests/stores/route.test.ts`

**Interfaces:**
- Consumes: `parseRoute`, `destToHash`, `RouteParams` from Task 1.
- Produces: store exposes `current: Dest`, `params: Ref<RouteParams>`, `start()`, `navigate(dest: Dest, params?: RouteParams)`.

- [ ] **Step 1: Write the failing tests** — append to `tests/stores/route.test.ts` inside `describe('useRoute')`:

```ts
  it('exposes params parsed from the hash', () => {
    hash = '#/students/student/s-7';
    const r = useRoute();
    expect(r.current).toBe('students-poc');
    expect(r.params).toEqual({ studentId: 's-7' });
  });

  it('navigate() with params writes the param hash and updates state', () => {
    const r = useRoute();
    r.start();
    r.navigate('students-poc', { grade: 'ป.1', room: '2' });
    expect(window.location.hash).toBe('#/students/class/' + encodeURIComponent('ป.1') + '/2');
    expect(r.current).toBe('students-poc');
    expect(r.params).toEqual({ grade: 'ป.1', room: '2' });
  });

  it('navigate() with no params clears prior params', () => {
    const r = useRoute();
    r.start();
    r.navigate('students-poc', { studentId: 's-7' });
    r.navigate('students-poc');
    expect(window.location.hash).toBe('#/students');
    expect(r.params).toEqual({});
  });
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- route`
Expected: FAIL — `r.params` undefined / `navigate` arity.

- [ ] **Step 3: Implement in `src/stores/route.ts`**

```ts
import { defineStore } from 'pinia';
import { ref } from 'vue';
import { parseRoute, destToHash, type Dest, type RouteParams } from '../router/hashRoutes';

export const useRoute = defineStore('route', () => {
  const initial = parseRoute(window.location.hash);
  const current = ref<Dest>(initial.dest);
  const params = ref<RouteParams>(initial.params);
  let started = false;

  function sync() {
    const r = parseRoute(window.location.hash);
    current.value = r.dest;
    params.value = r.params;
  }

  function start() {
    if (started) return;
    started = true;
    if (!window.location.hash) window.location.hash = '#/';
    window.addEventListener('hashchange', sync);
    sync();
  }

  // Single writer: set the hash; the hashchange listener updates state.
  // If the hash is already correct no event fires, so settle state directly.
  function navigate(dest: Dest, p?: RouteParams) {
    const next = destToHash(dest, p);
    if (window.location.hash === next) { sync(); return; }
    window.location.hash = next;
  }

  return { current, params, start, navigate };
});
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- route`
Expected: PASS (new + pre-existing route tests).

- [ ] **Step 5: Full test + type-check**

Run: `npm test && npx vue-tsc --noEmit`
Expected: all green.

- [ ] **Step 6: Report diff ready** — user commits.

---

### Task 3: Drive `StudentsPocView` level from route params

**Files:**
- Modify: `src/features/StudentsPocView.vue`
- Manual verification (no component-test harness in this repo; tests are domain/store only).

**Interfaces:**
- Consumes: `useRoute` store (`route.params`, `route.navigate`) from Task 2; existing `data.roomStudents`, `data.findStudent`.
- Produces: clicking a class navigates to `students-poc` + `{grade, room}`; opening a student navigates to `students-poc` + `{studentId}`. No local `view` ref.

- [ ] **Step 1: Import the route store** — in `<script setup>` add:

```ts
import { useRoute } from '../stores/route';
```
and after `const header = useHeader();`:
```ts
const route = useRoute();
```

- [ ] **Step 2: Replace local `view`/`grade`/`room` with route-derived state**

Remove (lines ~71-87):
```ts
const view = ref<'map' | 'students'>('map');
const grade = ref('');
const room = ref('');

function openRoom(g: string, r: string) {
  grade.value = g;
  room.value = r;
  riskOnly.value = false;
  applyDefaultRound();
  view.value = 'students';
  window.scrollTo({ top: 0 });
}
function toMap() {
  view.value = 'map';
  window.scrollTo({ top: 0 });
}
```

Replace with:
```ts
// Drill-down level is derived from the route: class params present → room view.
const grade = computed(() => route.params.grade ?? '');
const room = computed(() => route.params.room ?? '');
const view = computed<'map' | 'students'>(() => (grade.value && room.value ? 'students' : 'map'));

function openRoom(g: string, r: string) {
  riskOnly.value = false;
  route.navigate('students-poc', { grade: g, room: r });
  window.scrollTo({ top: 0 });
}
function toMap() {
  route.navigate('students-poc');
  window.scrollTo({ top: 0 });
}
```

- [ ] **Step 3: Open student via route, not emit**

Replace `openStudent` (lines ~20-22):
```ts
function openStudent(id: string, _g: string, _r: string) {
  route.navigate('students-poc', { studentId: id });
}
```
(Keep the call sites `openStudent(s.id, grade, room)` unchanged in template; the extra args are now ignored but preserve the existing template wiring. If `noUnusedLocals` flags `_g/_r` params — function params are exempt — leave as is.)

- [ ] **Step 4: Apply default round when the room changes**

`applyDefaultRound()` previously ran inside `openRoom`. Now grade/room are computed, so run it reactively. Add after the header watch:
```ts
watch([grade, room], ([g, r]) => {
  if (g && r) applyDefaultRound();
}, { immediate: true });
```

- [ ] **Step 5: Header reacts to derived `view`**

`syncHeader` and its `watch(view, syncHeader)` already key off `view`. Since `view` is now `computed`, `watch(view, syncHeader)` still works. The `back: toMap` reference stays (toMap now calls `route.navigate`). No change needed beyond confirming `toMap` is still referenced.

- [ ] **Step 6: Remove the now-unused `reopen` prop path if dead**

Check whether `props.reopen` / `emit('reopened')` is still wired in `AppShell` (Task 4 may drop it). If Task 4 keeps emitting `reopen`, leave the prop. Otherwise remove the prop, the `(e: 'reopened')` emit, and any `onMounted` that consumed `reopen`. Coordinate with Task 4 — do not leave a dangling prop. (Decide based on Task 4's final `AppShell`; default: keep `reopen` removed since deep-link via URL replaces it.)

- [ ] **Step 7: Type-check + build**

Run: `npx vue-tsc --noEmit`
Expected: no errors (watch for `noUnusedLocals` on removed imports/refs).

- [ ] **Step 8: Report diff ready** — user commits.

---

### Task 4: Render student detail from route params in `AppShell`

**Files:**
- Modify: `src/AppShell.vue`
- Manual verification.

**Interfaces:**
- Consumes: `route.params` (`studentId`, `grade`, `room`), `data.findStudent`, `data.roomStudents`.
- Produces: student detail (`StudentsView`) renders when `route.params.studentId` resolves; graceful fallback otherwise. No `showProfile`/`focusStudent` toggle.

- [ ] **Step 1: Remove the in-page profile toggle state**

Delete (lines ~34-39):
```ts
// Whether the #/students route shows the legacy student profile (StudentsView)
// instead of the Workspace (StudentsPocView). In-page state, not its own route.
const showProfile = ref(false);
```
and `const focusStudent = ref<string | null>(null);`. Keep `studentReturn` only if `StudentsView` still needs a return room (see Step 4); otherwise remove it too.

- [ ] **Step 2: Derive profile state from the route**

Add after `const route = useRoute();`:
```ts
// Student detail is route-driven: #/students/student/<id>. Resolve the id against
// the current year; if it's gone (promoted away / wrong year) fall back gracefully.
const focusStudent = computed(() => route.params.studentId ?? null);
const focusValid = computed(() => !!focusStudent.value && !!data.findStudent(focusStudent.value));
const showProfile = computed(() => focusValid.value);

watch(() => route.params.studentId, (id) => {
  if (!id) return;
  const s = data.findStudent(id);
  if (!s) {
    // Unknown student: drop to its class list if derivable, else class root.
    route.navigate('students-poc');
  }
}, { immediate: true });
```
(If `findStudent` could resolve the class even when the id is stale, prefer routing to that class; with the current model a missing id means no record, so class root is correct.)

- [ ] **Step 3: Replace the `go('students', {focus})` branch**

In `function go(...)`, replace the `else if (target === 'students' && payload && 'focus' in payload)` block (lines ~98-104) with:
```ts
  } else if (target === 'students' && payload && 'focus' in payload) {
    // Student detail is now its own hash entry.
    route.navigate('students-poc', { studentId: payload.focus });
```
Remove the `focusStudent.value = ...`, `studentReturn.value = ...`, `showProfile.value = true`, and the manual `header.setHeader(...)` lines (the detail view sets its own header on mount). Delete the old `watch(() => route.current, () => { showProfile.value = false; })` — superseded by the computed.

- [ ] **Step 4: Update the template binding**

In the template (lines ~194-195), the `StudentsView` branch keys off `showProfile` (now computed) and `:focus-id="focusStudent"` (now computed). Confirm `studentReturn` usage: if `StudentsView`'s `:return-room` is still desired, derive it:
```ts
const studentReturn = computed(() => {
  const s = focusStudent.value ? data.findStudent(focusStudent.value) : null;
  return s ? { grade: s.grade, room: s.room } : null;
});
```
Otherwise remove the `:return-room` binding and the ref. The template line stays:
```html
<StudentsView v-else-if="route.current === 'students-poc' && showProfile" key="student-profile" :focus-id="focusStudent" :return-room="studentReturn" @go="go" @focused="focusStudent = null" />
```
`@focused="focusStudent = null"` no longer works (computed is read-only). Replace with `@focused="route.navigate('students-poc')"` so clearing the focus returns to the class list. Wait — that would force-navigate on mount if StudentsView emits `focused` to clear. Inspect `StudentsView`'s `@focused` contract: it emits once after consuming `focusStudent` to avoid re-focus. With route-driven id this clear is no longer needed; remove the `@focused` handler (and the emit consumption is harmless). Default: drop `@focused`.

- [ ] **Step 5: Drop `pocReopen` deep-link if replaced by URL**

The `pocReopen` ref + `go('students-poc', {grade,room})` reopen path (lines ~43, ~109-111) reopened a room via in-memory payload. The class URL now does this. Replace the `if (target === 'students-poc')` block in `go` with a navigate that carries params when present:
```ts
    if (target === 'students-poc' && payload && 'grade' in payload && payload.grade && payload.room) {
      route.navigate('students-poc', { grade: payload.grade, room: payload.room });
      window.scrollTo({ top: 0 });
      return;
    }
```
Remove `const pocReopen = ref(...)` and the `:reopen`/`@reopened` props on `<StudentsPocView>` (coordinate with Task 3 Step 6). Plain `go('students-poc')` (nav click) falls through to `route.navigate(target as Dest)`.

- [ ] **Step 6: Type-check**

Run: `npx vue-tsc --noEmit`
Expected: no errors. Resolve any `noUnusedLocals` from removed refs/imports (`ref` may still be used elsewhere; `watch`/`computed` now used).

- [ ] **Step 7: Full test run**

Run: `npm test`
Expected: all green (domain + router + store tests unaffected).

- [ ] **Step 8: Report diff ready** — user commits.

---

### Task 5: Manual / browser verification

**Files:** none (verification only). Screenshots → `.playwright-mcp/` (gitignored).

- [ ] **Step 1: Type-check + unit tests**

Run: `npm test && npx vue-tsc --noEmit`
Expected: all green.

- [ ] **Step 2: Build the single-file bundle**

Run: `npm run build`
Expected: succeeds, emits `dist/index.html`.

- [ ] **Step 3: Drive the app at http://localhost:5173 (user's dev server — do not start your own)**

Verify each, taking a screenshot to `.playwright-mcp/`:
- Class list → click a class → URL becomes `#/students/class/<grade>/<room>`, student list shows.
- Click a student → URL becomes `#/students/student/<id>`, detail (StudentsView) shows.
- Browser **Back** → returns to student list (`#/students/class/...`); Back again → class list (`#/students`); Back again → previous page.
- **Refresh** on each of the three URLs → restores the correct level.
- Paste a `#/students/student/<bogus-id>` → falls back to class list, no error/blank.
- Paste a `#/students/class/<bogus-grade>/<bogus-room>` → room view empty or falls back per `roomStudents` (no crash).

- [ ] **Step 4: Report results** — paste outcomes + screenshot paths. If a check fails, invoke systematic-debugging before patching.

---

## Notes for the implementer

- This plan **amends** `docs/superpowers/specs/2026-06-29-hash-routing-design.md` (Decision #2 "no history per sub-screen" and the "no dynamic params" constraint). That's intentional and documented in `2026-06-29-student-drilldown-routing-design.md`.
- Legacy `StudentsView`/`MeasureView` stay mounted as the safety net (CLAUDE.md migration note) — do not delete them.
- Chart.js `animation: false` stays (screenshots).
</content>
