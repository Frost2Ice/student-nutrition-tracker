# Fast-Grid Student Import (POC) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace file-first student bulk-add with an in-app spreadsheet-style fast-grid of controlled inputs (date-picker DOB, gender toggle), paste-to-fill support, and a light game feel; Excel demoted to a secondary path that loads into the same grid.

**Architecture:** A new `grid` stage in `ImportDialog.vue` (student kind only) holds an editable rows array. Rows serialize to an `aoa: string[][]` in `STUDENT_CLASSROOM_HEADERS` order via a new pure helper `gridRowsToAoa`, then flow through the EXISTING `parseStudentImport` / `mergeStudents` — no new validation/classification logic. Excel file path is demoted to a link that parses into the same grid.

**Tech Stack:** Vue 3 `<script setup>` + TS, Vitest (node env, `tests/**/*.test.ts`), existing `ThaiDateField` component, domain module `src/domain/transfer/xlsx.ts`.

## Global Constraints

- `tsconfig` has `noUnusedLocals` — no unused imports/vars or the build fails.
- `src/domain/**` is framework-free + unit-tested; new pure helpers go there.
- ALL nutrition/validation flows through existing domain parsers — do NOT add a parallel path.
- Thai Buddhist-era dates, canonical form `D/M/YYYY` (from `ThaiDateField`).
- Gender values are exactly `'ชาย'` | `'หญิง'` (`Gender` type).
- Classroom column order: `STUDENT_CLASSROOM_HEADERS` = [รหัสนักเรียน, ชื่อ, นามสกุล, วันเกิด-วัน, วันเกิด-เดือน, วันเกิด-ปี(พ.ศ.), เพศ].
- Tests live under `tests/`, mirroring `src/` (e.g. `tests/transfer/`).
- Dev server is the user's on :5173 — never start/kill it.
- Write files with Write/Edit, never shell heredoc/echo.
- Build check: `npx vue-tsc --noEmit`. Tests: `npm test`.
- POC: this intentionally violates PRODUCT.md anti-references (spreadsheet-as-UI, playful). Documented in the spec; do not "fix" it back.

---

### Task 1: `gridRowsToAoa` pure serializer

Convert grid rows into the classroom-template AoA so existing `parseStudentImport` can validate them unchanged.

**Files:**
- Modify: `src/domain/transfer/xlsx.ts` (add export near `STUDENT_CLASSROOM_HEADERS` / AoA builders)
- Test: `tests/transfer/grid-import.test.ts`

**Interfaces:**
- Consumes: `STUDENT_CLASSROOM_HEADERS` (existing).
- Produces:
  ```ts
  export interface GridRow {
    id: string;
    firstName: string;
    lastName: string;
    gender: string; // '' | 'ชาย' | 'หญิง'
    dob: string;    // canonical 'D/M/YYYY' from ThaiDateField, or ''
  }
  export function gridRowsToAoa(rows: GridRow[]): string[][]
  ```
  Behavior: first element is `[...STUDENT_CLASSROOM_HEADERS]`. Each row → `[id, firstName, lastName, day, month, year, gender]` where day/month/year come from splitting `dob` on `/` (empty strings when dob is ''). Fully-blank rows (all fields empty/whitespace) are skipped.

- [ ] **Step 1: Write the failing test**

```ts
// tests/transfer/grid-import.test.ts
import { describe, it, expect } from 'vitest';
import { gridRowsToAoa, STUDENT_CLASSROOM_HEADERS, type GridRow } from '../../src/domain/transfer/xlsx';

const row = (p: Partial<GridRow> = {}): GridRow => ({
  id: '', firstName: '', lastName: '', gender: '', dob: '', ...p,
});

describe('gridRowsToAoa', () => {
  it('emits the classroom header row first', () => {
    const aoa = gridRowsToAoa([row({ id: '1', firstName: 'ก', lastName: 'ข', gender: 'ชาย', dob: '5/3/2558' })]);
    expect(aoa[0]).toEqual([...STUDENT_CLASSROOM_HEADERS]);
  });

  it('splits canonical dob into day/month/year cells in column order', () => {
    const aoa = gridRowsToAoa([row({ id: '10', firstName: 'ก', lastName: 'ข', gender: 'หญิง', dob: '5/3/2558' })]);
    expect(aoa[1]).toEqual(['10', 'ก', 'ข', '5', '3', '2558', 'หญิง']);
  });

  it('leaves dob cells empty when dob is blank', () => {
    const aoa = gridRowsToAoa([row({ id: '10', firstName: 'ก', lastName: 'ข', gender: 'ชาย', dob: '' })]);
    expect(aoa[1]).toEqual(['10', 'ก', 'ข', '', '', '', 'ชาย']);
  });

  it('skips fully blank rows', () => {
    const aoa = gridRowsToAoa([row(), row({ id: '1', firstName: 'ก', lastName: 'ข', dob: '1/1/2558' }), row()]);
    expect(aoa).toHaveLength(2); // header + 1 real row
  });

  it('returns header-only for all-blank input', () => {
    expect(gridRowsToAoa([row(), row()])).toEqual([[...STUDENT_CLASSROOM_HEADERS]]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/transfer/grid-import.test.ts`
Expected: FAIL — `gridRowsToAoa` / `GridRow` not exported.

- [ ] **Step 3: Write minimal implementation**

Add to `src/domain/transfer/xlsx.ts` (after the AoA builders section):

```ts
export interface GridRow {
  id: string;
  firstName: string;
  lastName: string;
  gender: string; // '' | 'ชาย' | 'หญิง'
  dob: string;    // canonical 'D/M/YYYY' or ''
}

/** Serialize fast-grid rows into the classroom-template AoA so parseStudentImport can validate them. */
export function gridRowsToAoa(rows: GridRow[]): string[][] {
  const aoa: string[][] = [[...STUDENT_CLASSROOM_HEADERS]];
  for (const r of rows) {
    const blank = !r.id.trim() && !r.firstName.trim() && !r.lastName.trim() && !r.gender.trim() && !r.dob.trim();
    if (blank) continue;
    const [day = '', month = '', year = ''] = r.dob.trim() ? r.dob.split('/') : [];
    aoa.push([r.id.trim(), r.firstName.trim(), r.lastName.trim(), day, month, year, r.gender.trim()]);
  }
  return aoa;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/transfer/grid-import.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add src/domain/transfer/xlsx.ts tests/transfer/grid-import.test.ts
git commit -m "feat(transfer): add gridRowsToAoa serializer for fast-grid import"
```

---

### Task 2: `parseClipboardGrid` paste helper

Parse a pasted TSV/CSV clipboard block into partial grid rows, skipping a header line.

**Files:**
- Modify: `src/domain/transfer/xlsx.ts`
- Test: `tests/transfer/grid-import.test.ts` (extend)

**Interfaces:**
- Produces:
  ```ts
  export function parseClipboardGrid(text: string): Array<Pick<GridRow, 'id' | 'firstName' | 'lastName' | 'gender'>>
  ```
  Behavior: split on newlines (drop empties); each line split on tab OR comma. Map columns positionally → id, firstName, lastName, gender (extra columns ignored). Skip a leading header line whose first cell is non-numeric (e.g. starts with `รหัส`/`id`, or is not all digits). DOB is NOT parsed from paste (date-picker only) — left for the user to fill; so `dob` is omitted from the returned shape.

- [ ] **Step 1: Write the failing test**

```ts
// append to tests/transfer/grid-import.test.ts
import { parseClipboardGrid } from '../../src/domain/transfer/xlsx';

describe('parseClipboardGrid', () => {
  it('parses tab-separated rows positionally', () => {
    const out = parseClipboardGrid('10\tสมชาย\tใจดี\tชาย\n11\tมาลี\tดี\tหญิง');
    expect(out).toEqual([
      { id: '10', firstName: 'สมชาย', lastName: 'ใจดี', gender: 'ชาย' },
      { id: '11', firstName: 'มาลี', lastName: 'ดี', gender: 'หญิง' },
    ]);
  });

  it('parses comma-separated rows', () => {
    const out = parseClipboardGrid('10,ก,ข,ชาย');
    expect(out[0]).toEqual({ id: '10', firstName: 'ก', lastName: 'ข', gender: 'ชาย' });
  });

  it('skips a non-numeric header line', () => {
    const out = parseClipboardGrid('รหัสนักเรียน\tชื่อ\tนามสกุล\tเพศ\n10\tก\tข\tชาย');
    expect(out).toHaveLength(1);
    expect(out[0].id).toBe('10');
  });

  it('ignores extra columns and blank lines', () => {
    const out = parseClipboardGrid('\n10\tก\tข\tชาย\textra\tcols\n\n');
    expect(out).toEqual([{ id: '10', firstName: 'ก', lastName: 'ข', gender: 'ชาย' }]);
  });

  it('returns empty for empty input', () => {
    expect(parseClipboardGrid('   ')).toEqual([]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/transfer/grid-import.test.ts`
Expected: FAIL — `parseClipboardGrid` not exported.

- [ ] **Step 3: Write minimal implementation**

Add to `src/domain/transfer/xlsx.ts`:

```ts
/** Parse a pasted TSV/CSV block into partial grid rows (id, names, gender). DOB is entered via the picker, not paste. */
export function parseClipboardGrid(
  text: string,
): Array<Pick<GridRow, 'id' | 'firstName' | 'lastName' | 'gender'>> {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (!lines.length) return [];
  const cellsOf = (line: string) => line.split(line.includes('\t') ? '\t' : ',').map((c) => c.trim());
  const first = cellsOf(lines[0]);
  const headerLike = !/^\d+$/.test(first[0] ?? '');
  const body = headerLike ? lines.slice(1) : lines;
  return body.map((line) => {
    const [id = '', firstName = '', lastName = '', gender = ''] = cellsOf(line);
    return { id, firstName, lastName, gender };
  });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/transfer/grid-import.test.ts`
Expected: PASS (all grid-import tests).

- [ ] **Step 5: Commit**

```bash
git add src/domain/transfer/xlsx.ts tests/transfer/grid-import.test.ts
git commit -m "feat(transfer): add parseClipboardGrid for paste-to-fill"
```

---

### Task 3: Grid stage state + logic in ImportDialog

Wire the grid rows, live validation (reuse parse), serialize, paste, and Excel-into-grid in the script block. No template yet.

**Files:**
- Modify: `src/components/ImportDialog.vue:1-202` (script setup)

**Interfaces:**
- Consumes: `gridRowsToAoa`, `parseClipboardGrid`, `GridRow` (Task 1/2); existing `parseStudentImport`, `readXlsxToAoa`, `studentClassroomTemplateAoa`, `aoaToXlsxBlob`, `downloadBlob`.
- Produces (used by Task 4 template): `gridRows` ref, `addGridRow()`, `removeGridRow(i)`, `setGender(i, g)`, `onGridDob(i, v)`, `gridStatus` (computed `{ rowNum, status, issues }[]`), `gridCounts` computed, `gridToPreview()`, `onGridPaste(e, i)`, `excelOpen` ref, `loadExcelIntoGrid(file)`.

- [ ] **Step 1: Add grid imports, types, state**

Edit the import from `'../domain/transfer/xlsx'` (currently lines 6-15) to also import `gridRowsToAoa`, `parseClipboardGrid`, and type `GridRow`:

```ts
import {
  aoaToXlsxBlob,
  studentClassroomTemplateAoa,
  measureTemplateAoa,
  readXlsxToAoa,
  parseStudentImport,
  parseMeasureImport,
  mergeStudents,
  mergeMeasures,
  gridRowsToAoa,
  parseClipboardGrid,
} from '../domain/transfer/xlsx';
import type {
  ImportPreviewRow,
  MeasureImportPreviewRow,
  MergeStore,
  GridRow,
} from '../domain/transfer/xlsx';
```

Add `'grid'` to the `Stage` type (line 41):

```ts
type Stage = 'room' | 'grid' | 'pick' | 'preview' | 'done';
```

After the existing refs (around line 54), add:

```ts
const blankRow = (): GridRow => ({ id: '', firstName: '', lastName: '', gender: '', dob: '' });
const gridRows = ref<GridRow[]>([]);
const excelOpen = ref(false);
```

- [ ] **Step 2: Default student kind to the grid stage in `reset()`**

In `reset()` (lines 64-76), replace the final stage line:

```ts
  // measure always has a known room; student uses the fast-grid (room first if unknown)
  if (props.kind === 'measure') {
    stage.value = 'pick';
  } else if (!room.value) {
    stage.value = 'room';
  } else {
    stage.value = 'grid';
  }
  gridRows.value = Array.from({ length: 5 }, blankRow);
  excelOpen.value = false;
```

Also update `pickRoom` (line 90) so the student room picker advances to the grid:

```ts
function pickRoom(r: string) { room.value = r; stage.value = props.kind === 'student' ? 'grid' : 'pick'; }
```

- [ ] **Step 3: Add grid row ops + paste + live validation**

Add after `pickRoom`:

```ts
// --- fast grid ---
function addGridRow() { gridRows.value.push(blankRow()); }
function removeGridRow(i: number) {
  gridRows.value.splice(i, 1);
  if (!gridRows.value.length) gridRows.value.push(blankRow());
}
function setGender(i: number, g: 'ชาย' | 'หญิง') {
  gridRows.value[i].gender = gridRows.value[i].gender === g ? '' : g;
}
function onGridDob(i: number, v: string) { gridRows.value[i].dob = v; }

function onGridPaste(e: ClipboardEvent, i: number) {
  const text = e.clipboardData?.getData('text/plain') ?? '';
  if (!text.includes('\t') && !text.includes('\n') && !text.includes(',')) return; // single value: let default paste happen
  e.preventDefault();
  const parsed = parseClipboardGrid(text);
  if (!parsed.length) return;
  // grow rows as needed, fill from row i
  for (let k = 0; k < parsed.length; k++) {
    const idx = i + k;
    if (idx >= gridRows.value.length) gridRows.value.push(blankRow());
    const p = parsed[k];
    gridRows.value[idx] = { ...gridRows.value[idx], id: p.id, firstName: p.firstName, lastName: p.lastName, gender: p.gender === 'ชาย' || p.gender === 'หญิง' ? p.gender : '' };
  }
}

// live validation via the single domain parser
const gridParse = computed(() => {
  const aoa = gridRowsToAoa(gridRows.value);
  const existing = new Set(data.students.map((s) => s.id));
  return parseStudentImport(aoa, { grade: grade.value, room: room.value }, existing, undefined, +data.period.year);
});
const gridCounts = computed(() => gridParse.value.counts);
// map parser rows (1-based, header-skipped) back to non-blank grid row indices
const gridStatusByRow = computed(() => {
  const map = new Map<number, ImportPreviewRow>();
  const nonBlank = gridRows.value
    .map((r, i) => ({ r, i }))
    .filter(({ r }) => r.id.trim() || r.firstName.trim() || r.lastName.trim() || r.gender.trim() || r.dob.trim());
  gridParse.value.rows.forEach((pr, k) => { if (nonBlank[k]) map.set(nonBlank[k].i, pr); });
  return map;
});
const canConfirmGrid = computed(() => gridCounts.value.ok + gridCounts.value.update > 0);

function gridToPreview() {
  lastAoa.value = gridRowsToAoa(gridRows.value);
  fileName.value = 'กรอกในแอป';
  dobOverrides.value = new Map();
  runParse();
  stage.value = 'preview';
}

// --- Excel into grid ---
function loadExcelIntoGrid(file: File) {
  fileName.value = file.name;
  const reader = new FileReader();
  reader.onload = () => {
    const aoa = readXlsxToAoa(reader.result as ArrayBuffer);
    const rows: GridRow[] = [];
    for (let i = 1; i < aoa.length; i++) {
      const c = aoa[i];
      const id = (c[0] ?? '').trim();
      const fn = (c[1] ?? '').trim();
      const ln = (c[2] ?? '').trim();
      if (!id && !fn && !ln) continue;
      const d = (c[3] ?? '').trim(), m = (c[4] ?? '').trim(), y = (c[5] ?? '').trim();
      const g = (c[6] ?? '').trim();
      rows.push({ id, firstName: fn, lastName: ln, gender: g === 'ชาย' || g === 'หญิง' ? g : '', dob: d && m && y ? `${+d}/${+m}/${y}` : '' });
    }
    gridRows.value = rows.length ? rows : [blankRow()];
    excelOpen.value = false;
    stage.value = 'grid';
  };
  reader.readAsArrayBuffer(file);
}
function onExcelFile(e: Event) {
  const input = e.target as HTMLInputElement;
  const f = input.files?.[0];
  if (f) loadExcelIntoGrid(f);
  input.value = '';
}
function onExcelDrop(e: DragEvent) {
  dragging.value = false;
  const f = e.dataTransfer?.files?.[0];
  if (f && f.name.endsWith('.xlsx')) loadExcelIntoGrid(f);
}
```

- [ ] **Step 4: Type-check**

Run: `npx vue-tsc --noEmit`
Expected: PASS (no unused-locals errors; every new symbol is used by Task 4, but to satisfy `noUnusedLocals` now, proceed straight to Task 4 before the next commit — see Step 5).

- [ ] **Step 5: Commit (combined with Task 4)**

Do not commit yet — `noUnusedLocals` will fail because the template (Task 4) is the only consumer. Implement Task 4, then commit both together.

---

### Task 4: Grid stage template + styles

Render the grid UI, the game-feel footer counts, the Excel-demoted section, and route the room picker into the grid.

**Files:**
- Modify: `src/components/ImportDialog.vue` (template ~204-419, styles ~421-500)

**Interfaces:**
- Consumes: all symbols from Task 3.

- [ ] **Step 1: Route the student room picker to the grid**

In the `room` stage block, the existing `pickRoom` change (Task 3 Step 2) already advances to `grid`. No template change needed there. Confirm `stage === 'room'` block still renders.

- [ ] **Step 2: Add the grid stage markup**

Insert a new block immediately after the `room` stage `</div>` and before `stage === 'pick'` (i.e. after line 234):

```html
    <!-- stage: fast grid (student) -->
    <div v-else-if="stage === 'grid'" class="grid-stage">
      <div class="sess">
        <div class="sess-info">
          <span class="sess-ico">👥</span>
          <div>
            <div class="sess-room">กรอกรายชื่อนักเรียน</div>
            <div class="sess-meta">พิมพ์ทีละแถว หรือวาง (paste) จาก Excel ได้เลย</div>
          </div>
        </div>
        <div class="sess-room-tag">
          <div class="sess-round">
            <span class="sess-round-lbl">ห้อง</span>
            <span class="sess-round-val">{{ roomLabel }}</span>
          </div>
          <button v-if="!props.room" class="btn quiet sess-edit" @click="stage = 'room'">เปลี่ยนห้อง</button>
        </div>
      </div>

      <div class="panel" style="padding: 0; overflow-x: auto">
        <table class="grid">
          <thead>
            <tr><th>รหัส</th><th>ชื่อ</th><th>สกุล</th><th>เพศ</th><th>วันเกิด</th><th></th><th></th></tr>
          </thead>
          <tbody>
            <tr v-for="(r, i) in gridRows" :key="i" :class="`r-${gridStatusByRow.get(i)?.status ?? 'blank'}`">
              <td><input v-model="r.id" class="gcell" inputmode="numeric" placeholder="รหัส" @paste="onGridPaste($event, i)" /></td>
              <td><input v-model="r.firstName" class="gcell" placeholder="ชื่อ" @paste="onGridPaste($event, i)" /></td>
              <td><input v-model="r.lastName" class="gcell" placeholder="สกุล" @paste="onGridPaste($event, i)" /></td>
              <td>
                <div class="seg">
                  <button type="button" :class="{ on: r.gender === 'ชาย' }" @click="setGender(i, 'ชาย')">ช</button>
                  <button type="button" :class="{ on: r.gender === 'หญิง' }" @click="setGender(i, 'หญิง')">ญ</button>
                </div>
              </td>
              <td>
                <ThaiDateField
                  :model-value="r.dob"
                  :year-min="dobYearMin"
                  :year-max="dobYearMax"
                  @update:model-value="(v: string) => onGridDob(i, v)"
                />
              </td>
              <td class="gstat">
                <span v-if="gridStatusByRow.get(i)" class="pill" :class="{ good: gridStatusByRow.get(i)!.status === 'ok', neutral: gridStatusByRow.get(i)!.status === 'update', bad: gridStatusByRow.get(i)!.status === 'error' }">
                  <template v-if="gridStatusByRow.get(i)!.status === 'ok'">✓</template>
                  <template v-else-if="gridStatusByRow.get(i)!.status === 'update'">✏️</template>
                  <template v-else>⚠️</template>
                </span>
                <div v-if="gridStatusByRow.get(i)?.issues.length" class="issues">
                  <div v-for="is in gridStatusByRow.get(i)!.issues" :key="is.message">{{ is.message }}</div>
                </div>
              </td>
              <td><button class="grm" type="button" aria-label="ลบแถว" @click="removeGridRow(i)">✕</button></td>
            </tr>
          </tbody>
        </table>
      </div>

      <button class="btn add-row" @click="addGridRow">+ เพิ่มแถว</button>

      <div class="excel-fallback">
        <button class="linkbtn" @click="excelOpen = !excelOpen">
          {{ excelOpen ? '▾' : '▸' }} หรือนำเข้าจากไฟล์ Excel
        </button>
        <div v-if="excelOpen" class="excel-body">
          <button class="btn" @click="downloadTemplate">⬇ ดาวน์โหลดแม่แบบ Excel</button>
          <label class="dropzone" :class="{ drag: dragging }" @dragover.prevent="dragging = true" @dragleave.prevent="dragging = false" @drop.prevent="onExcelDrop">
            <input type="file" accept=".xlsx" class="dz-input" @change="onExcelFile" />
            <div class="dz-ico">📥</div>
            <div class="dz-main">ลากไฟล์ Excel มาวาง หรือคลิกเลือก</div>
            <div class="dz-hint">ข้อมูลจะถูกนำมาใส่ในตารางด้านบนให้ตรวจทาน</div>
          </label>
        </div>
      </div>

      <div class="wiz-foot">
        <div class="prev-stats">
          <span class="stat ok"><b>{{ gridCounts.ok }}</b> พร้อม</span>
          <span class="stat upd"><b>{{ gridCounts.update }}</b> อัปเดต</span>
          <span class="stat err" :class="{ zero: !gridCounts.error }"><b>{{ gridCounts.error }}</b> ปัญหา</span>
        </div>
        <span class="spacer"></span>
        <button class="btn primary lg" :disabled="!canConfirmGrid" @click="gridToPreview">
          ตรวจทาน {{ gridCounts.ok + gridCounts.update }} รายการ →
        </button>
      </div>
    </div>
```

- [ ] **Step 3: Add styles**

Append inside the `<style scoped>` block (before closing `</style>`, line 500):

```css
/* fast grid (POC) */
.grid-stage { display: flex; flex-direction: column; gap: var(--s3); }
.grid { width: 100%; border-collapse: collapse; font-size: 14px; }
.grid th { text-align: left; white-space: nowrap; padding: var(--s2) var(--s3); background: var(--surface-2); color: var(--ink-muted); font-weight: 600; }
.grid td { padding: 4px var(--s2); border-top: 1px solid var(--line-soft); vertical-align: top; }
.grid tr.r-ok { background: var(--good-tint); }
.grid tr.r-update { background: var(--brand-tint); }
.grid tr.r-error { background: var(--bad-tint); }
.gcell { width: 100%; min-width: 90px; border: 1px solid var(--line); border-radius: 8px; padding: 8px; font: inherit; background: var(--surface); }
.gcell:focus { outline: 2px solid var(--brand); outline-offset: -1px; }
.seg { display: inline-flex; border: 1px solid var(--line); border-radius: 8px; overflow: hidden; }
.seg button { border: 0; background: var(--surface); padding: 8px 14px; cursor: pointer; font: inherit; color: var(--ink-muted); }
.seg button.on { background: var(--brand); color: #fff; font-weight: 700; }
.gstat .pill { font-size: 13px; }
.grm { border: 0; background: transparent; cursor: pointer; color: var(--ink-muted); font-size: 16px; padding: 6px; }
.grm:hover { color: var(--bad); }
.add-row { align-self: flex-start; }
.excel-fallback { border-top: 1px solid var(--line-soft); padding-top: var(--s3); }
.linkbtn { border: 0; background: transparent; color: var(--brand-ink); font: inherit; font-weight: 600; cursor: pointer; padding: 0; }
.excel-body { display: flex; flex-direction: column; gap: var(--s3); margin-top: var(--s3); }
.wiz-foot .prev-stats { display: flex; gap: var(--s2); }
```

- [ ] **Step 4: Type-check + build**

Run: `npx vue-tsc --noEmit`
Expected: PASS, no unused-locals.

- [ ] **Step 5: Run full test suite**

Run: `npm test`
Expected: PASS (existing + new grid-import tests).

- [ ] **Step 6: Commit**

```bash
git add src/components/ImportDialog.vue
git commit -m "feat(import): add spreadsheet-style fast-grid student entry (POC)"
```

---

### Task 5: Remove StudentsView template card

Drop the `ดาวน์โหลดแม่แบบ Excel` action card and its now-dead handler.

**Files:**
- Modify: `src/features/StudentsView.vue:702-708` (remove card), `:98` (remove `downloadRoomTemplate` if unused elsewhere)

**Interfaces:** none.

- [ ] **Step 1: Confirm `downloadRoomTemplate` has no other callers**

Run: `grep -n "downloadRoomTemplate" src/features/StudentsView.vue`
Expected: only the definition (line ~98) and the card `@click` (line ~702). If any other caller exists, keep the function.

- [ ] **Step 2: Remove the action card**

Delete the second `<button class="act-card" @click="downloadRoomTemplate">…</button>` block (the `📄 ดาวน์โหลดแม่แบบ Excel` card, lines 702-708). Keep the import and export cards.

- [ ] **Step 3: Remove the dead function**

Delete the `downloadRoomTemplate` function definition (around line 98) and any import it solely used (check `aoaToXlsxBlob` / `studentClassroomTemplateAoa` usage — only remove imports that become unused, to satisfy `noUnusedLocals`).

- [ ] **Step 4: Type-check + build**

Run: `npx vue-tsc --noEmit`
Expected: PASS, no unused-locals.

- [ ] **Step 5: Commit**

```bash
git add src/features/StudentsView.vue
git commit -m "feat(students): remove standalone Excel template card (grid POC)"
```

---

### Task 6: Manual verification

**Files:** none (verification only).

- [ ] **Step 1: Build passes**

Run: `npm run build`
Expected: succeeds, single `dist/index.html` emitted.

- [ ] **Step 2: Manual smoke (dev server is already running on :5173)**

Open http://localhost:5173 → a classroom → `นำเข้ารายชื่อนักเรียน`. Verify:
- Grid stage opens by default with 5 blank rows.
- Typing id+name+gender+DOB flips the row status pill; footer counts update live.
- `+ เพิ่มแถว` adds a row; ✕ removes one.
- Paste a TSV block (e.g. `10\tสมชาย\tใจดี\tชาย`) into the รหัส cell → fills rows.
- `หรือนำเข้าจากไฟล์ Excel` reveals template download + dropzone; loading a file populates the grid.
- `ตรวจทาน N รายการ →` goes to the existing preview, then confirm imports.
- StudentsView no longer shows the `ดาวน์โหลดแม่แบบ Excel` card.

- [ ] **Step 3: Commit (only if verification revealed fixes)**

If fixes were needed, commit them with a clear message; otherwise nothing to commit.

---

## Self-Review notes

- Spec coverage: grid stage (T3/T4), controlled DOB+gender (T4), paste-to-fill (T2/T3/T4), validation reuse via `gridRowsToAoa`+`parseStudentImport` (T1/T3), game-feel live counts/pills (T4), Excel demoted + loads-into-grid (T3/T4), StudentsView card removal (T5). All covered.
- Type consistency: `GridRow`, `gridRowsToAoa`, `parseClipboardGrid`, `gridStatusByRow`, `gridCounts`, `canConfirmGrid`, `gridToPreview` names consistent across tasks.
- `noUnusedLocals`: Task 3 symbols are consumed only by Task 4 template — committed together (T3 Step 5 defers, T4 Step 6 commits).
