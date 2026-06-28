<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useData } from '../stores/data';
import { useHeader } from '../stores/header';
import { serializeBackup, parseBackup } from '../domain/transfer/backup';
import { gradesUpTo } from '../domain/grade/ladder';
import type { Setup } from '../domain/types';

const emit = defineEmits<{ go: [tab: string] }>();

const data = useData();
const header = useHeader();
onMounted(() => header.setHeader({ title: 'ตั้งค่า', back: null, context: 'year' }));

// --- reset confirm ---
const resetConfirm = ref('');

// --- restore confirm ---
const openConfirm = ref(false);
const pendingRestore = ref<ReturnType<typeof parseBackup> | null>(null);

// --- toast ---
const toastMsg = ref('');
let toastTimer: ReturnType<typeof setTimeout> | null = null;
function showToast(msg: string) {
  toastMsg.value = msg;
  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { toastMsg.value = ''; }, 3000);
}

// --- backup overdue display ---
const backupDays = computed(() => data.backupOverdueDays);
const backupLabel = computed(() => {
  if (data.lastBackupAt === 0) return 'ยังไม่เคยเก็บข้อมูล';
  const d = backupDays.value;
  if (d === 0) return 'เก็บล่าสุดวันนี้';
  return `เก็บล่าสุด ${d} วันก่อน`;
});

// --- academic-year context: latest measure date ---
const latestMeasure = computed(() => {
  if (!data.measures.length) return null;
  return [...data.measures].sort((a, b) => b.savedAt - a.savedAt)[0];
});

// --- classroom structure grouped by education level (scannable summary) ---
const LEVELS: { name: string; test: (g: string) => boolean }[] = [
  { name: 'อนุบาล', test: (g) => g.startsWith('อ.') },
  { name: 'ประถมศึกษา', test: (g) => g.startsWith('ป.') },
  { name: 'มัธยมต้น', test: (g) => ['ม.1', 'ม.2', 'ม.3'].includes(g) },
  { name: 'มัธยมปลาย', test: (g) => ['ม.4', 'ม.5', 'ม.6'].includes(g) },
];
const structureByLevel = computed(() =>
  LEVELS.map((l) => ({ name: l.name, grades: data.structure.filter((s) => l.test(s.grade)) })).filter(
    (l) => l.grades.length,
  ),
);

// --- school edit ---
const editingSchool = ref(false);
const schoolDraft = ref<Setup>({ ...data.setup });
function startEditSchool() {
  schoolDraft.value = { ...data.setup };
  editingSchool.value = true;
}
function saveSchool() {
  data.saveSetup({ ...schoolDraft.value });
  editingSchool.value = false;
  showToast('บันทึกข้อมูลโรงเรียนแล้ว');
}

// --- period edit ---
const editingPeriod = ref(false);
const periodDraft = ref<{ year: string }>({ year: data.period.year });
function startEditPeriod() {
  periodDraft.value = { year: data.period.year };
  editingPeriod.value = true;
}
function savePeriod() {
  data.setPeriod({ year: periodDraft.value.year });
  editingPeriod.value = false;
  showToast('บันทึกปีการศึกษาแล้ว');
}

// --- classroom structure edit ---
const editingClassrooms = ref(false);
const classroomDraft = ref<{ grade: string; rooms: number }[]>([]);
const removalBlockers = ref<{ grade: string; room: string; count: number }[]>([]);
function startEditClassrooms() {
  const existingMap = new Map(data.structure.map((s) => [s.grade, s.rooms.length]));
  const grades = data.setup.maxGrade
    ? gradesUpTo(data.setup.maxGrade)
    : data.structure.map((s) => s.grade);
  classroomDraft.value = grades.map((grade) => ({
    grade,
    rooms: existingMap.get(grade) ?? 1,
  }));
  removalBlockers.value = [];
  editingClassrooms.value = true;
}
function saveClassrooms() {
  // Block any change that would orphan students still in a dropped grade/room.
  const blockers = data.classroomRemovalBlockers(classroomDraft.value);
  if (blockers.length) {
    removalBlockers.value = blockers;
    return;
  }
  data.setClassrooms(
    classroomDraft.value.map((g) => ({
      grade: g.grade,
      rooms: Array.from({ length: Math.max(0, g.rooms) }, (_, i) => String(i + 1)),
    })),
  );
  removalBlockers.value = [];
  editingClassrooms.value = false;
  showToast('บันทึกโครงสร้างชั้นเรียนแล้ว');
}

// --- backup download ---
function doBackup() {
  const json = serializeBackup({
    students: data.students,
    measures: data.measures,
    setup: data.setup,
    period: data.period,
    classrooms: data.classrooms,
  });
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  const ts = new Date().toISOString().slice(0, 10);
  a.download = `nutrition-backup-${ts}.json`;
  a.click();
  URL.revokeObjectURL(url);
  data.markBackup();
  showToast('บันทึกไฟล์สำรองแล้ว');
}

// --- restore file input ---
const restoreInput = ref<HTMLInputElement | null>(null);
function pickRestoreFile() {
  restoreInput.value?.click();
}
function onRestoreFile(e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (ev) => {
    try {
      const parsed = parseBackup(ev.target?.result as string);
      pendingRestore.value = parsed;
      openConfirm.value = true;
    } catch (err) {
      showToast((err as Error).message);
    }
  };
  reader.readAsText(file);
  // reset input so same file can be chosen again
  (e.target as HTMLInputElement).value = '';
}
function confirmRestore() {
  if (!pendingRestore.value) return;
  data.replaceAll(pendingRestore.value);
  openConfirm.value = false;
  pendingRestore.value = null;
  showToast('กู้คืนข้อมูลสำเร็จ — กำลังโหลดใหม่');
  setTimeout(() => location.reload(), 1000);
}
function cancelRestore() {
  openConfirm.value = false;
  pendingRestore.value = null;
}

// --- reset all ---
function doReset() {
  if (resetConfirm.value !== 'ลบข้อมูล') return;
  localStorage.clear();
  location.reload();
}
</script>

<template>
  <div class="container">
    <p class="page-sub">ข้อมูลโรงเรียน ปีการศึกษา และการดูแลข้อมูล (โปรแกรมนี้เก็บข้อมูลในเครื่องนี้เท่านั้น)</p>

    <!-- toast -->
    <div v-if="toastMsg" class="callout info" style="margin-bottom: var(--s4)">{{ toastMsg }}</div>

    <div class="group-head">การตั้งค่าระบบ</div>

    <!-- config -->
    <div class="panel">
      <div class="toolbar">
        <div class="section-title" style="margin: 0">ข้อมูลโรงเรียน</div>
        <span class="spacer"></span>
        <button class="btn" @click="startEditSchool">แก้ไข</button>
      </div>
      <div style="color: var(--ink-muted)">{{ data.setup.school }} · จ.{{ data.setup.province }} · ครูอนามัย {{ data.setup.teacher }}</div>
      <div v-if="editingSchool" style="margin-top: var(--s3)">
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: var(--s2); margin-bottom: var(--s3)">
          <label style="grid-column: 1/-1">
            <div style="font-size: 13px; color: var(--ink-muted); margin-bottom: 2px">ชื่อโรงเรียน</div>
            <input class="search" v-model="schoolDraft.school" style="width: 100%" />
          </label>
          <label>
            <div style="font-size: 13px; color: var(--ink-muted); margin-bottom: 2px">จังหวัด</div>
            <input class="search" v-model="schoolDraft.province" style="width: 100%" />
          </label>
          <label>
            <div style="font-size: 13px; color: var(--ink-muted); margin-bottom: 2px">ชื่อครู</div>
            <input class="search" v-model="schoolDraft.teacher" style="width: 100%" />
          </label>
        </div>
        <div style="display: flex; gap: var(--s2)">
          <button class="btn primary" @click="saveSchool">บันทึก</button>
          <button class="btn quiet" @click="editingSchool = false">ยกเลิก</button>
        </div>
      </div>
    </div>

    <div class="panel">
      <div class="toolbar">
        <div class="section-title" style="margin: 0">ปีการศึกษาปัจจุบัน</div>
        <span class="spacer"></span>
        <button class="btn" @click="startEditPeriod">เปลี่ยนปีการศึกษา</button>
      </div>
      <div class="ctx-grid">
        <div class="ctx"><div class="ctx-k">ปีการศึกษา</div><div class="ctx-v">{{ data.period.year }}</div></div>
        <div class="ctx">
          <div class="ctx-k">บันทึกการวัดล่าสุด</div>
          <div class="ctx-v">{{ latestMeasure ? latestMeasure.date : 'ยังไม่มีการวัด' }}</div>
        </div>
      </div>
      <div v-if="editingPeriod" style="margin-top: var(--s3)">
        <div style="display: flex; gap: var(--s2); margin-bottom: var(--s3)">
          <label>
            <div style="font-size: 13px; color: var(--ink-muted); margin-bottom: 2px">ปีการศึกษา</div>
            <input class="search" v-model="periodDraft.year" style="width: 90px" />
          </label>
        </div>
        <div style="display: flex; gap: var(--s2)">
          <button class="btn primary" @click="savePeriod">บันทึก</button>
          <button class="btn quiet" @click="editingPeriod = false">ยกเลิก</button>
        </div>
      </div>
    </div>

    <!-- classroom structure -->
    <div class="panel">
      <div class="toolbar">
        <div class="section-title" style="margin: 0">โครงสร้างชั้นเรียน</div>
        <span class="spacer"></span>
        <button class="btn" @click="startEditClassrooms">แก้ไข</button>
      </div>
      <div v-if="structureByLevel.length === 0" style="color: var(--ink-muted)">ยังไม่ได้กำหนดห้องเรียน</div>
      <div v-else class="lvl-list">
        <div v-for="lv in structureByLevel" :key="lv.name" class="lvl-row">
          <div class="lvl-name">{{ lv.name }}</div>
          <div class="lvl-grades">
            <span v-for="s in lv.grades" :key="s.grade" class="lvl-chip">{{ s.grade }} · {{ s.rooms.length }} ห้อง</span>
          </div>
        </div>
      </div>
      <div v-if="editingClassrooms" style="margin-top: var(--s3)">
        <div class="mrow head" style="grid-template-columns: 1fr 160px"><div>ชั้น</div><div>จำนวนห้อง</div></div>
        <div v-for="g in classroomDraft" :key="g.grade" class="mrow" style="grid-template-columns: 1fr 160px">
          <div class="nm">{{ g.grade }}</div>
          <input type="number" v-model.number="g.rooms" style="max-width: 90px" min="0" />
        </div>
        <div v-if="removalBlockers.length" class="callout bad" style="margin-top: var(--s3)">
          <div class="ct">⚠️ ลดห้องไม่ได้ เพราะยังมีนักเรียนอยู่</div>
          ย้ายนักเรียน เลื่อนชั้น หรือลบออกก่อน จึงจะลดห้องเหล่านี้ได้:
          <ul style="margin: var(--s2) 0 0; padding-left: 1.2em">
            <li v-for="b in removalBlockers" :key="b.grade + b.room">{{ b.grade }}/{{ b.room }} — {{ b.count }} คน</li>
          </ul>
        </div>
        <div style="display: flex; gap: var(--s2); margin-top: var(--s3)">
          <button class="btn primary" @click="saveClassrooms">บันทึก</button>
          <button class="btn quiet" @click="editingClassrooms = false">ยกเลิก</button>
        </div>
      </div>
    </div>

    <div class="group-head">การสำรองข้อมูล</div>

    <!-- Backup / restore (safety — replace) -->
    <div class="panel">
      <div class="section-title">การสำรองข้อมูล</div>
      <p class="grp-sub">เก็บสำเนาข้อมูลไว้กันหาย และเปิดกลับมาใช้เมื่อย้ายเครื่องหรือข้อมูลสูญหาย</p>

      <div class="goal">
        <div class="goal-ico">💾</div>
        <div class="goal-body">
          <div class="goal-t">สำรองข้อมูล</div>
          <div class="goal-d">บันทึกสำเนาข้อมูลทั้งหมดเป็นไฟล์ไว้กับตัว เผื่อคอมพิวเตอร์เสียหรือข้อมูลหาย</div>
          <div class="lastbackup" :class="{ stale: backupDays >= 7 }">
            {{ backupDays >= 7 || data.lastBackupAt === 0 ? '⚠️' : '✓' }} {{ backupLabel }}
          </div>
        </div>
        <button class="btn primary" @click="doBackup">สำรองข้อมูล</button>
      </div>

      <div class="goal">
        <div class="goal-ico">📂</div>
        <div class="goal-body">
          <div class="goal-t">เปิดข้อมูลสำรอง</div>
          <div class="goal-d">นำไฟล์สำรองที่เคยบันทึกไว้กลับมาใช้ เมื่อเปลี่ยนเครื่องใหม่ หรือข้อมูลหาย</div>
          <div v-if="openConfirm" class="callout bad" style="margin: var(--s3) 0 0">
            <div class="ct">⚠️ ข้อมูลในเครื่องนี้จะถูกแทนที่ทั้งหมด</div>
            ควร "สำรองข้อมูล" ของตอนนี้ไว้ก่อน
            <div style="display: flex; gap: 8px; margin-top: var(--s3)">
              <button class="btn danger" style="min-height: 38px" @click="confirmRestore">นำมาใช้และแทนที่</button>
              <button class="btn quiet" style="min-height: 38px" @click="cancelRestore">ยกเลิก</button>
            </div>
          </div>
        </div>
        <button v-if="!openConfirm" class="btn" @click="pickRestoreFile">เปิดไฟล์สำรอง</button>
        <input ref="restoreInput" type="file" accept=".json" style="display:none" @change="onRestoreFile" />
      </div>
    </div>

    <!-- TIME-BASED TASK -->
    <div class="panel">
      <div class="section-title">งานประจำปี</div>
      <div class="goal">
        <div class="goal-ico">🎓</div>
        <div class="goal-body">
          <div class="goal-t">ขึ้นปีการศึกษาใหม่</div>
          <div class="goal-d">เลื่อนนักเรียนทั้งโรงเรียนขึ้นชั้น และจัดการผู้จบการศึกษาอย่างปลอดภัย</div>
        </div>
        <button class="btn primary" @click="emit('go', 'promotion')">เริ่มเลื่อนชั้น</button>
      </div>
      <div class="callout info" style="margin-bottom: 0">
        ℹ️ ต้องการเอกสารหรือรายงานส่งหน่วยงาน? ไปที่เมนู "รายงาน"
      </div>
    </div>

    <!-- danger -->
    <div class="panel" style="border-color: var(--bad-tint)">
      <div class="section-title" style="color: var(--bad)">⚠️ ล้างข้อมูลทั้งหมด</div>
      <div style="color: var(--ink-muted); margin-bottom: var(--s3)">ลบข้อมูลทั้งหมดในเครื่องนี้เพื่อเริ่มใหม่ การลบนี้ย้อนกลับไม่ได้หากไม่มีไฟล์สำรอง</div>
      <div class="callout bad"><b>โปรดสำรองข้อมูลก่อน</b> แล้วพิมพ์คำว่า "ลบข้อมูล" เพื่อยืนยัน</div>
      <div style="display: flex; gap: var(--s3)">
        <input class="search" v-model="resetConfirm" placeholder="พิมพ์ ลบข้อมูล" style="max-width: 200px" />
        <button class="btn danger" :disabled="resetConfirm !== 'ลบข้อมูล'" @click="doReset">ล้างข้อมูลทั้งหมด</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.goal { display: flex; gap: var(--s4); align-items: flex-start; padding: var(--s4) 0; border-bottom: 1px solid var(--line-soft); }
.goal:last-of-type { border-bottom: none; }
.goal-ico { font-size: 26px; width: 36px; text-align: center; flex-shrink: 0; }
.goal-body { flex: 1; min-width: 0; }
.grp-sub { color: var(--ink-muted); font-size: 14.5px; margin: -8px 0 var(--s3); }
.lastbackup { font-size: 13.5px; font-weight: 600; color: var(--good); margin-top: 6px; }
.lastbackup.stale { color: var(--warn); }
.goal-t { font-weight: 700; font-size: 16.5px; }
.goal-d { color: var(--ink-muted); font-size: 14.5px; margin-top: 2px; }
.goal > .btn { flex-shrink: 0; }

/* zone grouping header */
.group-head {
  font-size: 13px; font-weight: 700; letter-spacing: 0.02em; color: var(--ink-muted);
  margin: var(--s5) 0 var(--s3); padding-bottom: 6px; border-bottom: 1px solid var(--line);
}
.group-head:first-of-type { margin-top: 0; }

/* academic-year context grid */
.ctx-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: var(--s3) var(--s4); }
.ctx-k { font-size: 13px; color: var(--ink-muted); }
.ctx-v { font-size: 16px; font-weight: 700; color: var(--ink); margin-top: 2px; }

/* classroom structure by level */
.lvl-list { display: flex; flex-direction: column; gap: var(--s3); }
.lvl-row { display: grid; grid-template-columns: 110px 1fr; gap: var(--s3); align-items: baseline; }
.lvl-name { font-weight: 700; font-size: 14.5px; color: var(--ink); }
.lvl-grades { display: flex; flex-wrap: wrap; gap: 6px; }
.lvl-chip {
  font-size: 13px; color: var(--ink-muted); background: var(--surface-2);
  border-radius: 8px; padding: 3px 10px;
}
@media (max-width: 560px) { .lvl-row { grid-template-columns: 1fr; gap: 4px; } }
@media (max-width: 560px) {
  .goal { flex-wrap: wrap; }
  .goal > .btn { width: 100%; }
}
</style>
