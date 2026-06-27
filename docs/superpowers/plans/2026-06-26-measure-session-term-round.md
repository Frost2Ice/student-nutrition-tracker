# Measure Session (Semester + Round) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move semester (ภาคเรียน / `term`) and round (ครั้งที่ / `round`) out of global Settings and into the Measure screen, where the teacher picks one of 4 sessions (2 semesters × 2 rounds) per academic year while measuring.

**Architecture:** Global `period` shrinks to `{ year }`. A new non-persisted store ref `measureSession` holds the `{ term, round }` the teacher is actively editing. MeasureView shows 4 combined session tabs; the room list shows current-year overall progress; the header reflects the active session only while measuring. Per-`Measurement` `term`/`round` are unchanged.

**Tech Stack:** Vue 3 + TypeScript + Vite, Pinia store, Vitest. Single-file offline app. UI copy is Thai.

## Global Constraints

- `tsconfig` has `noUnusedLocals` — remove every import/var left unused by an edit, or `vue-tsc` build fails.
- All teacher-facing labels use clear, full Thai words. Session label format: `ภาคเรียนที่ {term} · ครั้งที่ {round}`.
- `Term = '1' | '2'`, `Round = '1' | '2'` (from `src/domain/types.ts`) — unchanged.
- Default measure session on table open is always semester 1 round 1.
- Verify type safety after each view edit with `npx vue-tsc --noEmit`.
- Do NOT commit unless the user approves each commit (project git rule); the `git commit` steps below are written for the user to run/approve.
- Dev server is the user's on :5173 — never start/kill it.

---

### Task 1: Shrink global `period` to year-only + add `measureSession` (store)

**Files:**
- Modify: `src/stores/data.ts`
- Test: `tests/stores/period-session.test.ts` (create)

**Interfaces:**
- Produces:
  - `period: Ref<{ year: string }>`
  - `setPeriod(p: { year: string }): void`
  - `measureSession: Ref<{ term: Term; round: Round } | null>` (NOT persisted)
  - `replaceAll(parsed: { ...; period: { year: string }; ... })`

- [ ] **Step 1: Write the failing test**

Create `tests/stores/period-session.test.ts`:

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { useData } from '../../src/stores/data';

describe('period year-only + measureSession', () => {
  beforeEach(() => {
    localStorage.clear();
    setActivePinia(createPinia());
  });

  it('drops stray term/round from an old persisted period', () => {
    localStorage.setItem('ntr2_period', JSON.stringify({ year: '2568', term: '2', round: '2' }));
    const data = useData();
    expect(data.period).toEqual({ year: '2568' });
  });

  it('setPeriod persists year only', () => {
    const data = useData();
    data.setPeriod({ year: '2569' });
    expect(JSON.parse(localStorage.getItem('ntr2_period')!)).toEqual({ year: '2569' });
  });

  it('measureSession starts null and is settable', () => {
    const data = useData();
    expect(data.measureSession).toBeNull();
    data.measureSession = { term: '2', round: '1' };
    expect(data.measureSession).toEqual({ term: '2', round: '1' });
    // not persisted
    expect(localStorage.getItem('ntr2_session')).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/stores/period-session.test.ts`
Expected: FAIL (period equals `{year,term,round}`, or `measureSession` undefined).

- [ ] **Step 3: Implement the store changes**

In `src/stores/data.ts`:

Change the `period` ref (around line 30-32) to year-only, normalising old data:

```ts
  const period = ref<{ year: string }>(
    (() => {
      const raw = load<{ year: string; term?: string; round?: string }>(KP, { year: '' });
      return { year: raw.year ?? '' };
    })(),
  );

  const measureSession = ref<{ term: Term; round: Round } | null>(null);
```

Update `replaceAll` param type (line ~50) and `persist` (line 78 already writes `period.value` — fine; it now serialises `{year}` only).

```ts
  function replaceAll(parsed: {
    students: Student[];
    measures: Measurement[];
    setup: Setup;
    period: { year: string };
    classrooms?: { grade: string; rooms: string[] }[];
  }) {
```

Narrow `setPeriod` (line ~113):

```ts
  function setPeriod(p: { year: string }) {
    period.value = p;
    persist();
  }
```

Add `measureSession` to the returned object (near `period,` in the return, line ~302):

```ts
    period,
    measureSession,
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/stores/period-session.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/stores/data.ts tests/stores/period-session.test.ts
git commit -m "feat: shrink global period to year-only and add ephemeral measureSession"
```

---

### Task 2: Backup payload uses year-only period

**Files:**
- Modify: `src/domain/transfer/backup.ts`
- Test: `tests/transfer/backup-period.test.ts` (create)

**Interfaces:**
- Consumes: `period: { year: string }` from Task 1.
- Produces: `serializeBackup` writes `period: { year }`; `parseBackup` returns `period: { year }`, tolerating old payloads that also carry `term`/`round`.

- [ ] **Step 1: Write the failing test**

Create `tests/transfer/backup-period.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { serializeBackup, parseBackup } from '../../src/domain/transfer/backup';

const base = {
  students: [],
  measures: [],
  setup: {
    school: 'x', ministry: '', department: '', subdistrict: '',
    district: '', province: '', teacher: '', maxGrade: 'ป.6',
  },
  classrooms: [],
};

describe('backup period year-only', () => {
  it('serializes period as year only', () => {
    const text = serializeBackup({ ...base, period: { year: '2568' } });
    expect(JSON.parse(text).period).toEqual({ year: '2568' });
  });

  it('parses an old payload with stray term/round to year only', () => {
    const old = JSON.stringify({
      version: 'ntr2-1', ...base,
      period: { year: '2568', term: '2', round: '2' },
    });
    expect(parseBackup(old).period).toEqual({ year: '2568' });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/transfer/backup-period.test.ts`
Expected: FAIL — parsed period still contains term/round.

- [ ] **Step 3: Implement**

In `src/domain/transfer/backup.ts`:

- Change `BackupPayload.period` (line 10) and both function `period` types (lines 18, 36) to `{ year: string }`.
- In `serializeBackup`, replace `period: state.period,` (line 26) with `period: { year: state.period.year },`.
- In `parseBackup` return (line 70), replace `period: p.period as { year: string; term: Term; round: Round },` with:

```ts
    period: { year: String((p.period as { year?: unknown }).year ?? '') },
```

- Remove the now-unused `Term, Round` from the import on line 1 (keep `Student, Measurement, Setup`).

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/transfer/backup-period.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Typecheck + commit**

Run: `npx vue-tsc --noEmit`
Expected: no errors.

```bash
git add src/domain/transfer/backup.ts tests/transfer/backup-period.test.ts
git commit -m "feat: backup period is year-only, tolerant of legacy term/round"
```

---

### Task 3: MeasureView — 4 session tabs + room-list current-year progress

**Files:**
- Modify: `src/features/MeasureView.vue`

**Interfaces:**
- Consumes: `data.period.year`, `data.measureSession` (Task 1), `data.findDuplicate`, `data.measuresFor`/`data.measures`.
- Produces: writes `data.measureSession` while a room table is open; clears it on leave/unmount.

- [ ] **Step 1: Replace session state in `<script setup>`**

In `src/features/MeasureView.vue`:

Replace lines 19-21:

```ts
const sessYear = ref(data.period.year);
const sessTerm = ref<Term>(data.period.term as Term);
const sessRound = ref<Round>(data.period.round);
```

with:

```ts
const sessYear = ref(data.period.year);
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
  if (isActiveSession(term, round)) return;
  sessTerm.value = term;
  sessRound.value = round;
  data.measureSession = { term, round };
  loadRows();
}
// students in the picked room with a record for this exact session
function sessionCount(term: Term, round: Round): number {
  return data
    .roomStudents(pickedGrade.value, pickedRoom.value)
    .filter((s) => data.findDuplicate(s.id, sessYear.value, term, round) !== null).length;
}
```

- [ ] **Step 2: Update `roundCount` / `roomMeasuredCount` / `start` / `changeRound`**

Delete the old `roundCount` function (lines 50-54) — replaced by `sessionCount`.

Replace `roomMeasuredCount` (lines 55-59) with a current-year "measured at least once" count:

```ts
function roomMeasuredCount(grade: string, room: string): number {
  return data
    .roomStudents(grade, room)
    .filter((s) => data.measuresFor(s.id).some((m) => m.year === data.period.year)).length;
}
```

Replace `start` (lines 79-88):

```ts
function start(grade: string, room: string) {
  pickedGrade.value = grade;
  pickedRoom.value = room;
  sessYear.value = data.period.year;
  sessTerm.value = '1';
  sessRound.value = '1';
  sessDate.value = todayThai();
  data.measureSession = { term: '1', round: '1' };
  loadRows();
  view.value = 'table';
}
```

Delete `changeRound` (lines 90-94) — replaced by `pickSession`.

- [ ] **Step 3: Clear session on leave + unmount**

Update the existing `onBeforeUnmount(() => io?.disconnect());` (line 207) to also clear the session:

```ts
onBeforeUnmount(() => {
  io?.disconnect();
  data.measureSession = null;
});
```

Add a watcher so leaving the table back to the room list clears the session (place after `view` ref or near other watchers):

```ts
watch(view, (v) => {
  if (v === 'rooms') data.measureSession = null;
});
```

- [ ] **Step 4: Update the room-list template**

Replace the room-list head cell (line 235) round suffix:

```html
        <div class="mrow head" style="grid-template-columns: 1.4fr 1fr auto"><div>ห้อง</div><div>สถานะการวัดปีนี้</div><div></div></div>
```

(The `roomMeasuredCount` pill logic on lines 244-246 stays — it now reflects current-year progress.)

- [ ] **Step 5: Replace round tabs with 4 session tabs (toolbar)**

Replace the toolbar round-tabs block (lines 261-274) with:

```html
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
            <span class="rt-count" :class="sessionCount(s.term, s.round) === roomTotal && roomTotal > 0 ? 'good' : sessionCount(s.term, s.round) === 0 ? 'neutral' : 'warn'">{{ sessionCount(s.term, s.round) }}/{{ roomTotal }}</span>
          </button>
        </div>
```

- [ ] **Step 6: Replace round tabs in the sticky save bar**

Replace the mirrored round-tabs block (lines 348-361) with the same session tabs, compact:

```html
          <div class="round-tabs round-tabs-sm session-tabs" role="tablist">
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
              <span class="rt-count" :class="sessionCount(s.term, s.round) === roomTotal && roomTotal > 0 ? 'good' : sessionCount(s.term, s.round) === 0 ? 'neutral' : 'warn'">{{ sessionCount(s.term, s.round) }}/{{ roomTotal }}</span>
            </button>
          </div>
```

- [ ] **Step 7: Update copy that referenced term/round from global period**

- Page sub (line 257): already reads `sessTerm` — change to full words:

```html
      <p class="page-sub">ปีการศึกษา {{ sessYear }} · ภาคเรียนที่ {{ sessTerm }} · {{ roomTotal }} คน — กรอกหรือแก้ไขได้ในตาราง</p>
```

- Import card desc (line 289): `(ครั้งที่ {{ sessRound }})` → `(ภาคเรียนที่ {{ sessTerm }} ครั้งที่ {{ sessRound }})`.
- Summary line (line 303): `ในครั้งที่ {{ sessRound }}` → `ในภาคเรียนที่ {{ sessTerm }} ครั้งที่ {{ sessRound }}`.

- [ ] **Step 8: Add `.session-tabs` style for 4-tab wrap**

In the `<style scoped>` block, after the `.round-tabs` rule (line 406), add:

```css
.session-tabs { flex-wrap: wrap; }
.session-tabs .round-tab { flex: 1 1 auto; justify-content: center; white-space: nowrap; }
```

- [ ] **Step 9: Typecheck**

Run: `npx vue-tsc --noEmit`
Expected: no errors (no unused `Round`/`Term` — both still used).

- [ ] **Step 10: Manual verify in browser**

Open http://localhost:5173 → บันทึกการวัด → pick a room. Confirm: 4 tabs labelled `ภาคเรียนที่ 1 · ครั้งที่ 1` … `ภาคเรียนที่ 2 · ครั้งที่ 2`, each with its own count badge; default tab is semester 1 round 1; entering values + save writes to the selected session; room list shows `สถานะการวัดปีนี้`.

- [ ] **Step 11: Commit**

```bash
git add src/features/MeasureView.vue
git commit -m "feat: pick semester+round per measuring session via 4 tabs in Measure view"
```

---

### Task 4: AppShell header reflects active session

**Files:**
- Modify: `src/AppShell.vue:83-90`

**Interfaces:**
- Consumes: `data.period.year`, `data.measureSession` (Task 1, Task 3).

- [ ] **Step 1: Update computed header strings**

Replace lines 85-90:

```ts
const periodLine = computed(() => {
  const s = data.measureSession;
  const base = `ปีการศึกษา ${data.period.year}`;
  return s ? `${base} · ภาคเรียนที่ ${s.term} · ครั้งที่ ${s.round}` : base;
});
const periodShort = computed(() => {
  const s = data.measureSession;
  return s ? `ภาคเรียนที่ ${s.term} · ครั้งที่ ${s.round}` : `ปีการศึกษา ${data.period.year}`;
});
```

- [ ] **Step 2: Typecheck + verify**

Run: `npx vue-tsc --noEmit`
Expected: no errors.
Browser: header shows year only on Home; shows `· ภาคเรียนที่ X · ครั้งที่ Y` once a room table is open; reverts to year-only after leaving.

- [ ] **Step 3: Commit**

```bash
git add src/AppShell.vue
git commit -m "feat: header shows active measuring session, year-only otherwise"
```

---

### Task 5: Settings — year-only period panel

**Files:**
- Modify: `src/features/SettingsView.vue`

**Interfaces:**
- Consumes: `data.period: { year }`, `setPeriod({ year })`.

- [ ] **Step 1: Remove `currentRoundCount`**

Delete the `currentRoundCount` computed (lines 42-45) — it depends on removed `period.term/round`.

- [ ] **Step 2: Narrow period edit state**

Replace `periodDraft` init (line 76):

```ts
const periodDraft = ref<{ year: string }>({ year: data.period.year });
```

Replace `startEditPeriod` body (line 77-79) draft copy:

```ts
function startEditPeriod() {
  periodDraft.value = { year: data.period.year };
  editingPeriod.value = true;
}
```

(Keep whatever sets `editingPeriod = true` — match existing code; if `startEditPeriod` already toggled it, preserve that.)

Replace `savePeriod` (line 81-83):

```ts
function savePeriod() {
  data.setPeriod({ year: periodDraft.value.year });
  editingPeriod.value = false;
}
```

Remove the now-unused `Term`/`Round` imports if they were only used here (check the import line; keep any still referenced).

- [ ] **Step 3: Update the template**

- Button (line 229): `เปลี่ยนปี/ภาคเรียน` → `เปลี่ยนปีการศึกษา`.
- Remove the two ctx cells (lines 233-234: ภาคเรียน, ครั้งที่วัดปัจจุบัน).
- Remove the `วัดแล้วในรอบนี้` ctx cell (lines 239-242).
- In the edit form, remove the ภาคเรียน `<label>` (lines 250-256) and the ครั้งที่ `<label>` (lines 257-263). Keep the year input.

- [ ] **Step 4: Typecheck + verify**

Run: `npx vue-tsc --noEmit`
Expected: no errors, no unused-var failures.
Browser: Settings → "ปีการศึกษาปัจจุบัน" shows year + last-measure only; edit changes year and persists.

- [ ] **Step 5: Commit**

```bash
git add src/features/SettingsView.vue
git commit -m "feat: Settings period panel is year-only"
```

---

### Task 6: Onboarding + Reports cleanup

**Files:**
- Modify: `src/features/OnboardingView.vue:41`
- Modify: `src/features/ReportsView.vue:13`

**Interfaces:**
- Consumes: `setPeriod({ year })` (Task 1).

- [ ] **Step 1: Onboarding — drop term/round from setPeriod**

In `src/features/OnboardingView.vue`, replace line 41:

```ts
  data.setPeriod({ year: yearForm.value.year });
```

Remove the now-unused `Term` import if it was only used on this line (grep `Term` in the file first; remove from the type import only if unreferenced elsewhere).

- [ ] **Step 2: Reports — default term literal**

In `src/features/ReportsView.vue`, replace line 13:

```ts
const term = ref(data.period.term || '1');
```

with:

```ts
const term = ref<Term>('1');
```

Add `Term` to the type import from `../domain/types` if not already imported. (Year line 12 stays as-is.)

- [ ] **Step 3: Typecheck**

Run: `npx vue-tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Full test + build sanity**

Run: `npm test`
Expected: all suites pass (including Tasks 1-2 new tests).
Run: `npx vue-tsc --noEmit`
Expected: clean.

- [ ] **Step 5: Commit**

```bash
git add src/features/OnboardingView.vue src/features/ReportsView.vue
git commit -m "feat: onboarding sets year-only period; reports defaults term to 1"
```

---

## Final verification

- [ ] `npm test` — all green.
- [ ] `npx vue-tsc --noEmit` — no type errors, no unused-locals failures.
- [ ] Browser smoke: Onboarding (year only) → Measure (4 session tabs, default sem1·round1, per-session counts, save) → header reflects session → Settings year-only → Reports term selector works → backup export/import round-trips.
