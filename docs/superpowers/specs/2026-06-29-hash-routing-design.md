# Hash-based Routing — Design Spec

**Date:** 2026-06-29
**Status:** Approved (brainstorming complete)

## Goal

Replace `AppShell`'s internal `dest`-ref view switching with a lightweight,
framework-free **hash router** so each major screen has its own URL, while the
app stays a single-page app bundled into one `dist/index.html`.

## Constraints (non-negotiable)

- Hash routing via `window.location.hash` — **never** the History API.
- Works under both `http://localhost` and `file://` (no server, no backend).
- No routing library (no Vue Router / React Router / etc.).
- No nested routes, no dynamic params (none exist today; don't add).
- Don't break existing page/sub-page state beyond what routing requires.
- `tsconfig` has `noUnusedLocals` — unused imports fail the build.

## Route Map (matches the live nav)

Legacy standalone Students + Measurement are hidden from nav (Workspace
migration, 2026-06-29), so they get **no** routes. Hash path → existing `Dest`:

| Hash | `Dest` | Screen |
|------|--------|--------|
| `#/` | `home` | HomeView |
| `#/students` | `students-poc` | StudentsPocView (Student Workspace) |
| `#/reports` | `reports` | ReportsView |
| `#/settings` | `settings` | SettingsView |
| `#/data` | `wizard` | WizardHubView (Data Manager) |
| unknown / empty | `home` | fallback |

No `#/measurement` route; legacy `MeasureView`/`StudentsView` stay reachable in
code only (StudentsView still renders the student profile via `focus`).

## Decisions

1. **Overlays stay state, not routes.** `onboarding`, `import`, `promotion`,
   `backup` remain transient UI layered over the current page; they set the
   `overlay` ref and never touch the hash.
2. **Page-level Back/Forward only.** Browser Back/Forward moves between the 5
   pages via hash history. In-page sub-state (Workspace map↔room↔profile,
   wizard steps) is driven solely by the in-app header ← button, unchanged. No
   history entry per sub-screen.
3. **Payloads stay in-memory.** Programmatic navigation carrying transient
   context (`focus` student id, `reopen` room, wizard `start` step, import
   `grade/room`) keeps passing it via the existing `AppShell` refs. The hash
   reflects only the page. The legacy `StudentsView` profile (reached by
   `focus` from the Workspace) renders as **in-page state of `#/students`** —
   not its own route.
4. **First-run gate wins over routing.** While `!data.isSetup`, the welcome /
   onboarding screen shows regardless of hash. Routing is only active inside the
   app shell. After setup completes, navigate to `#/`.

## Components

### `src/router/hashRoutes.ts` (framework-free, pure, unit-tested)

```ts
export type Dest = 'home' | 'students' | 'students-poc' | 'measure' | 'reports' | 'settings' | 'wizard';

// Hash path -> Dest. Only the 5 live pages are routable.
const PATH_TO_DEST: Record<string, Dest> = {
  '/': 'home',
  '/students': 'students-poc',
  '/reports': 'reports',
  '/settings': 'settings',
  '/data': 'wizard',
};
const DEST_TO_PATH: Partial<Record<Dest, string>> = {
  'home': '/',
  'students-poc': '/students',
  'reports': '/reports',
  'settings': '/settings',
  'wizard': '/data',
};

// Normalize a raw location.hash to a Dest. Unknown/empty -> 'home'.
export function parseHash(hash: string): Dest {
  let p = hash.replace(/^#/, '');         // "#/students" -> "/students"
  if (p === '' || p === '/') return 'home';
  if (!p.startsWith('/')) p = '/' + p;    // tolerate "#students"
  p = p.replace(/\/+$/, '') || '/';       // strip trailing slashes
  return PATH_TO_DEST[p] ?? 'home';
}

// Dest -> hash string for writing location.hash. Unroutable dests -> '#/'.
export function destToHash(dest: Dest): string {
  return '#' + (DEST_TO_PATH[dest] ?? '/');
}
```

**Note:** `Dest` is the existing union in `AppShell.vue`; this module becomes
its canonical home. `AppShell` imports `Dest` from here (removing its local
definition) to keep one source of truth.

### `src/stores/route.ts` (Pinia)

```ts
import { defineStore } from 'pinia';
import { ref } from 'vue';
import { parseHash, destToHash, type Dest } from '../router/hashRoutes';

export const useRoute = defineStore('route', () => {
  const current = ref<Dest>(parseHash(window.location.hash));
  let started = false;

  function sync() { current.value = parseHash(window.location.hash); }

  function start() {
    if (started) return;
    started = true;
    if (!window.location.hash) window.location.hash = '#/';
    window.addEventListener('hashchange', sync);
    sync();
  }

  // Single writer: set the hash; the hashchange listener updates `current`.
  function navigate(dest: Dest) {
    const next = destToHash(dest);
    if (window.location.hash === next) { sync(); return; } // no event when unchanged
    window.location.hash = next;
  }

  return { current, start, navigate };
});
```

`navigate` writes only the hash; `hashchange` is the single point that updates
`current` — except when the hash is already correct (no event fires), where we
call `sync()` directly so a programmatic no-op still settles state.

### `src/AppShell.vue` (smallest viable change)

- Import `Dest` from `router/hashRoutes`; **remove** the local `type Dest`.
- Replace `const dest = ref<Dest>('home')` with `const route = useRoute()`; use
  `route.current` everywhere `dest` was read (the `<Transition>` switch, nav
  `active` classes, `destLabel`).
- `onMounted(() => route.start())`.
- In `go(target, payload?)`: keep all payload-stashing (`focusStudent`,
  `studentReturn`, `pocReopen`, `wizardStart`) and overlay handling exactly as
  now. For the 5 page targets, replace `dest.value = target` with
  `route.navigate(target as Dest)`. Overlay branch unchanged (no hash).
- Anywhere `dest.value = 'home'` was set imperatively (e.g. onboarding
  `@done="closeOverlay(); dest = 'home'"`), use `route.navigate('home')`.

All 23 `go()` call sites are untouched — only `go`'s internals change.

## Data Flow

```
click / emit('go') → go(target, payload)
   → stash payload in refs (unchanged)
   → route.navigate(target)        [page targets only]
   → window.location.hash = '#/...'
   → 'hashchange' event
   → route store: current = parseHash(hash)
   → <Transition> renders the matching page
```

One direction. Browser Back/Forward and refresh enter at the
`hashchange` / init read step and follow the same path. `file://` works because
nothing uses the History API or server routing.

## Edge Cases

- **Empty hash on first load** (`file://` or fresh `localhost`): `start()` sets
  `#/` → Home.
- **Unknown hash** (`#/nonsense`): `parseHash` → `home`. The displayed page is
  Home but the bad hash stays in the bar; acceptable (no redirect needed). If we
  want it tidied, `start()`/`sync()` could rewrite to `#/` on fallback — **not**
  doing this to keep behavior minimal and avoid history churn.
- **Hash to a hidden page** (`#/measurement`): not in `PATH_TO_DEST` → falls
  back to Home.
- **Refresh mid-overlay/sub-state:** overlay/sub-state is not persisted (by
  design); refresh lands on the page's root view. Page identity survives; modal
  context does not. Consistent with "overlays stay state."
- **Programmatic navigate to current page:** hash unchanged → no `hashchange`;
  `navigate` calls `sync()` so state still settles. (Sub-state reset, if any,
  is handled by the existing payload refs / view watchers.)

## Testing

**`tests/router/hashRoutes.test.ts`** (pure, primary coverage):
- `parseHash`: `''`, `'#'`, `'#/'` → `home`; `'#/students'` → `students-poc`;
  `'#/reports'`, `'#/settings'`, `'#/data'` → respective; `'#students'`
  (no slash) → `students-poc`; `'#/students/'` (trailing) → `students-poc`;
  `'#/measurement'`, `'#/nope'` → `home`.
- `destToHash`: each routable dest → expected hash; round-trip
  `parseHash(destToHash(d)) === d` for the 5 live dests; unroutable dest
  (`'measure'`) → `'#/'`.

**`tests/stores/route.test.ts`** (jsdom; Pinia + `window.location`/events):
- init reads existing `location.hash`.
- `navigate('reports')` sets `location.hash` to `#/reports` and (after
  `hashchange`) `current === 'reports'`.
- dispatching a manual `hashchange` (simulating Back/Forward) updates `current`.
- `start()` on empty hash sets `#/` and `current === 'home'`.

No new component tests: `AppShell`'s switch logic is structurally unchanged
(reads `route.current` instead of `dest`); existing build/type-check + manual
Playwright pass cover integration.

## Deliverables

1. `src/router/hashRoutes.ts` — pure hash↔dest mapping.
2. `src/stores/route.ts` — Pinia store owning `current`, `start`, `navigate`.
3. `AppShell.vue` migrated to the route store (payloads + overlays intact).
4. Browser Back/Forward + refresh-safe (via `hashchange` + hash read).
5. Single-file `dist/index.html` build unchanged.
