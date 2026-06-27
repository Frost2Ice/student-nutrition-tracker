# Design: Move semester (ภาคเรียน) + round (ครั้งที่) selection from Settings into Measure data

Date: 2026-06-26

## Problem

Today the academic **semester (ภาคเรียน / `term`)** and **measurement round (ครั้งที่ / `round`)**
are global state set once in Settings (and Onboarding). The teacher measures against
whatever the global pointer says.

The teacher should instead choose semester **and** round at measuring time. Each academic
year has 2 semesters × 2 rounds = **4 measurement datasets**. The teacher picks which of the
4 they are entering, directly inside the Measure screen.

## Decisions (from brainstorming)

- **Global period shrinks to year only.** `term` / `round` leave global state entirely.
- **Selector = 4 combined session tabs** inside the Measure table: semester 1 round 1,
  semester 1 round 2, semester 2 round 1, semester 2 round 2.
- **Session is picked inside the table only.** The room-list screen shows current-year
  overall progress (any session), not a per-round status.
- **Header** shows year always; appends the active semester+round only while the teacher is
  actively measuring (a session tab is selected).
- **Onboarding** asks academic year only; term/round inputs dropped.
- **Default tab on table open = semester 1 round 1, always** (predictable, not smart-default).
- **Wording: clear and full.** Teacher-facing labels use complete Thai words, no cryptic
  abbreviations. e.g. `ภาคเรียนที่ 1 · ครั้งที่ 1`.

## Data model

`src/domain/types.ts` — **unchanged**. `Measurement` already carries `term: Term` and
`round: Round` per record. `Term = '1' | '2'`, `Round = '1' | '2'`. Only the *global*
`period` object shrinks.

## Components

### 1. Store — `src/stores/data.ts`

- `period` type changes from `{ year: string; term: Term; round: Round }` to `{ year: string }`.
  - `KP` localStorage load: read old object, keep `year` only (stray `term`/`round` ignored —
    no migration write needed; next `persist()` drops them).
  - Fallback default becomes `{ year: '' }`.
- `setPeriod(p: { year: string })` — signature narrows to year only.
- Add **non-persisted** ephemeral ref:
  ```ts
  const measureSession = ref<{ term: Term; round: Round } | null>(null);
  ```
  Set when the teacher opens a room table, cleared when they leave it / unmount. Never
  written to localStorage, never part of backup. Exposed from the store for the header.
- `replaceAll(...)` and the backup type: `period` param becomes `{ year: string }`.

### 2. Measure — `src/features/MeasureView.vue`

- Drop `sessRound` + `changeRound`. Introduce the active session model:
  ```ts
  const SESSIONS: { term: Term; round: Round; label: string }[] = [
    { term: '1', round: '1', label: 'ภาคเรียนที่ 1 · ครั้งที่ 1' },
    { term: '1', round: '2', label: 'ภาคเรียนที่ 1 · ครั้งที่ 2' },
    { term: '2', round: '1', label: 'ภาคเรียนที่ 2 · ครั้งที่ 1' },
    { term: '2', round: '2', label: 'ภาคเรียนที่ 2 · ครั้งที่ 2' },
  ];
  const sessTerm = ref<Term>('1');
  const sessRound = ref<Round>('1');
  ```
  A tab is "on" when both `sessTerm` and `sessRound` match.
- `sessYear` stays `= data.period.year`.
- `start(grade, room)`: default session to **semester 1 round 1** (`sessTerm='1'`,
  `sessRound='1'`), set `data.measureSession = { term:'1', round:'1' }`, then `loadRows()`.
- Selecting a tab: set `sessTerm`/`sessRound`, update `data.measureSession`, `loadRows()`.
- Leaving the table (`view='rooms'`) and `onBeforeUnmount`: `data.measureSession = null`.
- `roundCount` → generalise to `sessionCount(term, round)`: count students in the picked room
  with an existing record for that `{year, term, round}`. Each tab shows `n/total` badge.
- The table sub-header / summary lines that say "ครั้งที่ X" now read the active session in
  full words: `ภาคเรียนที่ {{ sessTerm }} · ครั้งที่ {{ sessRound }}`.
- Excel import card description and `ImportDialog` props already pass `sessTerm`/`sessRound` —
  keep; they now reflect the chosen session.
- Tab UI: reuse existing `.round-tabs` / `.round-tab` styling. 4 tabs in one row (wrap on
  narrow screens). Labels two-line if needed for fit, but full words. Mirror into the sticky
  save bar exactly as the round tabs are mirrored today.

### 3. Room-list screen (inside MeasureView)

- `roomMeasuredCount(grade, room)` no longer keys off `data.period.term/round`. New meaning:
  **students in the room with ≥1 measurement in the current academic year (any term/round)**.
  ```ts
  // measured this year if any measure exists for this student with year === period.year
  ```
- Header cell `สถานะ (ครั้งที่ X)` → `สถานะการวัดปีนี้` (no round suffix).
- Pill text unchanged in shape: `ยังไม่วัด` / `วัดแล้ว n/total` / `วัดครบแล้ว`, now meaning
  "measured at least once this year".

### 4. App header — `src/AppShell.vue`

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

### 5. Settings — `src/features/SettingsView.vue`

- "ปีการศึกษาปัจจุบัน" panel:
  - Display grid: remove `ภาคเรียน` and `ครั้งที่วัดปัจจุบัน` ctx cells. Remove
    `วัดแล้วในรอบนี้` (no global round → `currentRoundCount` deleted).
  - Keep `ปีการศึกษา` and `บันทึกการวัดล่าสุด`.
  - Edit form: keep year input only; remove the term + round `<select>`s.
  - Button label `เปลี่ยนปี/ภาคเรียน` → `เปลี่ยนปีการศึกษา`.
  - `periodDraft` becomes `{ year }`; `savePeriod` calls `setPeriod({ year })`.

### 6. Onboarding — `src/features/OnboardingView.vue`

- Remove term/round collection from the wizard. Persist `{ year }` via `setPeriod`.
- Any step/summary copy referencing semester/round is removed.

### 7. Backup / transfer — `src/domain/transfer/backup.ts`

- `period` type in the backup payload → `{ year: string }`.
- Export: write `{ year: state.period.year }`.
- Import/validation: require `period.year` (string); ignore any stray `term`/`round` from
  older backups. Per-measurement `term`/`round` inside `measures[]` are untouched.
- `src/domain/transfer/xlsx.ts`: the `period` params here are supplied by the MeasureView
  session (via `ImportDialog`), not the global period — **no signature change needed**.
  Confirm no caller passes `data.period` (now year-only) where `{term,round}` is required;
  if one does, pass the session values instead.

### 8. Reports — `src/features/ReportsView.vue`

- Already owns independent `year` + `term` selectors. Only change: default-term init
  `data.period.term || '1'` → `'1'`. Year default stays `data.period.year || '2568'`.

## Data flow

```
Onboarding/Settings ──set──> period { year }            (persisted)
MeasureView room table ──pick session──> measureSession { term, round }  (ephemeral)
                       └──save row──> Measurement { year, term, round, ... }  (persisted)
AppShell header ──reads──> period.year + measureSession
Reports ──own selectors──> summarize(year, term)
Dashboard ──latestPerStudent──> auto term→round ordering (unchanged)
```

## Error handling / edge cases

- Old localStorage `period` with term/round: loaded, year retained, extras dropped on next
  persist. No crash.
- Old backup files with `period.term/round`: import succeeds using `year`, extras ignored.
- Header before any year set: shows `ปีการศึกษา ` (empty) as today — unchanged behaviour.
- Room-list "measured this year" with `period.year === ''`: matches no measures → all rooms
  show `ยังไม่วัด`. Acceptable (year unset is a pre-setup state).

## Testing

Unit (Vitest, domain/store level):

1. **Store period migration** — given localStorage `{year:'2568',term:'2',round:'2'}`,
   loaded `period` equals `{year:'2568'}`; after `persist()`, stored JSON has no term/round.
2. **measureSession lifecycle** — set on table open, null after leave/unmount (component or
   store-level test).
3. **Room "measured this year" count** — student with a measure in `{year, term:'2', round:'1'}`
   counts as measured when viewing the room list for that year, regardless of selected tab.
4. **sessionCount per tab** — distinct counts for each of the 4 `{term,round}` combos.
5. **Backup round-trip** — export writes `period:{year}`; import of an old payload with
   term/round yields `period:{year}` and preserves per-measurement term/round.

Existing `latest.ts` term→round ordering tests already cover dashboard aggregation; no change.

## Out of scope

- No change to nutrition engine, growth reference tables, or `Measurement` shape.
- No new report views; Reports keeps its current year+term filtering.
- No bulk migration of existing measurement records (they already carry term/round).
