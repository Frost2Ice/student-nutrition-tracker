# Onboarding Wizard Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Simplify เริ่มตั้งค่าระบบ wizard from 5 steps to 4 — remove import step, merge grade-range config into structure step, strip ภาคเรียน from year step, add summary screen.

**Architecture:** Single-file edit to `src/features/OnboardingView.vue`. No new files. Promotion-critical `maxGrade` moves from step 1's `schoolForm` to step 3's new `structureForm`; persisted via `saveSetup` at step 3.

**Tech Stack:** Vue 3 `<script setup lang="ts">`, Vite, existing `useData` store + `domain/grade/ladder`.

## Global Constraints

- `tsconfig` has `noUnusedLocals` — every removed feature must also remove its imports/refs/functions or build fails.
- `Setup` type (`src/domain/types.ts:36`) requires `maxGrade: string` — `saveSetup(next: Setup)` needs a full object.
- No component test harness exists; verification is `npx vue-tsc --noEmit` + browser at localhost:5173.
- Thai copy verbatim from spec. Never kill the user's dev server.

---

### Task 1: Rewrite OnboardingView.vue to 4-step wizard

**Files:**

- Modify: `src/features/OnboardingView.vue` (full rewrite of script + template)

**Interfaces:**

- Consumes: `useData()` → `saveSetup(next: Setup)`, `setPeriod({ year, term, round })`, `setClassrooms(...)`, `students`. `GRADE_ORDER: string[]` from `../domain/grade/ladder`. `Term` from `../domain/types`.
- Produces: emits `done` and `exit` (unchanged).

**State shape after rewrite:**

```ts
const steps = ['ข้อมูลโรงเรียน', 'ปีการศึกษา', 'โครงสร้างชั้นเรียน', 'สรุปการตั้งค่า'];
const schoolForm = ref({ school:'', ministry:'', department:'', subdistrict:'', district:'', province:'', teacher:'' }); // no maxGrade
const yearForm = ref({ year: String(new Date().getFullYear() + 543) }); // no term
const structureForm = ref({ minGrade: 'ป.1', maxGrade: 'ป.6' });
const structure = ref<{ grade: string; rooms: number }[]>([]);
```

- [ ] **Step 1: Replace `<script setup>` block**

Remove: `validateThaiDate` + `gradesUpTo` imports, `ImportDialog` import, `computed` (if now unused — keep only if used), all step-4 import/add state and functions (`importOpen`, `importGrade`, `importRoom`, `openImport`, `addErrors`, `studentForm`, `showAddForm`, `openAddForm`, `cancelAdd`, `submitStudent`, `roomCount`, `totalImported`).

New script:

```ts
<script setup lang="ts">
import { ref } from 'vue';
import { useData } from '../stores/data';
import { GRADE_ORDER } from '../domain/grade/ladder';
import type { Term } from '../domain/types';

const emit = defineEmits<{ done: []; exit: [] }>();
const data = useData();

const steps = ['ข้อมูลโรงเรียน', 'ปีการศึกษา', 'โครงสร้างชั้นเรียน', 'สรุปการตั้งค่า'];
const i = ref(0);
const next = () => (i.value = Math.min(i.value + 1, steps.length - 1));
const back = () => (i.value = Math.max(i.value - 1, 0));

// Step 1: School info
const schoolForm = ref({
  school: '', ministry: '', department: '', subdistrict: '',
  district: '', province: '', teacher: '',
});

// Step 2: Academic year (term auto-handled; system always has 2 terms)
const yearForm = ref({ year: String(new Date().getFullYear() + 543) });

// Step 3: Class structure
const structureForm = ref({ minGrade: 'ป.1', maxGrade: 'ป.6' });
const structure = ref<{ grade: string; rooms: number }[]>([]);

function rebuildStructure() {
  const minIdx = GRADE_ORDER.indexOf(structureForm.value.minGrade);
  const maxIdx = GRADE_ORDER.indexOf(structureForm.value.maxGrade);
  if (minIdx === -1 || maxIdx === -1 || minIdx > maxIdx) return;
  const prevMap = new Map(structure.value.map((g) => [g.grade, g.rooms]));
  structure.value = GRADE_ORDER.slice(minIdx, maxIdx + 1).map((grade) => ({
    grade,
    rooms: prevMap.get(grade) ?? 1,
  }));
}

function persistAll() {
  data.saveSetup({ ...schoolForm.value, maxGrade: structureForm.value.maxGrade });
  data.setPeriod({ year: yearForm.value.year, term: '1' as Term, round: '1' });
  data.setClassrooms(
    structure.value.map((g) => ({
      grade: g.grade,
      rooms: Array.from({ length: g.rooms }, (_, n) => String(n + 1)),
    })),
  );
}

function goToStep2() { next(); }
function goToStep3() { rebuildStructure(); next(); }
function goToStep4() { next(); }
function finish() { persistAll(); emit('done'); }
</script>
```

- [ ] **Step 2: Replace template steps 1–2**

Step 1 panel: remove the `ชั้นสูงสุดของโรงเรียน` field `<div>` (the `grid-column:1/-1` select block). Keep all other school fields. Footer button `@click="goToStep2"`.

Step 2 (`v-else-if="i === 1"`): remove the `callout info` auto-guess block and the ภาคเรียน field. Panel keeps only the year field:

```html
<div v-else-if="i === 1">
  <h1 class="page-title">ตั้งค่าปีการศึกษาปัจจุบัน</h1>
  <p class="page-sub">นี่คือค่าของทั้งระบบ ใช้กับทุกหน้าจอ เปลี่ยนได้ที่หน้าตั้งค่าเมื่อขึ้นปีหรือภาคเรียนใหม่</p>
  <div class="panel">
    <div class="form-grid">
      <div class="field"><label>ปีการศึกษา (พ.ศ.)</label><input v-model="yearForm.year" /></div>
    </div>
    <p class="hint" style="margin-top: var(--s3); color: var(--ink-muted)">
      ระบบจัดการ 2 ภาคเรียนต่อปีการศึกษาให้อัตโนมัติ "ครั้งที่วัด" จะเลือกตอนเริ่มบันทึกการวัดแต่ละครั้ง
    </p>
  </div>
  <div class="wiz-foot">
    <button class="btn quiet" @click="back">ย้อนกลับ</button>
    <span class="spacer"></span>
    <button class="btn primary lg" @click="goToStep3">ถัดไป: โครงสร้างชั้นเรียน</button>
  </div>
</div>
```

- [ ] **Step 3: Replace template step 3 (structure with min/max)**

```html
<div v-else-if="i === 2">
  <h1 class="page-title">กำหนดโครงสร้างชั้นเรียน</h1>
  <p class="page-sub">เลือกชั้นเรียนเริ่มต้นและสูงสุดของโรงเรียน ระบบจะสร้างรายการชั้นให้ แล้วระบุจำนวนห้องของแต่ละชั้น แก้ไขภายหลังได้</p>
  <div class="panel">
    <div class="form-grid">
      <div class="field"><label>ชั้นเรียนเริ่มต้น</label>
        <select v-model="structureForm.minGrade" @change="rebuildStructure">
          <option v-for="gr in GRADE_ORDER" :key="gr" :value="gr">{{ gr }}</option>
        </select>
      </div>
      <div class="field"><label>ชั้นสูงสุด</label>
        <select v-model="structureForm.maxGrade" @change="rebuildStructure">
          <option v-for="gr in GRADE_ORDER" :key="gr" :value="gr">{{ gr }}</option>
        </select>
        <div class="hint" style="color: var(--ink-muted)">ใช้กำหนดว่านักเรียนชั้นใดจะจบการศึกษาเมื่อเลื่อนชั้น</div>
      </div>
    </div>
  </div>
  <div class="panel" style="padding: 0; margin-top: var(--s3)">
    <div class="mrow head" style="grid-template-columns: 1fr 160px"><div>ชั้น</div><div>จำนวนห้อง</div></div>
    <div v-for="g in structure" :key="g.grade" class="mrow" style="grid-template-columns: 1fr 160px">
      <div class="nm">{{ g.grade }}</div>
      <input type="number" v-model.number="g.rooms" style="max-width: 90px" min="0" />
    </div>
  </div>
  <div class="wiz-foot">
    <button class="btn quiet" @click="back">ย้อนกลับ</button>
    <span class="spacer"></span>
    <button class="btn primary lg" @click="goToStep4">ถัดไป: สรุปการตั้งค่า</button>
  </div>
</div>
```

- [ ] **Step 4: Replace template step 4 (summary) and delete old steps 4–5 + ImportDialog**

Remove old `v-else-if="i === 3"` import block, old `v-else` done screen, and `<ImportDialog .../>` element. New final step:

```html
<div v-else>
  <h1 class="page-title">สรุปการตั้งค่า</h1>
  <p class="page-sub">ตรวจสอบข้อมูลก่อนยืนยัน หากต้องแก้ไขกด "ย้อนกลับ"</p>

  <div class="panel">
    <div class="ct" style="font-weight:600; margin-bottom: var(--s2)">ข้อมูลโรงเรียน</div>
    <div class="form-grid">
      <div class="field"><label>ชื่อโรงเรียน</label><div>{{ schoolForm.school || '—' }}</div></div>
      <div class="field"><label>สังกัดกระทรวง</label><div>{{ schoolForm.ministry || '—' }}</div></div>
      <div class="field"><label>สังกัดกรม/หน่วยงาน</label><div>{{ schoolForm.department || '—' }}</div></div>
      <div class="field"><label>ตำบล/แขวง</label><div>{{ schoolForm.subdistrict || '—' }}</div></div>
      <div class="field"><label>อำเภอ/เขต</label><div>{{ schoolForm.district || '—' }}</div></div>
      <div class="field"><label>จังหวัด</label><div>{{ schoolForm.province || '—' }}</div></div>
      <div class="field"><label>ครูอนามัยโรงเรียน</label><div>{{ schoolForm.teacher || '—' }}</div></div>
    </div>
  </div>

  <div class="panel" style="margin-top: var(--s3)">
    <div class="ct" style="font-weight:600; margin-bottom: var(--s2)">ปีการศึกษา</div>
    <div>ปีการศึกษา {{ yearForm.year }} (2 ภาคเรียน)</div>
  </div>

  <div class="panel" style="margin-top: var(--s3); padding: 0">
    <div class="mrow head" style="grid-template-columns: 1fr 160px">
      <div>ชั้น ({{ structureForm.minGrade }}–{{ structureForm.maxGrade }})</div><div>จำนวนห้อง</div>
    </div>
    <div v-for="g in structure" :key="g.grade" class="mrow" style="grid-template-columns: 1fr 160px">
      <div class="nm">{{ g.grade }}</div><div>{{ g.rooms }} ห้อง</div>
    </div>
  </div>

  <div class="wiz-foot">
    <button class="btn quiet" @click="back">ย้อนกลับ</button>
    <span class="spacer"></span>
    <button class="btn primary lg" @click="finish">ยืนยันและเริ่มใช้งาน</button>
  </div>
</div>
```

- [ ] **Step 5: Type-check**

Run: `npx vue-tsc --noEmit`
Expected: PASS, no errors. If `noUnusedLocals` flags `computed`/`Term`/etc., remove the unused import. (`Term` is used in `setPeriod` cast — keep it.)

- [ ] **Step 6: Browser verify**

Open localhost:5173, trigger onboarding. Confirm: 4 steps in stepper; step 1 has no max-grade field; step 2 has no ภาคเรียน/no callout, year pre-filled to current BE year; step 3 min/max dropdowns regenerate grade list + room inputs; step 4 shows full summary; ยืนยัน persists and reaches home. Verify promotion still works (maxGrade saved).

- [ ] **Step 7: Commit**

```bash
git add src/features/OnboardingView.vue docs/superpowers/specs/2026-06-26-onboarding-wizard-redesign.md docs/superpowers/plans/2026-06-26-onboarding-wizard-redesign.md
git commit -m "feat: streamline onboarding wizard to 4 steps with summary"
```

---

## Self-Review

- **Spec coverage:** (1) maxGrade moved → Step 3 ✓. (2) auto-guess removed → Step 2 ✓. (3) ภาคเรียน removed, term hardcoded '1' → Steps 1/2 ✓. (4) min/max grade selectors → Step 3 ✓. (5) import step removed → Step 4 deletes it ✓. (6) summary screen → Step 4 ✓.
- **Placeholders:** none — full code given.
- **Type consistency:** `rebuildStructure`, `persistAll`, `structureForm`, `schoolForm` (no maxGrade), `yearForm` (no term) consistent across script + template. `saveSetup` gets full `Setup` (school fields + maxGrade).
