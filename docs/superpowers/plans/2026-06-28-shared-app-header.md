# Shared App Header Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace per-view headers with one shared, consistently-styled top bar (back · centered title · context chip) across all main shell screens.

**Architecture:** A reactive `useHeader` Pinia store holds the active screen's `{ title, back, context }`. A single presentational `<AppHeader>` (replacing `.topbar`) renders that state — back button left, absolutely-centered title, academic-year/session context right. Each view declares its header via `setHeader()` on mount and on drill-down changes; AppShell resets header on top-level nav and supplies a "go home" back fallback. A pure `effectiveBack` helper decides the active back handler.

**Tech Stack:** Vue 3 `<script setup>` + TS, Pinia, Vitest (node env), CSS tokens in `journeys.css`.

## Global Constraints

- `tsconfig` has `noUnusedLocals` — no unused imports/vars or the build fails.
- Write files with Write/Edit tools, never shell heredoc/echo.
- Test env is `node` (vitest `environment: 'node'`) — no component mounting; test stores and pure functions only.
- Pinia store pattern: `defineStore('name', () => { ... })` setup-style, matching `src/stores/data.ts`.
- Thai UI copy stays verbatim from existing views.
- Dev server is the user's on :5173 — never start/kill it.
- Scope: main shell views only (Home, Students, Students POC, Measure, Reports, Settings). Do NOT touch wizard / onboarding / promotion bars.

---

### Task 1: `useHeader` store + `effectiveBack` helper

**Files:**
- Create: `src/stores/header.ts`
- Test: `tests/stores/header.test.ts`

**Interfaces:**
- Produces:
  - `interface HeaderState { title: string; back: (() => void) | null; context: 'year' | 'session' }`
  - `useHeader()` store with reactive refs `title`, `back`, `context` and actions
    `setHeader(partial: Partial<HeaderState>): void`, `resetHeader(): void`.
  - `effectiveBack(viewBack: (() => void) | null, isHome: boolean, goHome: () => void): (() => void) | null`
    — returns `viewBack` if set; else `goHome` when `!isHome`; else `null`.

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { useHeader, effectiveBack } from '../../src/stores/header';

describe('useHeader store', () => {
  beforeEach(() => setActivePinia(createPinia()));

  it('defaults to empty title, no back, year context', () => {
    const h = useHeader();
    expect(h.title).toBe('');
    expect(h.back).toBeNull();
    expect(h.context).toBe('year');
  });

  it('setHeader merges partial state', () => {
    const h = useHeader();
    const fn = () => {};
    h.setHeader({ title: 'นักเรียน', back: fn });
    expect(h.title).toBe('นักเรียน');
    expect(h.back).toBe(fn);
    expect(h.context).toBe('year'); // untouched
  });

  it('setHeader can switch context to session', () => {
    const h = useHeader();
    h.setHeader({ context: 'session' });
    expect(h.context).toBe('session');
  });

  it('resetHeader restores defaults', () => {
    const h = useHeader();
    h.setHeader({ title: 'X', back: () => {}, context: 'session' });
    h.resetHeader();
    expect(h.title).toBe('');
    expect(h.back).toBeNull();
    expect(h.context).toBe('year');
  });
});

describe('effectiveBack', () => {
  it('returns the view back handler when provided', () => {
    const viewBack = () => {};
    expect(effectiveBack(viewBack, false, () => {})).toBe(viewBack);
  });

  it('falls back to goHome when no view back and not home', () => {
    const goHome = () => {};
    expect(effectiveBack(null, false, goHome)).toBe(goHome);
  });

  it('returns null when on home and no view back', () => {
    expect(effectiveBack(null, true, () => {})).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/stores/header.test.ts`
Expected: FAIL — cannot resolve `../../src/stores/header`.

- [ ] **Step 3: Write the store**

```ts
// src/stores/header.ts
import { defineStore } from 'pinia';
import { ref } from 'vue';

export interface HeaderState {
  title: string;
  back: (() => void) | null;
  context: 'year' | 'session';
}

export const useHeader = defineStore('header', () => {
  const title = ref('');
  const back = ref<(() => void) | null>(null);
  const context = ref<'year' | 'session'>('year');

  function setHeader(partial: Partial<HeaderState>) {
    if (partial.title !== undefined) title.value = partial.title;
    if (partial.back !== undefined) back.value = partial.back;
    if (partial.context !== undefined) context.value = partial.context;
  }
  function resetHeader() {
    title.value = '';
    back.value = null;
    context.value = 'year';
  }
  return { title, back, context, setHeader, resetHeader };
});

export function effectiveBack(
  viewBack: (() => void) | null,
  isHome: boolean,
  goHome: () => void,
): (() => void) | null {
  if (viewBack) return viewBack;
  if (!isHome) return goHome;
  return null;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/stores/header.test.ts`
Expected: PASS (7 tests).

- [ ] **Step 5: Commit**

```bash
git add src/stores/header.ts tests/stores/header.test.ts
git commit -m "feat: add useHeader store and effectiveBack helper"
```

---

### Task 2: `<AppHeader>` component + header CSS tokens

**Files:**
- Create: `src/components/AppHeader.vue`
- Modify: `src/journeys.css` (add `.app-header` block; near existing `.topbar` rules)

**Interfaces:**
- Consumes: `useHeader()` (`title`, `back`, `context`), `effectiveBack` from Task 1; `useData()` for period.
- Props: `goHome: () => void` (required) — fallback back handler from AppShell.
- Renders: three-zone bar; left back button shown only when `effectiveBack(...)` non-null;
  centered title; right context = year chip (`📅 ปีการศึกษา {year}`) or session line
  (`ภาคเรียนที่ {term} · ครั้งที่ {round}`).

> No component unit test (node env can't mount). Verify visually on :5173 after Task 8.

- [ ] **Step 1: Write the component**

```vue
<script setup lang="ts">
import { computed } from 'vue';
import { useData } from '../stores/data';
import { useHeader, effectiveBack } from '../stores/header';

const props = defineProps<{ goHome: () => void; isHome: boolean }>();
const data = useData();
const header = useHeader();

const backHandler = computed(() => effectiveBack(header.back, props.isHome, props.goHome));

const yearLine = computed(() => `ปีการศึกษา ${data.period.year}`);
const sessionLine = computed(() => {
  const s = data.measureSession;
  return s ? `ภาคเรียนที่ ${s.term} · ครั้งที่ ${s.round}` : yearLine.value;
});
const contextText = computed(() =>
  header.context === 'session' ? sessionLine.value : yearLine.value,
);
</script>

<template>
  <header class="app-header">
    <div class="ah-left">
      <button v-if="backHandler" class="ah-back" type="button" aria-label="ย้อนกลับ" @click="backHandler()">
        ←
      </button>
    </div>
    <div class="ah-title">{{ header.title }}</div>
    <div class="ah-right">
      <div class="period-chip" style="width: auto">📅 {{ contextText }}</div>
    </div>
  </header>
</template>
```

> `effectiveBack(header.back, props.isHome, props.goHome)`: a view-supplied drill-down
> `back` wins; else the AppShell `goHome` fallback shows on any non-home top-level page;
> else (home) no back button, left zone stays empty.

- [ ] **Step 2: Add CSS tokens to `src/journeys.css`**

Append:

```css
.app-header {
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  align-items: center;
  height: 56px;
  padding: 0 var(--s4);
  border-bottom: 1px solid var(--line);
  background: #fff;
  position: sticky;
  top: 0;
  z-index: 20;
}
.app-header .ah-left { justify-self: start; }
.app-header .ah-right { justify-self: end; }
.app-header .ah-title {
  grid-column: 2;
  justify-self: center;
  font-size: 18px;
  font-weight: 700;
  color: var(--ink);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 50vw;
}
.app-header .ah-back {
  border: 1px solid var(--line);
  background: #fff;
  border-radius: var(--r);
  width: 36px;
  height: 36px;
  font-size: 18px;
  cursor: pointer;
  color: var(--ink);
}
.app-header .ah-back:hover { background: var(--bg-soft, #f5f5f5); }
```

> The `1fr auto 1fr` grid guarantees the center column is centered regardless of left/right
> widths. Implementer: if `--bg-soft` is undefined in this codebase, drop that line.

- [ ] **Step 3: Type-check**

Run: `npx vue-tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/components/AppHeader.vue src/journeys.css
git commit -m "feat: add AppHeader component with centered title and context"
```

---

### Task 3: Wire AppHeader into AppShell, remove old topbar

**Files:**
- Modify: `src/AppShell.vue`

**Interfaces:**
- Consumes: `<AppHeader>` (Task 2) with props `:go-home="() => go('home')"` and `:is-home="dest === 'home'"`.
- Consumes: `useHeader().resetHeader` (Task 1).
- Produces: header reset on every top-level `go()` navigation.

- [ ] **Step 1: Import AppHeader and useHeader**

In `<script setup>` of `src/AppShell.vue`, add imports:

```ts
import AppHeader from './components/AppHeader.vue';
import { useHeader } from './stores/header';
```

And after `const data = useData();`:

```ts
const header = useHeader();
```

- [ ] **Step 2: Reset header on top-level navigation**

In the `go()` function, inside the `else` branch (the non-overlay path), after the
`dest.value = target as Dest;` line, add:

```ts
    header.resetHeader();
```

(Views will re-declare their header on mount; resetting prevents stale drill-down state leaking between pages.)

- [ ] **Step 3: Replace the topbar markup**

Replace:

```html
      <header v-if="!inWizardFlow" class="topbar">
        <div class="brand-logo" style="width: 32px; height: 32px; font-size: 17px">🍎</div>
        <div class="period-chip" style="width: auto; margin-left: auto">📅 {{ periodShort }}</div>
      </header>
```

with:

```html
      <AppHeader v-if="!inWizardFlow" :go-home="() => go('home')" :is-home="dest === 'home'" />
```

- [ ] **Step 4: Remove now-unused `periodShort` if unreferenced**

Search `src/AppShell.vue` for other uses of `periodShort`. If none remain, delete its
`const periodShort = computed(...)` declaration (noUnusedLocals will fail the build otherwise).
Keep `periodLine` only if still referenced; otherwise remove it too.

- [ ] **Step 5: Type-check and build**

Run: `npx vue-tsc --noEmit`
Expected: no errors (no unused locals).

- [ ] **Step 6: Commit**

```bash
git add src/AppShell.vue
git commit -m "feat: render shared AppHeader in shell, reset header on nav"
```

---

### Task 4: Home, Reports, Settings, Students POC — single-level headers

**Files:**
- Modify: `src/features/HomeView.vue`, `src/features/ReportsView.vue`,
  `src/features/SettingsView.vue`, `src/features/StudentsPocView.vue`

**Interfaces:**
- Consumes: `useHeader().setHeader` (Task 1).
- Each view sets `{ title, back: null, context: 'year' }` on mount and drops its
  in-content `<h1 class="page-title">`.

- [ ] **Step 1: HomeView — set header on mount, remove page-title h1**

In `src/features/HomeView.vue` `<script setup>`, add imports/onMounted:

```ts
import { onMounted } from 'vue';
import { useHeader } from '../stores/header';

const header = useHeader();
onMounted(() => header.setHeader({ title: 'หน้าหลัก', back: null, context: 'year' }));
```

Remove the line:

```html
    <h1 class="page-title"><template v-if="teacherName">สวัสดี คุณครู{{ teacherName }} 👋</template><template v-else>สวัสดีคุณครู 👋</template></h1>
```

Keep the `<p class="page-sub">ภาพรวมของวันนี้</p>` intro line.

> If `onMounted` or `computed` were already imported, merge into the existing import — do not duplicate (noUnusedLocals + duplicate import errors).

- [ ] **Step 2: ReportsView — same pattern**

In `src/features/ReportsView.vue` add:

```ts
import { onMounted } from 'vue';
import { useHeader } from '../stores/header';

const header = useHeader();
onMounted(() => header.setHeader({ title: 'รายงาน', back: null, context: 'year' }));
```

Remove:

```html
    <h1 class="page-title">รายงานสำหรับหน่วยงานต้นสังกัด</h1>
```

Keep the `<p class="page-sub">…</p>` line.

- [ ] **Step 3: SettingsView — same pattern**

In `src/features/SettingsView.vue` add (merge with existing imports):

```ts
import { onMounted } from 'vue';
import { useHeader } from '../stores/header';

const header = useHeader();
onMounted(() => header.setHeader({ title: 'ตั้งค่า', back: null, context: 'year' }));
```

Remove:

```html
    <h1 class="page-title">ตั้งค่า</h1>
```

Keep its `page-sub`.

- [ ] **Step 4: StudentsPocView — same pattern**

In `src/features/StudentsPocView.vue` add:

```ts
import { onMounted } from 'vue';
import { useHeader } from '../stores/header';

const header = useHeader();
onMounted(() => header.setHeader({ title: 'นักเรียน (POC)', back: null, context: 'year' }));
```

Remove:

```html
    <h1 class="page-title">นักเรียน (POC)</h1>
```

Keep its `page-sub`.

- [ ] **Step 5: Type-check**

Run: `npx vue-tsc --noEmit`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add src/features/HomeView.vue src/features/ReportsView.vue src/features/SettingsView.vue src/features/StudentsPocView.vue
git commit -m "feat: route single-level view titles through shared header"
```

---

### Task 5: StudentsView — list + student-detail drill-down

**Files:**
- Modify: `src/features/StudentsView.vue`

**Interfaces:**
- Consumes: `useHeader().setHeader` (Task 1).
- List level: `{ title: 'นักเรียน', back: null, context: 'year' }`.
- Detail level (`open` set): `{ title: '<first> <last>', back: () => open = null }`.

- [ ] **Step 1: Add header wiring**

In `src/features/StudentsView.vue` `<script setup>` add (merge imports):

```ts
import { onMounted, watch } from 'vue';
import { useHeader } from '../stores/header';

const header = useHeader();
function syncHeader() {
  if (open.value) {
    header.setHeader({
      title: `${open.value.firstName} ${open.value.lastName}`,
      back: () => { open.value = null; },
      context: 'year',
    });
  } else {
    header.setHeader({ title: 'นักเรียน', back: null, context: 'year' });
  }
}
onMounted(syncHeader);
watch(open, syncHeader);
```

> `open` is the existing drill-down ref. Confirm its name by reading the file; if it differs (e.g. `detail`), use that. `watch`/`onMounted` may already be imported — merge.

- [ ] **Step 2: Remove the in-content page-title and inline back button**

Remove:

```html
      <h1 class="page-title">นักเรียน</h1>
```

(keep the `page-sub` instruction line).

Remove the inline detail back button:

```html
      <button class="btn quiet" style="margin-bottom: var(--s4)" @click="open = null">← กลับรายชื่อ {{ open.grade }}/{{ open.room }}</button>
```

> The detail view's own large `<h1 style="font-size: 24px">{{ open.firstName }} …</h1>` may stay as in-content content if it carries extra layout meaning, but the navigational title + back now live in the shared bar. Implementer decision: if the in-content name h1 now looks redundant directly under the bar, remove it; otherwise keep. Default: remove the redundant name h1.

- [ ] **Step 3: Type-check**

Run: `npx vue-tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/features/StudentsView.vue
git commit -m "feat: drive Students list/detail nav through shared header"
```

---

### Task 6: MeasureView — rooms + room-results drill-down (session context)

**Files:**
- Modify: `src/features/MeasureView.vue`

**Interfaces:**
- Consumes: `useHeader().setHeader` (Task 1).
- Rooms level (`view === 'rooms'`): `{ title: 'บันทึกการวัด', back: null, context: 'year' }`.
- Results level (`view === 'results'`): `{ title: 'ผลการวัด · ห้อง <picked>', back: () => view = 'rooms', context: 'session' }`.

- [ ] **Step 1: Add header wiring**

In `src/features/MeasureView.vue` `<script setup>` add (merge imports):

```ts
import { onMounted, watch } from 'vue';
import { useHeader } from '../stores/header';

const header = useHeader();
function syncHeader() {
  if (view.value === 'results') {
    header.setHeader({
      title: `ผลการวัด · ห้อง ${picked.value}`,
      back: () => { view.value = 'rooms'; },
      context: 'session',
    });
  } else {
    header.setHeader({ title: 'บันทึกการวัด', back: null, context: 'year' });
  }
}
onMounted(syncHeader);
watch([view, picked], syncHeader);
```

> Confirm the drill-down ref names by reading the file: the survey shows `view` (`'rooms'`/`'results'`) and `picked`. Use the actual names.

- [ ] **Step 2: Remove in-content page-titles and inline back**

Remove the rooms-level title:

```html
      <h1 class="page-title">บันทึกการวัด</h1>
```

Remove the results-level inline back + title:

```html
      <button class="btn quiet" style="margin-bottom: var(--s3)" @click="view = 'rooms'">← เลือกห้องอื่น</button>
      <h1 class="page-title">ผลการวัด · ห้อง {{ picked }}</h1>
```

Keep both `page-sub` instruction lines as in-content intro text.

- [ ] **Step 3: Type-check**

Run: `npx vue-tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/features/MeasureView.vue
git commit -m "feat: drive Measure rooms/results nav through shared header with session context"
```

---

### Task 7: Full suite + type-check gate

**Files:** none (verification task).

- [ ] **Step 1: Run the full test suite**

Run: `npm test`
Expected: PASS, including `tests/stores/header.test.ts`.

- [ ] **Step 2: Type-check**

Run: `npx vue-tsc --noEmit`
Expected: no errors (no unused `periodShort`/`periodLine`/imports anywhere).

- [ ] **Step 3: Production build**

Run: `npm run build`
Expected: builds to single `dist/index.html` with no errors.

- [ ] **Step 4: Commit (if any lockfile/artifact churn worth recording; else skip)**

No code commit expected here — this task is a gate.

---

### Task 8: Manual visual verification on :5173

**Files:** none (verification task; dev server is the user's, already running).

- [ ] **Step 1: Verify each screen's header**

Open http://localhost:5173 and confirm for Home, Students, Students POC, Measure, Reports, Settings:
- Header height/typography/border identical on every screen.
- Title visually centered in the bar on every screen (centered with AND without a back button).
- Home: left empty (no back). Other top-level pages: left shows a back-to-home `←`.
- Right: academic-year chip on all; Measure room-results shows session line (ภาคเรียน · ครั้งที่).

- [ ] **Step 2: Verify drill-down back behavior**

- Students: open a student → title = student name, `←` returns to list.
- Measure: pick a room → title = `ผลการวัด · ห้อง <room>`, context = session, `←` returns to rooms.

- [ ] **Step 3: Verify wizards/onboarding/promotion unchanged**

Enter a wizard flow → AppHeader hidden (`inWizardFlow`), wizard's own bar shown. Onboarding/promotion overlays keep their own bars.

- [ ] **Step 4: Screenshot for the record (optional)**

Save any screenshots to `.playwright-mcp/` (gitignored), never repo root.

---

## Self-Review Notes

- **Spec coverage:** store (T1), AppHeader + centering CSS (T2), AppShell wiring + topbar removal + reset-on-nav (T3), single-level views (T4), Students drill-down (T5), Measure drill-down + session context (T6), verification (T7–T8). All spec sections mapped.
- **Type consistency:** `setHeader`/`resetHeader`/`effectiveBack`/`HeaderState` names identical across T1–T6. AppHeader props `goHome`+`isHome` match AppShell binding in T3.
- **Out-of-scope honored:** no wizard/onboarding/promotion edits.
- **noUnusedLocals risk** flagged in T3 (periodShort) and every view task (merge imports).
