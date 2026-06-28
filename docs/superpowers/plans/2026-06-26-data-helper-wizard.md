# Data Helper Wizard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a new nav destination "ผู้ช่วยจัดการข้อมูล" hosting a hub of three guided, Excel-centric add-data wizards (add students, add measurement batch, export) for non-technical teachers.

**Architecture:** New Vue views under `src/features/wizard/` provide friendly step-by-step chrome (reusing the existing `Stepper` component) over the existing `useData` store and `src/domain/transfer/xlsx.ts` functions. Two small, unit-tested domain helpers are added so the measure template can prefill student names without breaking the positional `parseMeasureAoa`. Wired into the existing `dest` switch in `AppShell.vue` — no router.

**Tech Stack:** Vue 3 `<script setup>` + TypeScript, Vite, Vitest, SheetJS (via existing xlsx wrappers).

## Global Constraints

- Offline single-file app: no network/CDN at runtime; reuse embedded libs only.
- `tsconfig` has `noUnusedLocals` — no unused imports (build fails otherwise).
- All nutrition classification flows through `src/domain/nutrition/engine.ts`; do not add an alternate path.
- `src/domain/**` stays framework-free and unit-tested.
- Thai Buddhist-era dates `D/M/YYYY`; academic year ≠ calendar year.
- Write files with Write/Edit tools; never shell heredoc/echo.
- Dev server is the user's on http://localhost:5173 — never start/kill it.
- Scope guard: **add-data only**. Reuse existing table markup for any list/review. No new parse/merge/classification logic beyond the two helpers in Tasks 1–2.
- Academic year is fixed from settings (`data.period.year`); wizard picks only term + round.

## Existing building blocks (reuse, do not reimplement)

From `src/domain/transfer/xlsx.ts`:
- `STUDENT_HEADERS`, `MEASURE_HEADERS` (`['รหัสนักเรียน','น้ำหนัก(กก.)','ส่วนสูง(ซม.)','วันที่วัด']`)
- `studentTemplateAoa()`, `studentsToAoa(students)`, `graduatesToAoa(students)`
- `aoaToXlsxBlob(aoa, sheetName?, textCols?)`, `readXlsxToAoa(buf)`
- `parseStudentAoa(aoa)` → `{ rows, skipped }`
- `parseMeasureAoa(aoa, { year, term, round })` → `{ rows, skipped }` (reads cols positionally: 0=id,1=weight,2=height,3=date)
- `mergeStudents(store, rows)` → `{ added, updated }`
- `mergeMeasures(store, rows)` → `{ added, updated, orphans }`

From `src/stores/data.ts` (`useData()`):
- `structure` (computed `{ grade, rooms }[]`), `roomStudents(grade, room)` (Student[] sorted by id), `roomInfo(grade, room)`
- `period` (`{ year, term, round }`), `students`, `findStudent`, `addStudent`, `updateStudent`, `addMeasure`, `upsertMeasure`, `findDuplicate` — refs auto-unwrap on the Pinia store instance (use `data.period.year`, `data.students`, no `.value`)
- `mergeStudents`/`mergeMeasures` take a `MergeStore` adapter (`students: { value }` + the mutators), **not** the raw store — build the adapter exactly as ImportDialog does (shown in Tasks 4–5)
- `MergeStore` is exported from `src/domain/transfer/xlsx.ts`

Other:
- `downloadBlob(blob, filename)` from `src/features/download.ts`
- `Stepper` from `src/components/Stepper.vue` — props `{ steps: string[]; current: number }`
- Test pattern: `tests/transfer/grid-import.test.ts` (Vitest, import from `../../src/domain/transfer/xlsx`)

---

### Task 1: Domain helper — `measureRosterTemplateAoa`

Prefilled measure template carrying display name columns, so the teacher matches rows to the kids in front of them.

**Files:**
- Modify: `src/domain/transfer/xlsx.ts`
- Test: `tests/transfer/measure-roster.test.ts`

**Interfaces:**
- Consumes: `Student` type (already imported in xlsx.ts), `MEASURE_HEADERS`.
- Produces: `measureRosterTemplateAoa(students: Student[]): string[][]` — first row is the 6-col header `['รหัสนักเรียน','ชื่อ','นามสกุล','น้ำหนัก(กก.)','ส่วนสูง(ซม.)','วันที่วัด']`; one row per student with id/firstName/lastName filled and the three measurement columns blank; order = input order.

- [ ] **Step 1: Write the failing test**

```typescript
// tests/transfer/measure-roster.test.ts
import { describe, it, expect } from 'vitest';
import { measureRosterTemplateAoa } from '../../src/domain/transfer/xlsx';
import type { Student } from '../../src/domain/types';

const stu = (p: Partial<Student> = {}): Student => ({
  id: '1', firstName: 'ก', lastName: 'ข', dob: '1/1/2558',
  gender: 'ชาย', grade: 'ป.1', room: '1', ...p,
});

describe('measureRosterTemplateAoa', () => {
  it('emits the 6-column friendly header first', () => {
    const aoa = measureRosterTemplateAoa([]);
    expect(aoa[0]).toEqual(['รหัสนักเรียน', 'ชื่อ', 'นามสกุล', 'น้ำหนัก(กก.)', 'ส่วนสูง(ซม.)', 'วันที่วัด']);
  });

  it('prefills id/name and leaves measurement columns blank, preserving order', () => {
    const aoa = measureRosterTemplateAoa([stu({ id: '10', firstName: 'สมชาย', lastName: 'ใจดี' }), stu({ id: '11', firstName: 'มาลี', lastName: 'ดี' })]);
    expect(aoa[1]).toEqual(['10', 'สมชาย', 'ใจดี', '', '', '']);
    expect(aoa[2]).toEqual(['11', 'มาลี', 'ดี', '', '', '']);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/transfer/measure-roster.test.ts`
Expected: FAIL — `measureRosterTemplateAoa is not a function`.

- [ ] **Step 3: Write minimal implementation**

Add to `src/domain/transfer/xlsx.ts` (near `measureTemplateAoa`). Add the exported const for the header so the wizard and parser can share it:

```typescript
export const MEASURE_ROSTER_HEADERS = [
  'รหัสนักเรียน',
  'ชื่อ',
  'นามสกุล',
  'น้ำหนัก(กก.)',
  'ส่วนสูง(ซม.)',
  'วันที่วัด',
] as const;

export function measureRosterTemplateAoa(students: Student[]): string[][] {
  const rows: string[][] = [[...MEASURE_ROSTER_HEADERS]];
  for (const s of students) {
    rows.push([s.id, s.firstName, s.lastName, '', '', '']);
  }
  return rows;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/transfer/measure-roster.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add src/domain/transfer/xlsx.ts tests/transfer/measure-roster.test.ts
git commit -m "feat: add measureRosterTemplateAoa for prefilled measure template"
```

---

### Task 2: Domain helper — `pickMeasureColumns`

Header-aware adapter that projects the friendly 6-column upload down to the strict `[id, weight, height, date]` order `parseMeasureAoa` expects.

**Files:**
- Modify: `src/domain/transfer/xlsx.ts`
- Test: `tests/transfer/pick-measure-columns.test.ts`

**Interfaces:**
- Consumes: `MEASURE_HEADERS`.
- Produces: `pickMeasureColumns(aoa: string[][]): string[][]` — given a sheet whose header row contains the four texts `รหัสนักเรียน / น้ำหนัก(กก.) / ส่วนสูง(ซม.) / วันที่วัด` (in any column order, possibly among extra columns), returns a new AoA: header row `[...MEASURE_HEADERS]` followed by each data row projected to `[id, weight, height, date]`. If any of the four headers is missing, returns the input unchanged (identity fallback — already strict layout).

- [ ] **Step 1: Write the failing test**

```typescript
// tests/transfer/pick-measure-columns.test.ts
import { describe, it, expect } from 'vitest';
import { pickMeasureColumns, MEASURE_HEADERS } from '../../src/domain/transfer/xlsx';

describe('pickMeasureColumns', () => {
  it('projects the friendly 6-col roster sheet down to id/weight/height/date', () => {
    const aoa = [
      ['รหัสนักเรียน', 'ชื่อ', 'นามสกุล', 'น้ำหนัก(กก.)', 'ส่วนสูง(ซม.)', 'วันที่วัด'],
      ['10', 'สมชาย', 'ใจดี', '22.5', '120', '15/6/2569'],
    ];
    const out = pickMeasureColumns(aoa);
    expect(out[0]).toEqual([...MEASURE_HEADERS]);
    expect(out[1]).toEqual(['10', '22.5', '120', '15/6/2569']);
  });

  it('returns input unchanged when a required header is missing (identity fallback)', () => {
    const aoa = [
      ['รหัสนักเรียน', 'น้ำหนัก(กก.)', 'ส่วนสูง(ซม.)', 'วันที่วัด'],
      ['10', '22.5', '120', '15/6/2569'],
    ];
    expect(pickMeasureColumns(aoa)).toBe(aoa);
  });

  it('handles reordered columns', () => {
    const aoa = [
      ['วันที่วัด', 'รหัสนักเรียน', 'ชื่อ', 'ส่วนสูง(ซม.)', 'น้ำหนัก(กก.)'],
      ['15/6/2569', '10', 'สมชาย', '120', '22.5'],
    ];
    const out = pickMeasureColumns(aoa);
    expect(out[1]).toEqual(['10', '22.5', '120', '15/6/2569']);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/transfer/pick-measure-columns.test.ts`
Expected: FAIL — `pickMeasureColumns is not a function`.

- [ ] **Step 3: Write minimal implementation**

Add to `src/domain/transfer/xlsx.ts` (after `measureRosterTemplateAoa`):

```typescript
export function pickMeasureColumns(aoa: string[][]): string[][] {
  if (aoa.length === 0) return aoa;
  const header = aoa[0].map((h) => (h ?? '').trim());
  const want = ['รหัสนักเรียน', 'น้ำหนัก(กก.)', 'ส่วนสูง(ซม.)', 'วันที่วัด'];
  const idx = want.map((w) => header.indexOf(w));
  if (idx.some((i) => i === -1)) return aoa; // not the friendly layout — leave as-is
  const out: string[][] = [[...MEASURE_HEADERS]];
  for (let r = 1; r < aoa.length; r++) {
    const row = aoa[r];
    out.push(idx.map((i) => (row[i] ?? '').trim()));
  }
  return out;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/transfer/pick-measure-columns.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/domain/transfer/xlsx.ts tests/transfer/pick-measure-columns.test.ts
git commit -m "feat: add pickMeasureColumns header-aware adapter for measure upload"
```

---

### Task 3: Wizard hub + nav wiring

New `dest: 'wizard'` entry below ตั้งค่า opening a hub with three cards. The cards emit a local event the hub uses to switch which wizard component renders.

**Files:**
- Create: `src/features/wizard/WizardHubView.vue`
- Modify: `src/AppShell.vue`

**Interfaces:**
- Produces: `WizardHubView` renders the hub when no sub-wizard active, else renders the chosen wizard. Emits nothing upward (self-contained). Each child wizard (Tasks 4–6) emits `done` and `exit`; the hub handles both by returning to the card list.
- Consumes (Tasks 4–6 components): `AddStudentsWizard`, `AddMeasuresWizard`, `ExportWizard`, each `@done` / `@exit`. Until those tasks land, the hub imports are added per-task.

- [ ] **Step 1: Add the nav destination in AppShell.vue**

In `src/AppShell.vue`, extend the `Dest` type and the `nav` array, and render the hub.

Change the type (line ~14):

```typescript
type Dest = 'home' | 'students' | 'measure' | 'reports' | 'settings' | 'wizard';
```

Add to the `nav` array, after the `settings` entry:

```typescript
  { id: 'wizard', label: 'ผู้ช่วยจัดการข้อมูล', ico: '🧭' },
```

Add the import near the other view imports:

```typescript
import WizardHubView from './features/wizard/WizardHubView.vue';
```

Add to the `<Transition>` block, after the `ReportsView` line:

```html
          <WizardHubView v-else-if="dest === 'wizard'" key="wizard" />
```

- [ ] **Step 2: Create the hub component**

```vue
<!-- src/features/wizard/WizardHubView.vue -->
<script setup lang="ts">
import { ref } from 'vue';
import AddStudentsWizard from './AddStudentsWizard.vue';
import AddMeasuresWizard from './AddMeasuresWizard.vue';
import ExportWizard from './ExportWizard.vue';

type Active = 'students' | 'measures' | 'export' | null;
const active = ref<Active>(null);

const cards: { id: Exclude<Active, null>; ico: string; title: string; desc: string }[] = [
  { id: 'students', ico: '👥', title: 'เพิ่มรายชื่อนักเรียน', desc: 'ดาวน์โหลดแม่แบบ Excel กรอกรายชื่อ แล้วอัปโหลดกลับ' },
  { id: 'measures', ico: '📏', title: 'บันทึกการวัด', desc: 'เลือกห้อง ดาวน์โหลดแม่แบบที่มีชื่อนักเรียนแล้ว กรอกน้ำหนัก/ส่วนสูง แล้วอัปโหลด' },
  { id: 'export', ico: '📤', title: 'ส่งออกรายงาน', desc: 'เลือกข้อมูลและรูปแบบ แล้วดาวน์โหลดไฟล์เพื่อส่งให้หน่วยงาน' },
];

function back() { active.value = null; }
</script>

<template>
  <div v-if="active === null" class="container">
    <h1 class="page-title">ผู้ช่วยจัดการข้อมูล 🧭</h1>
    <p class="page-sub">เลือกสิ่งที่อยากทำ ระบบจะพาทำทีละขั้น</p>
    <div class="wiz-grid">
      <button v-for="c in cards" :key="c.id" class="wiz-card" @click="active = c.id">
        <span class="ico">{{ c.ico }}</span>
        <span class="t">{{ c.title }}</span>
        <span class="d">{{ c.desc }}</span>
      </button>
    </div>
  </div>

  <AddStudentsWizard v-else-if="active === 'students'" @done="back" @exit="back" />
  <AddMeasuresWizard v-else-if="active === 'measures'" @done="back" @exit="back" />
  <ExportWizard v-else-if="active === 'export'" @done="back" @exit="back" />
</template>

<style scoped>
.wiz-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: var(--s4); margin-top: var(--s5); }
@media (max-width: 760px) { .wiz-grid { grid-template-columns: 1fr; } }
.wiz-card {
  display: flex; flex-direction: column; gap: var(--s2); align-items: flex-start; text-align: left;
  padding: var(--s5); border: 1px solid var(--line); border-radius: var(--r); background: var(--surface);
  transition: background 150ms var(--ease), border-color 150ms var(--ease);
}
.wiz-card:hover { background: var(--brand-tint); border-color: var(--brand); }
.wiz-card .ico { font-size: 34px; }
.wiz-card .t { font-size: 18px; font-weight: 700; color: var(--ink); }
.wiz-card .d { font-size: 14px; color: var(--ink-muted); }
</style>
```

> NOTE: this references the three wizard components built in Tasks 4–6. To keep the build green if executing strictly in order, create the three files as minimal stubs now (a single `<template><div/></template>` with `defineEmits<{ done: []; exit: [] }>()`), then flesh them out in their tasks. Each later task overwrites its stub.

- [ ] **Step 3: Create stubs for the three wizards (keeps the build green)**

Create each of the following with this stub body (overwritten in Tasks 4–6):

```vue
<!-- src/features/wizard/AddStudentsWizard.vue (and AddMeasuresWizard.vue, ExportWizard.vue) -->
<script setup lang="ts">
defineEmits<{ done: []; exit: [] }>();
</script>
<template><div class="container">…</div></template>
```

- [ ] **Step 4: Verify it builds and renders**

Run: `npx vue-tsc --noEmit`
Expected: no errors.
Then open http://localhost:5173, click "ผู้ช่วยจัดการข้อมูล" in the sidebar (below ตั้งค่า) → hub with 3 cards renders; clicking a card swaps to its stub; nothing crashes.

- [ ] **Step 5: Commit**

```bash
git add src/AppShell.vue src/features/wizard/
git commit -m "feat: add data-helper wizard hub and nav entry"
```

---

### Task 4: AddStudentsWizard

Three-step roster import: download template → upload & parse → review → save.

**Files:**
- Create (overwrite stub): `src/features/wizard/AddStudentsWizard.vue`

**Interfaces:**
- Consumes: `useData()`, `studentTemplateAoa`, `aoaToXlsxBlob`, `readXlsxToAoa`, `parseStudentAoa`, `mergeStudents`, `downloadBlob`, `Stepper`.
- Produces: emits `done` (after save) and `exit` (back/cancel).

- [ ] **Step 1: Build the component**

```vue
<!-- src/features/wizard/AddStudentsWizard.vue -->
<script setup lang="ts">
import { ref, computed } from 'vue';
import { useData } from '../../stores/data';
import Stepper from '../../components/Stepper.vue';
import { downloadBlob } from '../download';
import {
  studentTemplateAoa, aoaToXlsxBlob, readXlsxToAoa, parseStudentAoa, mergeStudents,
  type MergeStore,
} from '../../domain/transfer/xlsx';
import type { Student } from '../../domain/types';

const data = useData();
const emit = defineEmits<{ done: []; exit: [] }>();

// mergeStudents/mergeMeasures expect a MergeStore (students as a { value } ref-like),
// not the unwrapped Pinia store instance. Same adapter ImportDialog uses.
function mergeStore(): MergeStore {
  return {
    students: { value: data.students },
    addStudent: (s) => data.addStudent(s),
    updateStudent: (id, patch) => data.updateStudent(id, patch),
    addMeasure: (m) => data.addMeasure(m),
    upsertMeasure: (m) => data.upsertMeasure(m),
    findDuplicate: (id, y, t, r) => data.findDuplicate(id, y, t, r),
  };
}

const steps = ['ดาวน์โหลดแม่แบบ', 'อัปโหลดไฟล์', 'ตรวจสอบและบันทึก'];
const step = ref(0);

const parsed = ref<Student[]>([]);
const skipped = ref<{ row: number; reason: string }[]>([]);
const fileErr = ref('');
const result = ref<{ added: number; updated: number } | null>(null);

function downloadTemplate() {
  downloadBlob(aoaToXlsxBlob(studentTemplateAoa(), 'รายชื่อนักเรียน', [0]), 'แม่แบบรายชื่อนักเรียน.xlsx');
}

function onFile(e: Event) {
  fileErr.value = '';
  const file = (e.target as HTMLInputElement).files?.[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const aoa = readXlsxToAoa(reader.result as ArrayBuffer);
      const out = parseStudentAoa(aoa);
      parsed.value = out.rows;
      skipped.value = out.skipped;
      step.value = 2;
    } catch {
      fileErr.value = 'อ่านไฟล์ไม่ได้ — ตรวจสอบว่าเป็นไฟล์ Excel (.xlsx) ที่ถูกต้อง';
    }
  };
  reader.readAsArrayBuffer(file);
  (e.target as HTMLInputElement).value = '';
}

function save() {
  result.value = mergeStudents(mergeStore(), parsed.value);
}

const canSave = computed(() => parsed.value.length > 0 && !result.value);
</script>

<template>
  <div class="container">
    <div class="toolbar"><button class="btn quiet" @click="emit('exit')">← กลับ</button></div>
    <h1 class="page-title">เพิ่มรายชื่อนักเรียน</h1>
    <Stepper :steps="steps" :current="step" />

    <!-- step 0 -->
    <div v-if="step === 0" class="panel">
      <p>ดาวน์โหลดแม่แบบ Excel กรอกรายชื่อนักเรียนตามหัวคอลัมน์ แล้วกดถัดไปเพื่ออัปโหลด</p>
      <button class="btn primary lg" @click="downloadTemplate">📥 ดาวน์โหลดแม่แบบ Excel</button>
      <div style="margin-top: var(--s4)"><button class="btn lg" @click="step = 1">ถัดไป →</button></div>
    </div>

    <!-- step 1 -->
    <div v-else-if="step === 1" class="panel">
      <p>เลือกไฟล์ Excel ที่กรอกรายชื่อแล้ว</p>
      <input type="file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" @change="onFile" />
      <div v-if="fileErr" style="color: var(--bad); margin-top: var(--s3)">{{ fileErr }}</div>
      <div style="margin-top: var(--s4)"><button class="btn quiet" @click="step = 0">← ย้อนกลับ</button></div>
    </div>

    <!-- step 2 -->
    <div v-else class="panel">
      <div v-if="!result">
        <div class="section-title">พบ {{ parsed.length }} รายชื่อ</div>
        <div class="table-wrap">
          <table>
            <thead><tr><th>รหัส</th><th>ชื่อ-สกุล</th><th>เพศ</th><th>ชั้น/ห้อง</th></tr></thead>
            <tbody>
              <tr v-for="s in parsed" :key="s.id">
                <td>{{ s.id }}</td><td>{{ s.firstName }} {{ s.lastName }}</td><td>{{ s.gender }}</td><td>{{ s.grade }}/{{ s.room }}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <div v-if="skipped.length" style="margin-top: var(--s4)">
          <div class="section-title">ข้ามไป {{ skipped.length }} แถว</div>
          <ul><li v-for="(sk, i) in skipped" :key="i">แถว {{ sk.row }}: {{ sk.reason }}</li></ul>
        </div>
        <div style="margin-top: var(--s4); display: flex; gap: var(--s3)">
          <button class="btn quiet" @click="step = 1">← เลือกไฟล์ใหม่</button>
          <button class="btn primary lg" :disabled="!canSave" @click="save">บันทึก {{ parsed.length }} รายชื่อ</button>
        </div>
      </div>
      <div v-else class="empty">
        <span class="ico">✅</span>
        <div>บันทึกแล้ว — เพิ่มใหม่ {{ result.added }} คน, อัปเดต {{ result.updated }} คน</div>
        <button class="btn primary lg" style="margin-top: var(--s4)" @click="emit('done')">เสร็จสิ้น</button>
      </div>
    </div>
  </div>
</template>
```

- [ ] **Step 2: Verify type-check + manual flow**

Run: `npx vue-tsc --noEmit`
Expected: no errors.
Then on localhost:5173: hub → "เพิ่มรายชื่อนักเรียน" → download template, fill a row in Excel, upload → review table shows the row → บันทึก → success counts → เสร็จสิ้น returns to hub. Confirm the student appears in นักเรียน view.

- [ ] **Step 3: Commit**

```bash
git add src/features/wizard/AddStudentsWizard.vue
git commit -m "feat: add students wizard (download/upload/review/save)"
```

---

### Task 5: AddMeasuresWizard

Steps: pick context (Grade→Room→Semester→Round, one page) → data (download prefilled, upload) → summary → done.

**Files:**
- Create (overwrite stub): `src/features/wizard/AddMeasuresWizard.vue`

**Interfaces:**
- Consumes: `useData()` (`structure`, `roomStudents`, `period`), `measureRosterTemplateAoa`, `pickMeasureColumns`, `parseMeasureAoa`, `mergeMeasures`, `aoaToXlsxBlob`, `readXlsxToAoa`, `downloadBlob`, `Stepper`. Term/Round typed as `Term`/`Round` from `../../domain/types`.
- Produces: emits `done`, `exit`.

- [ ] **Step 1: Build the component**

```vue
<!-- src/features/wizard/AddMeasuresWizard.vue -->
<script setup lang="ts">
import { ref, computed } from 'vue';
import { useData } from '../../stores/data';
import Stepper from '../../components/Stepper.vue';
import { downloadBlob } from '../download';
import {
  measureRosterTemplateAoa, pickMeasureColumns, parseMeasureAoa, mergeMeasures,
  aoaToXlsxBlob, readXlsxToAoa, type MergeStore,
} from '../../domain/transfer/xlsx';
import type { Term, Round, Measurement } from '../../domain/types';

const data = useData();
const emit = defineEmits<{ done: []; exit: [] }>();

// mergeMeasures expects a MergeStore adapter, not the raw Pinia store instance.
function mergeStore(): MergeStore {
  return {
    students: { value: data.students },
    addStudent: (s) => data.addStudent(s),
    updateStudent: (id, patch) => data.updateStudent(id, patch),
    addMeasure: (m) => data.addMeasure(m),
    upsertMeasure: (m) => data.upsertMeasure(m),
    findDuplicate: (id, y, t, r) => data.findDuplicate(id, y, t, r),
  };
}

const steps = ['เลือกข้อมูล', 'กรอกข้อมูล', 'สรุปการเปลี่ยนแปลง'];
const step = ref(0);

const grade = ref('');
const room = ref('');
const term = ref<Term>('1');
const round = ref<Round>('1');
const year = computed(() => data.period.year);

const rooms = computed(() => data.structure.find((g) => g.grade === grade.value)?.rooms ?? []);
const roomStudents = computed(() => (grade.value && room.value ? data.roomStudents(grade.value, room.value) : []));
const contextReady = computed(() => !!grade.value && !!room.value);

const parsedRows = ref<Measurement[]>([]);
const skipped = ref<{ row: number; reason: string }[]>([]);
const fileErr = ref('');
const result = ref<{ added: number; updated: number; orphans: number } | null>(null);

function pickGrade(g: string) { grade.value = g; room.value = ''; }

function downloadTemplate() {
  const aoa = measureRosterTemplateAoa(roomStudents.value);
  downloadBlob(aoaToXlsxBlob(aoa, 'ผลการวัด', [0]), `แม่แบบการวัด ${grade.value}-${room.value}.xlsx`);
}

function onFile(e: Event) {
  fileErr.value = '';
  const file = (e.target as HTMLInputElement).files?.[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const aoa = readXlsxToAoa(reader.result as ArrayBuffer);
      const strict = pickMeasureColumns(aoa);
      const out = parseMeasureAoa(strict, { year: year.value, term: term.value, round: round.value });
      parsedRows.value = out.rows;
      skipped.value = out.skipped;
      step.value = 2;
    } catch {
      fileErr.value = 'อ่านไฟล์ไม่ได้ — ตรวจสอบว่าเป็นไฟล์ Excel (.xlsx) ที่ถูกต้อง';
    }
  };
  reader.readAsArrayBuffer(file);
  (e.target as HTMLInputElement).value = '';
}

const nameOf = (id: string) => {
  const s = data.findStudent(id);
  return s ? `${s.firstName} ${s.lastName}` : id;
};

function save() {
  result.value = mergeMeasures(mergeStore(), parsedRows.value);
}

const canSave = computed(() => parsedRows.value.length > 0 && !result.value);
</script>

<template>
  <div class="container">
    <div class="toolbar"><button class="btn quiet" @click="emit('exit')">← กลับ</button></div>
    <h1 class="page-title">บันทึกการวัด</h1>
    <Stepper :steps="steps" :current="step" />

    <!-- step 0: context, one page -->
    <div v-if="step === 0" class="panel">
      <div class="section-title">เลือกชั้น</div>
      <div class="chip-row">
        <button v-for="g in data.structure" :key="g.grade" class="chip" :class="{ on: grade === g.grade }" @click="pickGrade(g.grade)">{{ g.grade }}</button>
      </div>
      <div class="section-title">เลือกห้อง</div>
      <div class="chip-row">
        <button v-for="r in rooms" :key="r" class="chip" :class="{ on: room === r }" @click="room = r">ห้อง {{ r }}</button>
      </div>
      <div class="section-title">ภาคเรียน</div>
      <div class="chip-row">
        <button v-for="t in (['1','2'] as Term[])" :key="t" class="chip" :class="{ on: term === t }" @click="term = t">ภาคเรียนที่ {{ t }}</button>
      </div>
      <div class="section-title">ครั้งที่วัด</div>
      <div class="chip-row">
        <button v-for="rd in (['1','2'] as Round[])" :key="rd" class="chip" :class="{ on: round === rd }" @click="round = rd">ครั้งที่ {{ rd }}</button>
      </div>
      <p style="color: var(--ink-muted)">ปีการศึกษา {{ year }} (ตั้งค่าจากหน้าตั้งค่า)</p>
      <button class="btn primary lg" :disabled="!contextReady" @click="step = 1">ถัดไป →</button>
    </div>

    <!-- step 1: data -->
    <div v-else-if="step === 1" class="panel">
      <p>ดาวน์โหลดแม่แบบ — มีรายชื่อนักเรียน {{ grade }}/{{ room }} จำนวน {{ roomStudents.length }} คนอยู่แล้ว กรอกเฉพาะน้ำหนัก/ส่วนสูง/วันที่วัด</p>
      <button class="btn primary lg" @click="downloadTemplate">📥 ดาวน์โหลดแม่แบบที่มีชื่อแล้ว</button>
      <div style="margin-top: var(--s4)">
        <div class="section-title">อัปโหลดไฟล์ที่กรอกแล้ว</div>
        <input type="file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" @change="onFile" />
        <div v-if="fileErr" style="color: var(--bad); margin-top: var(--s3)">{{ fileErr }}</div>
      </div>
      <div style="margin-top: var(--s4)"><button class="btn quiet" @click="step = 0">← ย้อนกลับ</button></div>
    </div>

    <!-- step 2: summary -->
    <div v-else class="panel">
      <div v-if="!result">
        <div class="section-title">ตรวจสอบ {{ parsedRows.length }} รายการ — {{ grade }}/{{ room }} · ภาค {{ term }} · ครั้งที่ {{ round }}</div>
        <div class="table-wrap">
          <table>
            <thead><tr><th>ชื่อ-สกุล</th><th>น้ำหนัก</th><th>ส่วนสูง</th><th>วันที่วัด</th></tr></thead>
            <tbody>
              <tr v-for="(m, i) in parsedRows" :key="i">
                <td>{{ nameOf(m.studentId) }}</td><td>{{ m.weightKg }}</td><td>{{ m.heightCm }}</td><td>{{ m.date }}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <div v-if="skipped.length" style="margin-top: var(--s4)">
          <div class="section-title">ข้ามไป {{ skipped.length }} แถว</div>
          <ul><li v-for="(sk, i) in skipped" :key="i">แถว {{ sk.row }}: {{ sk.reason }}</li></ul>
        </div>
        <div style="margin-top: var(--s4); display: flex; gap: var(--s3)">
          <button class="btn quiet" @click="step = 1">← เลือกไฟล์ใหม่</button>
          <button class="btn primary lg" :disabled="!canSave" @click="save">บันทึกผลการวัด</button>
        </div>
      </div>
      <div v-else class="empty">
        <span class="ico">✅</span>
        <div>บันทึกแล้ว — ใหม่ {{ result.added }} · อัปเดต {{ result.updated }}<template v-if="result.orphans"> · ไม่พบนักเรียน {{ result.orphans }} (รหัสไม่ตรง)</template></div>
        <button class="btn primary lg" style="margin-top: var(--s4)" @click="emit('done')">เสร็จสิ้น</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.chip-row { display: flex; flex-wrap: wrap; gap: var(--s2); margin-bottom: var(--s4); }
.chip { padding: 8px 14px; border: 1px solid var(--line); border-radius: 999px; background: var(--surface); font-weight: 600; }
.chip.on { background: var(--brand); color: #fff; border-color: var(--brand); }
</style>
```

- [ ] **Step 2: Verify type-check + manual flow**

Run: `npx vue-tsc --noEmit`
Expected: no errors.
Then on localhost:5173: hub → "บันทึกการวัด" → pick grade/room/term/round → download template (names prefilled, roster order) → fill น้ำหนัก/ส่วนสูง/วันที่ in Excel → upload → summary table shows names + values, counts of new/updated, orphans for any bad id → บันทึก → success. Confirm measurements appear for that room in the measure/profile views. Re-upload with a changed weight → summary shows it as updated (overwrite).

- [ ] **Step 3: Commit**

```bash
git add src/features/wizard/AddMeasuresWizard.vue
git commit -m "feat: add measures wizard with prefilled per-room Excel round-trip"
```

---

### Task 6: ExportWizard

Thin wrapper: pick scope → pick format → download. xlsx handled here; PDF/print hands off to the existing ReportsView.

**Files:**
- Create (overwrite stub): `src/features/wizard/ExportWizard.vue`

**Interfaces:**
- Consumes: `useData()` (`students`, `structure`), `studentsToAoa`, `graduatesToAoa`, `aoaToXlsxBlob`, `downloadBlob`, `Stepper`.
- Produces: emits `done`, `exit`. For PDF the wizard tells the user to use the รายงาน screen (no duplicate print pipeline) — keeps the wrapper thin per spec.

- [ ] **Step 1: Build the component**

```vue
<!-- src/features/wizard/ExportWizard.vue -->
<script setup lang="ts">
import { ref, computed } from 'vue';
import { useData } from '../../stores/data';
import Stepper from '../../components/Stepper.vue';
import { downloadBlob } from '../download';
import { studentsToAoa, graduatesToAoa, aoaToXlsxBlob } from '../../domain/transfer/xlsx';

const data = useData();
const emit = defineEmits<{ done: []; exit: [] }>();

const steps = ['เลือกขอบเขต', 'เลือกรูปแบบ', 'ดาวน์โหลด'];
const step = ref(0);

type Scope = 'all' | 'grade' | 'graduates';
const scope = ref<Scope>('all');
const grade = ref('');

const selected = computed(() => {
  if (scope.value === 'graduates') return data.students.filter((s) => s.graduated);
  const active = data.students.filter((s) => !s.graduated);
  if (scope.value === 'grade') return active.filter((s) => s.grade === grade.value);
  return active;
});

function exportXlsx() {
  const aoa = scope.value === 'graduates' ? graduatesToAoa(selected.value) : studentsToAoa(selected.value);
  downloadBlob(aoaToXlsxBlob(aoa, 'รายชื่อ', [0]), `รายชื่อนักเรียน-${scope.value}.xlsx`);
  step.value = 2;
}

const scopeReady = computed(() => scope.value !== 'grade' || !!grade.value);
</script>

<template>
  <div class="container">
    <div class="toolbar"><button class="btn quiet" @click="emit('exit')">← กลับ</button></div>
    <h1 class="page-title">ส่งออกรายงาน</h1>
    <Stepper :steps="steps" :current="step" />

    <!-- step 0 -->
    <div v-if="step === 0" class="panel">
      <div class="chip-row">
        <button class="chip" :class="{ on: scope === 'all' }" @click="scope = 'all'">นักเรียนทั้งหมด</button>
        <button class="chip" :class="{ on: scope === 'grade' }" @click="scope = 'grade'">เลือกชั้น</button>
        <button class="chip" :class="{ on: scope === 'graduates' }" @click="scope = 'graduates'">นักเรียนที่จบ/ออก</button>
      </div>
      <div v-if="scope === 'grade'" class="chip-row">
        <button v-for="g in data.structure" :key="g.grade" class="chip" :class="{ on: grade === g.grade }" @click="grade = g.grade">{{ g.grade }}</button>
      </div>
      <p style="color: var(--ink-muted)">เลือกแล้ว {{ selected.length }} คน</p>
      <button class="btn primary lg" :disabled="!scopeReady" @click="step = 1">ถัดไป →</button>
    </div>

    <!-- step 1 -->
    <div v-else-if="step === 1" class="panel">
      <p>เลือกรูปแบบไฟล์</p>
      <button class="btn primary lg" @click="exportXlsx">📊 ส่งออก Excel ({{ selected.length }} คน)</button>
      <p style="color: var(--ink-muted); margin-top: var(--s4)">ต้องการ PDF? ไปที่เมนู “รายงาน” เพื่อพิมพ์ / บันทึกเป็น PDF</p>
      <button class="btn quiet" @click="step = 0">← ย้อนกลับ</button>
    </div>

    <!-- step 2 -->
    <div v-else class="panel empty">
      <span class="ico">✅</span>
      <div>ดาวน์โหลดไฟล์แล้ว</div>
      <button class="btn primary lg" style="margin-top: var(--s4)" @click="emit('done')">เสร็จสิ้น</button>
    </div>
  </div>
</template>

<style scoped>
.chip-row { display: flex; flex-wrap: wrap; gap: var(--s2); margin-bottom: var(--s4); }
.chip { padding: 8px 14px; border: 1px solid var(--line); border-radius: 999px; background: var(--surface); font-weight: 600; }
.chip.on { background: var(--brand); color: #fff; border-color: var(--brand); }
</style>
```

- [ ] **Step 2: Verify type-check + manual flow**

Run: `npx vue-tsc --noEmit`
Expected: no errors.
Then on localhost:5173: hub → "ส่งออกรายงาน" → pick scope (all / a grade / graduates), count updates → ถัดไป → ส่งออก Excel downloads a file → เสร็จสิ้น returns to hub. Open the xlsx and confirm rows match the scope.

- [ ] **Step 3: Run the full test suite + commit**

Run: `npm test`
Expected: all pass (including the two new domain test files).

```bash
git add src/features/wizard/ExportWizard.vue
git commit -m "feat: add export wizard (scope + xlsx, PDF handoff to reports)"
```

---

## Notes for the implementer

- `Student` fields are `firstName`/`lastName` (see `src/domain/types.ts`); `Measurement` uses `weightKg`/`heightCm`/`studentId`/`date`/`gradeAtMeasure`/`roomAtMeasure`.
- `aoaToXlsxBlob(aoa, sheetName, textCols)` — pass `[0]` as `textCols` so the id column is written as text (preserves leading zeros), matching existing template downloads.
- Do not add grade/room columns to the *parsed* measure path — `pickMeasureColumns` is the only bridge from the friendly template to `parseMeasureAoa`.
- Reuse existing CSS utility classes (`.panel`, `.toolbar`, `.section-title`, `.table-wrap`, `.empty`, `.btn`, `.page-title`, `.page-sub`, `.chip`) — they are global, defined in the app stylesheet.
