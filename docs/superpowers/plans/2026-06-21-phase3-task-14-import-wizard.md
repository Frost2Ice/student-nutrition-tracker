# Phase 3 Task 14 — Import Wizard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create `src/features/ImportView.vue` by porting the prototype ImportJourney template/styles verbatim, wiring it to `parseImport`/`mergeImport` from `src/domain/transfer/csv.ts`, and replacing the placeholder in `AppShell.vue`.

**Architecture:** Port the 5-step wizard template and styles verbatim from `src/prototype/ImportJourney.vue`, replacing mock data with real Pinia store data and CSV pipeline calls. Step 0 lists rooms from `data.structure`. Step 1 reads a real file and calls `parseImport`. Step 2 shows `rows`/`skipped` from parse result. Step 3 notes duplicate counts from mergeImport preview. Step 4 calls `mergeImport(data, parsed)` and shows returned counts.

**Tech Stack:** Vue 3 Composition API (`<script setup lang="ts">`), Pinia (`useData`), `parseImport`/`mergeImport` from `src/domain/transfer/csv.ts`, `Stepper` from `src/components/Stepper.vue`

## Global Constraints

- `noUnusedLocals` — every imported symbol must be used or the build fails
- No git operations
- No server start/kill — dev server runs at http://localhost:5173
- Editor tools only (Write/Edit), no heredoc/echo
- UX parity: port prototype `<template>`/`<style>` verbatim; do not redesign
- Import = MERGE via `mergeImport` (add new, update existing, skip duplicate measurements, count orphans)
- Playwright screenshots save to `.playwright-mcp/` directory
- Type-check: `npx vue-tsc --noEmit`; build: `npm run build`; tests: `npm test`

---

### Task 1: Create `src/features/ImportView.vue`

**Files:**
- Create: `src/features/ImportView.vue`

**Interfaces:**
- Consumes:
  - `useData()` from `src/stores/data.ts` — `.structure` (computed `{ grade: string; rooms: string[] }[]`), plus it satisfies `MergeStore` interface (has `.students`, `.measures`, `.addStudent`, `.updateStudent`, `.addMeasure`, `.findDuplicate`)
  - `parseImport(text: string): { rows: ParsedRow[]; skipped: { row: number; reason: string }[] }` from `src/domain/transfer/csv.ts`
  - `mergeImport(store: MergeStore, parsed: { rows: ParsedRow[] }): { added: number; updated: number; skippedDup: number; orphans: number }` from `src/domain/transfer/csv.ts`
  - `Stepper` from `src/components/Stepper.vue` — props: `steps: string[]`, `current: number`
- Produces: Vue component that emits `done: []` and `exit: []`

- [ ] **Step 1: Write the component**

Create `/Users/11373966/Documents/development/code/external_github/food-for-good/src/features/ImportView.vue` with this exact content:

```vue
<script setup lang="ts">
import { ref } from 'vue';
import Stepper from '../components/Stepper.vue';
import { useData } from '../stores/data';
import { parseImport, mergeImport } from '../domain/transfer/csv';
import type { ParsedRow } from '../domain/transfer/csv';

defineEmits<{ done: []; exit: [] }>();

const data = useData();

const steps = ['เลือกห้อง', 'เลือกไฟล์', 'ตรวจ/แก้', 'รายการซ้ำ', 'เสร็จสิ้น'];
const i = ref(0);
const room = ref('');

// parsed state
const parsedRows = ref<ParsedRow[]>([]);
const skippedRows = ref<{ row: number; reason: string }[]>([]);

// merge result
const mergeResult = ref<{ added: number; updated: number; skippedDup: number; orphans: number } | null>(null);

const stateMeta: Record<string, { cls: string; label: string }> = {
  ok: { cls: 'good', label: 'พร้อมนำเข้า' },
  fixed: { cls: 'warn', label: 'แก้อัตโนมัติ' },
  error: { cls: 'bad', label: 'ข้าม' },
  dup: { cls: 'neutral', label: 'ซ้ำ' },
};

function pickRoom(label: string) {
  room.value = label;
  i.value = 1;
}

function onFileChange(e: Event) {
  const input = e.target as HTMLInputElement;
  const file = input.files?.[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    const text = reader.result as string;
    const result = parseImport(text);
    parsedRows.value = result.rows;
    skippedRows.value = result.skipped;
    i.value = 2;
  };
  reader.readAsText(file, 'utf-8');
}

function confirmImport() {
  mergeResult.value = mergeImport(data, { rows: parsedRows.value });
  i.value = 4;
}
</script>

<template>
  <div class="proto-screen proto-wide">
    <Stepper :steps="steps" :current="i" />

    <!-- 1 select room -->
    <div v-if="i === 0">
      <h1 class="page-title">นำเข้ารายชื่อนักเรียน</h1>
      <p class="page-sub">นำเข้าทีละห้อง จัดการง่ายและตรงกับวิธีที่โรงเรียนเก็บข้อมูล เลือกห้องที่จะนำเข้า</p>
      <div class="panel" style="padding: 0">
        <div class="mrow head" style="grid-template-columns: 1fr auto"><div>ห้อง</div><div></div></div>
        <template v-for="g in data.structure" :key="g.grade">
          <div v-for="r in g.rooms" :key="g.grade + r" class="mrow" style="grid-template-columns: 1fr auto; cursor: pointer" @click="pickRoom(g.grade + '/' + r)">
            <div class="nm">{{ g.grade }}/{{ r }}</div>
            <span style="color: var(--brand-ink); font-weight: 600">นำเข้า →</span>
          </div>
        </template>
        <div v-if="data.structure.length === 0" class="mrow" style="color: var(--ink-muted); justify-content: center">ยังไม่มีห้องเรียน</div>
      </div>
      <div class="wiz-foot"><button class="btn quiet" @click="$emit('exit')">ออก</button></div>
    </div>

    <!-- 2 upload -->
    <div v-else-if="i === 1">
      <h1 class="page-title">นำเข้าไฟล์ของห้อง {{ room }}</h1>
      <p class="page-sub">เลือกไฟล์รายชื่อของห้องนี้ ใช้แม่แบบเพื่อให้คอลัมน์ตรงกัน</p>
      <div class="panel" style="text-align: center; padding: var(--s7)">
        <div style="font-size: 44px">📄</div>
        <p style="margin: var(--s3) 0; color: var(--ink-muted)">ลากไฟล์มาวางที่นี่ หรือ</p>
        <label class="btn primary" style="cursor: pointer">
          เลือกไฟล์ CSV
          <input type="file" accept=".csv,text/csv" style="display: none" @change="onFileChange" />
        </label>
      </div>
      <div class="callout info"><div class="ct">💡 ยังไม่มีไฟล์?</div>ดาวน์โหลดแม่แบบ CSV ของห้อง {{ room }} ที่มีหัวคอลัมน์ครบพร้อมตัวอย่าง จากหน้าตั้งค่า → ส่งออก/นำเข้า</div>
      <div class="wiz-foot"><button class="btn quiet" @click="i = 0">เลือกห้องอื่น</button></div>
    </div>

    <!-- 3 preview / validate -->
    <div v-else-if="i === 2">
      <h1 class="page-title">ตรวจสอบข้อมูล · ห้อง {{ room }}</h1>
      <p class="page-sub">ระบบตรวจให้แล้ว แถวที่แก้ไม่ได้จะถูกข้าม แก้ไขในตารางนี้ได้ก่อนนำเข้า</p>
      <div class="callout good">พร้อมนำเข้า {{ parsedRows.length }} แถว · ข้าม {{ skippedRows.length }} แถว</div>

      <div v-if="parsedRows.length > 0" class="panel" style="padding: 0">
        <div class="mrow head" style="grid-template-columns: 48px 1fr 1.4fr 130px"><div>แถว</div><div>ประเภท</div><div>รายละเอียด</div><div>สถานะ</div></div>
        <div v-for="(r, idx) in parsedRows" :key="idx" class="mrow" style="grid-template-columns: 48px 1fr 1.4fr 130px">
          <div style="color: var(--ink-muted)">{{ idx + 2 }}</div>
          <div class="nm">
            <span v-if="r.type === 'student'">{{ r.firstName }} {{ r.lastName }}<div style="font-size: 12.5px; color: var(--ink-muted); font-weight: 400">{{ r.id || '—' }}</div></span>
            <span v-else>การวัด<div style="font-size: 12.5px; color: var(--ink-muted); font-weight: 400">รหัส {{ r.studentId || '—' }}</div></span>
          </div>
          <div style="font-size: 14px; color: var(--ink-muted)">
            <span v-if="r.type === 'student'">{{ r.grade }}/{{ r.room }}</span>
            <span v-else>{{ r.weightKg }} กก. · {{ r.heightCm }} ซม. · {{ r.date }}</span>
          </div>
          <div><span class="pill good">พร้อมนำเข้า</span></div>
        </div>
      </div>

      <div v-if="skippedRows.length > 0" class="panel" style="padding: 0; margin-top: var(--s4)">
        <div class="mrow head" style="grid-template-columns: 48px 1fr"><div>แถว</div><div>เหตุผลที่ข้าม</div></div>
        <div v-for="s in skippedRows" :key="s.row" class="mrow" style="grid-template-columns: 48px 1fr">
          <div style="color: var(--ink-muted)">{{ s.row }}</div>
          <div style="font-size: 14px; color: var(--ink-muted)">{{ s.reason }}</div>
        </div>
      </div>

      <div class="wiz-foot">
        <button class="btn quiet" @click="i = 1">เลือกไฟล์ใหม่</button>
        <span class="spacer"></span>
        <button class="btn primary lg" @click="i = 3">ถัดไป: จัดการรายการซ้ำ</button>
      </div>
    </div>

    <!-- 4 duplicates at scale -->
    <div v-else-if="i === 3">
      <h1 class="page-title">รายการซ้ำ</h1>
      <p class="page-sub">เลือกวิธีจัดการทั้งหมดได้ในคลิกเดียว หรือปรับเป็นรายคนสำหรับกรณีพิเศษ</p>
      <div class="panel">
        <div class="callout info">
          <div class="ct">⚡ วิธีนำเข้า</div>
          ระบบจะ <strong>เพิ่ม</strong> นักเรียนและการวัดที่ยังไม่มี <strong>อัปเดต</strong> นักเรียนที่มีอยู่แล้ว และ <strong>ข้าม</strong> การวัดที่ซ้ำกัน (ปีการศึกษา/ภาค/ครั้งเดียวกัน)
        </div>
        <div class="callout good" style="margin-top: var(--s4)">
          พร้อมนำเข้า {{ parsedRows.length }} แถว · ข้ามข้อมูลผิดพลาด {{ skippedRows.length }} แถว
        </div>
      </div>
      <div class="wiz-foot">
        <button class="btn quiet" @click="i = 2">ย้อนกลับ</button>
        <span class="spacer"></span>
        <button class="btn primary lg" @click="confirmImport">นำเข้าข้อมูล</button>
      </div>
    </div>

    <!-- 5 done -->
    <div v-else>
      <div class="proto-hero">
        <div class="success-check">✓</div>
        <h1>นำเข้าห้อง {{ room }} เรียบร้อย</h1>
        <p v-if="mergeResult">
          เพิ่มใหม่ {{ mergeResult.added }} รายการ · อัปเดต {{ mergeResult.updated }} รายการ · ข้ามซ้ำ {{ mergeResult.skippedDup }} รายการ · ไม่พบนักเรียน {{ mergeResult.orphans }} รายการ
        </p>
      </div>
      <div class="whatnext" style="justify-content: center">
        <button class="btn primary lg" @click="i = 0">นำเข้าห้องถัดไป</button>
        <button class="btn" @click="$emit('done')">กลับหน้าหลัก</button>
      </div>
    </div>
  </div>
</template>
```

- [ ] **Step 2: Run type-check to confirm no TS errors**

```bash
npx vue-tsc --noEmit
```

Expected: exits 0, no output (or only unrelated warnings). If there are errors, fix them before continuing.

- [ ] **Step 3: Run build to confirm bundle succeeds**

```bash
npm run build
```

Expected: exits 0. `dist/index.html` is produced.

- [ ] **Step 4: Run tests to confirm no regressions**

```bash
npm test
```

Expected: all tests pass (green).

---

### Task 2: Wire `ImportView` into `AppShell.vue`

**Files:**
- Modify: `src/AppShell.vue` — replace the placeholder `<div v-else-if="overlay === 'import'">` block with `<ImportView>`

**Interfaces:**
- Consumes: `ImportView` emits `done: []` and `exit: []`
- Produces: `AppShell` renders `ImportView` when `overlay === 'import'`

- [ ] **Step 1: Add `ImportView` import to `<script setup>` in AppShell.vue**

In `src/AppShell.vue`, inside `<script setup lang="ts">`, after the existing imports (e.g., after `import PromotionView from './features/PromotionView.vue';`), add:

```ts
import ImportView from './features/ImportView.vue';
```

- [ ] **Step 2: Replace the import placeholder in the template**

In `src/AppShell.vue`, find and replace the placeholder block:

```html
    <div v-else-if="overlay === 'import'" class="container">
      <h1 class="page-title">นำเข้ารายชื่อนักเรียน</h1>
      <p class="page-sub">(กำลังพัฒนา)</p>
    </div>
```

Replace with:

```html
    <ImportView
      v-else-if="overlay === 'import'"
      @done="closeOverlay"
      @exit="closeOverlay"
    />
```

- [ ] **Step 3: Type-check**

```bash
npx vue-tsc --noEmit
```

Expected: exits 0, no errors.

- [ ] **Step 4: Build**

```bash
npm run build
```

Expected: exits 0.

- [ ] **Step 5: Tests**

```bash
npm test
```

Expected: all pass.

---

### Task 3: Playwright verification and screenshot

**Files:**
- Read-only: `http://localhost:5173` (dev server already running)
- Screenshot output: `.playwright-mcp/p3-t14-import.png`

- [ ] **Step 1: Open the app and navigate to Import**

Use Playwright to navigate to `http://localhost:5173`. Click the "นำเข้ารายชื่อนักเรียน" link (either the Home quick link or Settings 📥 button) so that the overlay opens.

- [ ] **Step 2: Take a screenshot of step 0 (room selection)**

Take a screenshot and save it to `.playwright-mcp/p3-t14-import.png`.

- [ ] **Step 3: Walk the wizard with a CSV**

Craft a minimal valid CSV matching `toCsv`'s format. Column order (from csv.ts HEADER):
```
type,id,firstName,lastName,dob,gender,grade,room,studentId,year,term,round,date,weightKg,heightCm,gradeAtMeasure,roomAtMeasure
student,S001,สมชาย,ใจดี,1/6/2560,ชาย,ป.3,1,,,,,,,,, 
measure,,,,,,,,S001,2567,1,1,1/6/2568,25,120,ป.3,1
```

Upload that CSV through the file input and verify that step 2 shows the rows with "พร้อมนำเข้า" status, and step 3 shows the merge summary, and step 4 (done) shows the merge counts.

- [ ] **Step 4: Write the report**

Write the full implementation report to `docs/superpowers/briefs/phase3-task-14-report.md` covering:
- What was implemented
- Files created/modified
- Type-check result
- Build result
- Test result
- Playwright verification result (with screenshot path)
- Any concerns or deviations from the spec

---

## Self-Review

**Spec coverage check:**
1. ✅ Create `src/features/ImportView.vue` — Task 1
2. ✅ Modify `src/AppShell.vue` — Task 2
3. ✅ เลือกห้อง from `data.structure` — Task 1, step 0 block
4. ✅ เลือกไฟล์: real file input → `parseImport` — Task 1, `onFileChange`
5. ✅ ตรวจ/แก้: show `rows` (valid) and `skipped` with row number + reason — Task 1, step 2 block
6. ✅ รายการซ้ำ: surface that duplicates will be skipped — Task 1, step 3 block
7. ✅ เสร็จ: call `mergeImport(data, parsed)`, show returned counts — Task 1, `confirmImport` / step 4 block
8. ✅ AppShell wires `@done="closeOverlay"` `@exit="closeOverlay"` — Task 2
9. ✅ Type-check, build, tests — each task ends with these commands
10. ✅ Playwright screenshot to `.playwright-mcp/p3-t14-import.png` — Task 3
11. ✅ Report to `docs/superpowers/briefs/phase3-task-14-report.md` — Task 3, step 4

**Placeholder scan:** No TBDs, no "implement later", no "add appropriate error handling" — all code is explicit and complete.

**Type consistency:**
- `parsedRows` is `ref<ParsedRow[]>` — `ParsedRow` imported from `csv.ts`
- `mergeImport(data, { rows: parsedRows.value })` — `data` satisfies `MergeStore` (it has all required methods)
- `mergeResult` is `ref<{ added: number; updated: number; skippedDup: number; orphans: number } | null>` — matches `mergeImport` return type exactly
- `Stepper` imported from `../components/Stepper.vue` (not the prototype's Stepper) — props match: `steps: string[]`, `current: number`
