<script setup lang="ts">
import { ref, computed } from 'vue';
import { useData } from './stores/data';
import { parseBackup } from './domain/transfer/backup';
import OnboardingView from './features/OnboardingView.vue';
import HomeView from './features/HomeView.vue';
import StudentsView from './features/StudentsView.vue';
import StudentsPocView from './features/StudentsPocView.vue';
import MeasureView from './features/MeasureView.vue';
import SettingsView from './features/SettingsView.vue';
import PromotionView from './features/PromotionView.vue';
import ReportsView from './features/ReportsView.vue';
import WizardHubView from './features/wizard/WizardHubView.vue';
import ImportDialog from './components/ImportDialog.vue';

type Dest = 'home' | 'students' | 'students-poc' | 'measure' | 'reports' | 'settings' | 'wizard';
type Overlay = 'onboarding' | 'import' | 'promotion' | null;

const data = useData();

const welcome = ref<'choose' | 'restore'>('choose');
const restoreError = ref('');
const restoreInput = ref<HTMLInputElement | null>(null);
const dest = ref<Dest>('home');
const overlay = ref<Overlay>(null);
const importTarget = ref<{ grade: string; room: string } | null>(null);
const focusStudent = ref<string | null>(null);
const wizardStart = ref<string | null>(null);
const inWizardFlow = ref(false);

function pickRestoreFile() {
  restoreInput.value?.click();
}

function onRestoreFile(e: Event) {
  restoreError.value = '';
  const file = (e.target as HTMLInputElement).files?.[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (ev) => {
    try {
      const parsed = parseBackup(ev.target?.result as string);
      data.replaceAll(parsed);
    } catch {
      restoreError.value = 'ไฟล์สำรองไม่ถูกต้อง';
    }
  };
  reader.readAsText(file);
  (e.target as HTMLInputElement).value = '';
}

const nav: { id: Dest; label: string; ico: string }[] = [
  { id: 'home', label: 'หน้าหลัก', ico: '🏠' },
  { id: 'students', label: 'นักเรียน', ico: '👥' },
  { id: 'students-poc', label: 'นักเรียน (POC)', ico: '🧪' },
  { id: 'measure', label: 'บันทึกการวัด', ico: '📏' },
  { id: 'reports', label: 'รายงาน', ico: '📋' },
  { id: 'settings', label: 'ตั้งค่า', ico: '⚙️' },
  { id: 'wizard', label: 'ผู้ช่วยจัดการข้อมูล', ico: '🧭' },
];
const overlayTitle: Record<string, string> = {
  onboarding: 'เริ่มตั้งค่าระบบ', import: 'นำเข้ารายชื่อนักเรียน', promotion: 'เลื่อนชั้นปีการศึกษา',
};

const destLabel = computed(() => nav.find((n) => n.id === dest.value)?.label ?? '');

function go(target: string, payload?: { grade: string; room: string } | { start: string }) {
  if (target === 'import' || target === 'promotion' || target === 'onboarding') {
    if (target === 'import' && payload && 'grade' in payload) {
      importTarget.value = payload;
    }
    overlay.value = target as Overlay;
  } else {
    if (target === 'wizard') {
      wizardStart.value = payload && 'start' in payload ? payload.start : null;
    } else {
      inWizardFlow.value = false;
    }
    dest.value = target as Dest;
  }
  window.scrollTo({ top: 0 });
}
function closeOverlay() {
  overlay.value = null;
  importTarget.value = null;
}

const periodLine = computed(() => {
  const s = data.measureSession;
  const base = `ปีการศึกษา ${data.period.year}`;
  return s ? `${base} · ภาคเรียนที่ ${s.term} · ครั้งที่ ${s.round}` : base;
});
const periodShort = computed(() => {
  const s = data.measureSession;
  return s ? `ภาคเรียนที่ ${s.term} · ครั้งที่ ${s.round}` : `ปีการศึกษา ${data.period.year}`;
});
</script>

<template>
  <!-- FIRST RUN: welcome (no shell) -->
  <div v-if="!data.isSetup" class="proto-screen">
    <div class="proto-hero" style="padding-bottom: var(--s4)">
      <div class="big">🍎</div>
      <h1>ยินดีต้อนรับสู่ระบบติดตามภาวะโภชนาการนักเรียน</h1>
      <p>ผู้ช่วยบันทึกน้ำหนัก ส่วนสูง และประเมินภาวะโภชนาการของนักเรียน ข้อมูลเก็บในเครื่องนี้</p>
    </div>
    <div v-if="welcome === 'choose'">
      <p style="text-align: center; color: var(--ink-muted); margin-bottom: var(--s5)">เริ่มต้นอย่างไรดี?</p>
      <div class="choice-grid">
        <button class="choice" @click="go('onboarding')">
          <span class="ico">✨</span><span class="t">เริ่มใช้งานครั้งแรก</span>
          <span class="d">ตั้งค่าโรงเรียนและเพิ่มรายชื่อนักเรียนใหม่</span>
          <span class="rec">สำหรับโรงเรียนที่ยังไม่เคยใช้</span>
        </button>
        <button class="choice" @click="welcome = 'restore'">
          <span class="ico">♻️</span><span class="t">มีข้อมูลเดิมอยู่แล้ว</span>
          <span class="d">นำเข้าจากไฟล์สำรอง — ย้ายจากเครื่องอื่น หรือรับช่วงต่อจากครูคนเดิม</span>
        </button>
      </div>
    </div>
    <div v-else class="panel" style="max-width: 560px; margin: 0 auto">
      <div class="section-title">นำเข้าข้อมูลจากไฟล์สำรอง</div>
      <p style="color: var(--ink-muted); margin-top: -8px; margin-bottom: var(--s4)">
        เลือกไฟล์สำรองที่เคยบันทึกไว้ ระบบจะนำข้อมูลทั้งหมดกลับมาให้พร้อมใช้งานทันที โดยไม่ต้องตั้งค่าใหม่
      </p>
      <div style="text-align: center; padding: var(--s5); border: 2px dashed var(--line); border-radius: var(--r); margin-bottom: var(--s4)">
        <div style="font-size: 40px">📂</div>
        <p style="margin: var(--s3) 0; color: var(--ink-muted)">ลากไฟล์สำรองมาวาง หรือ</p>
        <input ref="restoreInput" type="file" accept=".json,.ntr,application/json" style="display:none" @change="onRestoreFile" />
        <button class="btn primary" @click="pickRestoreFile">เลือกไฟล์สำรอง</button>
        <div v-if="restoreError" style="color: var(--bad); margin-top: var(--s3); font-size: 14px">{{ restoreError }}</div>
      </div>
      <button class="btn quiet" @click="welcome = 'choose'">← ย้อนกลับ</button>
    </div>
  </div>

  <!-- APP SHELL -->
  <div v-else class="shell" :inert="!!overlay || undefined">
    <aside class="sidebar">
      <div class="brand-mark">
        <div class="brand-logo">🍎</div>
        <div>
          <div class="brand-name">ภาวะโภชนาการ</div>
          <div class="brand-sub">{{ data.setup.school }}</div>
        </div>
      </div>
      <div class="period-chip" style="margin-bottom: var(--s4)" title="เปลี่ยนได้ที่ตั้งค่า">📅 {{ periodLine }}</div>
      <button v-for="n in nav" :key="n.id" class="nav-item" :class="{ active: dest === n.id }" @click="go(n.id)">
        <span class="ico">{{ n.ico }}</span>{{ n.label }}
      </button>
      <div class="sidebar-foot">เกณฑ์ กรมอนามัย พ.ศ. 2564</div>
    </aside>

    <div class="main">
      <header v-if="!inWizardFlow" class="topbar">
        <div class="brand-logo" style="width: 32px; height: 32px; font-size: 17px">🍎</div>
        <div class="period-chip" style="width: auto; margin-left: auto">📅 {{ periodShort }}</div>
      </header>

      <main class="content">
        <Transition name="view" mode="out-in">
          <HomeView v-if="dest === 'home'" key="home" @go="go" />
          <StudentsView v-else-if="dest === 'students'" key="students" :focus-id="focusStudent" @go="go" @focused="focusStudent = null" />
          <StudentsPocView v-else-if="dest === 'students-poc'" key="students-poc" @go="go" />
          <MeasureView v-else-if="dest === 'measure'" key="measure" @done="go('home')" @exit="go('home')" />
          <SettingsView v-else-if="dest === 'settings'" key="settings" @go="go" />
          <ReportsView v-else-if="dest === 'reports'" key="reports" />
          <WizardHubView v-else-if="dest === 'wizard'" key="wizard" :start="wizardStart" @go="go" @flow="inWizardFlow = $event" />
          <div v-else class="container" :key="dest">
            <h1 class="page-title">{{ destLabel }}</h1>
            <p class="page-sub">(กำลังพัฒนา)</p>
          </div>
        </Transition>
      </main>
    </div>

    <nav class="bottomnav">
      <button v-for="n in nav" :key="n.id" :class="{ active: dest === n.id }" @click="go(n.id)">
        <span class="ico">{{ n.ico }}</span>{{ n.label }}
      </button>
    </nav>
  </div>

  <!-- FULL-PAGE FOCUSED FLOWS (first-run setup, high-stakes promotion) -->
  <div v-if="overlay === 'onboarding' || overlay === 'promotion'" class="overlay-wrap">
    <div class="overlay-bar">
      <div class="brand-logo" style="width: 30px; height: 30px; font-size: 16px">🍎</div>
      <div class="ob-title">{{ overlayTitle[overlay] }}</div>
      <span class="spacer"></span>
      <button class="btn quiet" @click="closeOverlay">✕ ปิด</button>
    </div>
    <OnboardingView
      v-if="overlay === 'onboarding'"
      @done="closeOverlay(); dest = 'home'"
      @exit="closeOverlay"
    />
    <PromotionView
      v-else-if="overlay === 'promotion'"
      @done="closeOverlay"
      @exit="closeOverlay"
    />
  </div>

  <!-- DO-AND-RETURN TASK: standardized import dialog over the dimmed screen -->
  <ImportDialog
    :open="overlay === 'import'"
    kind="student"
    :grade="importTarget?.grade"
    :room="importTarget?.room"
    @close="closeOverlay"
  />
</template>
