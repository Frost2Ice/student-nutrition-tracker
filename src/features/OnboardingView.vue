<script setup lang="ts">
import { ref, computed } from 'vue';
import { useData } from '../stores/data';
import { validateThaiDate } from '../domain/validation/rules';
import { gradesUpTo } from '../domain/grade/ladder';
import type { Term } from '../domain/types';
import ImportDialog from '../components/ImportDialog.vue';

const emit = defineEmits<{ done: []; exit: [] }>();

const data = useData();

// --- Stepper ---
const steps = ['ข้อมูลโรงเรียน', 'ปีการศึกษา', 'โครงสร้างชั้นเรียน', 'นำเข้านักเรียน', 'พร้อมใช้งาน'];
const i = ref(0);
const next = () => (i.value = Math.min(i.value + 1, steps.length - 1));
const back = () => (i.value = Math.max(i.value - 1, 0));

// --- Step 1: School info ---
const schoolForm = ref({
  school: '',
  ministry: '',
  department: '',
  subdistrict: '',
  district: '',
  province: '',
  teacher: '',
  maxGrade: 'ป.6',
});

function goToStep2() {
  data.saveSetup({ ...schoolForm.value });
  next();
}

// --- Step 2: Academic year ---
const yearForm = ref({ year: '2569', term: '1' as '1' | '2' });

function goToStep3() {
  data.setPeriod({ year: yearForm.value.year, term: yearForm.value.term as Term, round: '1' });
  const prevMap = new Map(structure.value.map((g) => [g.grade, g.rooms]));
  structure.value = gradesUpTo(schoolForm.value.maxGrade).map((grade) => ({
    grade,
    rooms: prevMap.get(grade) ?? 1,
  }));
  next();
}

// --- Step 3: Class structure (local UI only) ---
// Declared structure — teachers define grade/rooms here; no store field.
// Empty rooms won't persist until they have a student.
const structure = ref<{ grade: string; rooms: number }[]>([]);

function persistStructure() {
  data.setClassrooms(
    structure.value.map((g) => ({
      grade: g.grade,
      rooms: Array.from({ length: g.rooms }, (_, i) => String(i + 1)),
    })),
  );
}

function goToStep4() {
  persistStructure();
  next();
}

// --- Step 4: Import per classroom ---

// ImportDialog state
const importOpen = ref(false);
const importGrade = ref('');
const importRoom = ref('');

function openImport(grade: string, room: string) {
  importGrade.value = grade;
  importRoom.value = room;
  importOpen.value = true;
}

// Per-room student add: one student at a time (manual entry within onboarding)
const addErrors = ref<string[]>([]);
const studentForm = ref({ id: '', firstName: '', lastName: '', dob: '', gender: 'ชาย' as 'ชาย' | 'หญิง', grade: '', room: '' });
const showAddForm = ref<string | null>(null); // "grade/room" key of open form

function openAddForm(grade: string, room: string) {
  showAddForm.value = `${grade}/${room}`;
  studentForm.value = { id: '', firstName: '', lastName: '', dob: '', gender: 'ชาย', grade, room };
  addErrors.value = [];
}

function cancelAdd() {
  showAddForm.value = null;
  addErrors.value = [];
}

function submitStudent() {
  const errs: string[] = [];
  if (!studentForm.value.id.trim()) errs.push('กรุณากรอกรหัสนักเรียน');
  else if (data.students.some((s) => s.id === studentForm.value.id.trim())) errs.push('รหัสนักเรียนซ้ำกับที่มีอยู่แล้ว');
  if (!studentForm.value.firstName.trim()) errs.push('กรุณากรอกชื่อ');
  if (!studentForm.value.lastName.trim()) errs.push('กรุณากรอกนามสกุล');
  const dobErr = validateThaiDate(studentForm.value.dob, true);
  if (dobErr) errs.push(dobErr);
  if (!studentForm.value.grade) errs.push('กรุณาระบุชั้น');
  if (!studentForm.value.room) errs.push('กรุณาระบุห้อง');

  if (errs.length) {
    addErrors.value = errs;
    return;
  }

  data.addStudent({
    id: studentForm.value.id.trim(),
    firstName: studentForm.value.firstName.trim(),
    lastName: studentForm.value.lastName.trim(),
    dob: studentForm.value.dob,
    gender: studentForm.value.gender,
    grade: studentForm.value.grade,
    room: studentForm.value.room,
  });
  showAddForm.value = null;
  addErrors.value = [];
}

function roomCount(grade: string, room: string): number {
  return data.students.filter((s) => s.grade === grade && s.room === room).length;
}

const totalImported = computed(() => data.students.length);

// --- Step 5: Done ---
function finish() {
  persistStructure();
  emit('done');
}
</script>

<template>
  <div class="proto-screen">
    <div class="stepper">
      <template v-for="(s, si) in steps" :key="si">
        <div class="step" :class="{ active: si === i, done: si < i }">
          <span class="dot">{{ si < i ? '✓' : si + 1 }}</span>
          <span>{{ s }}</span>
        </div>
        <span v-if="si < steps.length - 1" class="sep"></span>
      </template>
    </div>

    <!-- 1 school -->
    <div v-if="i === 0">
      <h1 class="page-title">ตั้งค่าข้อมูลโรงเรียน</h1>
      <p class="page-sub">ข้อมูลนี้จะแสดงบนหัวโปรแกรมและในรายงานที่ส่งหน่วยงาน กรอกครั้งเดียว แก้ไขภายหลังได้</p>
      <div class="panel">
        <div class="form-grid">
          <div class="field" style="grid-column: 1/-1"><label>ชื่อโรงเรียน</label><input v-model="schoolForm.school" /></div>
          <div class="field"><label>สังกัดกระทรวง</label><input v-model="schoolForm.ministry" /></div>
          <div class="field"><label>สังกัดกรม/หน่วยงาน</label><input v-model="schoolForm.department" /></div>
          <div class="field"><label>ตำบล/แขวง</label><input v-model="schoolForm.subdistrict" /></div>
          <div class="field"><label>อำเภอ/เขต</label><input v-model="schoolForm.district" /></div>
          <div class="field"><label>จังหวัด</label><input v-model="schoolForm.province" /></div>
          <div class="field"><label>ชื่อ-สกุล ครูอนามัยโรงเรียน</label><input v-model="schoolForm.teacher" /></div>
          <div class="field" style="grid-column: 1/-1"><label>ชั้นสูงสุดของโรงเรียน</label>
            <select v-model="schoolForm.maxGrade"><option>อ.3</option><option>ป.6</option><option>ม.3</option><option>ม.6</option></select>
            <div class="hint" style="color: var(--ink-muted)">ใช้กำหนดว่านักเรียนชั้นใดจะจบการศึกษาเมื่อเลื่อนชั้น</div>
          </div>
        </div>
      </div>
      <div class="wiz-foot">
        <button class="btn quiet" @click="$emit('exit')">ออก</button>
        <span class="spacer"></span>
        <button class="btn primary lg" @click="goToStep2">ถัดไป: ปีการศึกษา</button>
      </div>
    </div>

    <!-- 2 academic year -->
    <div v-else-if="i === 1">
      <h1 class="page-title">ตั้งค่าปีการศึกษาปัจจุบัน</h1>
      <p class="page-sub">นี่คือค่าของทั้งระบบ ใช้กับทุกหน้าจอ เปลี่ยนได้ที่หน้าตั้งค่าเมื่อขึ้นปีหรือภาคเรียนใหม่</p>
      <div class="panel">
        <div class="callout info">
          <div class="ct">📅 ระบบเดาให้แล้วจากวันที่วันนี้</div>
          เดือนมิถุนายนอยู่ในภาคเรียนที่ 1 ของปีการศึกษา 2569
        </div>
        <div class="form-grid">
          <div class="field"><label>ปีการศึกษา (พ.ศ.)</label><input v-model="yearForm.year" /></div>
          <div class="field"><label>ภาคเรียน</label><select v-model="yearForm.term"><option value="1">1</option><option value="2">2</option></select></div>
        </div>
        <p class="hint" style="margin-top: var(--s3); color: var(--ink-muted)">
          "ครั้งที่วัด" จะเลือกตอนเริ่มบันทึกการวัดแต่ละครั้ง ไม่ต้องตั้งที่นี่
        </p>
      </div>
      <div class="wiz-foot">
        <button class="btn quiet" @click="back">ย้อนกลับ</button>
        <span class="spacer"></span>
        <button class="btn primary lg" @click="goToStep3">ถัดไป: โครงสร้างชั้นเรียน</button>
      </div>
    </div>

    <!-- 3 structure -->
    <div v-else-if="i === 2">
      <h1 class="page-title">กำหนดโครงสร้างชั้นเรียน</h1>
      <p class="page-sub">ระบุชั้นและจำนวนห้องของแต่ละชั้น เพื่อให้นำเข้านักเรียนทีละห้องได้ง่าย เพิ่ม/ลดห้องภายหลังได้</p>
      <div class="panel" style="padding: 0">
        <div class="mrow head" style="grid-template-columns: 1fr 160px"><div>ชั้น</div><div>จำนวนห้อง</div></div>
        <div v-for="g in structure" :key="g.grade" class="mrow" style="grid-template-columns: 1fr 160px">
          <div class="nm">{{ g.grade }}</div>
          <input type="number" v-model.number="g.rooms" style="max-width: 90px" min="0" />
        </div>
      </div>
      <div class="wiz-foot">
        <button class="btn quiet" @click="back">ย้อนกลับ</button>
        <span class="spacer"></span>
        <button class="btn primary lg" @click="goToStep4">ถัดไป: นำเข้านักเรียน</button>
      </div>
    </div>

    <!-- 4 import per classroom -->
    <div v-else-if="i === 3">
      <h1 class="page-title">นำเข้านักเรียนทีละห้อง</h1>
      <p class="page-sub">ดาวน์โหลดแม่แบบ Excel กรอกรายชื่อ แล้วนำเข้าทีละห้อง</p>
      <div class="callout info">
        <div class="ct">ℹ️ ไม่จำเป็นต้องครบทุกห้องตอนนี้</div>
        เพิ่มหรือนำเข้านักเรียนเพิ่มเติมภายหลังได้ที่หน้า <strong>นักเรียน</strong> และ <strong>ตั้งค่า</strong> ได้ตลอดเวลา
      </div>
      <div class="panel" style="padding: 0">
        <template v-for="g in structure" :key="g.grade">
          <template v-for="r in g.rooms" :key="g.grade + r">
            <!-- Room header row -->
            <div class="mrow head" style="grid-template-columns: 1fr auto auto; gap: var(--s3); align-items: center">
              <div class="nm" style="font-weight: 600">
                {{ g.grade }}/{{ r }}
                <span v-if="roomCount(g.grade, String(r))" class="pill good" style="margin-left: var(--s2)">{{ roomCount(g.grade, String(r)) }} คน</span>
                <span v-else class="pill neutral" style="margin-left: var(--s2)">ยังไม่นำเข้า</span>
              </div>
              <div style="display: flex; gap: var(--s2); align-items: center; flex-wrap: wrap">
                <button class="btn secondary" style="font-size: 13px" @click="openImport(g.grade, String(r))">
                  📄 นำเข้า Excel
                </button>
                <button
                  class="btn quiet"
                  style="font-size: 12px; color: var(--ink-muted)"
                  @click="openAddForm(g.grade, String(r))"
                >
                  เพิ่มทีละคน
                </button>
              </div>
            </div>

            <!-- Inline manual add form for this room -->
            <div v-if="showAddForm === `${g.grade}/${r}`" class="panel" style="margin: 0; border-top: 1px solid var(--line); border-radius: 0">
              <div class="form-grid">
                <div class="field"><label>รหัสนักเรียน</label><input v-model="studentForm.id" /></div>
                <div class="field"><label>ชื่อ</label><input v-model="studentForm.firstName" /></div>
                <div class="field"><label>นามสกุล</label><input v-model="studentForm.lastName" /></div>
                <div class="field"><label>วันเกิด (ว/ด/ปพ.ศ. เช่น 15/05/2556)</label><input v-model="studentForm.dob" placeholder="15/05/2556" /></div>
                <div class="field"><label>เพศ</label>
                  <select v-model="studentForm.gender">
                    <option value="ชาย">ชาย</option>
                    <option value="หญิง">หญิง</option>
                  </select>
                </div>
              </div>
              <div v-if="addErrors.length" style="color: var(--red, #d00); margin-top: var(--s2)">
                <div v-for="e in addErrors" :key="e">{{ e }}</div>
              </div>
              <div class="wiz-foot" style="margin-top: var(--s3)">
                <button class="btn quiet" @click="cancelAdd">ยกเลิก</button>
                <span class="spacer"></span>
                <button class="btn primary" @click="submitStudent">บันทึก</button>
              </div>
            </div>
          </template>
        </template>
      </div>
      <div style="margin-top: var(--s3); color: var(--ink-muted); font-size: 14px">นำเข้าแล้ว {{ totalImported }} คน</div>
      <div class="wiz-foot">
        <button class="btn quiet" @click="back">ย้อนกลับ</button>
        <span class="spacer"></span>
        <button class="btn primary lg" @click="next">เสร็จสิ้นการตั้งค่า</button>
      </div>
    </div>

    <!-- 5 ready -->
    <div v-else>
      <div class="proto-hero">
        <div class="success-check">✓</div>
        <h1>พร้อมใช้งานแล้ว!</h1>
        <p>ตั้งค่าโรงเรียนเรียบร้อย นำเข้านักเรียน {{ totalImported }} คน คุณครูเริ่มบันทึกการวัดได้เลย</p>
      </div>
      <div class="callout good">
        <div class="ct">✅ สิ่งที่ทำเสร็จแล้ว</div>
        ข้อมูลโรงเรียน · ปีการศึกษา {{ yearForm.year }} ภาคเรียน {{ yearForm.term }} · โครงสร้างชั้นเรียน · นักเรียน {{ totalImported }} คน
      </div>
      <div class="whatnext" style="justify-content: center">
        <button class="btn primary lg" @click="finish">เริ่มบันทึกการวัด</button>
        <button class="btn" @click="finish">ไปหน้าหลัก</button>
      </div>
    </div>

    <ImportDialog
      :open="importOpen"
      kind="student"
      :grade="importGrade"
      :room="importRoom"
      @imported="() => {}"
      @close="importOpen = false"
    />
  </div>
</template>
