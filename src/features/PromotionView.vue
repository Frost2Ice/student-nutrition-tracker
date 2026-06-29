<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import Stepper from '../components/Stepper.vue';
import { useData } from '../stores/data';
import { serializeBackup } from '../domain/transfer/backup';
import { aoaToXlsxBlob, graduatesToAoa } from '../domain/transfer/xlsx';
import { downloadBlob } from './download';
import { planPromotion } from '../domain/promotion/promote';
import { promote as promoteGrade } from '../domain/grade/ladder';
import { buildNextYear, type RolloverDecision } from '../domain/year/rollover';
import type { Decision } from '../domain/promotion/promote';
import { useSchool } from '../stores/school';

const emit = defineEmits<{ done: []; exit: [] }>();

const data = useData();
const school = useSchool();

// Rolling the year over always operates on the active (editable) year, even if the
// teacher launched this while viewing an archived one.
onMounted(() => data.viewActive());

const steps = ['เริ่มต้น', 'สำรองข้อมูล', 'ตรวจสอบ', 'ผู้จบการศึกษา', 'ยืนยัน', 'เสร็จสิ้น'];
const i = ref(0);
const backupDone = ref(false);
const exportDone = ref(false);

const fromYear = computed(() => data.period.year);
const toYear = computed(() => String(Number(data.period.year) + 1));

// Plan: split students into graduate vs promote
const plan = computed(() =>
  planPromotion(
    data.students.map((s) => ({ id: s.id, grade: s.grade })),
    data.setup.maxGrade,
  ),
);

// Effective action per student = explicit override, else plan default
// (max-grade → graduate, otherwise promote). Single source of truth for
// counts, the export file, and the confirm step.
function effectiveAction(id: string): Decision['action'] {
  const override = decisions.value[id];
  if (override) return override.action;
  return plan.value.graduate.some((g) => g.id === id) ? 'graduate' : 'promote';
}

const graduateStudents = computed(() =>
  data.students.filter((s) => effectiveAction(s.id) === 'graduate'),
);

const gradeFilename = computed(
  () => `รายชื่อนักเรียนจบการศึกษา ปีการศึกษา ${fromYear.value}.xlsx`,
);

// Preview rows: group by grade
const previewRows = computed(() => {
  const gradeMap = new Map<string, { from: string; to: string; n: number; grad: boolean }>();
  for (const s of data.students) {
    const isGrad = plan.value.graduate.some((g) => g.id === s.id);
    const to = isGrad ? 'จบการศึกษา' : promoteGrade(s.grade);
    if (!gradeMap.has(s.grade)) {
      gradeMap.set(s.grade, { from: s.grade, to, n: 0, grad: isGrad });
    }
    gradeMap.get(s.grade)!.n++;
  }
  return [...gradeMap.values()].sort((a, b) => {
    // sort by grade order
    const order = ['อ.1','อ.2','อ.3','ป.1','ป.2','ป.3','ป.4','ป.5','ป.6','ม.1','ม.2','ม.3','ม.4','ม.5','ม.6'];
    return order.indexOf(a.from) - order.indexOf(b.from);
  });
});

const promoteCount = computed(
  () => data.students.filter((s) => effectiveAction(s.id) === 'promote').length,
);
const graduateCount = computed(
  () => data.students.filter((s) => effectiveAction(s.id) === 'graduate').length,
);

// Per-student override decisions map
const decisions = ref<Record<string, Decision>>({});

function getDecision(id: string): Decision {
  return decisions.value[id] ?? { action: 'promote' };
}

function setAction(id: string, action: Decision['action']) {
  decisions.value[id] = { ...getDecision(id), action };
}

function setRoom(id: string, room: string) {
  decisions.value[id] = { ...getDecision(id), room };
}

// Search state for per-student adjustment panel
const searchQ = ref('');
const selectedId = ref<string | null>(null);

const searchResults = computed(() => {
  const q = searchQ.value.trim();
  if (!q) return [];
  return data.students
    .filter((s) => s.id.includes(q) || `${s.firstName} ${s.lastName}`.includes(q))
    .slice(0, 20);
});

const selectedStudent = computed(() =>
  selectedId.value ? data.students.find((s) => s.id === selectedId.value) ?? null : null,
);

function selectStudent(id: string) {
  selectedId.value = id;
  searchQ.value = '';
}

function clearSelection() {
  selectedId.value = null;
}

function resetDecision(id: string) {
  const d = { ...decisions.value };
  delete d[id];
  decisions.value = d;
}

// Students with explicit overrides
const overrideList = computed(() =>
  data.students
    .filter((s) => decisions.value[s.id] !== undefined)
    .map((s) => ({ ...s, decision: decisions.value[s.id] })),
);

const repeatCount = computed(
  () => data.students.filter((s) => effectiveAction(s.id) === 'repeat').length,
);

function downloadBackup() {
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
  a.download = `nutrition-backup-before-promotion-${fromYear.value}.json`;
  a.click();
  URL.revokeObjectURL(url);
  data.markBackup();
  backupDone.value = true;
}

function downloadGraduates() {
  const blob = aoaToXlsxBlob(graduatesToAoa(graduateStudents.value), 'ผู้จบการศึกษา', [3]);
  downloadBlob(blob, gradeFilename.value);
  exportDone.value = true;
}

function confirm() {
  // Build final decisions: for max-grade students with no explicit decision, graduate them.
  const finalDecisions: Record<string, RolloverDecision> = { ...decisions.value };
  for (const s of plan.value.graduate) {
    if (!finalDecisions[s.id]) {
      finalDecisions[s.id] = { action: 'graduate' };
    }
  }
  // Non-destructive: the current year is frozen as-is and a NEW year snapshot is
  // created with promoted students. Graduates are simply not carried forward.
  const prev = school.activeYear ? school.loadYear(school.activeYear) : null;
  if (!prev) return;
  const next = buildNextYear(prev, finalDecisions, {
    year: toYear.value,
    teacher: data.setup.teacher,
    maxGrade: data.setup.maxGrade,
    classrooms: data.classrooms,
  });
  school.createYear(next); // archives the prior active year, opens the new one
  data.viewActive();
  i.value = 5;
}
</script>

<template>
  <div class="proto-screen proto-wide">
    <Stepper :steps="steps" :current="i" />

    <!-- 1 intro -->
    <div v-if="i === 0">
      <h1 class="page-title">เลื่อนชั้นปีการศึกษา</h1>
      <p class="page-sub">ตัวช่วยเลื่อนชั้นนักเรียนทั้งโรงเรียนเมื่อขึ้นปีการศึกษาใหม่ ทำปีละครั้ง ใช้เวลาประมาณ 5 นาที</p>
      <div class="panel">
        <div class="callout info">
          <div class="ct">📘 ตัวช่วยนี้จะพาคุณครูทำตามขั้นตอน</div>
          เลื่อนนักเรียนทุกคนขึ้น 1 ชั้น · นักเรียนชั้นสูงสุด ({{ data.setup.maxGrade }}) จะจบการศึกษา · เก็บไฟล์ผู้จบไว้ก่อนนำออก
        </div>
        <ul class="sum">
          <li><span>ปีการศึกษาปัจจุบัน</span><b>{{ fromYear }}</b></li>
          <li><span>กำลังจะเลื่อนไปเป็น</span><b>{{ toYear }}</b></li>
        </ul>
        <div class="callout good">
          <div class="ct">🛟 ปลอดภัย ย้อนกลับได้</div>
          ทุกขั้นตอนอธิบายชัดเจน เราจะสำรองข้อมูลให้ก่อน และไม่มีข้อมูลใดสูญหาย
        </div>
      </div>
      <div class="wiz-foot">
        <button class="btn quiet" @click="$emit('exit')">ออก</button>
        <span class="spacer"></span>
        <button class="btn primary lg" @click="i = 1">เริ่ม</button>
      </div>
    </div>

    <!-- 2 backup -->
    <div v-else-if="i === 1">
      <h1 class="page-title">สำรองข้อมูลก่อน</h1>
      <p class="page-sub">เพื่อความปลอดภัย เราจะบันทึกสำเนาข้อมูลทั้งหมดไว้ก่อน หากมีอะไรผิดพลาด คุณครูนำกลับมาได้</p>
      <div class="panel" style="text-align: center; padding: var(--s6)">
        <div style="font-size: 40px">💾</div>
        <p style="margin: var(--s3) 0; color: var(--ink-muted)">กดปุ่มเพื่อบันทึกไฟล์สำรองลงเครื่อง</p>
        <button class="btn primary lg" @click="downloadBackup">สำรองข้อมูลทั้งหมด</button>
        <div v-if="backupDone" class="callout good" style="margin-top: var(--s4)">✅ สำรองข้อมูลเรียบร้อยแล้ว</div>
      </div>
      <div class="wiz-foot">
        <button class="btn quiet" @click="i = 0">ย้อนกลับ</button>
        <span class="spacer"></span>
        <button class="btn primary lg" :disabled="!backupDone" @click="i = 2">ถัดไป: ตรวจสอบการเลื่อนชั้น</button>
      </div>
    </div>

    <!-- 3 review -->
    <div v-else-if="i === 2">
      <h1 class="page-title">ตรวจสอบการเลื่อนชั้น</h1>
      <p class="page-sub">ค่าเริ่มต้นคือเลื่อนทุกคนขึ้น 1 ชั้น และนักเรียนชั้นสูงสุดจะจบการศึกษา คุณครูปรับเฉพาะคนที่ต่างออกไปได้</p>

      <div class="panel">
        <div class="section-title" style="font-size: 16px">สรุปการเลื่อนชั้นทั้งโรงเรียน</div>
        <div style="border: 1px solid var(--line); border-radius: 12px; overflow: hidden">
          <div class="mrow head" style="grid-template-columns: 1fr 1fr 100px"><div>ชั้นเดิม</div><div>ชั้นใหม่</div><div>จำนวน</div></div>
          <div v-for="r in previewRows" :key="r.from" class="mrow" style="grid-template-columns: 1fr 1fr 100px">
            <div class="nm">{{ r.from }}</div>
            <div><span v-if="r.grad" class="pill warn">🎓 {{ r.to }}</span><span v-else>→ {{ r.to }}</span></div>
            <div>{{ r.n }} คน</div>
          </div>
        </div>
        <div class="callout info" style="margin-bottom: 0; margin-top: var(--s4)">รวม: เลื่อน {{ promoteCount }} คน · คงชั้นเดิม {{ repeatCount }} คน · จบการศึกษา {{ graduateCount }} คน</div>
      </div>

      <div class="panel">
        <div class="section-title" style="font-size: 16px">ปรับรายคน (กรณีพิเศษ)</div>
        <p class="hint" style="color: var(--ink-muted); margin-top: -6px; margin-bottom: var(--s3)">
          ค้นหาเฉพาะนักเรียนที่ต้องปรับเป็นกรณีพิเศษ เช่น ให้ซ้ำชั้น หรือย้ายห้อง
        </p>

        <!-- Search box (shown when no student selected) -->
        <div v-if="!selectedStudent">
          <input
            v-model="searchQ"
            class="search"
            style="width: 100%; box-sizing: border-box; margin-bottom: var(--s3)"
            placeholder="ค้นหาด้วยรหัสนักเรียนหรือชื่อ"
            autofocus
          />
          <div v-if="searchQ.trim() && searchResults.length === 0" style="color: var(--ink-muted); font-size: 14px; padding: var(--s2) 0">
            ไม่พบนักเรียน
          </div>
          <div v-for="s in searchResults" :key="s.id"
            style="border: 1px solid var(--line); border-radius: 10px; padding: var(--s2) var(--s4); margin-bottom: var(--s2); cursor: pointer; display: flex; justify-content: space-between; align-items: center"
            @click="selectStudent(s.id)"
          >
            <div>
              <div class="nm">{{ s.firstName }} {{ s.lastName }}</div>
              <div style="font-size: 12.5px; color: var(--ink-muted)">รหัส {{ s.id }} · {{ s.grade }}</div>
            </div>
            <span v-if="decisions[s.id]" class="pill warn" style="font-size: 12px">ปรับแล้ว</span>
            <span v-else style="font-size: 13px; color: var(--ink-muted)">เลือก →</span>
          </div>
        </div>

        <!-- Selected student override controls -->
        <div v-if="selectedStudent" style="border: 2px solid var(--brand); border-radius: 12px; padding: var(--s4)">
          <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: var(--s3)">
            <div>
              <div class="nm">{{ selectedStudent.firstName }} {{ selectedStudent.lastName }}</div>
              <div style="font-size: 12.5px; color: var(--ink-muted)">
                รหัส {{ selectedStudent.id }} · {{ selectedStudent.grade }}
                → {{ getDecision(selectedStudent.id).action === 'promote' ? promoteGrade(selectedStudent.grade) : getDecision(selectedStudent.id).action === 'repeat' ? selectedStudent.grade : 'จบการศึกษา' }}
              </div>
            </div>
            <button class="btn quiet" style="font-size: 13px; padding: 4px 10px" @click="clearSelection">← ค้นหาใหม่</button>
          </div>
          <div class="opt-row" style="margin: 0 0 var(--s3)">
            <button class="opt" :class="{ sel: getDecision(selectedStudent.id).action === 'promote' }" style="font-size: 13px" @click="setAction(selectedStudent.id, 'promote')">เลื่อนปกติ</button>
            <button class="opt" :class="{ sel: getDecision(selectedStudent.id).action === 'repeat' }" style="font-size: 13px" @click="setAction(selectedStudent.id, 'repeat')">ซ้ำชั้น</button>
            <button class="opt" :class="{ sel: getDecision(selectedStudent.id).action === 'graduate' }" style="font-size: 13px" @click="setAction(selectedStudent.id, 'graduate')">จบการศึกษา</button>
          </div>
          <div style="margin-bottom: var(--s3)">
            <span style="font-size: 13px; color: var(--ink-muted)">ห้องใหม่:</span>
            <template v-if="data.structure.find(g => g.grade === (getDecision(selectedStudent!.id).action === 'promote' ? promoteGrade(selectedStudent!.grade) : selectedStudent!.grade))?.rooms?.length">
              <span class="opt-row" style="display: inline-flex; margin-left: 6px">
                <button
                  v-for="r in data.structure.find(g => g.grade === (getDecision(selectedStudent!.id).action === 'promote' ? promoteGrade(selectedStudent!.grade) : selectedStudent!.grade))!.rooms"
                  :key="r"
                  class="opt"
                  :class="{ sel: getDecision(selectedStudent!.id).room === r }"
                  style="font-size: 13px; padding: 4px 12px"
                  @click="setRoom(selectedStudent!.id, r)"
                >{{ r }}</button>
              </span>
            </template>
            <template v-else>
              <input
                :value="getDecision(selectedStudent.id).room ?? ''"
                class="search"
                style="display: inline; width: 80px; margin-left: 6px; font-size: 13px; padding: 4px 8px"
                placeholder="ห้อง"
                @input="setRoom(selectedStudent.id, ($event.target as HTMLInputElement).value)"
              />
            </template>
          </div>
          <div style="display: flex; gap: var(--s2)">
            <button class="btn primary" style="font-size: 13px" @click="clearSelection">บันทึกและปิด</button>
            <button v-if="decisions[selectedStudent.id]" class="btn quiet" style="font-size: 13px; color: var(--red)" @click="resetDecision(selectedStudent.id); clearSelection()">ยกเลิกการปรับ</button>
          </div>
        </div>

        <!-- Override summary -->
        <div v-if="overrideList.length > 0" style="margin-top: var(--s4)">
          <div style="font-size: 13px; font-weight: 600; color: var(--ink-muted); margin-bottom: var(--s2)">ปรับแล้ว {{ overrideList.length }} คน</div>
          <div v-for="s in overrideList" :key="s.id"
            style="display: flex; align-items: center; gap: var(--s3); border: 1px solid var(--line); border-radius: 8px; padding: var(--s2) var(--s3); margin-bottom: var(--s2)"
          >
            <div style="flex: 1; min-width: 0">
              <span class="nm" style="font-size: 14px">{{ s.firstName }} {{ s.lastName }}</span>
              <span style="font-size: 12px; color: var(--ink-muted); margin-left: 6px">{{ s.grade }}</span>
              <span class="pill warn" style="font-size: 11px; margin-left: 6px">{{ s.decision.action === 'repeat' ? 'ซ้ำชั้น' : s.decision.action === 'graduate' ? 'จบการศึกษา' : 'เลื่อนปกติ' }}</span>
            </div>
            <button class="btn quiet" style="font-size: 12px; padding: 2px 8px" @click="selectStudent(s.id)">แก้ไข</button>
            <button class="btn quiet" style="font-size: 12px; padding: 2px 8px; color: var(--red)" @click="resetDecision(s.id)">ยกเลิก</button>
          </div>
        </div>
      </div>

      <div class="wiz-foot">
        <button class="btn quiet" @click="i = 1">ย้อนกลับ</button>
        <span class="spacer"></span>
        <button class="btn primary lg" @click="i = 3">ถัดไป: ผู้จบการศึกษา</button>
      </div>
    </div>

    <!-- 4 graduates export (required) -->
    <div v-else-if="i === 3">
      <h1 class="page-title">เก็บข้อมูลผู้จบการศึกษา</h1>
      <p class="page-sub">นักเรียน {{ graduateCount }} คนนี้จบการศึกษาแล้ว และจะถูกนำออกจากทะเบียนนักเรียนที่ใช้งานอยู่ ก่อนนำออกต้องดาวน์โหลดไฟล์เก็บไว้ก่อน</p>
      <div class="panel">
        <div class="callout warn">
          <div class="ct">🎓 มีนักเรียนจบการศึกษา {{ graduateCount }} คน</div>
          เมื่อเลื่อนชั้นเสร็จ นักเรียนกลุ่มนี้จะถูก <b>นำออกจากทะเบียนนักเรียน</b> เพราะจบการศึกษาแล้ว ไฟล์ที่ดาวน์โหลดคือบันทึกของพวกเขา
        </div>

        <div style="border: 2px solid var(--brand); border-radius: var(--r); padding: var(--s5); margin: var(--s4) 0; background: var(--brand-tint)">
          <div style="display: flex; align-items: center; gap: 8px; margin-bottom: var(--s3)">
            <span class="pill bad">จำเป็น</span>
            <b style="color: var(--brand-ink)">ขั้นตอนที่ต้องทำก่อนไปต่อ</b>
          </div>
          <div class="eyebrow" style="margin-bottom: 6px">ไฟล์ที่จะดาวน์โหลด (มีรายชื่อ + ประวัติการวัดทั้งหมด)</div>
          <span class="file-chip" style="background: #fff">📄 {{ gradeFilename }}</span>
          <div style="margin-top: var(--s4)">
            <button v-if="!exportDone" class="btn primary lg block" @click="downloadGraduates">⬇️ ดาวน์โหลด Excel (จำเป็น)</button>
            <div v-else class="callout good" style="margin: 0">
              <div class="ct">✅ ดาวน์โหลดเรียบร้อย</div>
              เก็บไฟล์นี้ไว้ใช้อ้างอิง ตอนนี้กด"ถัดไป" เพื่อไปต่อได้แล้ว
            </div>
          </div>
        </div>

        <p v-if="!exportDone" class="hint" style="color: var(--ink-muted); text-align: center">
          🔒 ปุ่ม "ถัดไป" จะใช้ได้หลังจากดาวน์โหลดไฟล์เสร็จเท่านั้น
        </p>
      </div>
      <div class="wiz-foot">
        <button class="btn quiet" @click="i = 2">ย้อนกลับ</button>
        <span class="spacer"></span>
        <button class="btn primary lg" :disabled="!exportDone" @click="i = 4">ถัดไป: ยืนยัน</button>
      </div>
    </div>

    <!-- 5 confirm -->
    <div v-else-if="i === 4">
      <h1 class="page-title">ยืนยันการเลื่อนชั้น</h1>
      <p class="page-sub">ตรวจสอบสรุปอีกครั้ง เมื่อยืนยันแล้วระบบจะปรับชั้นและย้ายผู้จบออกจากรายชื่อ</p>
      <div class="panel">
        <ul class="sum">
          <li><span>เลื่อนขึ้นชั้นถัดไป</span><b>{{ promoteCount }} คน</b></li>
          <li><span>คงชั้นเดิม (ซ้ำชั้น)</span><b>{{ repeatCount }} คน</b></li>
          <li><span>จบการศึกษา (นำออกจากทะเบียน · มีไฟล์เก็บแล้ว)</span><b>{{ graduateCount }} คน</b></li>
          <li><span>ปีการศึกษาใหม่</span><b>{{ toYear }} · ภาคเรียน 1</b></li>
        </ul>
        <div class="callout good">✅ สำรองข้อมูลแล้ว · ✅ บันทึกไฟล์ผู้จบแล้ว</div>
      </div>
      <div class="wiz-foot">
        <button class="btn quiet" @click="i = 3">ย้อนกลับ</button>
        <span class="spacer"></span>
        <button class="btn primary lg" @click="confirm">ยืนยันการเลื่อนชั้น</button>
      </div>
    </div>

    <!-- 6 success -->
    <div v-else>
      <div class="proto-hero">
        <div class="success-check">✓</div>
        <h1>เลื่อนชั้นเรียบร้อย</h1>
        <p>ยินดีต้อนรับสู่ปีการศึกษา {{ toYear }} นักเรียนเดิมทุกคนเลื่อนชั้นให้อัตโนมัติแล้ว และเก็บข้อมูลผู้จบ {{ graduateCount }} คนไว้ในไฟล์เรียบร้อย</p>
      </div>
      <div class="callout good" style="max-width: 560px; margin-left: auto; margin-right: auto">
        <div class="ct">✅ นักเรียนเดิมเลื่อนชั้นแล้ว ไม่ต้องนำเข้าใหม่</div>
        ทะเบียนพร้อมใช้งานสำหรับปีการศึกษา {{ toYear }} เริ่มบันทึกการวัดได้เลย
      </div>
      <div class="callout info" style="max-width: 560px; margin-left: auto; margin-right: auto">
        <div class="ct">📌 ถ้ามีนักเรียน "เข้าใหม่"</div>
        นำเข้าเฉพาะนักเรียนที่เพิ่งเข้าโรงเรียนปีนี้ เช่น ชั้น ป.1/อ.1 ใหม่ หรือนักเรียนย้ายเข้า (นักเรียนเดิมไม่ต้องนำเข้าซ้ำ)
      </div>
      <div class="whatnext" style="justify-content: center">
        <button class="btn primary lg" @click="emit('done')">เริ่มบันทึกการวัด</button>
        <button class="btn" @click="emit('done')">นำเข้านักเรียนเข้าใหม่ (ถ้ามี)</button>
      </div>
    </div>
  </div>
</template>
