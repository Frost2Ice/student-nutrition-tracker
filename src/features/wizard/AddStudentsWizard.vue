<!-- src/features/wizard/AddStudentsWizard.vue -->
<script setup lang="ts">
defineOptions({ name: 'AddStudentsWizard' });
import { ref, computed, onMounted, nextTick } from 'vue';
import { useData } from '../../stores/data';
import { useHeader } from '../../stores/header';
import Stepper from '../../components/Stepper.vue';
import { downloadBlob } from '../download';
import {
  studentClassroomTemplateAoa, aoaToXlsxBlob, readXlsxToAoa, parseStudentImport,
  gridRowsToAoa, mergeStudents, pasteToAoa, STUDENT_CLASSROOM_HEADERS, hasLegacyDobColumns,
  type GridRow, type ImportPreviewRow, type MergeStore,
} from '../../domain/transfer/xlsx';
import { normalizeThaiDate } from '../../domain/date/thai-date';
import ThaiDateField from '../ThaiDateField.vue';
import type { Student } from '../../domain/types';

const data = useData();
const emit = defineEmits<{ done: []; exit: [] }>();

// Drive the shared app top bar instead of rendering a separate wizard bar.
const header = useHeader();
onMounted(() => header.setHeader({ title: 'เพิ่มรายชื่อนักเรียน', back: () => emit('exit'), context: 'year' }));

// mergeStudents expects a MergeStore (students as a { value } ref-like),
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

const steps = ['เลือกห้อง', 'เพิ่มข้อมูล', 'ตรวจสอบและบันทึก'];
const step = ref(0);

const grade = ref('');
const room = ref('');
const rooms = computed(() => data.structure.find((g) => g.grade === grade.value)?.rooms ?? []);

// guided "order ticket" flow: which choice the teacher is on (0=ชั้น 1=ห้อง, 2=ครบ)
const activePick = ref(0);
const allPicked = computed(() => activePick.value >= 2 && !!grade.value && !!room.value);
function editPick(i: number) { if (i <= activePick.value) activePick.value = i; }
function pickGrade(g: string) { grade.value = g; room.value = ''; activePick.value = 1; }
function pickRoom(r: string) { room.value = r; activePick.value = 2; }

const gridRows = ref<GridRow[]>([]);
const fileErr = ref('');
const pasteText = ref('');
const result = ref<{ added: number; updated: number } | null>(null);

function downloadTemplate() {
  const aoa = studentClassroomTemplateAoa();
  downloadBlob(aoaToXlsxBlob(aoa, 'รายชื่อนักเรียน', [0, 3]), `แม่แบบรายชื่อ ${grade.value}-${room.value}.xlsx`);
}

const blankRow = (): GridRow => ({ id: '', firstName: '', lastName: '', gender: '', dob: '' });

// Build best-effort editable rows from a classroom AoA. Nothing is dropped —
// even a misaligned/incomplete row is kept (with whatever we could parse, at
// least the id column) so the teacher sees it in review and can fix it.
function aoaToGridRows(aoa: string[][]): GridRow[] {
  const out: GridRow[] = [];
  for (let i = 1; i < aoa.length; i++) {
    const c = aoa[i];
    const id = (c[0] ?? '').trim();
    const firstName = (c[1] ?? '').trim();
    const lastName = (c[2] ?? '').trim();
    const dobCell = (c[3] ?? '').trim();
    const genderRaw = (c[4] ?? '').trim();
    if (!id && !firstName && !lastName && !dobCell && !genderRaw) continue;
    const norm = dobCell ? normalizeThaiDate(dobCell) : null;
    out.push({
      id,
      firstName,
      lastName,
      dob: norm ? norm.value : dobCell,
      gender: genderRaw === 'ชาย' || genderRaw === 'หญิง' ? genderRaw : '',
    });
  }
  return out.length ? out : [blankRow()];
}

// Shared by upload and paste: reject legacy files, load rows into the editable grid.
function process(classroomAoa: string[][]) {
  if (classroomAoa.length && hasLegacyDobColumns(classroomAoa[0])) {
    fileErr.value = 'ไฟล์รูปแบบเก่า (วันเกิดแยก 3 ช่อง) — ดาวน์โหลดแม่แบบใหม่ที่ใช้ช่อง "วันเกิด" ช่องเดียว';
    return;
  }
  gridRows.value = aoaToGridRows(classroomAoa);
  step.value = 2;
}

function onFile(e: Event) {
  fileErr.value = '';
  const file = (e.target as HTMLInputElement).files?.[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      process(readXlsxToAoa(reader.result as ArrayBuffer));
    } catch {
      fileErr.value = 'อ่านไฟล์ไม่ได้ ตรวจสอบว่าเป็นไฟล์ Excel (.xlsx) ที่ถูกต้อง';
    }
  };
  reader.readAsArrayBuffer(file);
  (e.target as HTMLInputElement).value = '';
}

function onPaste() {
  fileErr.value = '';
  const aoa = pasteToAoa(pasteText.value, STUDENT_CLASSROOM_HEADERS);
  if (aoa.length <= 1) {
    fileErr.value = 'ยังไม่มีข้อมูลที่วาง คัดลอกแถวข้อมูลจาก Excel มาวางในช่องนี้';
    return;
  }
  process(aoa);
}

// live validation via the single domain parser — same path as the workspace importer
const dobYearMin = computed(() => +data.period.year - 19);
const dobYearMax = computed(() => +data.period.year - 2);

const gridParse = computed(() => {
  const aoa = gridRowsToAoa(gridRows.value);
  const existing = new Set(data.students.map((s) => s.id));
  return parseStudentImport(aoa, { grade: grade.value, room: room.value }, existing, undefined, +data.period.year);
});
// map parser rows (1-based, header-skipped, blanks dropped) back to grid indices
const gridStatusByRow = computed(() => {
  const map = new Map<number, ImportPreviewRow>();
  const nonBlank = gridRows.value
    .map((r, i) => ({ r, i }))
    .filter(({ r }) => r.id.trim() || r.firstName.trim() || r.lastName.trim() || r.gender.trim() || r.dob.trim());
  gridParse.value.rows.forEach((pr, k) => {
    if (!nonBlank[k]) return;
    const { r, i } = nonBlank[k];
    let entry = pr;
    // For an existing id, tell the teacher which class the student is currently in.
    if (pr.status === 'update') {
      const found = data.students.find((s) => s.id === pr.id);
      if (found) {
        entry = {
          ...pr,
          issues: pr.issues.map((is) =>
            is.message === 'มีรหัสนี้อยู่แล้ว'
              ? { ...is, message: `มีรหัสนี้อยู่แล้ว (${found.grade}/${found.room})` }
              : is),
        };
      }
    }
    // Empty gender on a non-blank row is a blocking error: the parser would
    // otherwise coerce it to 'ชาย' and misclassify girls against the male standard.
    if (!r.gender.trim()) {
      const genderIssue = { message: 'ยังไม่ได้เลือกเพศ (ช/ญ)', severity: 'error' as const };
      map.set(i, { ...entry, status: 'error', issues: [genderIssue, ...entry.issues] });
    } else {
      map.set(i, entry);
    }
  });
  return map;
});
const gridCounts = computed(() => {
  const counts = { ok: 0, update: 0, error: 0 };
  gridStatusByRow.value.forEach((pr) => { counts[pr.status] = (counts[pr.status] ?? 0) + 1; });
  return counts;
});
const readyCount = computed(() => gridCounts.value.ok + gridCounts.value.update);
// 1-based row numbers still in error, for the "fix these rows" hint
const errorRowNumbers = computed(() =>
  gridRows.value
    .map((_, i) => i)
    .filter((i) => gridStatusByRow.value.get(i)?.status === 'error')
    .map((i) => i + 1),
);

const gridBody = ref<HTMLElement | null>(null);

function onGender(i: number, e: Event) {
  gridRows.value[i].gender = (e.target as HTMLSelectElement).value;
}
function onGridDob(i: number, v: string) { gridRows.value[i].dob = v; }
async function addGridRow() {
  gridRows.value.push(blankRow());
  await nextTick();
  const rows = gridBody.value?.querySelectorAll('tr');
  const last = rows?.[rows.length - 1];
  last?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  (last?.querySelector('input.gcell-id') as HTMLInputElement | undefined)?.focus();
}
function removeGridRow(i: number) {
  gridRows.value.splice(i, 1);
  if (!gridRows.value.length) gridRows.value.push(blankRow());
}

function save() {
  const students: Student[] = [];
  gridStatusByRow.value.forEach((pr) => { if (pr.student && pr.status !== 'error') students.push(pr.student); });
  result.value = mergeStudents(mergeStore(), students);
}

// Block save while ANY row has an error — no partial import, nothing silently omitted.
const canSave = computed(() => !result.value && gridCounts.value.error === 0 && readyCount.value > 0);
</script>

<template>
  <div class="container j-students">
    <Stepper :steps="steps" :current="step" />

    <!-- step 0: guided order-ticket flow — one choice at a time -->
    <div v-if="step === 0" class="panel">
      <p style="color: var(--ink-muted); margin-bottom: var(--s4)">เลือกทีละขั้น ระบบจะพาไปต่อเองจนครบ</p>
      <div class="order">
        <!-- 1: ชั้น -->
        <div class="order-row" :class="{ active: activePick === 0, done: activePick > 0 }">
          <button class="order-head" @click="editPick(0)">
            <span class="order-num">{{ activePick > 0 ? '✓' : '1' }}</span>
            <span class="order-label">เลือกชั้น</span>
            <span class="order-value">
              <span v-if="grade" class="chosen">{{ grade }}</span>
              <span v-else>แตะเพื่อเลือก</span>
              <span v-if="activePick > 0" class="order-edit">เปลี่ยน</span>
            </span>
          </button>
          <div v-if="activePick === 0" class="order-body">
            <div class="tile-grid">
              <button v-for="g in data.structure" :key="g.grade" class="tile" :class="{ on: grade === g.grade }" @click="pickGrade(g.grade)">
                <span class="tile-ico">📚</span><span class="tile-lbl">{{ g.grade }}</span><span class="tile-check">✓</span>
              </button>
            </div>
          </div>
        </div>

        <!-- 2: ห้อง -->
        <div class="order-row" :class="{ active: activePick === 1, done: activePick > 1, locked: activePick < 1 }">
          <button class="order-head" :disabled="activePick < 1" @click="editPick(1)">
            <span class="order-num">{{ activePick > 1 ? '✓' : '2' }}</span>
            <span class="order-label">เลือกห้อง</span>
            <span class="order-value">
              <span v-if="room" class="chosen">ห้อง {{ room }}</span>
              <span v-else>—</span>
              <span v-if="activePick > 1" class="order-edit">เปลี่ยน</span>
            </span>
          </button>
          <div v-if="activePick === 1" class="order-body">
            <div v-if="rooms.length" class="tile-grid">
              <button v-for="r in rooms" :key="r" class="tile" :class="{ on: room === r }" @click="pickRoom(r)">
                <span class="tile-ico">🚪</span><span class="tile-lbl">ห้อง {{ r }}</span><span class="tile-check">✓</span>
              </button>
            </div>
            <p v-else style="color: var(--ink-muted)">ชั้นนี้ยังไม่มีห้อง</p>
          </div>
        </div>
      </div>

      <div v-if="allPicked" class="order-ticket">
        <span class="ot-ico">🧾</span>
        <div class="ot-body">
          <div class="ot-label">ตรวจสอบก่อนยืนยัน</div>
          <div class="ot-detail">ชั้น {{ grade }} · ห้อง {{ room }}</div>
        </div>
      </div>
      <button class="btn j lg block" :disabled="!allPicked" @click="step = 1">ยืนยัน →</button>
    </div>

    <!-- step 1: add data -->
    <div v-else-if="step === 1" class="panel">
      <div class="dl-tile">
        <span class="dl-ico">📥</span>
        <div class="dl-body">
          <b>แม่แบบรายชื่อ {{ grade }}/{{ room }}</b>
          <span>กรอกเฉพาะ รหัส ชื่อ นามสกุล วันเกิด เพศ (ไม่ต้องกรอกชั้น/ห้อง)</span>
        </div>
        <button class="btn j" @click="downloadTemplate">ดาวน์โหลด</button>
      </div>

      <div class="chip-label">อัปโหลดไฟล์ที่กรอกแล้ว</div>
      <label class="dropzone" style="display: block; cursor: pointer">
        <div class="dz-ico">📄</div>
        <b>เลือกไฟล์ Excel ที่กรอกรายชื่อแล้ว</b>
        <div class="dz-hint">รองรับไฟล์ .xlsx</div>
        <input type="file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" @change="onFile" />
      </label>

      <div class="paste-or"><span>หรือวางข้อมูลจาก Excel</span></div>
      <textarea
        v-model="pasteText"
        class="paste-box"
        rows="4"
        placeholder="คัดลอกแถวข้อมูลจาก Excel (รหัส ชื่อ นามสกุล วันเกิด เพศ) แล้ววางที่นี่"
      ></textarea>

      <div v-if="fileErr" class="callout bad" style="margin-top: var(--s4)">{{ fileErr }}</div>
      <div class="wiz-actions">
        <button class="btn j lg" :disabled="!pasteText.trim()" @click="onPaste">ตรวจสอบข้อมูลที่วาง</button>
        <button class="btn ghost back" @click="step = 0">← ย้อนกลับ</button>
      </div>
    </div>

    <!-- step 2: review + save -->
    <div v-else>
      <div v-if="!result" class="panel">
        <div class="review-head">
          <h2>ตรวจสอบก่อนบันทึก</h2>
          <span class="review-count">พร้อม {{ readyCount }} · ปัญหา {{ gridCounts.error }}</span>
        </div>
        <p class="review-recap">จะเพิ่มเข้า <b>ชั้น {{ grade }}/{{ room }}</b> · ปีการศึกษา {{ data.period.year }}</p>
        <p class="review-hint">แก้แถวสีแดงที่กรอกไม่ครบให้เรียบร้อยก่อนบันทึก — แตะในช่องเพื่อแก้ไขได้เลย</p>
        <div class="preview-frame">
          <div class="table-wrap">
            <table class="grid">
              <thead>
                <tr><th>รหัส</th><th>ชื่อ</th><th>สกุล</th><th>เพศ</th><th>วันเกิด</th><th></th><th></th></tr>
              </thead>
              <tbody ref="gridBody">
                <tr v-for="(r, i) in gridRows" :key="i" :class="`r-${gridStatusByRow.get(i)?.status ?? 'blank'}`">
                  <td><input v-model="r.id" class="gcell gcell-id" inputmode="numeric" placeholder="รหัส" /></td>
                  <td><input v-model="r.firstName" class="gcell" placeholder="ชื่อ" /></td>
                  <td><input v-model="r.lastName" class="gcell" placeholder="สกุล" /></td>
                  <td>
                    <select class="gcell gsex" :value="r.gender" @change="onGender(i, $event)" aria-label="เพศ">
                      <option value="">เพศ</option>
                      <option value="ชาย">ชาย</option>
                      <option value="หญิง">หญิง</option>
                    </select>
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
                    <div class="gstat-row">
                      <span v-if="gridStatusByRow.get(i)" class="pill" :class="{ good: gridStatusByRow.get(i)!.status === 'ok', neutral: gridStatusByRow.get(i)!.status === 'update', bad: gridStatusByRow.get(i)!.status === 'error' }">
                        <template v-if="gridStatusByRow.get(i)!.status === 'ok'">✓</template>
                        <template v-else-if="gridStatusByRow.get(i)!.status === 'update'">✏️</template>
                        <template v-else>⚠️</template>
                      </span>
                      <div v-if="gridStatusByRow.get(i)?.issues.length" class="issues">
                        <div v-for="is in gridStatusByRow.get(i)!.issues" :key="is.message">{{ is.message }}</div>
                      </div>
                    </div>
                  </td>
                  <td><button class="grm" type="button" aria-label="ลบแถว" @click="removeGridRow(i)">✕</button></td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
        <button class="btn add-row" @click="addGridRow">+ เพิ่มแถว</button>
        <div v-if="gridCounts.error" class="callout bad" style="margin-top: var(--s4)">
          ยังมี {{ gridCounts.error }} แถวที่กรอกไม่ครบ (แถว {{ errorRowNumbers.join(', ') }}) — แก้ให้เรียบร้อยก่อนบันทึก
        </div>
        <div class="wiz-actions">
          <button class="btn j lg" :disabled="!canSave" @click="save">บันทึก {{ readyCount }} รายชื่อ</button>
          <button class="btn ghost back" @click="step = 1">← เลือกไฟล์ใหม่</button>
        </div>
      </div>
      <div v-else class="panel" style="text-align: center">
        <div class="success-check j lg">✓</div>
        <div class="section-title" style="margin-bottom: var(--s2)">บันทึกเรียบร้อย</div>
        <p class="success-sub">เพิ่มรายชื่อเข้า <b>ชั้น {{ grade }}/{{ room }}</b> ปีการศึกษา {{ data.period.year }} แล้ว</p>
        <div class="tally">
          <div class="t accent"><div class="n">{{ result.added }}</div><div class="l">เพิ่มใหม่</div></div>
          <div class="t"><div class="n">{{ result.updated }}</div><div class="l">อัปเดต</div></div>
        </div>
        <div class="wiz-actions">
          <button class="btn j lg" @click="emit('done')">เสร็จสิ้น</button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.review-hint { color: var(--ink-muted); font-size: 13px; margin: 0 0 var(--s3); }

/* editable review grid (mirrors the workspace importer grid) */
.grid { width: 100%; border-collapse: collapse; font-size: 14px; }
.grid th { text-align: left; white-space: nowrap; padding: var(--s2) var(--s3); background: var(--surface-2); color: var(--ink-muted); font-weight: 600; }
.grid td { padding: 4px var(--s2); border-top: 1px solid var(--line-soft); vertical-align: middle; }
.grid tr.r-ok { background: var(--surface); }
.grid tr.r-update { background: var(--brand-tint); }
.grid tr.r-error { background: color-mix(in oklab, var(--bad) 14%, var(--surface)); }
.grid tr.r-error td { border-top: 1px solid color-mix(in oklab, var(--bad) 40%, var(--surface)); }
.grid tr.r-error .issues { color: var(--bad); font-weight: 600; }
.gcell { width: 100%; min-width: 90px; height: 42px; border: 1px solid var(--line); border-radius: 8px; padding: 0 10px; font-size: 15px; background: var(--surface); }
.gcell-id { min-width: 60px; max-width: 84px; text-align: center; }
.gsex { min-width: 74px; width: 74px; cursor: pointer; }
.gcell:focus { outline: 2px solid var(--brand); outline-offset: -1px; }
/* lock the status/info column so the row layout doesn't reflow as issues change */
.grid td.gstat, .grid th:nth-last-child(2) { width: 190px; min-width: 190px; max-width: 190px; }
.gstat-row { display: flex; align-items: center; gap: 6px; }
.gstat .pill { font-size: 13px; flex-shrink: 0; }
.gstat .pill::before { display: none; } /* icon-only status chip — drop the global status dot */
.gstat .pill.bad { background: #dc2626; color: #fff; }
.gstat .issues { flex: 1; margin-top: 0; }
.grm { border: 0; background: transparent; cursor: pointer; color: var(--ink-muted); font-size: 16px; padding: 6px; }
.grm:hover { color: var(--bad); }
.add-row { align-self: flex-start; margin-top: var(--s3); }
.issues { margin-top: 2px; font-size: 12px; color: var(--ink-muted); }
</style>
