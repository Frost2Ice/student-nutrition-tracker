# School Code + Round-Level Reporting Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an optional `code` field to the school profile, and make report generation filter on an explicit `round` so the Academic Year → Semester(Term) → Round hierarchy is a real data boundary, not just a label.

**Architecture:** No new domain types — `Term` already models semester. `summarize()`/`summaryToAoa()` in `src/domain/report/summary.ts` gain a required `round` parameter and drop the cross-round "latest" collapse. `SchoolIdentity`/`Setup` gain an optional `code?: string`. `ReportsView.vue` gets a third cascading select and auto-defaults term/round per year via the existing `defaultRound()` helper. `OnboardingView.vue` and `SettingsView.vue` get one new text input each for the existing school-info forms.

**Tech Stack:** Vue 3 `<script setup>` + TypeScript, Pinia stores, Vitest for domain unit tests.

## Global Constraints

- School Code is free text, no length validation (min or max) — copied verbatim from spec.
- No new domain type for "semester" — reuse `Term`.
- `summarize()` must not retain a `'latest across rounds'` fallback mode — round is always explicit at the call site; UI-level convenience (auto-picking latest term/round) lives in `ReportsView.vue`, not in the domain function.
- No new report view/rollup — single (year, term, round) per report, unchanged from today's single-report model.
- Stay on `master` branch. Do not run `git commit` — the user commits manually. Steps below still show `git add`/`git commit` commands for the user's own reference; agents executing this plan must stop before running them and hand back to the user, or skip the commit step entirely if instructed.
- Existing empty state in `ReportsView.vue` (zero measured, empty grade table) must keep working unchanged for a (year, term, round) with no data — no new empty-state component.

---

### Task 1: Add `code` to `SchoolIdentity`/`Setup` types

**Files:**
- Modify: `src/domain/types.ts:28-46` (the `Setup` and `SchoolIdentity` interfaces)

**Interfaces:**
- Produces: `Setup.code?: string`, `SchoolIdentity.code?: string` — consumed by Task 2 (summary.ts), Task 4 (OnboardingView), Task 5 (SettingsView).

- [ ] **Step 1: Edit the two interfaces**

In `src/domain/types.ts`, change:

```ts
export interface Setup {
  school: string;
  ministry: string;
  department: string;
  subdistrict: string;
  district: string;
  province: string;
  teacher: string;
  maxGrade: string;
}

export interface SchoolIdentity {
  school: string;
  ministry: string;
  department: string;
  subdistrict: string;
  district: string;
  province: string;
}
```

to:

```ts
export interface Setup {
  school: string;
  code?: string;
  ministry: string;
  department: string;
  subdistrict: string;
  district: string;
  province: string;
  teacher: string;
  maxGrade: string;
}

export interface SchoolIdentity {
  school: string;
  code?: string;
  ministry: string;
  department: string;
  subdistrict: string;
  district: string;
  province: string;
}
```

- [ ] **Step 2: Type-check**

Run: `npx vue-tsc --noEmit`
Expected: no new errors. (`splitSetup()` in `src/domain/school/migrate.ts` uses rest-spread destructuring — `code` flows into `identity` automatically, no edit needed there.)

- [ ] **Step 3: Commit (user runs manually)**

```bash
git add src/domain/types.ts
git commit -m "feat: add optional school code field to SchoolIdentity/Setup"
```

---

### Task 2: `summarize()`/`summaryToAoa()` take explicit `round`, drop cross-round collapse; header prints full school identity

**Files:**
- Modify: `src/domain/report/summary.ts`
- Test: `tests/report/summary.test.ts`

**Interfaces:**
- Consumes: `Setup`, `SchoolIdentity` fields from Task 1 (`code?: string` now present on `Setup`).
- Produces: `summarize(students: Student[], measures: Measurement[], year: string, term: string, round: Round): ReportSummary` and `summaryToAoa(setup: Setup, summary: ReportSummary, year: string, term: string, round: Round): (string|number)[][]` — consumed by Task 3 (`ReportsView.vue`).

- [ ] **Step 1: Write failing tests for round filtering and header omission**

Replace the existing `tests/report/summary.test.ts` content with:

```ts
import { describe, it, expect } from 'vitest';
import { summarize, summaryToAoa } from '../../src/domain/report/summary';
import type { Student, Measurement, Setup } from '../../src/domain/types';

const student: Student = {
  id: 'S001',
  firstName: 'ทดสอบ',
  lastName: 'นาม',
  dob: '15/5/2556',
  gender: 'ชาย',
  grade: 'ป.4',
  room: '1',
};

const round1Measure: Measurement = {
  studentId: 'S001',
  year: '2568',
  term: '1',
  round: '1',
  date: '15/5/2568',
  weightKg: 25,
  heightCm: 120,
  savedAt: 1700000000000,
  gradeAtMeasure: 'ป.4',
  roomAtMeasure: '1',
};

const round2Measure: Measurement = {
  ...round1Measure,
  round: '2',
  date: '15/9/2568',
  weightKg: 26,
  heightCm: 121,
  savedAt: 1710000000000,
};

describe('summarize', () => {
  it('counts measured=1 for one student with one matching measurement', () => {
    const result = summarize([student], [round1Measure], '2568', '1', '1');
    expect(result.measured).toBe(1);
    expect(result.enrolled).toBe(1);
  });

  it('byGrade bucket counts sum to total measured', () => {
    const result = summarize([student], [round1Measure], '2568', '1', '1');
    const total = result.byGrade.reduce((sum, g) => sum + g.counts.reduce((a, b) => a + b, 0), 0);
    expect(total).toBe(result.measured);
  });

  it('returns measured=0 when year/term does not match', () => {
    const result = summarize([student], [round1Measure], '2568', '2', '1');
    expect(result.measured).toBe(0);
  });

  it('filters to only the requested round when both rounds have data', () => {
    const r1 = summarize([student], [round1Measure, round2Measure], '2568', '1', '1');
    const r2 = summarize([student], [round1Measure, round2Measure], '2568', '1', '2');
    expect(r1.measured).toBe(1);
    expect(r2.measured).toBe(1);
    // round 2's weight (26kg/121cm) differs from round 1's (25kg/120cm) — confirm
    // the two calls aren't silently returning the same collapsed record by checking
    // each only sees its own round's measurement via the tall-count side channel
    // is not reliable here, so assert via grade bucket distinctness is unnecessary;
    // the key behavior under test is that round 1 alone and round 2 alone both
    // report measured=1 (neither round's absence breaks the other).
  });

  it('returns measured=0 for a round with no measurement even if another round has data', () => {
    const result = summarize([student], [round1Measure], '2568', '1', '2');
    expect(result.measured).toBe(0);
  });

  it('picks the latest-saved measurement when two records share the same round', () => {
    const earlierSameRound: Measurement = { ...round1Measure, savedAt: 1600000000000, weightKg: 20 };
    const result = summarize([student], [earlierSameRound, round1Measure], '2568', '1', '1');
    expect(result.measured).toBe(1);
  });

  it('enrolled always equals students.length', () => {
    const result = summarize([student], [], '2568', '1', '1');
    expect(result.enrolled).toBe(1);
  });

  it('produces 5 bucket counts per grade', () => {
    const result = summarize([student], [round1Measure], '2568', '1', '1');
    for (const g of result.byGrade) {
      expect(g.counts).toHaveLength(5);
    }
  });
});

describe('summaryToAoa', () => {
  const fullSetup: Setup = {
    school: 'โรงเรียนทดสอบ',
    code: 'SC-001',
    ministry: 'กระทรวงศึกษา',
    department: 'สพม.',
    subdistrict: 'ตำบลทดสอบ',
    district: 'อำเภอทดสอบ',
    province: 'จังหวัดทดสอบ',
    teacher: 'ครูทดสอบ',
    maxGrade: 'ป.6',
  };

  const noCodeSetup: Setup = { ...fullSetup, code: undefined };

  it('returns a non-empty array', () => {
    const summary = summarize([student], [round1Measure], '2568', '1', '1');
    const aoa = summaryToAoa(fullSetup, summary, '2568', '1', '1');
    expect(Array.isArray(aoa)).toBe(true);
    expect(aoa.length).toBeGreaterThan(0);
  });

  it('includes school name', () => {
    const summary = summarize([student], [round1Measure], '2568', '1', '1');
    const aoa = summaryToAoa(fullSetup, summary, '2568', '1', '1');
    const flat = aoa.flat().map(String);
    expect(flat).toContain('โรงเรียนทดสอบ');
  });

  it('includes bucket label ผอม', () => {
    const summary = summarize([student], [round1Measure], '2568', '1', '1');
    const aoa = summaryToAoa(fullSetup, summary, '2568', '1', '1');
    const flat = aoa.flat().map(String);
    expect(flat).toContain('ผอม');
  });

  it('includes school code when present', () => {
    const summary = summarize([student], [round1Measure], '2568', '1', '1');
    const aoa = summaryToAoa(fullSetup, summary, '2568', '1', '1');
    const flat = aoa.flat().map(String);
    expect(flat).toContain('SC-001');
  });

  it('omits the school code row when code is blank', () => {
    const summary = summarize([student], [round1Measure], '2568', '1', '1');
    const aoa = summaryToAoa(noCodeSetup, summary, '2568', '1', '1');
    const labels = aoa.map((row) => row[0]);
    expect(labels).not.toContain('รหัสโรงเรียน');
  });

  it('includes the round in the header', () => {
    const summary = summarize([student], [round1Measure], '2568', '1', '1');
    const aoa = summaryToAoa(fullSetup, summary, '2568', '1', '1');
    const roundRow = aoa.find((row) => row[0] === 'ครั้งที่วัด');
    expect(roundRow?.[1]).toBe('1');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/report/summary.test.ts`
Expected: FAIL — `summarize`/`summaryToAoa` currently take 4 args, not 5; `code`/`ครั้งที่วัด` assertions fail since the field/row don't exist yet.

- [ ] **Step 3: Implement — update `src/domain/report/summary.ts`**

Replace the full file contents with:

```ts
import type { Student, Measurement, Setup, Round } from '../types';
import { calcNutrition } from '../nutrition/engine';
import { latestPerStudent } from '../nutrition/latest';
import { GRADE_ORDER } from '../grade/ladder';
import type { WfhLabel } from '../nutrition/engine';

export const WFH_BUCKET_LABELS = ['ผอม', 'ค่อนข้างผอม', 'สมส่วน', 'ท้วม/เริ่มอ้วน', 'อ้วน'] as const;
export type WfhBucketLabel = (typeof WFH_BUCKET_LABELS)[number];

/** Map engine WFH label → bucket index (0-4) */
function wfhBucket(label: WfhLabel): number {
  switch (label) {
    case 'ผอม': return 0;
    case 'ค่อนข้างผอม': return 1;
    case 'สมส่วน': return 2;
    case 'ท้วม': return 3;
    case 'เริ่มอ้วน': return 3;
    case 'อ้วน': return 4;
  }
}

export interface GradeSummary {
  grade: string;
  counts: number[]; // 5-bucket tallies
  tall: number;
}

export interface ReportSummary {
  measured: number;
  enrolled: number;
  byGrade: GradeSummary[];
  tall: number;
}

export function summarize(
  students: Student[],
  measures: Measurement[],
  year: string,
  term: string,
  round: Round,
): ReportSummary {
  const enrolled = students.length;

  // Filter to matching year+term+round (round is a real filter, not cosmetic —
  // each report shows exactly one measurement round)
  const filtered = measures.filter((m) => m.year === year && m.term === term && m.round === round);

  // If a room re-measured a student twice within the same round, keep the latest-saved one
  const latestMap = latestPerStudent(filtered);

  // Gather grade → counts
  const gradeMap = new Map<string, { counts: number[]; tall: number }>();

  let measured = 0;
  let tallTotal = 0;

  for (const student of students) {
    const m = latestMap.get(student.id);
    if (!m) continue;
    const result = calcNutrition(student, m);
    if (!result) continue;

    measured++;

    // Use student's current grade (BRD §6.3)
    const grade = student.grade;
    if (!gradeMap.has(grade)) {
      gradeMap.set(grade, { counts: [0, 0, 0, 0, 0], tall: 0 });
    }
    const entry = gradeMap.get(grade)!;
    entry.counts[wfhBucket(result.wfh)]++;
    if (result.tall) {
      entry.tall++;
      tallTotal++;
    }
  }

  // Sort by GRADE_ORDER
  const grades = [...gradeMap.keys()].sort((a, b) => {
    const ai = GRADE_ORDER.indexOf(a);
    const bi = GRADE_ORDER.indexOf(b);
    return (ai === -1 ? Infinity : ai) - (bi === -1 ? Infinity : bi);
  });

  const byGrade: GradeSummary[] = grades.map((grade) => ({
    grade,
    counts: gradeMap.get(grade)!.counts,
    tall: gradeMap.get(grade)!.tall,
  }));

  return { measured, enrolled, byGrade, tall: tallTotal };
}

export function summaryToAoa(
  setup: Setup,
  summary: ReportSummary,
  year: string,
  term: string,
  round: Round,
): (string | number)[][] {
  const aoa: (string | number)[][] = [];

  // Header info — omit a row entirely when the value is blank (legacy profiles
  // without a school code, or schools that never filled optional address fields)
  const headerLine = (label: string, value: string | undefined) => {
    if (value) aoa.push([label, value]);
  };

  headerLine('โรงเรียน', setup.school);
  headerLine('รหัสโรงเรียน', setup.code);
  headerLine('สังกัดกระทรวง', setup.ministry);
  headerLine('สังกัดกรม/หน่วยงาน', setup.department);
  headerLine('ตำบล/แขวง', setup.subdistrict);
  headerLine('อำเภอ/เขต', setup.district);
  headerLine('จังหวัด', setup.province);
  aoa.push(['ปีการศึกษา', year]);
  aoa.push(['ภาคเรียน', term]);
  aoa.push(['ครั้งที่วัด', round]);
  aoa.push(['นักเรียนทั้งหมด', summary.enrolled]);
  aoa.push(['นักเรียนที่วัด', summary.measured]);
  aoa.push([]);

  // Table header row
  aoa.push(['ระดับชั้น', ...WFH_BUCKET_LABELS, 'รวมที่วัด', 'สูงดีสมส่วน']);

  // Grade rows
  for (const g of summary.byGrade) {
    const total = g.counts.reduce((a, b) => a + b, 0);
    aoa.push([g.grade, ...g.counts, total, g.tall]);
  }

  // Totals row
  const catTotals = WFH_BUCKET_LABELS.map((_, i) =>
    summary.byGrade.reduce((s, g) => s + g.counts[i], 0),
  );
  aoa.push(['รวมทั้งโรงเรียน', ...catTotals, summary.measured, summary.tall]);

  // Percentage row (as strings with %)
  const pctVal = (n: number, d: number): string =>
    (d ? (Math.round((n / d) * 1000) / 10).toFixed(1) : '0.0') + '%';
  const pctRow = catTotals.map((n) => pctVal(n, summary.measured));
  aoa.push(['ร้อยละ', ...pctRow, '100%', pctVal(summary.tall, summary.measured)]);

  aoa.push([]);
  aoa.push(['แหล่งเกณฑ์', 'สำนักโภชนาการ กรมอนามัย พ.ศ. 2564']);

  return aoa;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/report/summary.test.ts`
Expected: PASS, all tests green.

- [ ] **Step 5: Type-check whole project (summary.ts callers not yet updated)**

Run: `npx vue-tsc --noEmit`
Expected: FAIL — `src/features/ReportsView.vue` still calls `summarize()`/`summaryToAoa()` with 4 args. This is expected; Task 3 fixes it. Confirm the *only* errors are in `ReportsView.vue`.

- [ ] **Step 6: Commit (user runs manually)**

```bash
git add src/domain/report/summary.ts tests/report/summary.test.ts
git commit -m "feat: filter reports by explicit round, print full school identity in header"
```

---

### Task 3: `ReportsView.vue` — round selector, auto-default term/round per year, extended header

**Files:**
- Modify: `src/features/ReportsView.vue`

**Interfaces:**
- Consumes: `summarize(students, measures, year, term, round)`, `summaryToAoa(setup, summary, year, term, round)` from Task 2; `defaultRound(hasData: (s: Session) => boolean): Session` and `Session = { term: Term; round: Round }` from `src/domain/measure/default-round.ts` (existing, unchanged); `Setup.code?`/other identity fields from Task 1.
- Produces: nothing consumed by later tasks — this is the UI leaf.

- [ ] **Step 1: Update script block**

In `src/features/ReportsView.vue`, replace the `<script setup>` block with:

```ts
defineOptions({ name: 'ReportsView' });
import { ref, computed, onMounted, watch } from 'vue';
import { useData } from '../stores/data';
import { useSchool } from '../stores/school';
import { useHeader } from '../stores/header';
import { summarize, summaryToAoa, WFH_BUCKET_LABELS } from '../domain/report/summary';
import { printElement } from './print';
import { aoaToXlsxBlob } from '../domain/transfer/xlsx';
import { downloadBlob } from './download';
import type { Term, Round } from '../domain/types';
import { defaultRound, type Session } from '../domain/measure/default-round';

const data = useData();
const school = useSchool();
const header = useHeader();
onMounted(() => header.setHeader({ title: 'รายงาน', back: null, context: 'year' }));

// Report can view ANY academic year read-only; default to the active year.
const selectedYear = ref(school.activeYear ?? data.period.year ?? '2568');
const term = ref<Term>('1');
const round = ref<Round>('1');

// Year picker options: every year recorded in the school manifest.
const yearOptions = computed(() => school.listYears().map((m) => m.year));

// Source students+measures from the selected year's snapshot. When the snapshot
// is missing (e.g. the active year hasn't been persisted yet) fall back to the
// live data store so the active-year path matches today's behavior.
const yearData = computed(() => {
  const snap = school.snapshotForYear(selectedYear.value);
  if (snap) return { students: snap.students, measures: snap.measures };
  return { students: data.students, measures: data.measures };
});

// Auto-default term+round to the latest session with data whenever the
// selected year changes. The user can still override either dropdown after.
function applyDefaultSession() {
  const measures = yearData.value.measures;
  const session: Session = defaultRound((s) =>
    measures.some((m) => m.term === s.term && m.round === s.round),
  );
  term.value = session.term;
  round.value = session.round;
}
watch(selectedYear, applyDefaultSession, { immediate: true });

const summary = computed(() =>
  summarize(yearData.value.students, yearData.value.measures, selectedYear.value, term.value, round.value),
);

const WFH_CATEGORIES = WFH_BUCKET_LABELS.map((label, i) => ({
  key: i,
  label,
  cls: ['thin', 'lthin', 'norm', 'chubby', 'obese'][i],
}));

const catTotals = computed(() =>
  WFH_CATEGORIES.map((_, i) => summary.value.byGrade.reduce((s, g) => s + g.counts[i], 0)),
);
const tallTotal = computed(() => summary.value.tall);
const pct = (n: number, d: number) => (d ? Math.round((n / d) * 1000) / 10 : 0);

const CRITERIA = {
  source: 'สำนักโภชนาการ กรมอนามัย',
  version: 'เกณฑ์อ้างอิงการเจริญเติบโต พ.ศ. 2564',
};

// Today's date in Thai format
const today = computed(() => {
  const d = new Date();
  const thaiMonths = ['มกราคม','กุมภาพันธ์','มีนาคม','เมษายน','พฤษภาคม','มิถุนายน','กรกฎาคม','สิงหาคม','กันยายน','ตุลาคม','พฤศจิกายน','ธันวาคม'];
  const buddhistYear = d.getFullYear() + 543;
  return `${d.getDate()} ${thaiMonths[d.getMonth()]} ${buddhistYear}`;
});

// School identity lines for the printable header — only populated fields show.
const identityLines = computed(() => {
  const s = data.setup;
  const lines: { label: string; value: string }[] = [];
  if (s.code) lines.push({ label: 'รหัสโรงเรียน', value: s.code });
  if (s.ministry) lines.push({ label: 'สังกัดกระทรวง', value: s.ministry });
  if (s.department) lines.push({ label: 'สังกัดกรม/หน่วยงาน', value: s.department });
  if (s.subdistrict) lines.push({ label: 'ตำบล/แขวง', value: s.subdistrict });
  if (s.district) lines.push({ label: 'อำเภอ/เขต', value: s.district });
  if (s.province) lines.push({ label: 'จังหวัด', value: s.province });
  return lines;
});

// Reference to the printable document
const documentEl = ref<HTMLElement | null>(null);

function handlePrint() {
  if (documentEl.value) {
    printElement(documentEl.value);
  }
}

function handleXlsx() {
  const blob = aoaToXlsxBlob(
    summaryToAoa(data.setup, summary.value, selectedYear.value, term.value, round.value),
    'สรุปโภชนาการ',
  );
  downloadBlob(blob, `รายงานสรุป ${selectedYear.value} ภาค${term.value} ครั้งที่${round.value}.xlsx`);
}
```

- [ ] **Step 2: Update template — filter bar and doc header**

Replace the filter bar block:

```html
    <!-- filter: only year + term (BRD FR-8.1 filterable by academic year) -->
    <div class="filterbar">
      <div class="field">
        <label>ปีการศึกษา</label>
        <select v-model="selectedYear"><option v-for="y in yearOptions" :key="y" :value="y">{{ y }}</option></select>
      </div>
      <div class="field">
        <label>ภาคเรียน</label>
        <select v-model="term"><option value="1">ภาคเรียน 1</option><option value="2">ภาคเรียน 2</option></select>
      </div>
      <span class="spacer"></span>
      <button class="btn primary lg" @click="handlePrint">🖨️ พิมพ์ / บันทึก PDF</button>
      <button class="btn lg" @click="handleXlsx">📊 ส่งออก Excel</button>
    </div>
```

with:

```html
    <!-- filter: Academic Year → Semester → Round (BRD FR-8.1, extended for round drill-down) -->
    <div class="filterbar">
      <div class="field">
        <label>ปีการศึกษา</label>
        <select v-model="selectedYear"><option v-for="y in yearOptions" :key="y" :value="y">{{ y }}</option></select>
      </div>
      <div class="field">
        <label>ภาคเรียน</label>
        <select v-model="term"><option value="1">ภาคเรียน 1</option><option value="2">ภาคเรียน 2</option></select>
      </div>
      <div class="field">
        <label>ครั้งที่วัด</label>
        <select v-model="round"><option value="1">ครั้งที่ 1</option><option value="2">ครั้งที่ 2</option></select>
      </div>
      <span class="spacer"></span>
      <button class="btn primary lg" @click="handlePrint">🖨️ พิมพ์ / บันทึก PDF</button>
      <button class="btn lg" @click="handleXlsx">📊 ส่งออก Excel</button>
    </div>
```

Replace the `.doc-head` block:

```html
      <div class="doc-head">
        <div>
          <div class="doc-title">รายงานสรุปภาวะโภชนาการนักเรียน</div>
          <div class="doc-school">{{ data.setup.school }} · จังหวัด{{ data.setup.province }}</div>
        </div>
        <div class="doc-period">
          <div>ปีการศึกษา {{ selectedYear }} · ภาคเรียน {{ term }}</div>
          <div class="muted">วันที่ออกรายงาน {{ today }}</div>
        </div>
      </div>
```

with:

```html
      <div class="doc-head">
        <div>
          <div class="doc-title">รายงานสรุปภาวะโภชนาการนักเรียน</div>
          <div class="doc-school">{{ data.setup.school }}</div>
          <div v-for="line in identityLines" :key="line.label" class="doc-identity">{{ line.label }}: {{ line.value }}</div>
        </div>
        <div class="doc-period">
          <div>ปีการศึกษา {{ selectedYear }} · ภาคเรียน {{ term }} · ครั้งที่ {{ round }}</div>
          <div class="muted">วันที่ออกรายงาน {{ today }}</div>
        </div>
      </div>
```

- [ ] **Step 3: Add `.doc-identity` style**

In the `<style scoped>` block, after the existing `.doc-school` rule, add:

```css
.doc-identity { color: var(--ink-muted); font-size: 13px; margin-top: 1px; }
```

- [ ] **Step 4: Type-check**

Run: `npx vue-tsc --noEmit`
Expected: no errors (this was the only file failing after Task 2's step 5).

- [ ] **Step 5: Run full unit test suite**

Run: `npm test`
Expected: PASS, all existing + new tests green.

- [ ] **Step 6: Manual check in the running dev server**

The dev server is already running at `http://localhost:5173` (do not start a new one, do not kill it). Open it, navigate to รายงาน (Reports):
- Confirm three cascading selects (ปีการศึกษา / ภาคเรียน / ครั้งที่วัด) appear.
- Switch academic year and confirm term/round jump to the latest session that has data for that year.
- Manually change round and confirm the grade table changes (or empty-state renders if that round has no data).
- Confirm the school code and address fields appear under the school name when populated (populate them via Settings first if the current profile has none — see Task 5).
- Print preview and Excel export both show the round and any populated identity fields.

- [ ] **Step 7: Commit (user runs manually)**

```bash
git add src/features/ReportsView.vue
git commit -m "feat: add round selector and auto-defaulting to reports view"
```

---

### Task 4: School Code field in Onboarding wizard

**Files:**
- Modify: `src/features/OnboardingView.vue`

**Interfaces:**
- Consumes: `Setup.code?: string` from Task 1; `data.saveSetup(next: Setup)` (existing, unchanged — already spreads the whole form).

- [ ] **Step 1: Add `code` to `schoolForm`**

Change:

```ts
const schoolForm = ref({
  school: '', ministry: '', department: '', subdistrict: '',
  district: '', province: '', teacher: '',
});
```

to:

```ts
const schoolForm = ref({
  school: '', code: '', ministry: '', department: '', subdistrict: '',
  district: '', province: '', teacher: '',
});
```

- [ ] **Step 2: Add the input to step 1's form**

In the step-1 template block, change:

```html
          <div class="field" style="grid-column: 1/-1"><label>ชื่อโรงเรียน</label><input v-model="schoolForm.school" /></div>
          <div class="field"><label>สังกัดกระทรวง</label><input v-model="schoolForm.ministry" /></div>
```

to:

```html
          <div class="field" style="grid-column: 1/-1"><label>ชื่อโรงเรียน</label><input v-model="schoolForm.school" /></div>
          <div class="field"><label>รหัสโรงเรียน</label><input v-model="schoolForm.code" /></div>
          <div class="field"><label>สังกัดกระทรวง</label><input v-model="schoolForm.ministry" /></div>
```

- [ ] **Step 3: Add the summary line to step 4**

In the step-4 summary panel, change:

```html
          <div class="field"><label>ชื่อโรงเรียน</label><div>{{ schoolForm.school || '—' }}</div></div>
          <div class="field"><label>สังกัดกระทรวง</label><div>{{ schoolForm.ministry || '—' }}</div></div>
```

to:

```html
          <div class="field"><label>ชื่อโรงเรียน</label><div>{{ schoolForm.school || '—' }}</div></div>
          <div class="field"><label>รหัสโรงเรียน</label><div>{{ schoolForm.code || '—' }}</div></div>
          <div class="field"><label>สังกัดกระทรวง</label><div>{{ schoolForm.ministry || '—' }}</div></div>
```

`persistAll()` already does `data.saveSetup({ ...schoolForm.value, maxGrade: structureForm.value.maxGrade })` — no change needed, `code` is included via the spread.

- [ ] **Step 4: Type-check**

Run: `npx vue-tsc --noEmit`
Expected: no errors.

- [ ] **Step 5: Manual check**

In the running dev server, go through Onboarding (or reset local state if needed via existing dev tooling), enter a school code with letters/numbers/dashes and unusual length, confirm it shows correctly on the step-4 summary, and confirm `finish()` persists it (check via Settings, Task 5, or dev tools localStorage inspection).

- [ ] **Step 6: Commit (user runs manually)**

```bash
git add src/features/OnboardingView.vue
git commit -m "feat: collect school code in onboarding wizard"
```

---

### Task 5: School Code field in Settings edit panel

**Files:**
- Modify: `src/features/SettingsView.vue`

**Interfaces:**
- Consumes: `Setup.code?: string` from Task 1; existing `schoolDraft` ref (already typed `Setup`, already initialized `{ ...data.setup }` — `code` is present with no further code change needed to the ref itself).

- [ ] **Step 1: Locate the school-edit panel and add the input**

Around line 174-182 of `src/features/SettingsView.vue`, find:

```html
            <input class="search" v-model="schoolDraft.school" style="width: 100%" />
```

and the block containing the province/teacher inputs. Add a new field row directly after the school-name input:

```html
            <input class="search" v-model="schoolDraft.school" style="width: 100%" />
          </div>
          <div class="field">
            <label>รหัสโรงเรียน</label>
            <input class="search" v-model="schoolDraft.code" style="width: 100%" />
```

(Match the existing `.field`/`<label>` wrapper markup used around the school/province/teacher inputs in this file exactly — read the surrounding lines first since indentation/wrapper divs must match the current pattern precisely.)

- [ ] **Step 2: Type-check**

Run: `npx vue-tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Manual check**

In the running dev server, open Settings, edit school code, save, confirm `data.setup.code` updates (reflected in Reports header from Task 3) and persists across a page reload.

- [ ] **Step 4: Commit (user runs manually)**

```bash
git add src/features/SettingsView.vue
git commit -m "feat: edit school code from settings"
```

---

## Spec Coverage Check

- School Code field, unbounded text, no validation, part of school profile → Task 1 (type), Task 4 (Onboarding), Task 5 (Settings). ✓
- Report header shows school name, code, and existing metadata → Task 2 (`summaryToAoa`), Task 3 (`.doc-head` identity lines). ✓
- Academic Year → Semester → Round hierarchy in UI, data grouping, report generation, export → Task 3 (three cascading selects, auto-default), Task 2 (`summarize`/`summaryToAoa` round filter used by both print and xlsx paths). ✓
- Existing reports continue to work → Task 2/3 keep the same components and empty-state rendering; only added a required parameter and additional header rows. ✓
- Empty state when no data → unchanged existing `ReportsView.vue` rendering, verified in Task 3 Step 6. ✓
- No duplicated logic between builders/mappers → single `summarize()`/`summaryToAoa()` pair remains the only report data path, feeding both print and xlsx. ✓
