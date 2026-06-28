<!-- src/features/wizard/ExportWizard.vue -->
<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useData } from '../../stores/data';
import { useHeader } from '../../stores/header';
import Stepper from '../../components/Stepper.vue';
import { downloadBlob } from '../download';
import { studentsToAoa, aoaToXlsxBlob } from '../../domain/transfer/xlsx';

const data = useData();
const emit = defineEmits<{ done: []; exit: [] }>();

// Drive the shared app top bar instead of rendering a separate wizard bar.
const header = useHeader();
onMounted(() => header.setHeader({ title: 'ส่งออกรายงาน', back: () => emit('exit'), context: 'year' }));

const steps = ['เลือกขอบเขต', 'เลือกรูปแบบ', 'ดาวน์โหลด'];
const step = ref(0);

type Scope = 'all' | 'grade';
const scope = ref<Scope>('all');
const grade = ref('');

const selected = computed(() => {
  if (scope.value === 'grade') return data.students.filter((s) => s.grade === grade.value);
  return data.students;
});

const scopeLabel = computed(() => (scope.value === 'grade' ? grade.value : 'ทั้งหมด'));

// guided "order ticket" flow: 0=ขอบเขต, 1=ชั้น (only when เฉพาะชั้น), ready at 2
const activePick = ref(0);
const ready = computed(() => activePick.value >= 2 && (scope.value === 'all' || !!grade.value));
function editPick(i: number) { if (i <= activePick.value) activePick.value = i; }
function pickScopeAll() { scope.value = 'all'; grade.value = ''; activePick.value = 2; }
function pickScopeGrade() { scope.value = 'grade'; grade.value = ''; activePick.value = 1; }
function pickGrade(g: string) { grade.value = g; activePick.value = 2; }

function exportXlsx() {
  const aoa = studentsToAoa(selected.value);
  downloadBlob(aoaToXlsxBlob(aoa, 'รายชื่อ', [0]), `รายชื่อนักเรียน-${scopeLabel.value}.xlsx`);
  step.value = 2;
}
</script>

<template>
  <div class="container j-export">
    <Stepper :steps="steps" :current="step" />

    <!-- step 0: guided order-ticket flow -->
    <div v-if="step === 0" class="panel">
      <p style="color: var(--ink-muted); margin-bottom: var(--s4)">เลือกทีละขั้น ระบบจะพาไปต่อเองจนครบ</p>
      <div class="order">
        <!-- 1: ขอบเขต -->
        <div class="order-row" :class="{ active: activePick === 0, done: activePick > 0 }">
          <button class="order-head" @click="editPick(0)">
            <span class="order-num">{{ activePick > 0 ? '✓' : '1' }}</span>
            <span class="order-label">เลือกขอบเขต</span>
            <span class="order-value">
              <span v-if="activePick > 0" class="chosen">{{ scope === 'grade' ? 'เฉพาะชั้น' : 'นักเรียนทั้งหมด' }}</span>
              <span v-else>แตะเพื่อเลือก</span>
              <span v-if="activePick > 0" class="order-edit">เปลี่ยน</span>
            </span>
          </button>
          <div v-if="activePick === 0" class="order-body">
            <div class="tile-grid">
              <button class="tile" :class="{ on: activePick > 0 && scope === 'all' }" @click="pickScopeAll">
                <span class="tile-ico">👥</span><span class="tile-lbl">นักเรียนทั้งหมด</span><span class="tile-check">✓</span>
              </button>
              <button class="tile" :class="{ on: scope === 'grade' }" @click="pickScopeGrade">
                <span class="tile-ico">🏫</span><span class="tile-lbl">เลือกเฉพาะชั้น</span><span class="tile-check">✓</span>
              </button>
            </div>
          </div>
        </div>

        <!-- 2: ชั้น (only when เฉพาะชั้น) -->
        <div v-if="scope === 'grade'" class="order-row" :class="{ active: activePick === 1, done: activePick > 1, locked: activePick < 1 }">
          <button class="order-head" :disabled="activePick < 1" @click="editPick(1)">
            <span class="order-num">{{ activePick > 1 ? '✓' : '2' }}</span>
            <span class="order-label">เลือกชั้น</span>
            <span class="order-value">
              <span v-if="grade" class="chosen">{{ grade }}</span>
              <span v-else>—</span>
              <span v-if="activePick > 1" class="order-edit">เปลี่ยน</span>
            </span>
          </button>
          <div v-if="activePick === 1" class="order-body">
            <div class="tile-grid">
              <button v-for="g in data.structure" :key="g.grade" class="tile" :class="{ on: grade === g.grade }" @click="pickGrade(g.grade)">
                <span class="tile-ico">📚</span><span class="tile-lbl">{{ g.grade }}</span><span class="tile-check">✓</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      <div v-if="ready" class="order-ticket">
        <span class="ot-ico">🧾</span>
        <span>ส่งออก {{ selected.length }} คน · {{ scopeLabel }}</span>
      </div>
      <button class="btn j lg block" :disabled="!ready" @click="step = 1">ยืนยัน แล้วเลือกรูปแบบ →</button>
    </div>

    <!-- step 1 -->
    <div v-else-if="step === 1" class="panel">
      <div class="chip-label">เลือกรูปแบบไฟล์</div>
      <button class="btn j lg block" @click="exportXlsx">📊 ส่งออกเป็น Excel ({{ selected.length }} คน)</button>
      <div class="callout info" style="margin-top: var(--s4)">
        <div class="ct">📄 ต้องการไฟล์ PDF?</div>
        ไปที่เมนู “รายงาน” เพื่อพิมพ์หรือบันทึกเป็น PDF ได้เลย
      </div>
      <button class="btn quiet" @click="step = 0">← ย้อนกลับ</button>
    </div>

    <!-- step 2 -->
    <div v-else class="panel" style="text-align: center">
      <div class="success-check j">✓</div>
      <div class="section-title" style="margin-bottom: var(--s2)">ดาวน์โหลดไฟล์เรียบร้อย</div>
      <p style="color: var(--ink-muted); margin-bottom: var(--s5)">ไฟล์รายชื่อ {{ scopeLabel }} ({{ selected.length }} คน) ถูกบันทึกลงเครื่องแล้ว</p>
      <button class="btn j lg" @click="emit('done')">เสร็จสิ้น</button>
    </div>
  </div>
</template>
