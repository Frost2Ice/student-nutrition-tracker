<!-- src/features/wizard/AddMeasuresWizard.vue -->
<script setup lang="ts">
import { ref, computed } from 'vue';
import { useData } from '../../stores/data';
import Stepper from '../../components/Stepper.vue';
import { downloadBlob } from '../download';
import {
  measureRosterTemplateAoa, pickMeasureColumns, parseMeasureAoa, mergeMeasures,
  aoaToXlsxBlob, readXlsxToAoa, pasteToAoa, MEASURE_ROSTER_HEADERS, type MergeStore,
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

// guided "order ticket" flow: which choice the teacher is on (0=ชั้น 1=ห้อง 2=ภาค 3=ครั้ง, 4=ครบ)
const activePick = ref(0);
const allPicked = computed(() => activePick.value >= 4 && !!grade.value && !!room.value);
function editPick(i: number) { if (i <= activePick.value) activePick.value = i; }

function pickGrade(g: string) { grade.value = g; room.value = ''; activePick.value = 1; }
function pickRoom(r: string) { room.value = r; activePick.value = 2; }
function pickTerm(t: Term) { term.value = t; activePick.value = 3; }
function pickRound(r: Round) { round.value = r; activePick.value = 4; }

const parsedRows = ref<Measurement[]>([]);
const skipped = ref<{ row: number; reason: string }[]>([]);
const fileErr = ref('');
const pasteText = ref('');
const result = ref<{ added: number; updated: number; orphans: number } | null>(null);

function downloadTemplate() {
  const aoa = measureRosterTemplateAoa(roomStudents.value);
  downloadBlob(aoaToXlsxBlob(aoa, 'ผลการวัด', [0]), `แม่แบบการวัด ${grade.value}-${room.value}.xlsx`);
}

// Shared by upload and paste: map columns, parse with the picked period, advance.
function process(aoa: string[][]) {
  parsedRows.value = [];
  skipped.value = [];
  const strict = pickMeasureColumns(aoa);
  const out = parseMeasureAoa(strict, { year: year.value, term: term.value, round: round.value });
  parsedRows.value = out.rows;
  skipped.value = out.skipped;
  if (out.rows.length === 0 && out.skipped.length > 0) {
    fileErr.value = 'ไม่พบข้อมูลที่บันทึกได้ ตรวจสอบว่ากรอกน้ำหนัก/ส่วนสูง/วันที่ครบและถูกต้อง';
    return;
  }
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
  const aoa = pasteToAoa(pasteText.value, MEASURE_ROSTER_HEADERS);
  if (aoa.length <= 1) {
    fileErr.value = 'ยังไม่มีข้อมูลที่วาง คัดลอกแถวข้อมูลจาก Excel มาวางในช่องนี้';
    return;
  }
  process(aoa);
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
  <div class="container j-measure">
    <div class="wiz-back"><button class="btn" @click="emit('exit')">← กลับ</button></div>
    <div class="wiz-head">
      <span class="wh-medallion">📏</span>
      <div class="wh-title">บันทึกการวัด</div>
    </div>
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

        <!-- 3: ภาคเรียน -->
        <div class="order-row" :class="{ active: activePick === 2, done: activePick > 2, locked: activePick < 2 }">
          <button class="order-head" :disabled="activePick < 2" @click="editPick(2)">
            <span class="order-num">{{ activePick > 2 ? '✓' : '3' }}</span>
            <span class="order-label">เลือกภาคเรียน</span>
            <span class="order-value">
              <span v-if="activePick > 2" class="chosen">ภาคเรียนที่ {{ term }}</span>
              <span v-else>—</span>
              <span v-if="activePick > 2" class="order-edit">เปลี่ยน</span>
            </span>
          </button>
          <div v-if="activePick === 2" class="order-body">
            <div class="tile-grid">
              <button v-for="t in (['1','2'] as Term[])" :key="t" class="tile" :class="{ on: term === t }" @click="pickTerm(t)">
                <span class="tile-ico">📅</span><span class="tile-lbl">ภาคเรียนที่ {{ t }}</span><span class="tile-check">✓</span>
              </button>
            </div>
          </div>
        </div>

        <!-- 4: ครั้งที่วัด -->
        <div class="order-row" :class="{ active: activePick === 3, done: activePick > 3, locked: activePick < 3 }">
          <button class="order-head" :disabled="activePick < 3" @click="editPick(3)">
            <span class="order-num">{{ activePick > 3 ? '✓' : '4' }}</span>
            <span class="order-label">เลือกครั้งที่วัด</span>
            <span class="order-value">
              <span v-if="activePick > 3" class="chosen">ครั้งที่ {{ round }}</span>
              <span v-else>—</span>
              <span v-if="activePick > 3" class="order-edit">เปลี่ยน</span>
            </span>
          </button>
          <div v-if="activePick === 3" class="order-body">
            <div class="tile-grid">
              <button v-for="rd in (['1','2'] as Round[])" :key="rd" class="tile" :class="{ on: round === rd }" @click="pickRound(rd)">
                <span class="tile-ico">🔁</span><span class="tile-lbl">ครั้งที่ {{ rd }}</span><span class="tile-check">✓</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      <div v-if="allPicked" class="order-ticket">
        <span class="ot-ico">🧾</span>
        <span>{{ grade }}/{{ room }} · ภาคเรียนที่ {{ term }} · ครั้งที่ {{ round }} · ปี {{ year }}</span>
      </div>
      <button class="btn j lg block" :disabled="!allPicked" @click="step = 1">ยืนยัน แล้วไปกรอกข้อมูล →</button>
    </div>

    <!-- step 1: data -->
    <div v-else-if="step === 1" class="panel">
      <div class="dl-tile">
        <span class="dl-ico">📥</span>
        <div class="dl-body">
          <b>แม่แบบการวัด {{ grade }}/{{ room }}</b>
          <span>มีรายชื่อนักเรียน {{ roomStudents.length }} คนอยู่แล้ว กรอกเฉพาะน้ำหนัก/ส่วนสูง/วันที่</span>
        </div>
        <button class="btn j" :disabled="!roomStudents.length" @click="downloadTemplate">ดาวน์โหลด</button>
      </div>
      <p v-if="!roomStudents.length" class="callout warn">ห้องนี้ยังไม่มีรายชื่อนักเรียน เพิ่มรายชื่อก่อนจึงจะบันทึกการวัดได้</p>

      <div class="chip-label">อัปโหลดไฟล์ที่กรอกแล้ว</div>
      <label class="dropzone" style="display: block; cursor: pointer">
        <div class="dz-ico">📄</div>
        <b>เลือกไฟล์ที่กรอกน้ำหนัก/ส่วนสูงแล้ว</b>
        <div class="dz-hint">รองรับไฟล์ .xlsx</div>
        <input type="file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" @change="onFile" />
      </label>

      <div class="paste-or"><span>หรือวางข้อมูลจาก Excel</span></div>
      <textarea
        v-model="pasteText"
        class="paste-box"
        rows="4"
        placeholder="คัดลอกแถวข้อมูลจาก Excel (รหัส ชื่อ นามสกุล น้ำหนัก ส่วนสูง วันที่วัด) แล้ววางที่นี่"
      ></textarea>
      <button class="btn j" :disabled="!pasteText.trim()" @click="onPaste">ตรวจสอบข้อมูลที่วาง</button>

      <div v-if="fileErr" class="callout bad" style="margin-top: var(--s4)">{{ fileErr }}</div>
      <div style="margin-top: var(--s4)"><button class="btn quiet" @click="step = 0">← ย้อนกลับ</button></div>
    </div>

    <!-- step 2: summary -->
    <div v-else>
      <div v-if="!result" class="panel">
        <div class="section-title">ตรวจสอบ {{ parsedRows.length }} รายการ</div>
        <p style="color: var(--ink-muted); margin-top: -8px; margin-bottom: var(--s4)">{{ grade }}/{{ room }} · ภาคเรียนที่ {{ term }} · ครั้งที่ {{ round }} · ปี {{ year }}</p>
        <div class="table-wrap">
          <table>
            <thead><tr><th>ชื่อ-สกุล</th><th>น้ำหนัก</th><th>ส่วนสูง</th><th>วันที่วัด</th></tr></thead>
            <tbody>
              <tr v-for="m in parsedRows" :key="m.studentId">
                <td>{{ nameOf(m.studentId) }}</td><td>{{ m.weightKg }} กก.</td><td>{{ m.heightCm }} ซม.</td><td>{{ m.date }}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <div v-if="skipped.length" class="callout warn" style="margin-top: var(--s4)">
          <div class="ct">⚠️ ข้ามไป {{ skipped.length }} แถว</div>
          <ul style="margin: 0; padding-left: 1.2em"><li v-for="(sk, i) in skipped" :key="i">แถว {{ sk.row }}: {{ sk.reason }}</li></ul>
        </div>
        <div style="margin-top: var(--s5); display: flex; gap: var(--s3); flex-wrap: wrap">
          <button class="btn quiet" @click="step = 1">← เลือกไฟล์ใหม่</button>
          <span style="flex: 1"></span>
          <button class="btn j lg" :disabled="!canSave" @click="save">บันทึกผลการวัด</button>
        </div>
      </div>
      <div v-else class="panel" style="text-align: center">
        <div class="success-check j">✓</div>
        <div class="section-title" style="margin-bottom: var(--s2)">บันทึกผลการวัดเรียบร้อย</div>
        <div class="tally">
          <div class="t accent"><div class="n">{{ result.added }}</div><div class="l">บันทึกใหม่</div></div>
          <div class="t"><div class="n">{{ result.updated }}</div><div class="l">อัปเดต</div></div>
          <div v-if="result.orphans" class="t warn"><div class="n">{{ result.orphans }}</div><div class="l">รหัสไม่ตรง</div></div>
        </div>
        <button class="btn j lg" @click="emit('done')">เสร็จสิ้น</button>
      </div>
    </div>
  </div>
</template>
