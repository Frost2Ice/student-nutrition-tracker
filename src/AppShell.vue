<script setup lang="ts">
defineOptions({ name: 'AppShell' });
import { ref, computed, watch, onMounted } from 'vue';
import { useData } from './stores/data';
import { useHeader } from './stores/header';
import { useRoute } from './stores/route';
import type { Dest } from './router/hashRoutes';
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
import BackupRestoreWizard from './features/wizard/BackupRestoreWizard.vue';
import ImportDialog from './components/ImportDialog.vue';
import AppHeader from './components/AppHeader.vue';

type Overlay = 'onboarding' | 'import' | 'promotion' | 'backup' | null;

const data = useData();
const header = useHeader();
const route = useRoute();

const welcome = ref<'choose' | 'restore'>('choose');
const restoreError = ref('');
const restoreInput = ref<HTMLInputElement | null>(null);
// Whether the #/students route shows the legacy student profile (StudentsView)
// instead of the Workspace (StudentsPocView). In-page state, not its own route.
const showProfile = ref(false);
const overlay = ref<Overlay>(null);
const importTarget = ref<{ grade: string; room: string } | null>(null);
const focusStudent = ref<string | null>(null);
// Room the user was viewing in the Student Workspace when they opened a
// profile — lets the profile's Back return there, and the Workspace reopen it.
const studentReturn = ref<{ grade: string; room: string } | null>(null);
const pocReopen = ref<{ grade: string; room: string } | null>(null);
const wizardStart = ref<string | null>(null);

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
  { id: 'students-poc', label: 'นักเรียน', ico: '👥' },
  { id: 'reports', label: 'รายงาน', ico: '📋' },
  { id: 'settings', label: 'ตั้งค่า', ico: '⚙️' },
  { id: 'wizard', label: 'ผู้ช่วยจัดการข้อมูล', ico: '🧭' },
  // Legacy entries hidden during Student Workspace migration; routes + views kept
  // as a safety net (still reachable in code, just not in nav):
  //   { id: 'students', label: 'นักเรียน', ico: '👥' },
  //   { id: 'measure', label: 'บันทึกการวัด', ico: '📏' },
];
const overlayTitle: Record<string, string> = {
  onboarding: 'เริ่มตั้งค่าระบบ', import: 'นำเข้ารายชื่อนักเรียน', promotion: 'เลื่อนชั้นปีการศึกษา',
  backup: 'ผู้ช่วยสำรองและกู้คืนข้อมูล',
};

const destLabel = computed(() => nav.find((n) => n.id === route.current)?.label ?? '');

// Leaving the #/students route (or re-entering it via Back/Forward) drops the
// profile overlay so the Workspace shows. Opening a profile happens while
// already on #/students, so navigate() is a no-op there and this won't fire.
watch(() => route.current, () => { showProfile.value = false; });

function go(target: string, payload?: { grade: string; room: string } | { start: string } | { focus: string; grade?: string; room?: string }) {
  if (target === 'import' || target === 'promotion' || target === 'onboarding' || target === 'backup') {
    if (target === 'import' && payload && 'grade' in payload && payload.grade && payload.room) {
      importTarget.value = { grade: payload.grade, room: payload.room };
    }
    overlay.value = target as Overlay;
  } else if (target === 'students' && payload && 'focus' in payload) {
    // Open the legacy student profile as in-page state of #/students.
    focusStudent.value = payload.focus;
    studentReturn.value = payload.grade && payload.room ? { grade: payload.grade, room: payload.room } : null;
    route.navigate('students-poc');
    showProfile.value = true;
    header.setHeader({ title: '', back: null, context: 'year' });
  } else {
    if (target === 'wizard') {
      wizardStart.value = payload && 'start' in payload ? payload.start : null;
    }
    if (target === 'students-poc') {
      pocReopen.value = payload && 'grade' in payload && payload.grade && payload.room ? { grade: payload.grade, room: payload.room } : null;
    }
    route.navigate(target as Dest);
    // Set the header optimistically so the bar never blanks during the
    // out-in view transition; the destination view refines it on mount.
    header.setHeader({ title: nav.find((n) => n.id === target)?.label ?? '', back: null, context: 'year' });
  }
  window.scrollTo({ top: 0 });
}

onMounted(() => route.start());
function closeOverlay() {
  overlay.value = null;
  importTarget.value = null;
}

const periodLine = computed(() => {
  const s = data.measureSession;
  const base = `ปีการศึกษา ${data.period.year}`;
  return s ? `${base} · ภาคเรียนที่ ${s.term} · ครั้งที่ ${s.round}` : base;
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
      <button v-for="n in nav" :key="n.id" class="nav-item" :class="{ active: route.current === n.id }" @click="go(n.id)">
        <span class="ico">{{ n.ico }}</span>{{ n.label }}
      </button>
      <div class="sidebar-foot">เกณฑ์ กรมอนามัย พ.ศ. 2564</div>
    </aside>

    <div class="main">
      <AppHeader :go-home="() => go('home')" :is-home="route.current === 'home'" />

      <main class="content">
        <Transition name="view" mode="out-in">
          <HomeView v-if="route.current === 'home'" key="home" @go="go" />
          <StudentsView v-else-if="route.current === 'students-poc' && showProfile" key="student-profile" :focus-id="focusStudent" :return-room="studentReturn" @go="go" @focused="focusStudent = null" />
          <StudentsPocView v-else-if="route.current === 'students-poc'" key="students-poc" :reopen="pocReopen" @go="go" @reopened="pocReopen = null" />
          <MeasureView v-else-if="route.current === 'measure'" key="measure" @done="go('home')" @exit="go('home')" />
          <SettingsView v-else-if="route.current === 'settings'" key="settings" @go="go" />
          <ReportsView v-else-if="route.current === 'reports'" key="reports" />
          <WizardHubView v-else-if="route.current === 'wizard'" key="wizard" :start="wizardStart" @go="go" />
          <div v-else class="container" :key="route.current">
            <h1 class="page-title">{{ destLabel }}</h1>
            <p class="page-sub">(กำลังพัฒนา)</p>
          </div>
        </Transition>
      </main>
    </div>

    <nav class="bottomnav">
      <button v-for="n in nav" :key="n.id" :class="{ active: route.current === n.id }" @click="go(n.id)">
        <span class="ico">{{ n.ico }}</span>{{ n.label }}
      </button>
    </nav>
  </div>

  <!-- FULL-PAGE FOCUSED FLOWS (first-run setup, high-stakes promotion) -->
  <div v-if="overlay === 'onboarding' || overlay === 'promotion' || overlay === 'backup'" class="overlay-wrap">
    <div class="overlay-bar">
      <div class="brand-logo" style="width: 30px; height: 30px; font-size: 16px">🍎</div>
      <div class="ob-title">{{ overlayTitle[overlay] }}</div>
      <span class="spacer"></span>
      <button class="btn quiet" @click="closeOverlay">✕ ปิด</button>
    </div>
    <OnboardingView
      v-if="overlay === 'onboarding'"
      @done="closeOverlay(); route.navigate('home')"
      @exit="closeOverlay"
    />
    <PromotionView
      v-else-if="overlay === 'promotion'"
      @done="closeOverlay"
      @exit="closeOverlay"
    />
    <BackupRestoreWizard
      v-else-if="overlay === 'backup'"
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
