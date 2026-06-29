# Student Workspace (POC) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Merge the POC student roster and per-round measurement results into one round-scoped **Student Workspace** table inside `StudentsPocView.vue`.

**Architecture:** Two pure, unit-tested domain helpers (display-label shortening; default-round selection) plus a rewrite of the POC view's `students` surface into a single combined table. Measurement entry is no longer in this menu; row click reuses the existing Student Detail profile in `StudentsView.vue` via the `focus-id` prop. `engine.ts` is untouched — classification still flows through the single engine; only rendered text is shortened.

**Tech Stack:** Vue 3 + TS + Vite, Pinia store (`src/stores/data.ts`), Vitest (domain unit tests), Playwright (UI verification against the user's dev server at http://localhost:5173).

## Global Constraints

- `tsconfig` has `noUnusedLocals` — no unused imports/locals or the build fails.
- ALL nutrition classification flows through `src/domain/nutrition/engine.ts`. Do NOT add classification logic or alter label semantics there. Label shortening is display-only in a separate module.
- `npm run build` = `vue-tsc --noEmit && vite build`. Type-check with `npx vue-tsc --noEmit`.
- Dev server is the user's, always running on http://localhost:5173. NEVER start or kill it. Vite HMR picks up edits.
- Playwright screenshots save to `.playwright-mcp/` (gitignored), never repo root.
- **Commits are the user's.** Do NOT run `git add`/`git commit`/`git push`. Leave changes in the working tree; end each task at the verification step.
- Thai labels exact — copy verbatim from this plan, do not retype Thai by hand.

---

### Task 1: Display-label shortening helper

Pure module that shortens assessment labels for display by stripping the prefix that duplicates the column header. Engine values and color-class mapping are unchanged.

**Files:**
- Create: `src/domain/nutrition/labels.ts`
- Test: `tests/nutrition/labels.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `shortWfa(label: string): string` — น้ำหนัก/อายุ (WFA) display text.
  - `shortHfa(label: string): string` — ส่วนสูง/อายุ (HFA) display text.
  - WFH and สูงดีสมส่วน are intentionally NOT shortened (no function; render raw).

- [ ] **Step 1: Write the failing test**

```ts
// tests/nutrition/labels.test.ts
import { describe, it, expect } from 'vitest';
import { shortWfa, shortHfa } from '../../src/domain/nutrition/labels';

describe('shortWfa', () => {
  it('strips the น้ำหนัก prefix that duplicates the column header', () => {
    expect(shortWfa('น้ำหนักน้อย')).toBe('น้อย');
    expect(shortWfa('น้ำหนักค่อนข้างน้อย')).toBe('ค่อนข้างน้อย');
    expect(shortWfa('น้ำหนักตามเกณฑ์')).toBe('ตามเกณฑ์');
    expect(shortWfa('น้ำหนักค่อนข้างมาก')).toBe('ค่อนข้างมาก');
    expect(shortWfa('น้ำหนักมาก')).toBe('มาก');
  });
  it('passes through unknown values unchanged', () => {
    expect(shortWfa('ยังไม่วัด')).toBe('ยังไม่วัด');
  });
});

describe('shortHfa', () => {
  it('shortens สูงตามเกณฑ์ only; already-short labels pass through', () => {
    expect(shortHfa('สูงตามเกณฑ์')).toBe('ตามเกณฑ์');
    expect(shortHfa('เตี้ย')).toBe('เตี้ย');
    expect(shortHfa('ค่อนข้างเตี้ย')).toBe('ค่อนข้างเตี้ย');
    expect(shortHfa('ค่อนข้างสูง')).toBe('ค่อนข้างสูง');
    expect(shortHfa('สูง')).toBe('สูง');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/nutrition/labels.test.ts`
Expected: FAIL — cannot find module `src/domain/nutrition/labels`.

- [ ] **Step 3: Write minimal implementation**

```ts
// src/domain/nutrition/labels.ts
// Display-only label shortening. Engine values are unchanged; we only strip the
// prefix that duplicates the table column header (น้ำหนัก/อายุ, ส่วนสูง/อายุ).

const WFA_SHORT: Record<string, string> = {
  น้ำหนักน้อย: 'น้อย',
  น้ำหนักค่อนข้างน้อย: 'ค่อนข้างน้อย',
  น้ำหนักตามเกณฑ์: 'ตามเกณฑ์',
  น้ำหนักค่อนข้างมาก: 'ค่อนข้างมาก',
  น้ำหนักมาก: 'มาก',
};

const HFA_SHORT: Record<string, string> = {
  สูงตามเกณฑ์: 'ตามเกณฑ์',
};

export function shortWfa(label: string): string {
  return WFA_SHORT[label] ?? label;
}

export function shortHfa(label: string): string {
  return HFA_SHORT[label] ?? label;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/nutrition/labels.test.ts`
Expected: PASS (both suites).

- [ ] **Step 5: Verify types & stop for review**

Run: `npx vue-tsc --noEmit`
Expected: no errors. Leave changes staged for the user; do not commit.

---

### Task 2: Default-round selector

Pure helper picking which term/round tab Workspace opens on: the latest round that has any data for the room, falling back to term 1 / round 1.

**Files:**
- Create: `src/domain/measure/default-round.ts`
- Test: `tests/measure/default-round.test.ts`

**Interfaces:**
- Consumes: `Term`, `Round` from `src/domain/types`.
- Produces:
  - `type Session = { term: Term; round: Round }`
  - `const SESSION_ORDER: Session[]` — canonical order:
    `[{1,1},{1,2},{2,1},{2,2}]`.
  - `defaultRound(hasData: (s: Session) => boolean): Session` — returns the LAST session in `SESSION_ORDER` for which `hasData` is true; if none, returns `SESSION_ORDER[0]` (`{term:'1',round:'1'}`).

- [ ] **Step 1: Write the failing test**

```ts
// tests/measure/default-round.test.ts
import { describe, it, expect } from 'vitest';
import { defaultRound, SESSION_ORDER } from '../../src/domain/measure/default-round';

describe('defaultRound', () => {
  it('falls back to term 1 round 1 when no round has data', () => {
    expect(defaultRound(() => false)).toEqual({ term: '1', round: '1' });
  });
  it('returns the latest round that has data', () => {
    const withData = new Set(['1-1', '2-1']);
    const pick = defaultRound((s) => withData.has(`${s.term}-${s.round}`));
    expect(pick).toEqual({ term: '2', round: '1' });
  });
  it('returns the only round that has data', () => {
    const withData = new Set(['1-2']);
    const pick = defaultRound((s) => withData.has(`${s.term}-${s.round}`));
    expect(pick).toEqual({ term: '1', round: '2' });
  });
  it('exposes the canonical session order', () => {
    expect(SESSION_ORDER).toEqual([
      { term: '1', round: '1' },
      { term: '1', round: '2' },
      { term: '2', round: '1' },
      { term: '2', round: '2' },
    ]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/measure/default-round.test.ts`
Expected: FAIL — cannot find module `src/domain/measure/default-round`.

- [ ] **Step 3: Write minimal implementation**

```ts
// src/domain/measure/default-round.ts
import type { Term, Round } from '../types';

export type Session = { term: Term; round: Round };

export const SESSION_ORDER: Session[] = [
  { term: '1', round: '1' },
  { term: '1', round: '2' },
  { term: '2', round: '1' },
  { term: '2', round: '2' },
];

export function defaultRound(hasData: (s: Session) => boolean): Session {
  for (let i = SESSION_ORDER.length - 1; i >= 0; i--) {
    if (hasData(SESSION_ORDER[i])) return SESSION_ORDER[i];
  }
  return SESSION_ORDER[0];
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/measure/default-round.test.ts`
Expected: PASS.

- [ ] **Step 5: Verify types & stop for review**

Run: `npx vue-tsc --noEmit`
Expected: no errors. Leave changes staged; do not commit.

---

### Task 3: Wire AppShell `go()` to focus a student → Student Detail

Allow a `go('students', { focus })` call so a Workspace row click opens the existing Student Detail profile in `StudentsView.vue`.

**Files:**
- Modify: `src/AppShell.vue` (the `go` function, ~lines 69-85; `Dest`/payload types ~line 18-31)

**Interfaces:**
- Consumes: existing `focusStudent` ref and `StudentsView`'s `:focus-id` prop (already wired at `AppShell.vue:159`).
- Produces: `go('students', { focus: studentId })` sets `focusStudent.value = studentId` then navigates to `students`. Workspace (Task 5) calls this.

- [ ] **Step 1: Extend the `go` payload type and handler**

In `src/AppShell.vue`, update the `go` signature to accept a `focus` payload and set `focusStudent`. Current signature:

```ts
function go(target: string, payload?: { grade: string; room: string } | { start: string }) {
```

Replace with:

```ts
function go(
  target: string,
  payload?: { grade: string; room: string } | { start: string } | { focus: string },
) {
  if (target === 'import' || target === 'promotion' || target === 'onboarding') {
    if (target === 'import' && payload && 'grade' in payload) {
      importTarget.value = payload;
    }
    overlay.value = target as Overlay;
  } else {
    if (target === 'wizard') {
      wizardStart.value = payload && 'start' in payload ? payload.start : null;
    }
    if (target === 'students' && payload && 'focus' in payload) {
      focusStudent.value = payload.focus;
    }
    dest.value = target as Dest;
    header.setHeader({ title: nav.find((n) => n.id === target)?.label ?? '', back: null, context: 'year' });
  }
  window.scrollTo({ top: 0 });
}
```

(Only the `if (target === 'students' ...)` line and the widened payload union are new; keep the rest of the function identical to the original.)

- [ ] **Step 2: Verify types**

Run: `npx vue-tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Manual verification (Playwright)**

With the user's dev server at http://localhost:5173: this wiring is exercised end-to-end in Task 5 (row click). For now confirm the app still loads and the existing `นักเรียน` menu opens a student profile by clicking a row. Screenshot to `.playwright-mcp/task3-students.png`. Leave changes staged; do not commit.

---

### Task 4: Simplify POC map cards + add round state/tabs

Strip the room cards to navigation-only and introduce the round selector state that Task 5's table consumes.

**Files:**
- Modify: `src/features/StudentsPocView.vue`

**Interfaces:**
- Consumes: `SESSION_ORDER`, `defaultRound`, `Session` from `src/domain/measure/default-round`; store `data.findDuplicate`, `data.roomStudents`, `data.period`.
- Produces (script-local, used by Task 5):
  - `sessTerm: Ref<Term>`, `sessRound: Ref<Round>`
  - `SESSIONS` tab list (term, round, label)
  - `pickSession(term, round)`, `isActiveSession(term, round)`, `sessionCount(term, round)`
  - `applyDefaultRound()` called from `openRoom`

- [ ] **Step 1: Remove card summary pills (map → navigation only)**

In the template's room card (`<button class="room-card" ...>`, ~lines 159-175), delete the `<span class="rc-tags">…</span>` block entirely (both the progress pill and the `risk` pill). Keep `rc-name` and `rc-count`. Remove the now-unused `progressClass`, `progressText`, `roomRisk`, and `cardIndex`-stagger only if they become unused elsewhere — check: `roomRisk` is also used by `roomRiskCount` (keep), `cardIndex` still drives stagger (keep). Remove `progressClass`/`progressText` if no remaining references (they are only used in the deleted block — remove them to satisfy `noUnusedLocals`).

- [ ] **Step 2: Add round selector state + helpers in `<script setup>`**

Add imports and state (place near the existing roster section):

```ts
import { SESSION_ORDER, defaultRound } from '../domain/measure/default-round';
import type { Term, Round } from '../domain/types';

const sessTerm = ref<Term>('1');
const sessRound = ref<Round>('1');

const SESSIONS: { term: Term; round: Round; label: string }[] = [
  { term: '1', round: '1', label: 'ภาคเรียนที่ 1 · ครั้งที่ 1' },
  { term: '1', round: '2', label: 'ภาคเรียนที่ 1 · ครั้งที่ 2' },
  { term: '2', round: '1', label: 'ภาคเรียนที่ 2 · ครั้งที่ 1' },
  { term: '2', round: '2', label: 'ภาคเรียนที่ 2 · ครั้งที่ 2' },
];

function isActiveSession(term: Term, round: Round) {
  return sessTerm.value === term && sessRound.value === round;
}
function pickSession(term: Term, round: Round) {
  sessTerm.value = term;
  sessRound.value = round;
}
function sessionCount(term: Term, round: Round): number {
  return roomStudents.value.filter(
    (s) => data.findDuplicate(s.id, data.period.year, term, round) !== null,
  ).length;
}
function applyDefaultRound() {
  const pick = defaultRound((s) =>
    roomStudents.value.some(
      (st) => data.findDuplicate(st.id, data.period.year, s.term, s.round) !== null,
    ),
  );
  sessTerm.value = pick.term;
  sessRound.value = pick.round;
}
```

Note: `SESSION_ORDER` is imported for parity with the helper but only `defaultRound` is called here — if `SESSION_ORDER` stays unused, import only `defaultRound` to satisfy `noUnusedLocals`.

- [ ] **Step 3: Call `applyDefaultRound()` when a room opens**

In `openRoom(g, r)`, after setting `grade.value`/`room.value` and before `view.value = 'students'`, add `applyDefaultRound();`. Because `roomStudents` is a computed off `grade`/`room`, set those first (they already are) so the default sees the right roster.

- [ ] **Step 4: Verify types**

Run: `npx vue-tsc --noEmit`
Expected: no errors (watch for unused `progressClass`/`progressText`/`SESSION_ORDER`).

- [ ] **Step 5: Manual verification (Playwright)**

Open http://localhost:5173 → `นักเรียน (POC)`. Confirm room cards show only name + count (no pills). Screenshot `.playwright-mcp/task4-map.png`. Leave staged; do not commit.

---

### Task 5: Workspace combined table

Replace the POC roster table with the round-scoped combined table: student info + plain-text W/H + four assessment columns, shortened labels, per-student empty state, risk filter, search without status pill, export-only action, row → Student Detail.

**Files:**
- Modify: `src/features/StudentsPocView.vue`

**Interfaces:**
- Consumes: Task 4 state (`sessTerm`, `sessRound`, `SESSIONS`, `pickSession`, `isActiveSession`, `sessionCount`); `shortWfa`, `shortHfa` from `src/domain/nutrition/labels`; `calcNutrition`; store `data.findDuplicate`, `data.roomStudents`; AppShell `go('students', { focus })` (Task 3).
- Produces: final Workspace UI. No exports to later tasks.

- [ ] **Step 1: Add per-round assessment helper in `<script setup>`**

```ts
import { shortWfa, shortHfa } from '../domain/nutrition/labels';

type Assess = { wfa: string; hfa: string; wfh: string; tall: boolean } | null;
function assessFor(s: Student): { measure: Measurement | null; result: Assess } {
  const m = data.findDuplicate(s.id, data.period.year, sessTerm.value, sessRound.value);
  if (!m) return { measure: null, result: null };
  return { measure: m, result: calcNutrition(s, m) };
}

const wfhClass: Record<string, string> = {
  ผอม: 'bad', ค่อนข้างผอม: 'warn', สมส่วน: 'good', ท้วม: 'warn', เริ่มอ้วน: 'warn', อ้วน: 'bad',
};
const wfaClass: Record<string, string> = {
  น้ำหนักน้อย: 'bad', น้ำหนักค่อนข้างน้อย: 'warn', น้ำหนักตามเกณฑ์: 'good',
  น้ำหนักค่อนข้างมาก: 'warn', น้ำหนักมาก: 'bad',
};
const hfaClass: Record<string, string> = {
  เตี้ย: 'bad', ค่อนข้างเตี้ย: 'warn', สูงตามเกณฑ์: 'good', ค่อนข้างสูง: 'good', สูง: 'good',
};
```

Add `Measurement` to the existing `import type { Student } from '../domain/types'` line: `import type { Student, Measurement } from '../domain/types'`.

- [ ] **Step 2: Redefine round-scoped risk for the filter**

The existing `statusOf`/`roomRisk`/`roomRiskCount`/`currentRoomStudents`/`riskOnly` use latest-status. Rescope risk to the SELECTED round. Replace `statusOf` usage in the roster with a round-based predicate:

```ts
function rowRisk(s: Student): boolean {
  const r = assessFor(s).result;
  if (!r) return false;
  return r.wfh !== 'สมส่วน'; // any non-สมส่วน WFH counts as at-risk
}
const roomRiskCount = computed(() => roomStudents.value.filter(rowRisk).length);
const currentRoomStudents = computed(() =>
  riskOnly.value ? roomStudents.value.filter(rowRisk) : roomStudents.value,
);
```

Remove the old latest-based `statusOf` and `roomRisk(grade,room)` if they are now unused (the search results table also used `statusOf` — see Step 4; remove only after Step 4 drops it). `noUnusedLocals` will flag leftovers.

- [ ] **Step 3: Replace the roster `<template v-else>` block with the Workspace UI**

Replace the entire students-view block (the `<template v-else> … </template>` containing `room-actions` + the roster `panel`, ~lines 182-233) with:

```html
<template v-else>
  <!-- export-only action -->
  <div class="room-actions">
    <button class="act-card" :disabled="!roomStudents.length" @click="exportRoom">
      <span class="act-ico" aria-hidden="true">📤</span>
      <span class="act-body">
        <span class="act-title">ส่งออกรายชื่อนักเรียน</span>
        <span class="act-desc">ดาวน์โหลดรายชื่อนักเรียนของห้องนี้เป็นไฟล์ Excel</span>
      </span>
    </button>
  </div>

  <!-- session selector -->
  <div class="round-tabs session-tabs" role="tablist">
    <button
      v-for="s in SESSIONS"
      :key="s.term + s.round"
      class="round-tab"
      :class="{ on: isActiveSession(s.term, s.round) }"
      role="tab"
      :aria-selected="isActiveSession(s.term, s.round)"
      @click="pickSession(s.term, s.round)"
    >
      {{ s.label }}
      <span class="rt-count" :class="sessionCount(s.term, s.round) === roomStudents.length && roomStudents.length > 0 ? 'good' : sessionCount(s.term, s.round) === 0 ? 'neutral' : 'warn'">{{ sessionCount(s.term, s.round) }}/{{ roomStudents.length }}</span>
    </button>
  </div>

  <div class="panel">
    <div class="toolbar">
      <div class="section-title" style="margin: 0">ห้อง {{ grade }}/{{ room }}</div>
      <span class="spacer"></span>
      <button
        v-if="roomRiskCount"
        class="chipbtn"
        :class="{ on: riskOnly }"
        :aria-pressed="riskOnly"
        @click="riskOnly = !riskOnly"
      >
        ⚠️ เฉพาะกลุ่มเสี่ยง <span class="chip-n">{{ roomRiskCount }}</span>
      </button>
    </div>
    <div class="table-wrap ws-scroll">
      <table class="ws-table">
        <thead>
          <tr>
            <th>รหัส</th><th>ชื่อ-สกุล</th><th>เพศ</th>
            <th>น้ำหนัก</th><th>ส่วนสูง</th>
            <th>น้ำหนัก/อายุ</th><th>ส่วนสูง/อายุ</th><th>น้ำหนัก/ส่วนสูง</th><th>สูงดีสมส่วน</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="s in currentRoomStudents" :key="s.id" @click="$emit('go', 'students', { focus: s.id })">
            <td>{{ s.id }}</td>
            <td class="nm">{{ s.firstName }} {{ s.lastName }}</td>
            <td>{{ s.gender }}</td>
            <template v-if="assessFor(s).measure">
              <td>{{ assessFor(s).measure!.weightKg }} กก.</td>
              <td>{{ assessFor(s).measure!.heightCm }} ซม.</td>
              <template v-if="assessFor(s).result">
                <td><span class="pill" :class="wfaClass[assessFor(s).result!.wfa]">{{ shortWfa(assessFor(s).result!.wfa) }}</span></td>
                <td><span class="pill" :class="hfaClass[assessFor(s).result!.hfa]">{{ shortHfa(assessFor(s).result!.hfa) }}</span></td>
                <td><span class="pill" :class="wfhClass[assessFor(s).result!.wfh]">{{ assessFor(s).result!.wfh }}</span></td>
                <td><span class="pill" :class="assessFor(s).result!.tall ? 'good' : 'warn'">{{ assessFor(s).result!.tall ? 'สูงดีสมส่วน' : 'ไม่สมส่วน' }}</span></td>
              </template>
              <td v-else class="empty-cell" colspan="4">ประเมินไม่ได้</td>
            </template>
            <template v-else>
              <td>—</td><td>—</td>
              <td class="empty-cell" colspan="4">ยังไม่วัด</td>
            </template>
          </tr>
          <tr v-if="!currentRoomStudents.length">
            <td colspan="9" class="empty-cell">
              {{ riskOnly ? 'ไม่มีนักเรียนกลุ่มเสี่ยงในห้องนี้ 🎉' : 'ห้องนี้ยังไม่มีรายชื่อนักเรียน' }}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>
```

Note: the `colspan="4"` on an empty cell after two `<td>` weight/height cells keeps the row at 9 columns. Verify column counts visually in Step 6.

- [ ] **Step 4: Drop the status pill from whole-school search results**

In the search results table (`<section v-if="searching">`, ~lines 124-141): remove the `<th>ภาวะล่าสุด</th>` header cell and the matching `<td><span class="pill" …>{{ statusOf(s).label }}</span></td>` body cell. Update the empty-row `colspan="4"` → `colspan="3"`. After this, `statusOf` should be unreferenced — remove it and the now-unused `StatusCls` type / `calcNutrition` import ONLY if nothing else uses them (`assessFor` uses `calcNutrition`, so keep that import).

- [ ] **Step 5: Add minimal table styles in `<style scoped>`**

```css
/* workspace combined table: horizontal scroll on narrow screens */
.ws-scroll { overflow-x: auto; }
.ws-table { min-width: 860px; }
.ws-table .pill { white-space: normal; }
.round-tabs { display: inline-flex; gap: 4px; background: var(--surface-2); padding: 4px; border-radius: 12px; margin-bottom: var(--s3); flex-wrap: wrap; }
.round-tab { display: inline-flex; align-items: center; gap: 8px; border: none; background: transparent; border-radius: 9px; cursor: pointer; padding: 8px 16px; font-size: 15px; font-weight: 700; color: var(--ink-muted); }
.round-tab.on { background: var(--surface); color: var(--brand-ink); box-shadow: 0 1px 3px rgba(20,30,35,0.12); }
.rt-count { font-size: 12px; font-weight: 700; padding: 1px 8px; border-radius: 999px; }
.rt-count.good { background: var(--good-tint); color: var(--good); }
.rt-count.warn { background: var(--warn-tint); color: var(--warn); }
.rt-count.neutral { background: var(--surface-2); color: var(--ink-muted); }
```

- [ ] **Step 6: Verify types**

Run: `npx vue-tsc --noEmit`
Expected: no errors. Resolve any `noUnusedLocals` from removed helpers (`statusOf`, `progressClass`, `progressText`, old `roomRisk`).

- [ ] **Step 7: Run the full domain test suite**

Run: `npm test`
Expected: all pass (Task 1 + Task 2 suites green, nothing else broken).

- [ ] **Step 8: Manual verification (Playwright)**

Open http://localhost:5173 → `นักเรียน (POC)` → a grade → a room. Verify:
- session tabs render with `n/total` badges; default tab is the latest round with data;
- table shows id/name/gender, plain-text น้ำหนัก/ส่วนสูง with units, four assessment columns;
- WFA/HFA labels are shortened (e.g. `ตามเกณฑ์`), WFH and สูงดีสมส่วน unchanged;
- a student with no record this round shows `—` / `—` and `ยังไม่วัด`;
- switching tabs refreshes the table to that round only;
- the risk chip filters; the 🔍 search results have no status pill;
- clicking a row opens the Student Detail profile (lands on `นักเรียน` with the profile open).

Screenshot `.playwright-mcp/task5-workspace.png`. Leave staged; do not commit.

---

## Self-Review

- **Spec coverage:** journey/map simplification (Task 4) · session selector + default round (Task 2, Task 4) · round-scoped single table with 4 columns (Task 5) · plain-text W/H (Task 5) · label shortening display-only (Task 1, Task 5) · per-student empty (Task 5) · export-only action, no import, no MeasureView link (Task 5) · row → Student Detail (Task 3, Task 5) · search without pill (Task 5) · wide-table scroll (Task 5). Out-of-scope items (Student Detail redesign, historical viz, school-wide browsing) — no tasks, correct.
- **Placeholders:** none; all code shown.
- **Type consistency:** `Session`/`SESSION_ORDER`/`defaultRound` consistent across Tasks 2/4; `assessFor` return shape matches `calcNutrition` `{wfa,hfa,wfh,tall}` used in Task 5; `go('students', { focus })` payload defined in Task 3 matches the call in Task 5.
