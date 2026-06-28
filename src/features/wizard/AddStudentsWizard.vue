<!-- src/features/wizard/AddStudentsWizard.vue -->
<script setup lang="ts">
import { ref, computed } from 'vue';
import { useData } from '../../stores/data';
import Stepper from '../../components/Stepper.vue';
import { downloadBlob } from '../download';
import {
  studentClassroomTemplateAoa, aoaToXlsxBlob, readXlsxToAoa, parseStudentAoa,
  injectGradeRoom, mergeStudents, pasteToAoa, STUDENT_CLASSROOM_HEADERS, type MergeStore,
} from '../../domain/transfer/xlsx';
import type { Student } from '../../domain/types';

const data = useData();
const emit = defineEmits<{ done: []; exit: [] }>();

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

const parsed = ref<Student[]>([]);
const skipped = ref<{ row: number; reason: string }[]>([]);
const fileErr = ref('');
const pasteText = ref('');
const result = ref<{ added: number; updated: number } | null>(null);

function downloadTemplate() {
  const aoa = studentClassroomTemplateAoa();
  downloadBlob(aoaToXlsxBlob(aoa, 'รายชื่อนักเรียน', [0]), `แม่แบบรายชื่อ ${grade.value}-${room.value}.xlsx`);
}

// Shared by upload and paste: inject the picked grade/room, parse, advance.
function process(classroomAoa: string[][]) {
  parsed.value = [];
  skipped.value = [];
  const out = parseStudentAoa(injectGradeRoom(classroomAoa, grade.value, room.value));
  parsed.value = out.rows;
  skipped.value = out.skipped;
  if (out.rows.length === 0 && out.skipped.length > 0) {
    fileErr.value = 'ไม่พบรายชื่อที่บันทึกได้ ตรวจสอบว่ากรอกข้อมูลครบและถูกต้อง';
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
  const aoa = pasteToAoa(pasteText.value, STUDENT_CLASSROOM_HEADERS);
  if (aoa.length <= 1) {
    fileErr.value = 'ยังไม่มีข้อมูลที่วาง คัดลอกแถวข้อมูลจาก Excel มาวางในช่องนี้';
    return;
  }
  process(aoa);
}

function save() {
  result.value = mergeStudents(mergeStore(), parsed.value);
}

const canSave = computed(() => parsed.value.length > 0 && !result.value);
</script>

<template>
  <div class="container j-students">
    <div class="wiz-back"><button class="btn" @click="emit('exit')">← กลับ</button></div>
    <div class="wiz-head">
      <span class="wh-medallion">👥</span>
      <div class="wh-title">เพิ่มรายชื่อนักเรียน</div>
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
      </div>

      <div v-if="allPicked" class="order-ticket">
        <span class="ot-ico">🧾</span>
        <span>เพิ่มรายชื่อเข้าชั้น {{ grade }}/{{ room }}</span>
      </div>
      <button class="btn j lg block" :disabled="!allPicked" @click="step = 1">ยืนยัน แล้วไปเพิ่มข้อมูล →</button>
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
        placeholder="คัดลอกแถวข้อมูลจาก Excel (รหัส ชื่อ นามสกุล วัน เดือน ปี เพศ) แล้ววางที่นี่"
      ></textarea>
      <button class="btn j" :disabled="!pasteText.trim()" @click="onPaste">ตรวจสอบข้อมูลที่วาง</button>

      <div v-if="fileErr" class="callout bad" style="margin-top: var(--s4)">{{ fileErr }}</div>
      <div style="margin-top: var(--s4)"><button class="btn quiet" @click="step = 0">← ย้อนกลับ</button></div>
    </div>

    <!-- step 2: review + save -->
    <div v-else>
      <div v-if="!result" class="panel">
        <div class="section-title">พบ {{ parsed.length }} รายชื่อ</div>
        <p style="color: var(--ink-muted); margin-top: -8px; margin-bottom: var(--s4)">จะเพิ่มเข้าชั้น {{ grade }}/{{ room }}</p>
        <div class="table-wrap">
          <table>
            <thead><tr><th>รหัส</th><th>ชื่อ-สกุล</th><th>เพศ</th><th>วันเกิด</th></tr></thead>
            <tbody>
              <tr v-for="s in parsed" :key="s.id">
                <td>{{ s.id }}</td><td>{{ s.firstName }} {{ s.lastName }}</td><td>{{ s.gender }}</td><td>{{ s.dob }}</td>
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
          <button class="btn j lg" :disabled="!canSave" @click="save">บันทึก {{ parsed.length }} รายชื่อ</button>
        </div>
      </div>
      <div v-else class="panel" style="text-align: center">
        <div class="success-check j">✓</div>
        <div class="section-title" style="margin-bottom: var(--s2)">บันทึกเรียบร้อย</div>
        <div class="tally">
          <div class="t accent"><div class="n">{{ result.added }}</div><div class="l">เพิ่มใหม่</div></div>
          <div class="t"><div class="n">{{ result.updated }}</div><div class="l">อัปเดต</div></div>
        </div>
        <button class="btn j lg" @click="emit('done')">เสร็จสิ้น</button>
      </div>
    </div>
  </div>
</template>
