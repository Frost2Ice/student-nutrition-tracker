# Hash-based Routing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace `AppShell`'s `dest`-ref view switching with a framework-free hash router so each major screen has its own URL, staying a single-file SPA.

**Architecture:** A pure mapping module (`hashRoutes.ts`) converts between `location.hash` and the existing `Dest` union; a Pinia store (`route.ts`) owns `current`, listens to `hashchange`, and exposes `navigate`. `AppShell` reads `route.current` instead of `dest`; `go()` keeps its payload/overlay logic and calls `route.navigate()` for page targets.

**Tech Stack:** Vue 3.4 `<script setup>` + TypeScript, Pinia, Vite (single inlined `dist/index.html`), Vitest (jsdom).

## Global Constraints

- Hash routing via `window.location.hash` only — never the History API.
- Must work under `http://localhost` and `file://` — no server, no backend.
- No routing library; no nested routes; no dynamic params.
- `tsconfig` has `noUnusedLocals` — unused imports fail the build.
- Spec: `docs/superpowers/specs/2026-06-29-hash-routing-design.md`.
- User handles all git commits — do NOT run `git commit`. "Commit" steps below mark a logical stopping point; leave changes staged-or-unstaged for the user.
- Routable pages only: `#/`→home, `#/students`→students-poc, `#/reports`→reports, `#/settings`→settings, `#/data`→wizard. Unknown/empty→home.

---

### Task 1: Pure hash↔dest mapping

**Files:**
- Create: `src/router/hashRoutes.ts`
- Test: `tests/router/hashRoutes.test.ts`

**Interfaces:**
- Produces:
  - `type Dest = 'home' | 'students' | 'students-poc' | 'measure' | 'reports' | 'settings' | 'wizard'`
  - `parseHash(hash: string): Dest`
  - `destToHash(dest: Dest): string`

- [ ] **Step 1: Write the failing test**

Create `tests/router/hashRoutes.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { parseHash, destToHash, type Dest } from '../../src/router/hashRoutes';

describe('parseHash', () => {
  it('maps empty / root forms to home', () => {
    expect(parseHash('')).toBe('home');
    expect(parseHash('#')).toBe('home');
    expect(parseHash('#/')).toBe('home');
  });
  it('maps the five live routes', () => {
    expect(parseHash('#/students')).toBe('students-poc');
    expect(parseHash('#/reports')).toBe('reports');
    expect(parseHash('#/settings')).toBe('settings');
    expect(parseHash('#/data')).toBe('wizard');
  });
  it('tolerates a missing leading slash', () => {
    expect(parseHash('#students')).toBe('students-poc');
  });
  it('strips trailing slashes', () => {
    expect(parseHash('#/students/')).toBe('students-poc');
  });
  it('falls back to home for hidden or unknown paths', () => {
    expect(parseHash('#/measurement')).toBe('home');
    expect(parseHash('#/nope')).toBe('home');
  });
});

describe('destToHash', () => {
  it('maps each routable dest', () => {
    expect(destToHash('home')).toBe('#/');
    expect(destToHash('students-poc')).toBe('#/students');
    expect(destToHash('reports')).toBe('#/reports');
    expect(destToHash('settings')).toBe('#/settings');
    expect(destToHash('wizard')).toBe('#/data');
  });
  it('maps unroutable dests to root', () => {
    expect(destToHash('measure')).toBe('#/');
    expect(destToHash('students')).toBe('#/');
  });
  it('round-trips the five live dests', () => {
    const live: Dest[] = ['home', 'students-poc', 'reports', 'settings', 'wizard'];
    for (const d of live) expect(parseHash(destToHash(d))).toBe(d);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/router/hashRoutes.test.ts`
Expected: FAIL — cannot resolve `../../src/router/hashRoutes`.

- [ ] **Step 3: Write minimal implementation**

Create `src/router/hashRoutes.ts`:

```ts
export type Dest =
  | 'home' | 'students' | 'students-poc' | 'measure' | 'reports' | 'settings' | 'wizard';

const PATH_TO_DEST: Record<string, Dest> = {
  '/': 'home',
  '/students': 'students-poc',
  '/reports': 'reports',
  '/settings': 'settings',
  '/data': 'wizard',
};

const DEST_TO_PATH: Partial<Record<Dest, string>> = {
  home: '/',
  'students-poc': '/students',
  reports: '/reports',
  settings: '/settings',
  wizard: '/data',
};

/** Normalize a raw `location.hash` to a routable Dest. Unknown/empty -> 'home'. */
export function parseHash(hash: string): Dest {
  let p = hash.replace(/^#/, '');
  if (p === '' || p === '/') return 'home';
  if (!p.startsWith('/')) p = '/' + p;
  p = p.replace(/\/+$/, '') || '/';
  return PATH_TO_DEST[p] ?? 'home';
}

/** Dest -> hash string for writing `location.hash`. Unroutable dests -> '#/'. */
export function destToHash(dest: Dest): string {
  return '#' + (DEST_TO_PATH[dest] ?? '/');
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/router/hashRoutes.test.ts`
Expected: PASS (all cases).

- [ ] **Step 5: Type-check**

Run: `npx vue-tsc --noEmit`
Expected: no output (clean).

- [ ] **Step 6: Commit (stage only; user commits)**

```bash
git add src/router/hashRoutes.ts tests/router/hashRoutes.test.ts
# user runs the commit: feat: add pure hash<->dest route mapping
```

---

### Task 2: Route store

**Files:**
- Create: `src/stores/route.ts`
- Test: `tests/stores/route.test.ts`

**Interfaces:**
- Consumes: `parseHash`, `destToHash`, `Dest` from `src/router/hashRoutes`.
- Produces: `useRoute()` Pinia store with `current: Ref<Dest>`, `start(): void`, `navigate(dest: Dest): void`.

- [ ] **Step 1: Write the failing test**

Create `tests/stores/route.test.ts`:

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { useRoute } from '../../src/stores/route';

function setHash(h: string) {
  window.location.hash = h;
}

describe('useRoute', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    setHash('');
  });

  it('initializes current from the existing hash', () => {
    setHash('#/reports');
    const r = useRoute();
    expect(r.current).toBe('reports');
  });

  it('start() sets #/ when hash is empty and current is home', () => {
    setHash('');
    const r = useRoute();
    r.start();
    expect(window.location.hash).toBe('#/');
    expect(r.current).toBe('home');
  });

  it('navigate() writes the hash and updates current after hashchange', async () => {
    const r = useRoute();
    r.start();
    r.navigate('settings');
    expect(window.location.hash).toBe('#/settings');
    await new Promise((res) => setTimeout(res, 0)); // let hashchange fire
    expect(r.current).toBe('settings');
  });

  it('reacts to a manual hashchange (Back/Forward)', async () => {
    const r = useRoute();
    r.start();
    setHash('#/data');
    window.dispatchEvent(new HashChangeEvent('hashchange'));
    expect(r.current).toBe('wizard');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/stores/route.test.ts`
Expected: FAIL — cannot resolve `../../src/stores/route`.

- [ ] **Step 3: Write minimal implementation**

Create `src/stores/route.ts`:

```ts
import { defineStore } from 'pinia';
import { ref } from 'vue';
import { parseHash, destToHash, type Dest } from '../router/hashRoutes';

export const useRoute = defineStore('route', () => {
  const current = ref<Dest>(parseHash(window.location.hash));
  let started = false;

  function sync() {
    current.value = parseHash(window.location.hash);
  }

  function start() {
    if (started) return;
    started = true;
    if (!window.location.hash) window.location.hash = '#/';
    window.addEventListener('hashchange', sync);
    sync();
  }

  // Single writer: set the hash; the hashchange listener updates `current`.
  // If the hash is already correct no event fires, so settle state directly.
  function navigate(dest: Dest) {
    const next = destToHash(dest);
    if (window.location.hash === next) { sync(); return; }
    window.location.hash = next;
  }

  return { current, start, navigate };
});
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/stores/route.test.ts`
Expected: PASS.

Note: jsdom updates `window.location.hash` synchronously but fires `hashchange`
asynchronously; the `navigate` test awaits a macrotask. The empty-hash assertion
in `start()` is synchronous because `sync()` is called inline.

- [ ] **Step 5: Type-check + full test run**

Run: `npx vue-tsc --noEmit && npx vitest run`
Expected: clean type-check; all tests pass.

- [ ] **Step 6: Commit (stage only; user commits)**

```bash
git add src/stores/route.ts tests/stores/route.test.ts
# user commits: feat: add hash route store with hashchange sync
```

---

### Task 3: Migrate AppShell to the route store

**Files:**
- Modify: `src/AppShell.vue`

**Interfaces:**
- Consumes: `useRoute` from `src/stores/route`; `Dest` from `src/router/hashRoutes`.

This task has no new unit test (AppShell switch logic is structurally
unchanged); verification is type-check + build + manual Back/Forward/refresh.

- [ ] **Step 1: Import the store and Dest; remove the local Dest type**

In `src/AppShell.vue` `<script setup>`:

Add imports near the other store imports:
```ts
import { useRoute } from './stores/route';
import type { Dest } from './router/hashRoutes';
```

Remove the existing local line:
```ts
type Dest = 'home' | 'students' | 'students-poc' | 'measure' | 'reports' | 'settings' | 'wizard';
```
(Keep the `Overlay` type as-is.)

- [ ] **Step 2: Replace the dest ref with the route store**

Remove:
```ts
const dest = ref<Dest>('home');
```
Add (next to `const data = useData();`):
```ts
const route = useRoute();
```

- [ ] **Step 3: Point `go()` and `destLabel` at the store**

In `destLabel`, replace `dest.value` with `route.current`:
```ts
const destLabel = computed(() => nav.find((n) => n.id === route.current)?.label ?? '');
```

Inside `go()`, in the `else` branch, replace:
```ts
    dest.value = target as Dest;
```
with:
```ts
    route.navigate(target as Dest);
```
Leave every payload assignment (`wizardStart`, `focusStudent`, `studentReturn`,
`pocReopen`) and the optimistic `header.setHeader(...)` line exactly as they are,
and leave the overlay branch untouched.

- [ ] **Step 4: Replace remaining direct `dest` reads/writes in template + handlers**

In the onboarding overlay handler, replace `dest = 'home'`:
```html
    <OnboardingView
      v-if="overlay === 'onboarding'"
      @done="closeOverlay(); route.navigate('home')"
      @exit="closeOverlay"
    />
```

In the shell template, replace every `dest === ...` / `dest = n.id` with the store:
- `<Transition>` children: `v-if="route.current === 'home'"`, `v-else-if="route.current === 'students'"`, … (one per existing branch, same keys).
- Fallback branch `:key="dest"` → `:key="route.current"`; and `dest === 'students'` etc. in `:focus-id`/condition checks stay keyed off `route.current`.
- Sidebar nav: `:class="{ active: route.current === n.id }"`.
- Bottom nav: `:class="{ active: route.current === n.id }"`.
- The `AppHeader` `:is-home="dest === 'home'"` → `:is-home="route.current === 'home'"`.

Search the file for `dest` and confirm no occurrences remain except inside
comments. (`grep -n "\bdest\b" src/AppShell.vue` should return nothing in code.)

- [ ] **Step 5: Start the router on mount**

Add an `onMounted` (import `onMounted` from 'vue' if not already imported):
```ts
import { ref, computed, onMounted } from 'vue';
...
onMounted(() => route.start());
```

- [ ] **Step 6: Type-check + build**

Run: `npx vue-tsc --noEmit && npm run build`
Expected: clean type-check; build emits `dist/index.html`.

- [ ] **Step 7: Manual verification (dev server is the user's, on :5173)**

Open `http://localhost:5173` and confirm:
- App loads at `#/` (Home); hash bar shows `#/`.
- Clicking นักเรียน → `#/students` (Workspace); รายงาน → `#/reports`; ตั้งค่า → `#/settings`; ผู้ช่วยจัดการข้อมูล → `#/data`.
- Browser **Back** returns to the previous page; **Forward** re-advances.
- **Refresh** on `#/reports` stays on Reports.
- Typing `#/nonsense` then refresh → Home.
- Build artifact opened as `file://.../dist/index.html` navigates between pages (hash works without a server).

- [ ] **Step 8: Commit (stage only; user commits)**

```bash
git add src/AppShell.vue
# user commits: feat: drive AppShell navigation from the hash route store
```

---

### Task 4: Docs touch-up

**Files:**
- Modify: `DESIGN.md` (Navigation paragraph added 2026-06-29)

- [ ] **Step 1: Note routing in the Navigation paragraph**

In `DESIGN.md`, in the Navigation paragraph, append one sentence:
> Pages are addressable by hash (`#/`, `#/students`, `#/reports`, `#/settings`,
> `#/data`); navigation updates `location.hash` and rendering follows it, so
> Back/Forward and refresh work and the app still runs from `file://`.

- [ ] **Step 2: Commit (stage only; user commits)**

```bash
git add DESIGN.md
# user commits: docs: note hash routing in DESIGN.md
```

---

## Self-Review

**Spec coverage:**
- Hash router (pure mapping) → Task 1. ✓
- Route store + `hashchange` + programmatic nav → Task 2. ✓
- AppShell migration, payloads/overlays intact → Task 3. ✓
- Back/Forward + refresh-safe → Task 2 (event/init) + Task 3 manual verify. ✓
- `file://` support, single `index.html` → Task 3 Steps 6–7. ✓
- First-run gate wins → unchanged `!data.isSetup` block; Task 3 leaves it intact (no `dest` inside it). ✓
- Overlays stay state → Task 3 Step 3 leaves overlay branch untouched. ✓
- Route map matches live nav → Task 1 tables. ✓

**Placeholder scan:** none.

**Type consistency:** `Dest` union identical in Tasks 1 & 3; `parseHash`/`destToHash`/`useRoute`/`current`/`start`/`navigate` names consistent across Tasks 1–3 and the store test.
