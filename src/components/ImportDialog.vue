<script setup lang="ts">
defineOptions({ name: 'ImportDialog' });
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
  gridRowsToAoa,
  parseClipboardGrid,
} from '../domain/transfer/xlsx';
import type {
  ImportPreviewRow,
  MeasureImportPreviewRow,
  MergeStore,
  GridRow,
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

type Stage = 'room' | 'method' | 'grid' | 'excel' | 'pick' | 'preview' | 'done';
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
    ? `นำเข้าผลการวัด · ภาคเรียนที่ ${props.term} · ครั้งที่ ${props.round}`
    : 'เพิ่มรายชื่อนักเรียน',
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
  // measure always has a known room; student picks a method (room first if unknown)
  if (props.kind === 'measure') {
    stage.value = 'pick';
  } else if (!room.value) {
    stage.value = 'room';
  } else {
    stage.value = 'method';
  }
  gridRows.value = Array.from({ length: 3 }, blankRow);
  pasteText.value = '';
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
function pickRoom(r: string) { room.value = r; stage.value = props.kind === 'student' ? 'method' : 'pick'; }

// --- method chooser ---
function chooseType() {
  gridRows.value = Array.from({ length: 3 }, blankRow);
  stage.value = 'grid';
}
function chooseExcel() {
  pasteText.value = '';
  stage.value = 'excel';
}

// shared: clipboard/file parsed rows → GridRow with validated gender
function toGridRow(p: { id: string; firstName: string; lastName: string; gender: string; dob: string }): GridRow {
  return {
    id: p.id,
    firstName: p.firstName,
    lastName: p.lastName,
    dob: p.dob,
    gender: p.gender === 'ชาย' || p.gender === 'หญิง' ? p.gender : '',
  };
}

// paste box (Excel step): parse pasted block → load grid → review
const pasteText = ref('');
const pasteRowCount = computed(() => parseClipboardGrid(pasteText.value).length);
function pasteBoxToGrid() {
  const rows = parseClipboardGrid(pasteText.value).map(toGridRow);
  if (!rows.length) return;
  gridRows.value = rows;
  stage.value = 'grid';
}

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
    gridRows.value[idx] = toGridRow(parsed[k]);
  }
}

// live validation via the single domain parser
const gridParse = computed(() => {
  const aoa = gridRowsToAoa(gridRows.value);
  const existing = new Set(data.students.map((s) => s.id));
  return parseStudentImport(aoa, { grade: grade.value, room: room.value }, existing, undefined, +data.period.year);
});
// map parser rows (1-based, header-skipped) back to non-blank grid row indices
const gridStatusByRow = computed(() => {
  const map = new Map<number, ImportPreviewRow>();
  const nonBlank = gridRows.value
    .map((r, i) => ({ r, i }))
    .filter(({ r }) => r.id.trim() || r.firstName.trim() || r.lastName.trim() || r.gender.trim() || r.dob.trim());
  gridParse.value.rows.forEach((pr, k) => {
    if (!nonBlank[k]) return;
    const { r, i } = nonBlank[k];
    // Grid-only rule: empty gender on a non-blank row is a blocking error
    if (!r.gender.trim()) {
      const genderIssue = { message: 'ยังไม่ได้เลือกเพศ (ช/ญ)', severity: 'error' as const };
      map.set(i, { ...pr, status: 'error', issues: [genderIssue, ...pr.issues] });
    } else {
      map.set(i, pr);
    }
  });
  return map;
});
const gridCounts = computed(() => {
  const counts = { ok: 0, update: 0, error: 0, skip: 0 };
  gridStatusByRow.value.forEach((pr) => { counts[pr.status] = (counts[pr.status] ?? 0) + 1; });
  return counts;
});
// any non-blank grid row missing gender blocks proceeding: the preview parser would
// silently coerce empty gender to 'ชาย', misclassifying girls against the male standard
const gridHasUnsetGender = computed(() =>
  gridRows.value.some(
    (r) =>
      !r.gender.trim() &&
      (r.id.trim() || r.firstName.trim() || r.lastName.trim() || r.dob.trim()),
  ),
);
const canConfirmGrid = computed(
  () => gridCounts.value.ok + gridCounts.value.update > 0 && !gridHasUnsetGender.value,
);

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

const blankRow = (): GridRow => ({ id: '', firstName: '', lastName: '', gender: '', dob: '' });
const gridRows = ref<GridRow[]>([]);

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

    <!-- stage: method chooser (student) -->
    <div v-else-if="stage === 'method'" class="grid-stage">
      <div class="callout">
        <div class="callout-top">
          <span class="callout-ico">➕</span>
          <div class="callout-body">
            <div class="callout-title">เพิ่มรายชื่อนักเรียน</div>
            <div class="callout-sub">เลือกวิธีที่สะดวกกับคุณ</div>
          </div>
          <div class="sess-room-tag">
            <div class="sess-round">
              <span class="sess-round-lbl">ห้อง</span>
              <span class="sess-round-val">{{ roomLabel }}</span>
            </div>
            <button v-if="!props.room" class="btn quiet sess-edit" @click="stage = 'room'">เปลี่ยนห้อง</button>
          </div>
        </div>
        <p class="callout-note">
          🛡️ เพิ่มเข้าห้อง {{ roomLabel }} — <b>ไม่ลบ ไม่แทนที่</b>รายชื่อเดิม คนที่มีอยู่ยังอยู่ครบ
          ระบบเพิ่มเฉพาะคนใหม่ ถ้ารหัสซ้ำจะแจ้งเตือนให้ตรวจก่อน
        </p>
      </div>

      <div class="method-grid">
        <button class="method-card" @click="chooseType">
          <span class="method-ico">⌨️</span>
          <span class="method-title">พิมพ์ในแอป</span>
          <span class="method-desc">กรอกทีละคนในตาราง — เหมาะกับการเพิ่มไม่กี่คน</span>
        </button>
        <button class="method-card" @click="chooseExcel">
          <span class="method-ico">📄</span>
          <span class="method-title">ใช้ไฟล์ Excel</span>
          <span class="method-desc">อัปโหลดไฟล์ หรือวางข้อมูลจาก Excel — เหมาะกับทั้งห้อง</span>
        </button>
      </div>
    </div>

    <!-- stage: fast grid (type in app) -->
    <div v-else-if="stage === 'grid'" class="grid-stage">
      <div class="sess">
        <div class="sess-info">
          <span class="sess-ico">⌨️</span>
          <div>
            <div class="sess-room">พิมพ์รายชื่อนักเรียน</div>
            <div class="sess-meta">กรอกให้ครบทุกช่อง เพศและวันเกิดเลือกจากตัวเลือก</div>
          </div>
        </div>
        <div class="sess-room-tag">
          <div class="sess-round">
            <span class="sess-round-lbl">ห้อง</span>
            <span class="sess-round-val">{{ roomLabel }}</span>
          </div>
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

      <div class="wiz-foot sticky-foot">
        <button class="btn quiet" @click="stage = 'method'">← เลือกวิธีอื่น</button>
        <div class="prev-stats">
          <span class="stat ok"><b>{{ gridCounts.ok }}</b> พร้อม</span>
          <span class="stat upd"><b>{{ gridCounts.update }}</b> อัปเดต</span>
          <span class="stat err" :class="{ zero: !gridCounts.error }"><b>{{ gridCounts.error }}</b> ปัญหา</span>
        </div>
        <span class="spacer"></span>
        <button class="btn primary lg" :disabled="!canConfirmGrid" @click="gridToPreview">
          ตรวจทานเพื่อเพิ่ม {{ gridCounts.ok + gridCounts.update }} คน →
        </button>
      </div>
    </div>

    <!-- stage: Excel (upload file or paste from Excel) -->
    <div v-else-if="stage === 'excel'" class="grid-stage">
      <div class="sess">
        <div class="sess-info">
          <span class="sess-ico">📄</span>
          <div>
            <div class="sess-room">ใช้ไฟล์ Excel</div>
            <div class="sess-meta">อัปโหลดไฟล์ หรือวางข้อมูลที่คัดลอกมา</div>
          </div>
        </div>
        <div class="sess-room-tag">
          <div class="sess-round">
            <span class="sess-round-lbl">ห้อง</span>
            <span class="sess-round-val">{{ roomLabel }}</span>
          </div>
        </div>
      </div>

      <!-- option A: upload a file -->
      <div class="xl-block">
        <div class="xl-head"><span class="xl-badge">1</span> อัปโหลดไฟล์ Excel</div>
        <p class="xl-sub">ยังไม่มีไฟล์? <button class="linkbtn" @click="downloadTemplate">⬇ ดาวน์โหลดแม่แบบสำหรับกรอก</button></p>
        <label class="dropzone" :class="{ drag: dragging }" @dragover.prevent="dragging = true" @dragleave.prevent="dragging = false" @drop.prevent="onExcelDrop">
          <input type="file" accept=".xlsx" class="dz-input" @change="onExcelFile" />
          <div class="dz-ico">📥</div>
          <div class="dz-main">ลากไฟล์ .xlsx มาวางที่นี่ หรือคลิกเพื่อเลือกไฟล์</div>
          <div class="dz-hint">ข้อมูลจะถูกนำมาใส่ตารางให้ตรวจทานก่อนเพิ่ม</div>
        </label>
      </div>

      <div class="xl-or">หรือ</div>

      <!-- option B: paste -->
      <div class="xl-block">
        <div class="xl-head"><span class="xl-badge">2</span> วางข้อมูลจาก Excel</div>
        <p class="xl-sub">
          ใช้คอลัมน์เรียงตามแม่แบบ เริ่มจาก <b>รหัสนักเรียน</b> เป็นคอลัมน์แรก:
          รหัส · ชื่อ · นามสกุล · วัน · เดือน · ปี(พ.ศ.) · เพศ
        </p>
        <ol class="xl-steps">
          <li>ในไฟล์ Excel <b>ลากคลุมแถวข้อมูล</b> ที่ต้องการ (คลุมทุกคอลัมน์ตั้งแต่รหัสนักเรียน) จะคลุมหัวตารางมาด้วยก็ได้</li>
          <li>กด <b>Ctrl+C</b> (หรือ <b>⌘C</b> บน Mac) เพื่อคัดลอก</li>
          <li>คลิกในช่องด้านล่าง แล้วกด <b>Ctrl+V</b> (หรือ <b>⌘V</b>) เพื่อวาง</li>
        </ol>
        <textarea
          v-model="pasteText"
          class="xl-paste"
          rows="4"
          placeholder="วางข้อมูลที่คัดลอกจาก Excel ที่นี่…"
        ></textarea>
      </div>

      <div class="wiz-foot sticky-foot">
        <button class="btn quiet" @click="stage = 'method'">← เลือกวิธีอื่น</button>
        <span class="xl-count" :class="{ on: pasteRowCount > 0 }">
          {{ pasteRowCount > 0 ? `พบ ${pasteRowCount} แถว` : 'ยังไม่มีข้อมูล' }}
        </span>
        <span class="spacer"></span>
        <button class="btn primary lg" :disabled="!pasteRowCount" @click="pasteBoxToGrid">
          นำลงตารางเพื่อตรวจทาน →
        </button>
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
      <!-- student: room context — mirrors measure session banner -->
      <div v-else class="sess">
        <div class="sess-info">
          <span class="sess-ico">👥</span>
          <div>
            <div class="sess-room">นำเข้ารายชื่อนักเรียน</div>
            <div class="sess-meta">ไฟล์ที่นำเข้าจะถูกเพิ่มเข้าห้องนี้</div>
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
.sess-room-tag { display: flex; align-items: center; gap: var(--s2); flex-shrink: 0; }
.sess-edit { flex-shrink: 0; }
@media (max-width: 560px) {
  .sess-room-tag { flex-direction: column; align-items: stretch; }
}
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

/* method callout (header + reassurance combined) */
.callout { background: var(--good-tint); border-radius: 14px; padding: var(--s4); }
.callout-top { display: flex; align-items: center; gap: var(--s3); flex-wrap: wrap; }
.callout-ico { font-size: 28px; flex-shrink: 0; }
.callout-body { flex: 1; min-width: 0; }
.callout-title { font-weight: 800; font-size: 18px; color: var(--good); }
.callout-sub { font-size: 13.5px; color: var(--ink-muted); margin-top: 1px; }
.callout-note { margin: var(--s3) 0 0; font-size: 13px; color: var(--ink); line-height: 1.55; }
.callout-note b { color: var(--good); }

/* back link (wizard steps) */
/* sticky wizard footer (grid / excel steps) */
.sticky-foot {
  position: sticky; bottom: 0; margin-top: 0;
  background: var(--surface); border-top: 1px solid var(--line);
  padding: var(--s3) 0; z-index: 1;
}

/* method chooser cards */
.method-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: var(--s4); }
.method-card {
  display: flex; flex-direction: column; align-items: flex-start; gap: 4px;
  text-align: left; cursor: pointer; font: inherit;
  border: 1px solid var(--line); border-radius: 14px; background: var(--surface);
  padding: var(--s4); transition: border-color 140ms var(--ease), background 140ms var(--ease);
}
.method-card:hover { border-color: var(--brand); background: var(--brand-tint); }
.method-ico { font-size: 32px; }
.method-title { font-weight: 700; font-size: 17px; color: var(--ink); }
.method-desc { font-size: 13px; color: var(--ink-muted); line-height: 1.45; }

/* Excel step blocks */
.xl-block { display: flex; flex-direction: column; gap: var(--s2); }
.xl-head { display: flex; align-items: center; gap: var(--s2); font-weight: 700; color: var(--ink); }
.xl-badge {
  width: 24px; height: 24px; border-radius: 999px; background: var(--brand); color: #fff;
  font-size: 14px; font-weight: 700; display: inline-flex; align-items: center; justify-content: center; flex-shrink: 0;
}
.xl-sub { margin: 0; font-size: 13px; color: var(--ink-muted); }
.xl-or { text-align: center; font-size: 13px; color: var(--ink-muted); font-weight: 600; position: relative; }
.xl-or::before, .xl-or::after {
  content: ''; position: absolute; top: 50%; width: 38%; height: 1px; background: var(--line);
}
.xl-or::before { left: 0; }
.xl-or::after { right: 0; }
.xl-steps { margin: 0; padding-left: 1.3em; font-size: 13.5px; color: var(--ink); line-height: 1.7; }
.xl-paste {
  width: 100%; border: 1px solid var(--line); border-radius: 10px; padding: var(--s3);
  font: inherit; resize: vertical; background: var(--surface-2);
}
.xl-paste:focus { outline: 2px solid var(--brand); outline-offset: -1px; background: var(--surface); }
.xl-count { font-size: 13px; color: var(--ink-muted); font-weight: 600; }
.xl-count.on { color: var(--good); }
.linkbtn { border: 0; background: transparent; color: var(--brand-ink); font: inherit; font-weight: 600; cursor: pointer; padding: 0; text-decoration: underline; }
.linkbtn:hover { color: var(--brand); }
.wiz-foot .prev-stats { display: flex; gap: var(--s2); }
</style>
