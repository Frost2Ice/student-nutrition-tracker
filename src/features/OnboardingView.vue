<script setup lang="ts">
defineOptions({ name: 'OnboardingView' });
import { ref } from 'vue';
import { useData } from '../stores/data';
import { GRADE_ORDER } from '../domain/grade/ladder';

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
  data.setPeriod({ year: yearForm.value.year });
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

    <!-- 3 structure -->
    <div v-else-if="i === 2">
      <h1 class="page-title">กำหนดโครงสร้างชั้นเรียน</h1>
      <p class="page-sub">เลือกชั้นต่ำสุดและสูงสุดของโรงเรียน ระบบจะสร้างรายการชั้นให้ แล้วระบุจำนวนห้องของแต่ละชั้น แก้ไขภายหลังได้</p>
      <div class="panel">
        <div class="form-grid">
          <div class="field"><label>ชั้นต่ำสุด</label>
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

    <!-- 4 summary -->
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
  </div>
</template>
