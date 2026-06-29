<!-- src/features/wizard/BackupRestoreWizard.vue -->
<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useData } from '../../stores/data';
import { useSchool } from '../../stores/school';
import { useHeader } from '../../stores/header';
import { parseYearBundle } from '../../domain/transfer/backup';
import { downloadBlob } from '../download';

const data = useData();
const school = useSchool();
const emit = defineEmits<{ done: []; exit: [] }>();

// Drive the shared app top bar instead of rendering a separate wizard bar.
const header = useHeader();
onMounted(() => header.setHeader({ title: 'สำรองและกู้คืนข้อมูล', back: () => emit('exit'), context: 'year' }));

// step model: one decision per screen, no shared state between branches.
//  'home'    → choose backup vs restore
//  'backup'  → choose scope (current year / other year / whole school)
//  'restore' → choose scope (import year / restore whole school)
//  'success' → confirmation after a backup, finish or start over
type Step = 'home' | 'backup' | 'restore' | 'success';
const step = ref<Step>('home');
const successMsg = ref('');

function goHome() {
  step.value = 'home';
  successMsg.value = '';
  yearPickOpen.value = false;
  yearConflict.value = null;
  cancelRestore();
}

// --- backup helpers ---
function downloadText(text: string, filename: string) {
  downloadBlob(new Blob([text], { type: 'application/json' }), filename);
}

// archived/other years to offer for "ปีการศึกษาอื่น" (exclude the active year)
const otherYears = computed(() =>
  [...school.listYears()]
    .filter((m) => m.year !== school.activeYear)
    .sort((a, b) => b.createdAt - a.createdAt)
    .map((m) => m.year),
);
const yearPickOpen = ref(false);
function openYearPick() { yearPickOpen.value = true; }

function backupYear(year: string | null) {
  if (!year) return;
  downloadText(school.exportYear(year), `ปีการศึกษา ${year}.json`);
  data.markBackup();
  yearPickOpen.value = false;
  successMsg.value = `สำรองปีการศึกษา ${year} แล้ว — เก็บไฟล์ไว้กันหาย`;
  step.value = 'success';
}
function backupSchool() {
  const ts = new Date().toISOString().slice(0, 10);
  downloadText(school.exportSchool(), `โรงเรียน-สำรองทั้งหมด-${ts}.json`);
  data.markBackup();
  successMsg.value = 'สำรองทั้งโรงเรียนแล้ว — เก็บไฟล์ไว้กันหาย';
  step.value = 'success';
}

// --- year import (merge, with overwrite confirm) ---
const yearConflict = ref<{ text: string; year: string; count: number } | null>(null);
const importMsg = ref('');
const yearInput = ref<HTMLInputElement | null>(null);
function pickYearFile() { yearInput.value?.click(); }
function onYearFile(e: Event) {
  importMsg.value = '';
  const file = (e.target as HTMLInputElement).files?.[0];
  (e.target as HTMLInputElement).value = '';
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (ev) => {
    const text = ev.target?.result as string;
    try {
      const { year } = parseYearBundle(text);
      if (school.years.some((m) => m.year === year.year)) {
        yearConflict.value = { text, year: year.year, count: year.students.length };
      } else {
        school.importYearBundle(text);
        importMsg.value = `นำเข้าปีการศึกษา ${year.year} แล้ว`;
      }
    } catch (err) {
      importMsg.value = (err as Error).message;
    }
  };
  reader.readAsText(file);
}
function confirmYearOverwrite() {
  if (!yearConflict.value) return;
  school.importYearBundle(yearConflict.value.text);
  importMsg.value = `เขียนทับปีการศึกษา ${yearConflict.value.year} แล้ว`;
  yearConflict.value = null;
}
function cancelYearOverwrite() { yearConflict.value = null; }

// --- full school import (replace, with strong confirm) ---
const openConfirm = ref(false);
const pendingSchool = ref<string | null>(null);
const schoolInput = ref<HTMLInputElement | null>(null);
function pickSchoolFile() { schoolInput.value?.click(); }
function onSchoolFile(e: Event) {
  importMsg.value = '';
  const file = (e.target as HTMLInputElement).files?.[0];
  (e.target as HTMLInputElement).value = '';
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (ev) => {
    pendingSchool.value = ev.target?.result as string;
    openConfirm.value = true;
  };
  reader.readAsText(file);
}
function confirmRestore() {
  if (!pendingSchool.value) return;
  try {
    school.importSchool(pendingSchool.value);
    openConfirm.value = false;
    pendingSchool.value = null;
    importMsg.value = 'กู้คืนทั้งโรงเรียนสำเร็จ — กำลังโหลดใหม่';
    setTimeout(() => location.reload(), 1000);
  } catch (err) {
    openConfirm.value = false;
    pendingSchool.value = null;
    importMsg.value = (err as Error).message;
  }
}
function cancelRestore() {
  openConfirm.value = false;
  pendingSchool.value = null;
}
</script>

<template>
  <div class="container j-export">
    <!-- STEP: what do you want to do? -->
    <div v-if="step === 'home'" class="panel">
      <div class="wiz-q">ต้องการทำอะไร?</div>
      <p style="color: var(--ink-muted); margin: -6px 0 var(--s4)">เก็บสำเนาข้อมูลไว้กันหาย หรือเปิดไฟล์ที่เคยสำรองกลับมาใช้</p>
      <div class="wiz-choices">
        <button class="wiz-card" @click="step = 'backup'">
          <span class="wiz-ico">📤</span>
          <span class="wiz-ct">
            <span class="wiz-t">สำรองข้อมูล</span>
            <span class="wiz-d">ดาวน์โหลดไฟล์เก็บไว้กันหาย</span>
          </span>
        </button>
        <button class="wiz-card" @click="step = 'restore'">
          <span class="wiz-ico">📥</span>
          <span class="wiz-ct">
            <span class="wiz-t">กู้คืนข้อมูล</span>
            <span class="wiz-d">เปิดไฟล์ที่เคยสำรองกลับมาใช้</span>
          </span>
        </button>
      </div>
      <div class="wiz-foot">
        <span class="spacer"></span>
        <button class="btn quiet" @click="emit('exit')">ออก</button>
      </div>
    </div>

    <!-- STEP: backup scope -->
    <div v-else-if="step === 'backup'" class="panel">
      <div class="wiz-q">สำรองข้อมูลส่วนไหน?</div>
      <div class="wiz-choices">
        <button class="wiz-card" @click="backupYear(school.activeYear)">
          <span class="wiz-ico">📅</span>
          <span class="wiz-ct">
            <span class="wiz-t">ปีการศึกษาปัจจุบัน</span>
            <span class="wiz-d">ไฟล์พกพาได้ของปี {{ school.activeYear }} (รวมข้อมูลโรงเรียน)</span>
          </span>
        </button>

        <button class="wiz-card" :disabled="otherYears.length === 0" @click="openYearPick">
          <span class="wiz-ico">🗂️</span>
          <span class="wiz-ct">
            <span class="wiz-t">ปีการศึกษาอื่น</span>
            <span class="wiz-d">{{ otherYears.length ? 'เลือกปีที่เก็บถาวรเพื่อส่งออก' : 'ยังไม่มีปีการศึกษาอื่น' }}</span>
          </span>
        </button>

        <button class="wiz-card" @click="backupSchool">
          <span class="wiz-ico">🏫</span>
          <span class="wiz-ct">
            <span class="wiz-t">ทั้งโรงเรียน</span>
            <span class="wiz-d">สำรองทุกปีการศึกษาในไฟล์เดียว</span>
          </span>
        </button>
      </div>

      <!-- year picker for "other year" -->
      <div v-if="yearPickOpen" class="callout info" style="margin-top: var(--s3)">
        <div class="ct">เลือกปีการศึกษาที่ต้องการส่งออก</div>
        <div class="wiz-yearlist">
          <button v-for="y in otherYears" :key="y" class="btn" @click="backupYear(y)">ปีการศึกษา {{ y }}</button>
        </div>
      </div>

      <div class="wiz-foot">
        <button class="btn quiet" @click="goHome">ย้อนกลับ</button>
        <span class="spacer"></span>
        <button class="btn quiet" @click="emit('exit')">ออก</button>
      </div>
    </div>

    <!-- STEP: restore scope -->
    <div v-else-if="step === 'restore'" class="panel">
      <div class="wiz-q">กู้คืนข้อมูลส่วนไหน?</div>

      <div v-if="importMsg" class="callout info" style="margin-bottom: var(--s3)">{{ importMsg }}</div>

      <div class="goal">
        <div class="goal-ico">📥</div>
        <div class="goal-body">
          <div class="goal-t">นำเข้าปีการศึกษา</div>
          <div class="goal-d">เพิ่มปีเข้าไป ถ้ามีปีนั้นอยู่แล้วจะถามก่อนเขียนทับ</div>
          <div v-if="yearConflict" class="callout bad" style="margin: var(--s3) 0 0">
            <div class="ct">⚠️ มีปีการศึกษา {{ yearConflict.year }} อยู่แล้ว</div>
            เขียนทับด้วยข้อมูลใหม่ ({{ yearConflict.count }} คน) หรือไม่? ไฟล์เดิมของคุณยังอยู่
            <div style="display: flex; gap: 8px; margin-top: var(--s3)">
              <button class="btn danger" style="min-height: 44px" @click="confirmYearOverwrite">เขียนทับ</button>
              <button class="btn quiet" style="min-height: 44px" @click="cancelYearOverwrite">ยกเลิก</button>
            </div>
          </div>
        </div>
        <button v-if="!yearConflict" class="btn" @click="pickYearFile">เลือกไฟล์ปีการศึกษา</button>
        <input ref="yearInput" type="file" accept=".json" style="display:none" @change="onYearFile" />
      </div>

      <div class="goal">
        <div class="goal-ico">📂</div>
        <div class="goal-body">
          <div class="goal-t">กู้คืนทั้งโรงเรียน</div>
          <div class="goal-d">กู้คืนทั้งหมด จะแทนที่ข้อมูลปัจจุบัน (สำหรับย้ายเครื่องหรือข้อมูลหาย)</div>
          <div v-if="openConfirm" class="callout bad" style="margin: var(--s3) 0 0">
            <div class="ct">⚠️ ข้อมูลในเครื่องนี้จะถูกแทนที่ทั้งหมด</div>
            ไฟล์เดิมของคุณยังอยู่ ควรสำรองข้อมูลตอนนี้ไว้ก่อน
            <div style="display: flex; gap: 8px; margin-top: var(--s3)">
              <button class="btn danger" style="min-height: 44px" @click="confirmRestore">นำมาใช้และแทนที่</button>
              <button class="btn quiet" style="min-height: 44px" @click="cancelRestore">ยกเลิก</button>
            </div>
          </div>
        </div>
        <button v-if="!openConfirm" class="btn" @click="pickSchoolFile">เลือกไฟล์ทั้งโรงเรียน</button>
        <input ref="schoolInput" type="file" accept=".json" style="display:none" @change="onSchoolFile" />
      </div>

      <div class="wiz-foot">
        <button class="btn quiet" @click="goHome">ย้อนกลับ</button>
        <span class="spacer"></span>
        <button class="btn quiet" @click="emit('exit')">ออก</button>
      </div>
    </div>

    <!-- STEP: backup success -->
    <div v-else class="panel" style="text-align: center">
      <div class="success-check j">✓</div>
      <div class="section-title" style="margin-bottom: var(--s2)">สำรองข้อมูลเรียบร้อย</div>
      <p style="color: var(--ink-muted); margin-bottom: var(--s5)">{{ successMsg }}</p>
      <div style="display: flex; gap: var(--s2); justify-content: center; flex-wrap: wrap">
        <button class="btn quiet lg" @click="goHome">สำรองข้อมูลอีก</button>
        <button class="btn j lg" @click="emit('done')">เสร็จสิ้น</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.wiz-q { font-weight: 700; font-size: 16px; color: var(--ink); margin-bottom: var(--s3); }
.wiz-choices { display: flex; flex-direction: column; gap: var(--s3); }
.wiz-card {
  display: flex; gap: var(--s3); align-items: center; text-align: left; width: 100%;
  min-height: 44px; padding: var(--s3) var(--s4); cursor: pointer;
  background: var(--surface); border: 1px solid var(--line); border-radius: 12px;
  font: inherit; color: inherit;
}
.wiz-card:hover:not(:disabled) { border-color: var(--brand); background: var(--surface-2); }
.wiz-card:disabled { opacity: 0.55; cursor: not-allowed; }
.wiz-ico { font-size: 24px; width: 32px; text-align: center; flex-shrink: 0; }
.wiz-ct { display: flex; flex-direction: column; min-width: 0; }
.wiz-t { font-weight: 700; font-size: 16px; }
.wiz-d { color: var(--ink-muted); font-size: 14px; margin-top: 2px; }
.wiz-yearlist { display: flex; flex-wrap: wrap; gap: var(--s2); margin-top: var(--s3); }
.wiz-yearlist .btn { min-height: 44px; }

.goal { display: flex; gap: var(--s4); align-items: flex-start; padding: var(--s4) 0; border-bottom: 1px solid var(--line-soft); }
.goal:last-of-type { border-bottom: none; }
.goal-ico { font-size: 26px; width: 36px; text-align: center; flex-shrink: 0; }
.goal-body { flex: 1; min-width: 0; }
.goal-t { font-weight: 700; font-size: 16.5px; }
.goal-d { color: var(--ink-muted); font-size: 14.5px; margin-top: 2px; }
.goal > .btn { flex-shrink: 0; }
@media (max-width: 560px) {
  .goal { flex-wrap: wrap; }
  .goal > .btn { width: 100%; }
}
</style>
