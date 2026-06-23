<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import Dialog from './Dialog.vue';
import ThaiDateField from '../features/ThaiDateField.vue';
import { useData } from '../stores/data';
import {
  aoaToXlsxBlob,
  studentClassroomTemplateAoa,
  measureTemplateAoa,
  readXlsxToAoa,
  parseStudentImport,
  parseMeasureImport,
  mergeStudents,
  mergeMeasures,
} from '../domain/transfer/xlsx';
import type {
  ImportPreviewRow,
  MeasureImportPreviewRow,
  MergeStore,
} from '../domain/transfer/xlsx';
import type { Term, Round } from '../domain/types';
import { downloadBlob } from '../features/download';

const props = defineProps<{
  open: boolean;
  kind: 'student' | 'measure';
  grade?: string;
  room?: string;
  // measurement session (required when kind === 'measure')
  year?: string;
  term?: Term;
  round?: Round;
}>();
const emit = defineEmits<{
  close: [];
  imported: [result: { added: number; updated: number }];
}>();

const data = useData();

type Stage = 'room' | 'pick' | 'preview' | 'done';
const stage = ref<Stage>('pick');

// chosen room (may be supplied via props, or picked in-dialog for roomless imports)
const grade = ref('');
const room = ref('');

const studentRows = ref<ImportPreviewRow[]>([]);
const measureRows = ref<MeasureImportPreviewRow[]>([]);
const counts = ref({ ok: 0, update: 0, error: 0 });
const lastAoa = ref<string[][]>([]);
const dobOverrides = ref(new Map<number, { dob?: string }>());
const dateOverrides = ref(new Map<number, { date?: string; weight?: string; height?: string }>());
const result = ref<{ added: number; updated: number } | null>(null);

const title = computed(() =>
  props.kind === 'measure'
    ? `นำเข้าผลการวัด · ครั้งที่ ${props.round}`
    : 'นำเข้ารายชื่อนักเรียน (Excel)',
);
const roomLabel = computed(() => (grade.value && room.value ? `${grade.value}/${room.value}` : ''));
const canConfirm = computed(() => counts.value.ok + counts.value.update > 0);

function reset() {
  grade.value = props.grade ?? '';
  room.value = props.room ?? '';
  studentRows.value = [];
  measureRows.value = [];
  counts.value = { ok: 0, update: 0, error: 0 };
  lastAoa.value = [];
  dobOverrides.value = new Map();
  dateOverrides.value = new Map();
  result.value = null;
  // measure always has a known room; student may need to pick one
  stage.value = props.kind === 'student' && !room.value ? 'room' : 'pick';
}

watch(
  () => props.open,
  (open) => { if (open) reset(); },
  { immediate: true },
);

// --- room picker (student, roomless entry) ---
const roomsForGrade = computed(() => {
  const e = data.structure.find((s) => s.grade === grade.value);
  return e ? e.rooms : [];
});
function pickGrade(g: string) { grade.value = g; room.value = ''; }
function pickRoom(r: string) { room.value = r; stage.value = 'pick'; }

// --- template ---
function downloadTemplate() {
  if (props.kind === 'measure') {
    downloadBlob(aoaToXlsxBlob(measureTemplateAoa(), 'ผลการวัด'), 'แม่แบบผลการวัด.xlsx');
  } else {
    downloadBlob(
      aoaToXlsxBlob(studentClassroomTemplateAoa(), 'รายชื่อนักเรียน'),
      `แม่แบบรายชื่อ ${roomLabel.value || 'นักเรียน'}.xlsx`,
    );
  }
}

// --- parse ---
function runParse() {
  if (props.kind === 'measure') {
    const res = parseMeasureImport(
      lastAoa.value,
      { year: props.year!, term: props.term!, round: props.round! },
      data.students,
      (id) => data.findDuplicate(id, props.year!, props.term!, props.round!) !== null,
      { grade: grade.value, room: room.value },
      dateOverrides.value,
    );
    measureRows.value = res.rows;
    counts.value = res.counts;
  } else {
    const existing = new Set(data.students.map((s) => s.id));
    const res = parseStudentImport(
      lastAoa.value,
      { grade: grade.value, room: room.value },
      existing,
      dobOverrides.value,
      +data.period.year,
    );
    studentRows.value = res.rows;
    counts.value = res.counts;
  }
}

const dragging = ref(false);
const fileName = ref('');

function processFile(file: File) {
  fileName.value = file.name;
  const reader = new FileReader();
  reader.onload = () => {
    lastAoa.value = readXlsxToAoa(reader.result as ArrayBuffer);
    dobOverrides.value = new Map();
    dateOverrides.value = new Map();
    runParse();
    stage.value = 'preview';
  };
  reader.readAsArrayBuffer(file);
}

function onFile(e: Event) {
  const input = e.target as HTMLInputElement;
  const file = input.files?.[0];
  if (file) processFile(file);
  input.value = '';
}

function onDrop(e: DragEvent) {
  dragging.value = false;
  const file = e.dataTransfer?.files?.[0];
  if (file && file.name.endsWith('.xlsx')) processFile(file);
}

function onDobFix(rowNum: number, dob: string) {
  dobOverrides.value = new Map(dobOverrides.value);
  dobOverrides.value.set(rowNum, { dob });
  runParse();
}
function onDateFix(rowNum: number, date: string) {
  dateOverrides.value = new Map(dateOverrides.value);
  dateOverrides.value.set(rowNum, { ...dateOverrides.value.get(rowNum), date });
  runParse();
}

function store(): MergeStore {
  return {
    students: { value: data.students },
    addStudent: (s) => data.addStudent(s),
    updateStudent: (id, patch) => data.updateStudent(id, patch),
    addMeasure: (m) => data.addMeasure(m),
    upsertMeasure: (m) => data.upsertMeasure(m),
    findDuplicate: (id, y, t, r) => data.findDuplicate(id, y, t, r),
  };
}

function confirm() {
  if (props.kind === 'measure') {
    const good = measureRows.value
      .filter((r) => r.status === 'ok' || r.status === 'update')
      .map((r) => r.measure!);
    const { added, updated } = mergeMeasures(store(), good);
    result.value = { added, updated };
  } else {
    const good = studentRows.value.filter((r) => r.student !== null).map((r) => r.student!);
    const { added, updated } = mergeStudents(store(), good);
    result.value = { added, updated };
  }
  emit('imported', result.value);
  stage.value = 'done';
}

const dobYearMin = computed(() => +data.period.year - 19);
const dobYearMax = computed(() => +data.period.year - 2);
const measureYearMin = computed(() => +(props.year ?? data.period.year) - 1);
const measureYearMax = computed(() => +(props.year ?? data.period.year) + 1);
</script>

<template>
  <Dialog :open="open" :title="title" @close="emit('close')">
    <!-- stage: room picker (student, roomless) -->
    <div v-if="stage === 'room'">
      <p class="page-sub" style="margin-top: 0">เลือกชั้นและห้องที่ต้องการนำเข้า</p>
      <div class="field-block">
        <div class="fb-label">ชั้น</div>
        <div class="chips">
          <button
            v-for="e in data.structure"
            :key="e.grade"
            class="btn"
            :class="{ primary: grade === e.grade }"
            @click="pickGrade(e.grade)"
          >{{ e.grade }}</button>
        </div>
        <div v-if="!data.structure.length" style="color: var(--ink-muted)">ยังไม่ได้ตั้งค่าห้องเรียน</div>
      </div>
      <div v-if="grade" class="field-block">
        <div class="fb-label">ห้อง</div>
        <div class="chips">
          <button
            v-for="r in roomsForGrade"
            :key="r"
            class="btn"
            :class="{ primary: room === r }"
            @click="pickRoom(r)"
          >{{ r }}</button>
        </div>
      </div>
    </div>

    <!-- stage: pick file — cohesive 2-step upload -->
    <div v-else-if="stage === 'pick'" class="up">
      <!-- measure: prominent session banner — which round is being filled -->
      <div v-if="kind === 'measure'" class="sess">
        <div class="sess-info">
          <span class="sess-ico">📏</span>
          <div>
            <div class="sess-room">ห้อง {{ roomLabel }}</div>
            <div class="sess-meta">ปีการศึกษา {{ year }} · ภาคเรียนที่ {{ term }}</div>
          </div>
        </div>
        <div class="sess-round">
          <span class="sess-round-lbl">กำลังนำเข้าผลการวัด</span>
          <span class="sess-round-val">ครั้งที่ {{ round }}</span>
        </div>
      </div>
      <!-- student: room context -->
      <div v-else class="up-ctx">
        <span class="up-ctx-ico">👥</span>
        <div>
          <div class="up-ctx-t">นำเข้ารายชื่อนักเรียน · ห้อง {{ roomLabel }}</div>
          <div class="up-ctx-d">ไฟล์ที่นำเข้าจะถูกเพิ่มเข้าห้องนี้</div>
        </div>
        <button v-if="!props.room" class="btn quiet up-ctx-edit" @click="stage = 'room'">เปลี่ยนห้อง</button>
      </div>

      <ol class="up-steps">
        <li class="up-step">
          <div class="up-n">1</div>
          <div class="up-b">
            <div class="up-t">ดาวน์โหลดแม่แบบ (ถ้ายังไม่มีไฟล์)</div>
            <div class="up-d">ไฟล์ตัวอย่างมีหัวคอลัมน์ครบ กรอกข้อมูลแล้วบันทึกเป็น .xlsx</div>
            <button class="btn" @click="downloadTemplate">⬇ ดาวน์โหลดแม่แบบ Excel</button>
          </div>
        </li>
        <li class="up-step">
          <div class="up-n">2</div>
          <div class="up-b">
            <div class="up-t">เลือกไฟล์ที่กรอกแล้ว</div>
            <label
              class="dropzone"
              :class="{ drag: dragging }"
              @dragover.prevent="dragging = true"
              @dragleave.prevent="dragging = false"
              @drop.prevent="onDrop"
            >
              <input type="file" accept=".xlsx" class="dz-input" @change="onFile" />
              <div class="dz-ico">📥</div>
              <div class="dz-main">ลากไฟล์ Excel มาวางที่นี่</div>
              <div class="dz-or">หรือ</div>
              <span class="btn primary lg dz-btn">เลือกไฟล์จากเครื่อง</span>
              <div class="dz-hint">รองรับไฟล์ .xlsx เท่านั้น</div>
            </label>
          </div>
        </li>
      </ol>
    </div>

    <!-- stage: preview -->
    <div v-else-if="stage === 'preview'">
      <div class="prev-head">
        <div class="prev-file">
          <span>📄</span> {{ fileName }} · ห้อง {{ roomLabel }}
          <span v-if="kind === 'measure'" class="prev-round">ครั้งที่ {{ round }}</span>
        </div>
        <div class="prev-stats">
          <span class="stat ok"><b>{{ counts.ok }}</b> เพิ่มใหม่</span>
          <span class="stat upd"><b>{{ counts.update }}</b> อัปเดต</span>
          <span class="stat err" :class="{ zero: !counts.error }"><b>{{ counts.error }}</b> มีปัญหา</span>
        </div>
      </div>

      <div class="panel" style="padding: 0; overflow-x: auto">
        <table class="prev">
          <thead>
            <tr>
              <th>แถว</th>
              <th>รหัส</th>
              <th>{{ kind === 'measure' ? 'ชื่อ' : 'ชื่อ-สกุล' }}</th>
              <th v-if="kind === 'measure'">น้ำหนัก</th>
              <th v-if="kind === 'measure'">ส่วนสูง</th>
              <th>{{ kind === 'measure' ? 'วันที่' : 'วันเกิด' }}</th>
              <th>สถานะ</th>
            </tr>
          </thead>
          <!-- student rows -->
          <tbody v-if="kind === 'student'">
            <tr v-for="row in studentRows" :key="row.rowNum" :class="`r-${row.status}`">
              <td class="muted">{{ row.rowNum }}</td>
              <td class="mono">{{ row.id }}</td>
              <td>{{ row.firstName }} {{ row.lastName }}</td>
              <td>
                <ThaiDateField
                  v-if="row.hasDateError"
                  :model-value="dobOverrides.get(row.rowNum)?.dob ?? ''"
                  :year-min="dobYearMin"
                  :year-max="dobYearMax"
                  @update:model-value="(v) => onDobFix(row.rowNum, v)"
                />
                <template v-else>{{ row.dob }}</template>
              </td>
              <td>
                <span class="pill" :class="{ good: row.status === 'ok', neutral: row.status === 'update', bad: row.status === 'error' }">
                  <template v-if="row.status === 'ok'">✓ พร้อม</template>
                  <template v-else-if="row.status === 'update'">✏️ อัปเดต</template>
                  <template v-else>⚠️ ปัญหา</template>
                </span>
                <div v-if="row.issues.length" class="issues">
                  <div v-for="is in row.issues" :key="is.message">{{ is.message }}</div>
                </div>
              </td>
            </tr>
          </tbody>
          <!-- measure rows -->
          <tbody v-else>
            <tr v-for="row in measureRows" :key="row.rowNum" :class="`r-${row.status}`">
              <td class="muted">{{ row.rowNum }}</td>
              <td class="mono">{{ row.id }}</td>
              <td>{{ row.name || '—' }}</td>
              <td>{{ row.weightRaw }}</td>
              <td>{{ row.heightRaw }}</td>
              <td>
                <ThaiDateField
                  v-if="row.issues.some(is => is.severity === 'error' && is.message.includes('อ่านวันที่'))"
                  :model-value="dateOverrides.get(row.rowNum)?.date ?? ''"
                  :year-min="measureYearMin"
                  :year-max="measureYearMax"
                  @update:model-value="(v) => onDateFix(row.rowNum, v)"
                />
                <template v-else>{{ row.measure?.date ?? row.dateRaw }}</template>
              </td>
              <td>
                <span class="pill" :class="{ good: row.status === 'ok', neutral: row.status === 'update', bad: row.status === 'error' }">
                  <template v-if="row.status === 'ok'">✓ พร้อม</template>
                  <template v-else-if="row.status === 'update'">↻ บันทึกทับ</template>
                  <template v-else>⚠️ ปัญหา</template>
                </span>
                <div v-if="row.issues.length" class="issues">
                  <div v-for="is in row.issues" :key="is.message">{{ is.message }}</div>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <p v-if="counts.error" style="margin-top: var(--s3); font-size: 13px; color: var(--ink-muted)">
        แถวที่มีปัญหาจะถูกข้าม แก้ในไฟล์แล้วเลือกใหม่ หรือแก้วันที่ในช่องด้านบนได้
      </p>

      <div class="wiz-foot">
        <button class="btn quiet" @click="stage = 'pick'">เลือกไฟล์ใหม่</button>
        <span class="spacer"></span>
        <button class="btn primary lg" :disabled="!canConfirm" @click="confirm">
          นำเข้า {{ counts.ok + counts.update }} รายการ
        </button>
      </div>
    </div>

    <!-- stage: done -->
    <div v-else>
      <div class="proto-hero" style="padding: var(--s5) 0">
        <div class="success-check">✓</div>
        <h1>นำเข้าเรียบร้อย</h1>
        <p v-if="result">
          ห้อง {{ roomLabel }}<template v-if="kind === 'measure'"> · ครั้งที่ {{ round }}</template> ·
          เพิ่มใหม่ {{ result.added }} · อัปเดต {{ result.updated }}
          <template v-if="counts.error"> · ข้าม {{ counts.error }} แถวที่มีปัญหา</template>
        </p>
      </div>
      <div class="wiz-foot">
        <span class="spacer"></span>
        <button class="btn primary lg" @click="emit('close')">เสร็จสิ้น</button>
      </div>
    </div>
  </Dialog>
</template>

<style scoped>
.field-block { margin-bottom: var(--s4); }
.fb-label { font-weight: 600; margin-bottom: var(--s2); }
.chips { display: flex; flex-wrap: wrap; gap: var(--s2); }

/* measure session banner — round is the hero */
.sess {
  display: flex; align-items: center; justify-content: space-between; gap: var(--s4);
  flex-wrap: wrap;
  background: var(--brand-tint); border-radius: 14px;
  padding: var(--s3) var(--s4); margin-bottom: var(--s4);
}
.sess-info { display: flex; align-items: center; gap: var(--s3); min-width: 0; }
.sess-ico { font-size: 28px; flex-shrink: 0; }
.sess-room { font-weight: 700; font-size: 17px; color: var(--brand-ink); }
.sess-meta { font-size: 13px; color: var(--brand-ink); opacity: 0.75; margin-top: 1px; }
.sess-round {
  display: flex; flex-direction: column; align-items: flex-end; text-align: right;
  background: var(--brand); color: #fff; border-radius: 12px;
  padding: 8px 16px; flex-shrink: 0;
}
.sess-round-lbl { font-size: 11.5px; opacity: 0.85; font-weight: 600; }
.sess-round-val { font-size: 20px; font-weight: 800; line-height: 1.1; }
@media (max-width: 560px) {
  .sess { flex-direction: column; align-items: stretch; }
  .sess-round { flex-direction: row; align-items: center; justify-content: space-between; text-align: left; }
}

/* upload (pick stage) */
.up-ctx {
  display: flex; align-items: center; gap: var(--s3);
  background: var(--brand-tint); border-radius: 12px; padding: var(--s3) var(--s4); margin-bottom: var(--s4);
}
.up-ctx-ico { font-size: 26px; }
.up-ctx-t { font-weight: 700; color: var(--brand-ink); }
.up-ctx-d { font-size: 13px; color: var(--ink-muted); margin-top: 1px; }
.up-ctx-edit { margin-left: auto; }
.up-steps { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: var(--s4); }
.up-step { display: flex; gap: var(--s3); }
.up-n {
  flex-shrink: 0; width: 28px; height: 28px; border-radius: 999px;
  background: var(--brand); color: #fff; font-weight: 700; font-size: 15px;
  display: flex; align-items: center; justify-content: center;
}
.up-b { flex: 1; min-width: 0; }
.up-t { font-weight: 700; color: var(--ink); }
.up-d { font-size: 13px; color: var(--ink-muted); margin: 2px 0 var(--s2); }

.dropzone {
  display: flex; flex-direction: column; align-items: center; gap: 6px;
  border: 2px dashed var(--line); border-radius: 14px; padding: var(--s5) var(--s4);
  text-align: center; cursor: pointer; background: var(--surface-2);
  transition: border-color 140ms var(--ease), background 140ms var(--ease);
}
.dropzone:hover { border-color: var(--brand); }
.dropzone.drag { border-color: var(--brand); background: var(--brand-tint); }
.dz-input { position: absolute; width: 1px; height: 1px; opacity: 0; pointer-events: none; }
.dz-ico { font-size: 38px; }
.dz-main { font-weight: 600; color: var(--ink); }
.dz-or { font-size: 12.5px; color: var(--ink-muted); }
.dz-btn { margin-top: 2px; }
.dz-hint { font-size: 12px; color: var(--ink-muted); margin-top: 2px; }

/* preview header */
.prev-head { margin-bottom: var(--s4); }
.prev-file { display: flex; align-items: center; flex-wrap: wrap; gap: 6px; font-size: 13.5px; color: var(--ink-muted); margin-bottom: var(--s2); word-break: break-all; }
.prev-round { background: var(--brand); color: #fff; font-weight: 700; font-size: 12.5px; border-radius: 999px; padding: 2px 10px; }
.prev-stats { display: flex; flex-wrap: wrap; gap: var(--s2); }
.stat { border-radius: 10px; padding: 6px 12px; font-size: 13.5px; font-weight: 600; }
.stat b { font-size: 16px; margin-right: 4px; }
.stat.ok { background: var(--good-tint); color: var(--good); }
.stat.upd { background: var(--brand-tint); color: var(--brand-ink); }
.stat.err { background: var(--bad-tint); color: var(--bad); }
.stat.err.zero { background: var(--surface-2); color: var(--ink-muted); }
.prev { width: 100%; border-collapse: collapse; font-size: 14px; }
.prev th { text-align: left; white-space: nowrap; padding: var(--s2) var(--s3); background: var(--surface-2); color: var(--ink-muted); font-weight: 600; }
.prev td { padding: var(--s2) var(--s3); vertical-align: top; border-top: 1px solid var(--line-soft); }
.prev .muted { color: var(--ink-muted); }
.prev .mono { font-family: monospace; }
.prev tr.r-error { background: var(--bad-tint); }
.prev tr.r-update { background: var(--brand-tint); }
.issues { margin-top: 2px; font-size: 12px; color: var(--ink-muted); }
</style>
