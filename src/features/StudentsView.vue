<script setup lang="ts">
import { ref, reactive, computed, watch, onMounted, onUnmounted, nextTick } from 'vue';
import { Chart } from 'chart.js/auto';
import { useData } from '../stores/data';
import ThaiDateField from './ThaiDateField.vue';
import { calcNutrition } from '../domain/nutrition/engine';
import { buildWfh, buildHfa, buildWfa } from './charts';
import { getAgeMonths, todayThai } from '../domain/date/thai-date';
import { validateThaiDate, validateWeight, validateHeight } from '../domain/validation/rules';
import type { Student, Measurement, Term, Round } from '../domain/types';
import { aoaToXlsxBlob, studentsToAoa } from '../domain/transfer/xlsx';
import { downloadBlob } from './download';
import { printHtml } from './print';
import ImportDialog from '../components/ImportDialog.vue';
import { useHeader } from '../stores/header';

const props = defineProps<{ focusId?: string | null }>();
const emit = defineEmits<{ go: [tab: string, payload?: { grade: string; room: string }]; focused: [] }>();

const data = useData();

type Level = 'grades' | 'rooms' | 'students';
const level = ref<Level>('grades');
const grade = ref('');
const room = ref('');
const open = ref<Student | null>(null);
const search = ref('');
const riskOnly = ref(false);

const header = useHeader();
function syncHeader() {
  if (open.value) {
    header.setHeader({
      title: `${open.value.firstName} ${open.value.lastName}`,
      back: () => { open.value = null; },
      context: 'year',
    });
  } else {
    header.setHeader({ title: 'นักเรียน', back: null, context: 'year' });
  }
}
onMounted(syncHeader);
watch(open, syncHeader);

// ---- toast ----
const toast = ref('');
let toastT: ReturnType<typeof setTimeout> | undefined;
function say(msg: string) {
  toast.value = msg;
  clearTimeout(toastT);
  toastT = setTimeout(() => (toast.value = ''), 2200);
}

// ---- status computation per student ----
type StatusCls = 'good' | 'warn' | 'bad' | 'neutral';

function statusOf(s: Student): { label: string; cls: StatusCls; risk: boolean } {
  const m = data.latest.get(s.id) ?? null;
  if (!m) return { label: 'ยังไม่วัด', cls: 'neutral', risk: false };
  const r = calcNutrition(s, m);
  if (!r) return { label: 'ประเมินไม่ได้', cls: 'neutral', risk: false };
  const w = r.wfh;
  if (w === 'สมส่วน') return { label: w, cls: 'good', risk: false };
  if (w === 'ท้วม' || w === 'ค่อนข้างผอม' || w === 'เริ่มอ้วน') return { label: w, cls: 'warn', risk: true };
  return { label: w, cls: 'bad', risk: true }; // ผอม / อ้วน
}

// ---- browse ----
const results = computed(() => {
  const q = search.value.trim();
  if (!q) return [];
  return data.searchStudents(q);
});

const currentRoomStudents = computed(() => {
  const list = grade.value && room.value ? data.roomStudents(grade.value, room.value) : [];
  return riskOnly.value ? list.filter((s) => statusOf(s).risk) : list;
});

const roomRiskCount = computed(() =>
  grade.value && room.value
    ? data.roomStudents(grade.value, room.value).filter((s) => statusOf(s).risk).length
    : 0,
);

// Open a student's profile directly when navigated here with a focus id
// (e.g. from the measurement page). Consume once, then notify parent to clear.
watch(
  () => props.focusId,
  (id) => {
    if (!id) return;
    const s = data.findStudent(id);
    if (s) {
      grade.value = s.grade;
      room.value = s.room;
      level.value = 'students';
      open.value = s;
    }
    emit('focused');
  },
  { immediate: true },
);

function openGrade(g: string) { grade.value = g; level.value = 'rooms'; }
function openRoom(r: string) { room.value = r; level.value = 'students'; riskOnly.value = false; }
function toGrades() { level.value = 'grades'; grade.value = ''; room.value = ''; importOpen.value = false; }
function toRooms() { level.value = 'rooms'; room.value = ''; importOpen.value = false; }

// ---- per-room Excel import via the standardized ImportDialog ----
const importOpen = ref(false);
function onImported(r: { added: number; updated: number }) {
  say(`นำเข้าห้อง ${grade.value}/${room.value} แล้ว · เพิ่ม ${r.added} · อัปเดต ${r.updated}`);
}
function exportRoom() {
  const list = data.roomStudents(grade.value, room.value);
  downloadBlob(
    aoaToXlsxBlob(studentsToAoa(list), 'รายชื่อนักเรียน', [3]),
    `รายชื่อ ${grade.value}-${room.value}.xlsx`,
  );
  say(`ส่งออกรายชื่อห้อง ${grade.value}/${room.value} แล้ว (${list.length} คน)`);
}

function progressClass(m: number, t: number) { return m === t ? 'good' : m === 0 ? 'neutral' : 'warn'; }
function progressText(m: number, t: number) { return m === t ? 'วัดครบแล้ว' : m === 0 ? 'ยังไม่วัด' : `วัดแล้ว ${m}/${t}`; }

// ---- profile ----
const openMeasures = computed(() =>
  open.value
    ? data.measuresFor(open.value.id).sort((a, b) => {
        if (a.year !== b.year) return b.year.localeCompare(a.year);
        if (a.term !== b.term) return b.term.localeCompare(a.term);
        if (a.round !== b.round) return b.round.localeCompare(a.round);
        return b.savedAt - a.savedAt;
      })
    : [],
);

const latestMeasure = computed(() =>
  open.value ? (data.latest.get(open.value.id) ?? openMeasures.value[0] ?? null) : null,
);

const latestNutrition = computed(() =>
  open.value && latestMeasure.value ? calcNutrition(open.value, latestMeasure.value) : null,
);

function ageLabel(s: Student): string {
  const months = getAgeMonths(s.dob, todayThai());
  if (months === null) return '';
  const y = Math.floor(months / 12);
  const m = months % 12;
  return m ? `${y} ปี ${m} เดือน` : `${y} ปี`;
}

function nutritionCls(label: string): StatusCls {
  const good = new Set(['สมส่วน', 'น้ำหนักตามเกณฑ์', 'น้ำหนักค่อนข้างน้อย', 'น้ำหนักค่อนข้างมาก', 'สูงตามเกณฑ์', 'ค่อนข้างสูง', 'สูง', 'ค่อนข้างเตี้ย']);
  const bad = new Set(['ผอม', 'อ้วน', 'น้ำหนักน้อย', 'น้ำหนักมาก', 'เตี้ย']);
  if (bad.has(label)) return 'bad';
  if (good.has(label)) return 'good';
  return 'warn';
}

function rowNutritionCls(r: Measurement): StatusCls {
  if (!open.value) return 'neutral';
  const n = calcNutrition(open.value, r);
  if (!n) return 'neutral';
  return nutritionCls(n.wfh);
}

// ---- charts ----
const canvasWfh = ref<HTMLCanvasElement | null>(null);
const canvasHfa = ref<HTMLCanvasElement | null>(null);
const canvasWfa = ref<HTMLCanvasElement | null>(null);

let chartWfh: Chart | null = null;
let chartHfa: Chart | null = null;
let chartWfa: Chart | null = null;

function destroyCharts() {
  // Destroy our tracked instances
  chartWfh?.destroy(); chartWfh = null;
  chartHfa?.destroy(); chartHfa = null;
  chartWfa?.destroy(); chartWfa = null;
  // Also destroy any orphaned Chart.js instances still registered on the canvases
  if (canvasWfh.value) { const c = Chart.getChart(canvasWfh.value); c?.destroy(); }
  if (canvasHfa.value) { const c = Chart.getChart(canvasHfa.value); c?.destroy(); }
  if (canvasWfa.value) { const c = Chart.getChart(canvasWfa.value); c?.destroy(); }
}

let renderScheduled = false;
async function renderCharts() {
  if (renderScheduled) return;
  renderScheduled = true;
  await nextTick();
  renderScheduled = false;
  if (!open.value) return;
  destroyCharts();
  const ms = openMeasures.value;
  const s = open.value;
  if (canvasWfh.value) chartWfh = new Chart(canvasWfh.value, buildWfh(s, ms));
  if (canvasHfa.value) chartHfa = new Chart(canvasHfa.value, buildHfa(s, ms));
  if (canvasWfa.value) chartWfa = new Chart(canvasWfa.value, buildWfa(s, ms));
}

watch(open, async (s) => {
  if (s) {
    renderCharts();
  } else {
    destroyCharts();
  }
});

// Re-render charts when measures change (after add/edit/delete)
watch(openMeasures, () => {
  if (open.value) renderCharts();
}, { deep: true });

onUnmounted(destroyCharts);

// ---- student form ----
const sMode = ref<'add' | 'edit' | null>(null);
const sForm = reactive({ id: '', firstName: '', lastName: '', gender: 'ชาย' as 'ชาย' | 'หญิง', dob: '', grade: '', room: '' });
const sErrors = reactive({ id: '', name: '', dob: '', grade: '', room: '' });
const gradeConfirm = ref(false);

function clearSErrors() {
  sErrors.id = ''; sErrors.name = ''; sErrors.dob = ''; sErrors.grade = ''; sErrors.room = '';
}

function openAddStudent() {
  sMode.value = 'add';
  Object.assign(sForm, { id: '', firstName: '', lastName: '', gender: 'ชาย', dob: '', grade: grade.value, room: room.value });
  clearSErrors();
}

function openEditStudent() {
  if (!open.value) return;
  sMode.value = 'edit';
  Object.assign(sForm, {
    id: open.value.id,
    firstName: open.value.firstName,
    lastName: open.value.lastName,
    gender: open.value.gender,
    dob: open.value.dob,
    grade: open.value.grade,
    room: open.value.room,
  });
  clearSErrors();
}

function saveStudent() {
  clearSErrors();
  let ok = true;
  if (!sForm.id.trim()) { sErrors.id = 'กรุณากรอกรหัสนักเรียน'; ok = false; }
  if (!sForm.firstName.trim() && !sForm.lastName.trim()) { sErrors.name = 'กรุณากรอกชื่อหรือนามสกุล'; ok = false; }
  const py = +data.period.year;
  const dobErr = validateThaiDate(sForm.dob, true, py);
  if (dobErr) { sErrors.dob = dobErr; ok = false; }
  if (!sForm.grade.trim()) { sErrors.grade = 'กรุณากรอกชั้น'; ok = false; }
  if (!sForm.room.trim()) { sErrors.room = 'กรุณากรอกห้อง'; ok = false; }

  if (sMode.value === 'add') {
    const dup = data.students.find((s) => s.id === sForm.id.trim());
    if (dup) { sErrors.id = 'รหัสนักเรียนนี้มีอยู่แล้ว'; ok = false; }
  }

  if (!ok) return;

  if (sMode.value === 'edit' && open.value) {
    const moved = sForm.grade !== open.value.grade || sForm.room !== open.value.room;
    if (moved && !gradeConfirm.value) { gradeConfirm.value = true; return; }
    applyStudentEdit();
  } else {
    const s: Student = {
      id: sForm.id.trim(),
      firstName: sForm.firstName.trim(),
      lastName: sForm.lastName.trim(),
      gender: sForm.gender,
      dob: sForm.dob.trim(),
      grade: sForm.grade.trim(),
      room: sForm.room.trim(),
    };
    data.addStudent(s);
    sMode.value = null;
    say('เพิ่มนักเรียนแล้ว');
  }
}

function applyStudentEdit() {
  if (!open.value) return;
  data.updateStudent(open.value.id, {
    firstName: sForm.firstName.trim(),
    lastName: sForm.lastName.trim(),
    gender: sForm.gender,
    dob: sForm.dob.trim(),
    grade: sForm.grade.trim(),
    room: sForm.room.trim(),
  });
  // Re-point open to the (mutated) student object
  open.value = data.findStudent(open.value.id);
  gradeConfirm.value = false;
  sMode.value = null;
  say('บันทึกข้อมูลนักเรียนแล้ว');
}

const delStudent = ref(false);
function confirmDelStudent() {
  if (!open.value) return;
  data.deleteStudent(open.value.id);
  delStudent.value = false;
  open.value = null;
  say('ลบนักเรียนแล้ว');
}

// ---- measurement form ----
const mOpen = ref(false);
const mEditTarget = ref<Measurement | null>(null);
const mForm = reactive<{ date: string; w: string; h: string; term: Term; round: Round }>({
  date: '', w: '', h: '', term: '1', round: '1',
});
const mErrors = reactive({ date: '', w: '', h: '' });
const dupWarn = ref(false);

function clearMErrors() { mErrors.date = ''; mErrors.w = ''; mErrors.h = ''; }

function openAddMeasure() {
  mEditTarget.value = null;
  Object.assign(mForm, { date: todayThai(), w: '', h: '', term: '1', round: '1' });
  clearMErrors();
  dupWarn.value = false;
  mOpen.value = true;
}

function openEditMeasure(m: Measurement) {
  mEditTarget.value = m;
  Object.assign(mForm, { date: m.date, w: String(m.weightKg), h: String(m.heightCm), term: m.term, round: m.round });
  clearMErrors();
  dupWarn.value = false;
  mOpen.value = true;
}

function saveMeasure(force = false) {
  if (!open.value) return;
  clearMErrors();
  let ok = true;

  const dateErr = validateThaiDate(mForm.date, false);
  if (dateErr) { mErrors.date = dateErr; ok = false; }

  const wVal = parseFloat(mForm.w);
  const wErr = validateWeight(wVal);
  if (wErr) { mErrors.w = wErr; ok = false; }

  const hVal = parseFloat(mForm.h);
  const hErr = validateHeight(hVal);
  if (hErr) { mErrors.h = hErr; ok = false; }

  if (!ok) return;

  const p = data.period;
  if (!mEditTarget.value && !force) {
    const dup = data.findDuplicate(open.value.id, p.year, mForm.term, mForm.round);
    if (dup) { dupWarn.value = true; return; }
  }

  const newM: Measurement = {
    studentId: open.value.id,
    year: p.year,
    term: mForm.term,
    round: mForm.round,
    date: mForm.date.trim(),
    weightKg: wVal,
    heightCm: hVal,
    gradeAtMeasure: open.value.grade,
    roomAtMeasure: open.value.room,
    savedAt: Date.now(),
  };

  if (mEditTarget.value) {
    data.deleteMeasure(mEditTarget.value);
    data.addMeasure(newM);
    say('แก้ไขผลการวัดแล้ว');
  } else {
    data.addMeasure(newM);
    say('เพิ่มผลการวัดแล้ว');
  }

  mOpen.value = false;
  dupWarn.value = false;
}

const measureYearMax = new Date().getFullYear() + 544;

const delMeasureTarget = ref<Measurement | null>(null);
function confirmDelMeasure() {
  if (delMeasureTarget.value) {
    data.deleteMeasure(delMeasureTarget.value);
    delMeasureTarget.value = null;
    say('ลบผลการวัดแล้ว');
  }
}

function rowWfhLabel(r: Measurement): string {
  if (!open.value) return '—';
  const n = calcNutrition(open.value, r);
  return n ? n.wfh : 'ประเมินไม่ได้';
}

function rowWfaLabel(r: Measurement): string {
  if (!open.value) return '—';
  const n = calcNutrition(open.value, r);
  return n ? n.wfa : 'ประเมินไม่ได้';
}

function rowHfaLabel(r: Measurement): string {
  if (!open.value) return '—';
  const n = calcNutrition(open.value, r);
  return n ? n.hfa : 'ประเมินไม่ได้';
}

function rowTallLabel(r: Measurement): string {
  if (!open.value) return '—';
  const n = calcNutrition(open.value, r);
  if (!n) return 'ประเมินไม่ได้';
  return n.tall ? 'สูงดีสมส่วน' : 'ไม่สมส่วน';
}

function rowWfaCls(r: Measurement): StatusCls {
  if (!open.value) return 'neutral';
  const n = calcNutrition(open.value, r);
  if (!n) return 'neutral';
  return nutritionCls(n.wfa);
}

function rowHfaCls(r: Measurement): StatusCls {
  if (!open.value) return 'neutral';
  const n = calcNutrition(open.value, r);
  if (!n) return 'neutral';
  return nutritionCls(n.hfa);
}

function tallCls(r: Measurement): StatusCls {
  if (!open.value) return 'neutral';
  const n = calcNutrition(open.value, r);
  if (!n) return 'neutral';
  return n.tall ? 'good' : 'warn';
}

// ---- export PDF ----
function exportPdf() {
  const s = open.value;
  if (!s) return;

  const months = getAgeMonths(s.dob, todayThai());
  const ageStr =
    months === null
      ? ''
      : (() => {
          const y = Math.floor(months / 12);
          const m = months % 12;
          return m ? `${y} ปี ${m} เดือน` : `${y} ปี`;
        })();

  // personal info block
  const personalHtml = `
    <div class="section">
      <h2>ข้อมูลนักเรียน</h2>
      <div class="info-grid">
        <div class="info-row"><span class="info-label">ชื่อ-สกุล</span><span>${s.firstName} ${s.lastName}</span></div>
        <div class="info-row"><span class="info-label">รหัส</span><span>${s.id}</span></div>
        <div class="info-row"><span class="info-label">เพศ</span><span>${s.gender}</span></div>
        <div class="info-row"><span class="info-label">วันเกิด</span><span>${s.dob}</span></div>
        <div class="info-row"><span class="info-label">อายุ</span><span>${ageStr}</span></div>
        <div class="info-row"><span class="info-label">ชั้นปัจจุบัน</span><span>${s.grade}/${s.room}</span></div>
      </div>
      <div style="margin-top:6px;font-size:13px;color:#555">เกณฑ์อ้างอิง: กรมอนามัย กระทรวงสาธารณสุข พ.ศ. 2564</div>
    </div>`;

  // latest assessment block
  const lm = latestMeasure.value;
  const ln = latestNutrition.value;
  const assessHtml = lm && ln
    ? `<div class="section">
        <h2>ผลประเมินล่าสุด (${lm.date})</h2>
        <div class="pills">
          <span class="pill">น้ำหนัก/อายุ: ${ln.wfa}</span>
          <span class="pill">ส่วนสูง/อายุ: ${ln.hfa}</span>
          <span class="pill">น้ำหนัก/ส่วนสูง: ${ln.wfh}</span>
          <span class="pill">${ln.tall ? 'สูงดีสมส่วน' : 'ไม่สมส่วน'}</span>
        </div>
      </div>`
    : '';

  // charts as images from toDataURL
  const wfhDataUrl = canvasWfh.value?.toDataURL('image/png') ?? '';
  const hfaDataUrl = canvasHfa.value?.toDataURL('image/png') ?? '';
  const wfaDataUrl = canvasWfa.value?.toDataURL('image/png') ?? '';
  const chartsHtml = `
    <div class="section">
      <h2>กราฟการเจริญเติบโต</h2>
      ${wfhDataUrl ? `<div class="chart-img"><div style="font-size:13px;font-weight:600;margin-bottom:4px">น้ำหนักตามเกณฑ์ส่วนสูง (WFH)</div><img src="${wfhDataUrl}" alt="WFH chart"/></div>` : ''}
      ${hfaDataUrl ? `<div class="chart-img"><div style="font-size:13px;font-weight:600;margin-bottom:4px">ส่วนสูงตามเกณฑ์อายุ (HFA)</div><img src="${hfaDataUrl}" alt="HFA chart"/></div>` : ''}
      ${wfaDataUrl ? `<div class="chart-img"><div style="font-size:13px;font-weight:600;margin-bottom:4px">น้ำหนักตามเกณฑ์อายุ (WFA)</div><img src="${wfaDataUrl}" alt="WFA chart"/></div>` : ''}
    </div>`;

  // full measurement history table
  const measures = openMeasures.value;
  const histRows = measures
    .map((r) => {
      const n = calcNutrition(s, r);
      const wfaLabel = n ? n.wfa : 'ประเมินไม่ได้';
      const hfaLabel = n ? n.hfa : 'ประเมินไม่ได้';
      const wfhLabel = n ? n.wfh : 'ประเมินไม่ได้';
      const tallLabel = n ? (n.tall ? 'สูงดีสมส่วน' : 'ไม่สมส่วน') : 'ประเมินไม่ได้';
      return `<tr>
        <td>${r.year}/${r.term}/${r.round}</td>
        <td>${r.date}</td>
        <td>${r.gradeAtMeasure}</td>
        <td>${r.weightKg}</td>
        <td>${r.heightCm}</td>
        <td>${wfaLabel}</td>
        <td>${hfaLabel}</td>
        <td>${wfhLabel}</td>
        <td>${tallLabel}</td>
      </tr>`;
    })
    .join('');
  const histHtml = `
    <div class="section">
      <h2>ประวัติการวัดและการประเมิน</h2>
      ${
        measures.length
          ? `<table>
              <thead><tr><th>ปี/ภาค/ครั้ง</th><th>วันที่</th><th>ชั้น</th><th>น้ำหนัก (กก.)</th><th>ส่วนสูง (ซม.)</th><th>น้ำหนัก/อายุ</th><th>ส่วนสูง/อายุ</th><th>น้ำหนัก/ส่วนสูง</th><th>สูงดีสมส่วน</th></tr></thead>
              <tbody>${histRows}</tbody>
            </table>`
          : '<p>ยังไม่มีผลการวัด</p>'
      }
    </div>`;

  const footerHtml = `<div class="footer">แหล่งอ้างอิง: เกณฑ์อ้างอิงการเจริญเติบโต กรมอนามัย กระทรวงสาธารณสุข พ.ศ. 2564 (REF-8.2)</div>`;

  const fullHtml = `
    <h1>${s.firstName} ${s.lastName} — รายงานการเจริญเติบโต</h1>
    ${personalHtml}${assessHtml}${chartsHtml}${histHtml}${footerHtml}`;

  printHtml(fullHtml, `รายงานนักเรียน ${s.firstName} ${s.lastName}`);
}
</script>

<template>
  <div class="container students-wide">
    <!-- ===== PROFILE ===== -->
    <template v-if="open">
      <div class="panel">
        <div class="prof-head">
          <div class="avatar">{{ open.gender === 'ชาย' ? '👦' : '👧' }}</div>
          <div style="flex: 1; min-width: 200px">
            <div style="color: var(--ink-muted)">รหัส {{ open.id }} · {{ open.gender }} · เกิด {{ open.dob }} · อายุ {{ ageLabel(open) }}</div>
            <div style="margin-top: 4px"><span class="pill neutral">ชั้นปัจจุบัน {{ open.grade }}/{{ open.room }}</span></div>
          </div>
          <div class="prof-actions">
            <button class="btn" @click="exportPdf">🖨️ ออกรายงาน PDF</button>
            <button class="btn" @click="openEditStudent">แก้ไขข้อมูล</button>
            <button class="btn danger" @click="delStudent = true">ลบ</button>
          </div>
        </div>
        <div v-if="latestMeasure && latestNutrition" style="margin-top: var(--s4)">
          <div class="eyebrow" style="margin-bottom: 6px">ผลประเมินล่าสุด ({{ latestMeasure.date }})</div>
          <div style="display: flex; gap: 8px; flex-wrap: wrap">
            <span class="pill" :class="nutritionCls(latestNutrition.wfa)">{{ latestNutrition.wfa }}</span>
            <span class="pill" :class="nutritionCls(latestNutrition.hfa)">{{ latestNutrition.hfa }}</span>
            <span class="pill" :class="nutritionCls(latestNutrition.wfh)">{{ latestNutrition.wfh }}</span>
            <span class="pill" :class="latestNutrition.tall ? 'good' : 'warn'">{{ latestNutrition.tall ? 'สูงดีสมส่วน' : 'ไม่สมส่วน' }}</span>
          </div>
        </div>
        <div v-else-if="!latestMeasure" style="margin-top: var(--s4); color: var(--ink-muted)">ยังไม่มีผลการวัด</div>
      </div>

      <!-- growth charts — 3 stacked -->
      <div class="panel">
        <div class="section-title">กราฟการเจริญเติบโต</div>
        <div class="muted-note" style="margin-top: 0; margin-bottom: var(--s4)">เส้นคือค่าของนักเรียน แถบสีคือเกณฑ์อ้างอิง — จุดอยู่แถบใด คือผลประเมินนั้น</div>

        <div class="chart-card">
          <div class="chart-heading">น้ำหนักตามเกณฑ์ส่วนสูง (WFH)</div>
          <div style="position: relative; height: 280px">
            <canvas ref="canvasWfh" style="width: 100%; height: 100%"></canvas>
          </div>
        </div>

        <div class="chart-card">
          <div class="chart-heading">ส่วนสูงตามเกณฑ์อายุ (HFA)</div>
          <div style="position: relative; height: 280px">
            <canvas ref="canvasHfa" style="width: 100%; height: 100%"></canvas>
          </div>
        </div>

        <div class="chart-card">
          <div class="chart-heading">น้ำหนักตามเกณฑ์อายุ (WFA)</div>
          <div style="position: relative; height: 280px">
            <canvas ref="canvasWfa" style="width: 100%; height: 100%"></canvas>
          </div>
        </div>
      </div>

      <!-- measurement history -->
      <div class="panel">
        <div class="toolbar">
          <div class="section-title" style="margin: 0">ประวัติการวัดและการประเมิน</div>
          <span class="spacer"></span>
          <button class="btn primary" style="min-height: 38px" @click="openAddMeasure">+ บันทึกการวัด</button>
        </div>
        <div v-if="!openMeasures.length" class="empty"><span class="ico">📏</span><div>ยังไม่มีผลการวัด</div></div>
        <div v-else class="table-wrap">
          <table>
            <thead><tr><th>ปี/ภาค/ครั้ง</th><th>วันที่</th><th>ชั้น</th><th>นน.</th><th>สส.</th><th>น้ำหนัก/อายุ</th><th>ส่วนสูง/อายุ</th><th>น้ำหนัก/ส่วนสูง</th><th>สูงดีสมส่วน</th><th></th></tr></thead>
            <tbody>
              <tr v-for="r in openMeasures" :key="`${r.year}-${r.term}-${r.round}-${r.savedAt}`">
                <td>{{ r.year }}/{{ r.term }}/{{ r.round }}</td>
                <td>{{ r.date }}</td>
                <td>{{ r.gradeAtMeasure }}</td>
                <td>{{ r.weightKg }}</td>
                <td>{{ r.heightCm }}</td>
                <td><span class="pill" :class="rowWfaCls(r)">{{ rowWfaLabel(r) }}</span></td>
                <td><span class="pill" :class="rowHfaCls(r)">{{ rowHfaLabel(r) }}</span></td>
                <td><span class="pill" :class="rowNutritionCls(r)">{{ rowWfhLabel(r) }}</span></td>
                <td><span class="pill" :class="tallCls(r)">{{ rowTallLabel(r) }}</span></td>
                <td class="rowact">
                  <button class="linkbtn" @click="openEditMeasure(r)">แก้ไข</button>
                  <button class="linkbtn danger" @click="delMeasureTarget = r">ลบ</button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <div class="muted-note">ชั้นที่แสดงคือชั้น ณ เวลาที่วัด (ไม่เปลี่ยนแม้เลื่อนชั้นแล้ว)</div>
      </div>
    </template>

    <!-- ===== BROWSE ===== -->
    <template v-else>
      <p class="page-sub">เลือกชั้นและห้องเพื่อดูรายชื่อ หรือค้นหาเมื่อทราบชื่อ/รหัสนักเรียน</p>

      <div style="position: relative; margin-bottom: var(--s5)">
        <input v-model="search" class="search" style="width: 100%; padding-left: 40px" placeholder="ค้นหาด้วยชื่อหรือรหัสนักเรียน (ทั้งโรงเรียน)" />
        <span style="position: absolute; left: 14px; top: 50%; transform: translateY(-50%); color: var(--ink-muted)">🔎</span>
      </div>

      <div v-if="search.trim()" class="panel">
        <div class="section-title" style="font-size: 16px">ผลการค้นหา "{{ search }}" ({{ results.length }})</div>
        <div v-if="!results.length" class="empty"><span class="ico">🔍</span><div>ไม่พบนักเรียน</div></div>
        <div v-else class="table-wrap">
          <table>
            <thead><tr><th>รหัส</th><th>ชื่อ-สกุล</th><th>ชั้น/ห้อง</th><th></th></tr></thead>
            <tbody>
              <tr v-for="s in results" :key="s.id" style="cursor: pointer" @click="open = s">
                <td>{{ s.id }}</td><td style="font-weight: 600">{{ s.firstName }} {{ s.lastName }}</td><td>{{ s.grade }}/{{ s.room }}</td>
                <td><span style="color: var(--brand-ink); font-weight: 600">ดูประวัติ →</span></td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <template v-else>
        <nav class="crumb">
          <button :class="{ on: level === 'grades' }" @click="toGrades">ทุกชั้น</button>
          <template v-if="grade"><span>›</span><button :class="{ on: level === 'rooms' }" @click="toRooms">{{ grade }}</button></template>
          <template v-if="level === 'students'"><span>›</span><button class="on">ห้อง {{ room }}</button></template>
        </nav>

        <div v-if="data.structure.length === 0 && level === 'grades'" class="empty">
          <span class="ico">👥</span><div>ยังไม่มีนักเรียน — เพิ่มนักเรียนได้ที่แต่ละห้อง</div>
        </div>

        <div v-else-if="level === 'grades'" class="browse-grid">
          <button v-for="(g, gi) in data.structure" :key="g.grade" class="browse-card stagger-item" :style="{ '--i': gi }" @click="openGrade(g.grade)">
            <div class="bc-top"><span class="bc-name">{{ g.grade }}</span><span class="bc-count">{{ data.gradeInfo(g.grade).total }} คน</span></div>
            <div class="bc-sub">{{ data.gradeInfo(g.grade).rooms }} ห้อง</div>
            <div class="bc-bar"><div class="bc-fill" :style="{ width: (data.gradeInfo(g.grade).measured / Math.max(data.gradeInfo(g.grade).total, 1) * 100) + '%' }"></div></div>
          </button>
        </div>

        <div v-else-if="level === 'rooms'" class="browse-grid">
          <button
            v-for="(r, ri) in (data.structure.find((s) => s.grade === grade)?.rooms ?? [])"
            :key="r"
            class="browse-card stagger-item"
            :style="{ '--i': ri }"
            @click="openRoom(r)"
          >
            <div class="bc-top"><span class="bc-name">{{ grade }}/{{ r }}</span><span class="bc-count">{{ data.roomInfo(grade, r).total }} คน</span></div>
            <div class="bc-sub">
              <span class="pill" :class="progressClass(data.roomInfo(grade, r).measured, data.roomInfo(grade, r).total)">{{ progressText(data.roomInfo(grade, r).measured, data.roomInfo(grade, r).total) }}</span>
            </div>
          </button>
        </div>

        <!-- students: classroom-scoped actions live here, in context -->
        <template v-else>
          <!-- classroom action cards: import / template / export -->
          <div class="room-actions">
            <button class="act-card" @click="importOpen = true">
              <span class="act-ico">📥</span>
              <span class="act-body">
                <span class="act-title">นำเข้ารายชื่อนักเรียน</span>
                <span class="act-desc">นำเข้ารายชื่อนักเรียนของห้องนี้จากไฟล์ Excel</span>
              </span>
            </button>
            <button class="act-card" :disabled="!currentRoomStudents.length && !roomRiskCount" @click="exportRoom">
              <span class="act-ico">📤</span>
              <span class="act-body">
                <span class="act-title">ส่งออกรายชื่อนักเรียน</span>
                <span class="act-desc">ดาวน์โหลดรายชื่อนักเรียนของห้องนี้เป็นไฟล์ Excel</span>
              </span>
            </button>
          </div>

          <div class="panel">
          <div class="toolbar">
            <div class="section-title" style="margin: 0">ห้อง {{ grade }}/{{ room }}</div>
            <span class="spacer"></span>
            <button class="chipbtn" :class="{ on: riskOnly }" @click="riskOnly = !riskOnly">
              ⚠️ เฉพาะกลุ่มเสี่ยง <span class="chip-n">{{ roomRiskCount }}</span>
            </button>
            <button class="btn primary" style="min-height: 38px" @click="openAddStudent">+ เพิ่มนักเรียน</button>
          </div>
          <div class="table-wrap">
            <table>
              <thead><tr><th>รหัส</th><th>ชื่อ-สกุล</th><th>เพศ</th><th>ภาวะล่าสุด</th><th></th></tr></thead>
              <tbody>
                <tr v-for="s in currentRoomStudents" :key="s.id" style="cursor: pointer" @click="open = s">
                  <td>{{ s.id }}</td><td style="font-weight: 600">{{ s.firstName }} {{ s.lastName }}</td><td>{{ s.gender }}</td>
                  <td><span class="pill" :class="statusOf(s).cls">{{ statusOf(s).label }}</span></td>
                  <td><span style="color: var(--brand-ink); font-weight: 600">ดูประวัติ →</span></td>
                </tr>
                <tr v-if="!currentRoomStudents.length"><td colspan="5" style="text-align: center; color: var(--ink-muted); padding: var(--s5)">ไม่มีนักเรียนกลุ่มเสี่ยงในห้องนี้ 🎉</td></tr>
              </tbody>
            </table>
          </div>
          </div>
        </template>
      </template>
    </template>

    <!-- ===== student form dialog ===== -->
    <div v-if="sMode" class="smodal-back" @click.self="sMode = null">
      <div class="smodal">
        <div class="smodal-title">{{ sMode === 'add' ? 'เพิ่มนักเรียนใหม่' : 'แก้ไขข้อมูลนักเรียน' }}</div>
        <div class="form-grid">
          <div class="field">
            <label>รหัสนักเรียน</label>
            <input v-model="sForm.id" :disabled="sMode === 'edit'" placeholder="เช่น 10210" />
            <div v-if="sErrors.id" class="field-err">{{ sErrors.id }}</div>
          </div>
          <div class="field">
            <label>เพศ</label>
            <select v-model="sForm.gender"><option>ชาย</option><option>หญิง</option></select>
          </div>
        </div>
        <div class="form-grid">
          <div class="field">
            <label>ชื่อ</label>
            <input v-model="sForm.firstName" placeholder="ชื่อ" />
          </div>
          <div class="field">
            <label>นามสกุล</label>
            <input v-model="sForm.lastName" placeholder="นามสกุล" />
          </div>
        </div>
        <div v-if="sErrors.name" class="field-err" style="margin-top: -8px; margin-bottom: var(--s3)">{{ sErrors.name }}</div>
        <div class="form-grid">
          <div class="field">
            <label>วันเกิด</label>
            <ThaiDateField
              v-model="sForm.dob"
              :year-min="+data.period.year - 19"
              :year-max="+data.period.year - 2"
            />
            <div v-if="sErrors.dob" class="field-err">{{ sErrors.dob }}</div>
          </div>
          <div class="field">
            <label>ชั้น / ห้อง</label>
            <div style="display: flex; gap: 8px">
              <input v-model="sForm.grade" style="flex: 1" placeholder="ป.2" />
              <input v-model="sForm.room" style="width: 70px" placeholder="1" />
            </div>
            <div v-if="sErrors.grade || sErrors.room" class="field-err">{{ sErrors.grade || sErrors.room }}</div>
          </div>
        </div>
        <div class="smodal-foot">
          <button class="btn quiet" @click="sMode = null">ยกเลิก</button>
          <span class="spacer"></span>
          <button class="btn primary" @click="saveStudent">บันทึก</button>
        </div>
      </div>
    </div>

    <!-- ===== measurement form dialog ===== -->
    <div v-if="mOpen" class="smodal-back" @click.self="mOpen = false">
      <div class="smodal">
        <div class="smodal-title">{{ mEditTarget === null ? 'บันทึกการวัด' : 'แก้ไขผลการวัด' }} · {{ open?.firstName }} {{ open?.lastName }}</div>
        <div class="field">
          <label>วันที่วัด</label>
          <ThaiDateField
            v-model="mForm.date"
            :year-min="2555"
            :year-max="measureYearMax"
          />
          <div v-if="mErrors.date" class="field-err">{{ mErrors.date }}</div>
        </div>
        <div class="form-grid">
          <div class="field">
            <label>ภาคเรียนที่</label>
            <select v-model="mForm.term">
              <option value="1">1</option>
              <option value="2">2</option>
            </select>
          </div>
          <div class="field">
            <label>ครั้งที่</label>
            <select v-model="mForm.round">
              <option value="1">1</option>
              <option value="2">2</option>
            </select>
          </div>
        </div>
        <div class="form-grid">
          <div class="field">
            <label>น้ำหนัก (กก.)</label>
            <input v-model="mForm.w" type="number" step="0.1" inputmode="decimal" />
            <div v-if="mErrors.w" class="field-err">{{ mErrors.w }}</div>
          </div>
          <div class="field">
            <label>ส่วนสูง (ซม.)</label>
            <input v-model="mForm.h" type="number" step="0.1" inputmode="decimal" />
            <div v-if="mErrors.h" class="field-err">{{ mErrors.h }}</div>
          </div>
        </div>
        <!-- dup warn -->
        <div v-if="dupWarn" style="background: var(--warn-tint); border: 1px solid var(--warn); border-radius: var(--r); padding: var(--s3); margin-bottom: var(--s3); color: var(--warn); font-size: 14px">
          ⚠️ มีผลการวัดสำหรับรอบนี้อยู่แล้ว ยืนยันจะบันทึกเพิ่มหรือไม่?
          <div style="display: flex; gap: var(--s2); margin-top: var(--s2)">
            <button class="btn quiet" @click="dupWarn = false">ยกเลิก</button>
            <button class="btn primary" @click="saveMeasure(true)">ยืนยัน บันทึกเพิ่ม</button>
          </div>
        </div>
        <div class="smodal-foot">
          <button class="btn quiet" @click="mOpen = false">ยกเลิก</button>
          <span class="spacer"></span>
          <button v-if="!dupWarn" class="btn primary" @click="saveMeasure()">บันทึก</button>
        </div>
      </div>
    </div>

    <!-- lightweight guard when classroom/grade changes -->
    <div v-if="gradeConfirm" class="smodal-back" @click.self="gradeConfirm = false">
      <div class="smodal">
        <div class="smodal-title">ย้ายชั้น/ห้องของนักเรียน?</div>
        <p style="color: var(--ink-muted)">
          {{ open?.firstName }} {{ open?.lastName }} จะย้ายไปอยู่ <b>{{ sForm.grade }}/{{ sForm.room }}</b>
          ตั้งแต่นี้เป็นต้นไป ผลการวัดที่บันทึกไว้แล้วยังคงแสดงชั้นเดิม ณ เวลาที่วัด
        </p>
        <div class="smodal-foot">
          <button class="btn quiet" @click="gradeConfirm = false">ยกเลิก</button>
          <span class="spacer"></span>
          <button class="btn primary" @click="applyStudentEdit">ยืนยันการย้าย</button>
        </div>
      </div>
    </div>

    <!-- ===== confirm dialogs ===== -->
    <div v-if="delStudent" class="smodal-back" @click.self="delStudent = false">
      <div class="smodal">
        <div class="smodal-title">ลบนักเรียน?</div>
        <p style="color: var(--ink-muted)">จะลบ <b>{{ open?.firstName }} {{ open?.lastName }}</b> และประวัติการวัดทั้งหมดของนักเรียนคนนี้ การลบนี้ย้อนกลับไม่ได้</p>
        <div class="smodal-foot">
          <button class="btn quiet" @click="delStudent = false">ยกเลิก</button>
          <span class="spacer"></span>
          <button class="btn danger" @click="confirmDelStudent">ลบนักเรียน</button>
        </div>
      </div>
    </div>

    <div v-if="delMeasureTarget !== null" class="smodal-back" @click.self="delMeasureTarget = null">
      <div class="smodal">
        <div class="smodal-title">ลบผลการวัดนี้?</div>
        <p style="color: var(--ink-muted)">จะลบผลการวัดวันที่ {{ delMeasureTarget?.date }} ออกจากประวัติ</p>
        <div class="smodal-foot">
          <button class="btn quiet" @click="delMeasureTarget = null">ยกเลิก</button>
          <span class="spacer"></span>
          <button class="btn danger" @click="confirmDelMeasure">ลบ</button>
        </div>
      </div>
    </div>

    <!-- standardized per-room Excel import -->
    <ImportDialog
      :open="importOpen"
      kind="student"
      :grade="grade"
      :room="room"
      @imported="onImported"
      @close="importOpen = false"
    />

    <!-- toast -->
    <Transition name="toast"><div v-if="toast" class="toast">✓ {{ toast }}</div></Transition>
  </div>
</template>

<style scoped>
/* use more of the screen so the history's 4 criteria columns fit without scrolling */
.container.students-wide { max-width: 1180px; }
.avatar { width: 64px; height: 64px; border-radius: 50%; background: var(--brand-tint); display: grid; place-items: center; font-size: 34px; }
.prof-head { display: flex; gap: var(--s4); align-items: center; flex-wrap: wrap; }
.prof-actions { display: flex; gap: var(--s2); flex-shrink: 0; }
.prof-actions .btn { min-height: 38px; padding: 0 14px; font-size: 14.5px; }
.muted-note { color: var(--ink-muted); font-size: 13px; margin-top: var(--s3); }

/* stacked growth chart cards */
.chart-card { border: 1px solid var(--line); border-radius: var(--r); padding: var(--s4); margin-bottom: var(--s4); background: var(--surface); box-shadow: var(--shadow-sm); }
.chart-card:last-child { margin-bottom: 0; }
.chart-heading { font-size: 14px; font-weight: 700; color: var(--ink); margin-bottom: var(--s3); }

/* classroom action cards (in-context: import / template / export) */
.room-actions { display: grid; grid-template-columns: repeat(auto-fit, minmax(230px, 1fr)); gap: var(--s3); margin-bottom: var(--s4); }
.act-card {
  display: flex; gap: var(--s3); align-items: flex-start; text-align: left;
  background: var(--surface); border: 1px solid var(--line); border-radius: var(--rounded-md, 16px);
  padding: var(--s3) var(--s4); cursor: pointer; transition: border-color 120ms var(--ease), background 120ms var(--ease);
}
.act-card:hover { border-color: var(--brand); background: var(--brand-tint); }
.act-card:disabled { opacity: 0.5; cursor: not-allowed; }
.act-ico { font-size: 22px; line-height: 1.2; flex-shrink: 0; }
.act-body { display: flex; flex-direction: column; gap: 2px; }
.act-title { font-weight: 700; color: var(--ink); }
.act-desc { font-size: 13px; color: var(--ink-muted); line-height: 1.4; }

/* row + chip actions */
.rowact { white-space: nowrap; text-align: right; }
.linkbtn { border: none; background: transparent; color: var(--brand-ink); font-weight: 600; font-size: 14px; padding: 4px 8px; border-radius: 8px; cursor: pointer; }
.linkbtn:hover { background: var(--brand-tint); }
.linkbtn.danger { color: var(--bad); }
.linkbtn.danger:hover { background: var(--bad-tint); }
.chipbtn { border: 1px solid var(--line); background: var(--surface); border-radius: 999px; padding: 7px 14px; font-size: 13.5px; font-weight: 600; color: var(--ink-muted); cursor: pointer; display: inline-flex; align-items: center; gap: 6px; }
.chipbtn.on { background: var(--warn-tint); border-color: var(--warn); color: var(--warn); }
.chip-n { background: var(--warn); color: #fff; border-radius: 999px; padding: 0 7px; font-size: 12px; }
.chipbtn:not(.on) .chip-n { background: var(--line); color: var(--ink-muted); }

/* dialog */
.smodal-back { position: fixed; inset: 0; z-index: var(--z-modal); background: oklch(0.3 0.02 220 / 0.4); display: grid; place-items: center; padding: var(--s4); }
.smodal { background: var(--surface); border-radius: var(--r); box-shadow: var(--shadow); width: 100%; max-width: 460px; padding: var(--s5); animation: pop-in 200ms var(--ease) both; }
.smodal-title { font-size: 19px; font-weight: 700; margin-bottom: var(--s4); }
.smodal .field { margin-bottom: var(--s3); }
.smodal-foot { display: flex; align-items: center; margin-top: var(--s5); }
.smodal-foot .spacer { flex: 1; }
.field-err { color: var(--bad); font-size: 13px; margin-top: 4px; }

/* toast */
.toast { position: fixed; bottom: calc(var(--s6) + 56px); left: 50%; transform: translateX(-50%); z-index: var(--z-toast); background: var(--ink); color: #fff; padding: 12px 20px; border-radius: 999px; font-weight: 600; font-size: 14.5px; box-shadow: var(--shadow); }
.toast-enter-active, .toast-leave-active { transition: opacity 200ms var(--ease), transform 200ms var(--ease); }
.toast-enter-from, .toast-leave-to { opacity: 0; transform: translate(-50%, 10px); }

.crumb { display: flex; align-items: center; gap: 8px; margin-bottom: var(--s4); font-size: 15px; }
.crumb button { border: none; background: transparent; color: var(--ink-muted); font-weight: 600; padding: 4px 8px; border-radius: 8px; cursor: pointer; }
.crumb button:hover { background: var(--surface-2); }
.crumb button.on { color: var(--brand-ink); background: var(--brand-tint); }
.crumb span { color: var(--line); }

.import-toolbar { display: flex; justify-content: flex-end; gap: var(--s2); flex-wrap: wrap; margin-bottom: var(--s4); }

.browse-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); gap: var(--s4); }
.browse-card {
  text-align: left; background: var(--surface); border: 1px solid var(--line);
  border-radius: var(--r); padding: var(--s4); box-shadow: var(--shadow-sm);
  display: flex; flex-direction: column; gap: 8px;
  transition: transform 150ms var(--ease), box-shadow 150ms var(--ease), border-color 150ms var(--ease);
}
.browse-card:hover { transform: translateY(-2px); box-shadow: var(--shadow); border-color: var(--brand); }
.bc-top { display: flex; align-items: baseline; justify-content: space-between; }
.bc-name { font-size: 22px; font-weight: 800; color: var(--ink); }
.bc-count { font-size: 13px; color: var(--ink-muted); font-weight: 600; }
.bc-sub { font-size: 13.5px; color: var(--ink-muted); }
.bc-bar { height: 6px; border-radius: 999px; background: var(--surface-2); overflow: hidden; margin-top: 2px; }
.bc-fill { height: 100%; background: var(--brand); border-radius: 999px; transform-origin: left; animation: grow-x 640ms var(--ease) both; }
</style>
