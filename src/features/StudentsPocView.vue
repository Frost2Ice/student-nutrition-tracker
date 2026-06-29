<script setup lang="ts">
defineOptions({ name: 'StudentsPocView' });
import { ref, computed, watch, onMounted } from 'vue';
import { useData } from '../stores/data';
import { useHeader } from '../stores/header';
import { calcNutrition } from '../domain/nutrition/engine';
import { shortWfa, shortHfa } from '../domain/nutrition/labels';
import type { Student, Term, Round, Measurement } from '../domain/types';
import { defaultRound } from '../domain/measure/default-round';
import { aoaToXlsxBlob, studentsToAoa } from '../domain/transfer/xlsx';
import { downloadBlob } from './download';
const emit = defineEmits<{ (e: 'go', target: string, payload?: { focus: string; grade: string; room: string }): void; (e: 'reopened'): void }>();
const props = defineProps<{ reopen?: { grade: string; room: string } | null }>();

const data = useData();
const header = useHeader();

// Open a student's full profile (rendered by the legacy StudentsView for now).
// Carry grade/room so Back from the profile returns to THIS room, not legacy browse.
function openStudent(id: string, g: string, r: string) {
  emit('go', 'students', { focus: id, grade: g, room: r });
}

// ---- measurement round selector ----
const sessTerm = ref<Term>('1');
const sessRound = ref<Round>('1');

const SESSIONS: { term: Term; round: Round; label: string }[] = [
  { term: '1', round: '1', label: 'ภาคเรียนที่ 1 · ครั้งที่ 1' },
  { term: '1', round: '2', label: 'ภาคเรียนที่ 1 · ครั้งที่ 2' },
  { term: '2', round: '1', label: 'ภาคเรียนที่ 2 · ครั้งที่ 1' },
  { term: '2', round: '2', label: 'ภาคเรียนที่ 2 · ครั้งที่ 2' },
];

function isActiveSession(term: Term, round: Round) {
  return sessTerm.value === term && sessRound.value === round;
}
function pickSession(term: Term, round: Round) {
  sessTerm.value = term;
  sessRound.value = round;
}

type Assess = { wfa: string; hfa: string; wfh: string; tall: boolean } | null;
function assessFor(s: Student): { measure: Measurement | null; result: Assess } {
  const m = data.findDuplicate(s.id, data.period.year, sessTerm.value, sessRound.value);
  if (!m) return { measure: null, result: null };
  return { measure: m, result: calcNutrition(s, m) };
}

const wfhClass: Record<string, string> = {
  ผอม: 'bad', ค่อนข้างผอม: 'warn', สมส่วน: 'good', ท้วม: 'warn', เริ่มอ้วน: 'warn', อ้วน: 'bad',
};
const wfaClass: Record<string, string> = {
  น้ำหนักน้อย: 'bad', น้ำหนักค่อนข้างน้อย: 'warn', น้ำหนักตามเกณฑ์: 'good',
  น้ำหนักค่อนข้างมาก: 'warn', น้ำหนักมาก: 'bad',
};
const hfaClass: Record<string, string> = {
  เตี้ย: 'bad', ค่อนข้างเตี้ย: 'warn', สูงตามเกณฑ์: 'good', ค่อนข้างสูง: 'good', สูง: 'good',
};

const assessMap = computed(() =>
  new Map(roomStudents.value.map((s) => [s.id, assessFor(s)] as const)),
);

function rowRisk(s: Student): boolean {
  const r = assessFor(s).result;
  if (!r) return false;
  return r.wfh !== 'สมส่วน';
}

// ---- navigation: map (grades+rooms in one) → students ----
const view = ref<'map' | 'students'>('map');
const grade = ref('');
const room = ref('');

function openRoom(g: string, r: string) {
  grade.value = g;
  room.value = r;
  riskOnly.value = false;
  applyDefaultRound();
  view.value = 'students';
  window.scrollTo({ top: 0 });
}
function toMap() {
  view.value = 'map';
  window.scrollTo({ top: 0 });
}

// running index so every room card across all grade bands staggers in sequence
const cardIndex = computed(() => {
  const map = new Map<string, number>();
  let i = 0;
  for (const g of data.structure) for (const r of g.rooms) map.set(`${g.grade}/${r}`, i++);
  return map;
});

// ---- search (whole school) ----
const search = ref('');
const results = computed(() => {
  const q = search.value.trim();
  return q ? data.searchStudents(q) : [];
});
const searching = computed(() => search.value.trim().length > 0);

// ---- student roster for the open room ----
const riskOnly = ref(false);
const roomStudents = computed(() => (grade.value && room.value ? data.roomStudents(grade.value, room.value) : []));
const roomRiskCount = computed(() => roomStudents.value.filter(rowRisk).length);
const currentRoomStudents = computed(() =>
  riskOnly.value ? roomStudents.value.filter(rowRisk) : roomStudents.value,
);

function sessionCount(term: Term, round: Round): number {
  return roomStudents.value.filter(
    (s) => data.findDuplicate(s.id, data.period.year, term, round) !== null,
  ).length;
}
const sessionCounts = computed(() =>
  new Map(SESSIONS.map((s) => [s.term + s.round, sessionCount(s.term, s.round)] as const)),
);
function applyDefaultRound() {
  const pick = defaultRound((s) =>
    roomStudents.value.some(
      (st) => data.findDuplicate(st.id, data.period.year, s.term, s.round) !== null,
    ),
  );
  sessTerm.value = pick.term;
  sessRound.value = pick.round;
}

// ---- room actions ----
function exportRoom() {
  const list = roomStudents.value;
  downloadBlob(
    aoaToXlsxBlob(studentsToAoa(list), 'รายชื่อนักเรียน', [3]),
    `รายชื่อ ${grade.value}-${room.value}.xlsx`,
  );
  say(`ส่งออกรายชื่อห้อง ${grade.value}/${room.value} แล้ว (${list.length} คน)`);
}

// ---- toast ----
const toast = ref('');
let toastT: ReturnType<typeof setTimeout> | undefined;
function say(msg: string) {
  toast.value = msg;
  if (toastT) clearTimeout(toastT);
  toastT = setTimeout(() => (toast.value = ''), 3000);
}

// ---- header ----
function syncHeader() {
  if (view.value === 'students') {
    header.setHeader({ title: `ห้อง ${grade.value}/${room.value}`, back: toMap, context: 'year' });
  } else {
    header.setHeader({ title: 'นักเรียน (POC)', back: null, context: 'year' });
  }
}
onMounted(syncHeader);
watch(view, syncHeader);

// Returning from a student profile: reopen the room the user was in.
watch(
  () => props.reopen,
  (r) => {
    if (!r) return;
    openRoom(r.grade, r.room);
    emit('reopened');
  },
  { immediate: true },
);
</script>

<template>
  <div class="container">
    <!-- search: whole school, always available -->
    <div class="searchbar">
      <span class="search-ico" aria-hidden="true">🔍</span>
      <input
        v-model="search"
        class="search"
        type="search"
        placeholder="ค้นหาด้วยชื่อหรือรหัสนักเรียน (ทั้งโรงเรียน)"
        aria-label="ค้นหานักเรียนทั้งโรงเรียน"
      />
    </div>

    <!-- search results take over when typing -->
    <section v-if="searching" class="panel" aria-label="ผลการค้นหา">
      <div class="table-wrap">
        <table>
          <thead><tr><th>รหัส</th><th>ชื่อ-สกุล</th><th>ชั้น/ห้อง</th></tr></thead>
          <tbody>
            <tr v-for="s in results" :key="s.id" @click="openRoom(s.grade, s.room)">
              <td>{{ s.id }}</td>
              <td class="nm">{{ s.firstName }} {{ s.lastName }}</td>
              <td>{{ s.grade }}/{{ s.room }}</td>
            </tr>
            <tr v-if="!results.length">
              <td colspan="3" class="empty-cell">ไม่พบนักเรียนที่ตรงกับ "{{ search.trim() }}"</td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>

    <!-- MAP: every grade + room on one scannable screen -->
    <template v-else-if="view === 'map'">
      <div v-if="data.structure.length === 0" class="blank">
        <span class="blank-ico" aria-hidden="true">👥</span>
        <p class="blank-title">ยังไม่มีนักเรียนในระบบ</p>
        <p class="blank-sub">เพิ่มรายชื่อนักเรียนได้ที่เมนูผู้ช่วยจัดการข้อมูล</p>
      </div>

      <div v-else class="map">
        <section v-for="g in data.structure" :key="g.grade" class="grade-band">
          <header class="band-head">
            <h2 class="band-name">{{ g.grade }}</h2>
            <span class="band-meta">{{ data.gradeInfo(g.grade).total }} คน · {{ g.rooms.length }} ห้อง</span>
          </header>

          <div class="room-grid">
            <button
              v-for="r in g.rooms"
              :key="r"
              class="room-card stagger-item"
              :style="{ '--i': cardIndex.get(`${g.grade}/${r}`) }"
              @click="openRoom(g.grade, r)"
            >
              <span class="rc-name">{{ g.grade }}/{{ r }}</span>
              <span class="rc-count">{{ data.roomInfo(g.grade, r).total }} คน</span>
            </button>
          </div>
        </section>
      </div>
    </template>

    <!-- STUDENTS: roster of the chosen room (in-place swap) -->
    <template v-else>
      <div class="room-actions">
        <button class="act-card" :disabled="!roomStudents.length" @click="exportRoom">
          <span class="act-ico" aria-hidden="true">📤</span>
          <span class="act-body">
            <span class="act-title">ส่งออกรายชื่อนักเรียน</span>
            <span class="act-desc">ดาวน์โหลดรายชื่อนักเรียนของห้องนี้เป็นไฟล์ Excel</span>
          </span>
        </button>
      </div>

      <div class="round-picker">
        <span class="round-label">เลือกรอบการวัด</span>
        <div class="round-tabs session-tabs" role="tablist" aria-label="รอบการวัด">
          <button
            v-for="s in SESSIONS"
            :key="s.term + s.round"
            class="round-tab"
            :class="{ on: isActiveSession(s.term, s.round) }"
            role="tab"
            :aria-selected="isActiveSession(s.term, s.round)"
            @click="pickSession(s.term, s.round)"
          >
            {{ s.label }}
            <span class="rt-count" :class="sessionCounts.get(s.term + s.round)! === roomStudents.length && roomStudents.length > 0 ? 'good' : sessionCounts.get(s.term + s.round)! === 0 ? 'neutral' : 'warn'">{{ sessionCounts.get(s.term + s.round)! }}/{{ roomStudents.length }}</span>
          </button>
        </div>
      </div>

      <div class="panel">
        <div class="toolbar">
          <p class="round-summary">
            ภาคเรียนที่ {{ sessTerm }} ครั้งที่ {{ sessRound }} ·
            บันทึกแล้ว <strong>{{ sessionCounts.get(sessTerm + sessRound) ?? 0 }}</strong>/{{ roomStudents.length }} คน
          </p>
          <span class="spacer"></span>
          <button
            v-if="roomRiskCount"
            class="chipbtn"
            :class="{ on: riskOnly }"
            :aria-pressed="riskOnly"
            @click="riskOnly = !riskOnly"
          >
            ⚠️ เฉพาะกลุ่มเสี่ยง <span class="chip-n">{{ roomRiskCount }}</span>
          </button>
        </div>
        <div class="table-wrap ws-scroll">
          <table class="ws-table">
            <thead>
              <tr>
                <th>รหัส</th><th>ชื่อ-สกุล</th><th>เพศ</th>
                <th class="num">น้ำหนัก</th><th class="num">ส่วนสูง</th>
                <th class="ctr">น้ำหนัก/อายุ</th><th class="ctr">ส่วนสูง/อายุ</th><th class="ctr">น้ำหนัก/ส่วนสูง</th><th class="ctr">สูงดีสมส่วน</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="s in currentRoomStudents" :key="s.id" tabindex="0" @click="openStudent(s.id, grade, room)" @keydown.enter="openStudent(s.id, grade, room)">
                <td class="id">{{ s.id }}</td>
                <td class="nm">{{ s.firstName }} {{ s.lastName }}</td>
                <td>{{ s.gender }}</td>
                <template v-if="assessMap.get(s.id)!.measure">
                  <td class="num">{{ assessMap.get(s.id)!.measure!.weightKg }} <span class="unit">กก.</span></td>
                  <td class="num">{{ assessMap.get(s.id)!.measure!.heightCm }} <span class="unit">ซม.</span></td>
                  <template v-if="assessMap.get(s.id)!.result">
                    <td class="ctr"><span class="pill" :class="wfaClass[assessMap.get(s.id)!.result!.wfa]">{{ shortWfa(assessMap.get(s.id)!.result!.wfa) }}</span></td>
                    <td class="ctr"><span class="pill" :class="hfaClass[assessMap.get(s.id)!.result!.hfa]">{{ shortHfa(assessMap.get(s.id)!.result!.hfa) }}</span></td>
                    <td class="ctr"><span class="pill" :class="wfhClass[assessMap.get(s.id)!.result!.wfh]">{{ assessMap.get(s.id)!.result!.wfh }}</span></td>
                    <td class="ctr"><span class="pill" :class="assessMap.get(s.id)!.result!.tall ? 'good' : 'warn'">{{ assessMap.get(s.id)!.result!.tall ? 'สูงดีสมส่วน' : 'ไม่สมส่วน' }}</span></td>
                  </template>
                  <td v-else class="ctr unmeasured" colspan="4"><span class="pill neutral">ประเมินไม่ได้</span></td>
                </template>
                <template v-else>
                  <td class="num c-dash">—</td><td class="num c-dash">—</td>
                  <td class="ctr unmeasured" colspan="4"><span class="pill neutral">ยังไม่วัด</span></td>
                </template>
              </tr>
              <tr v-if="!currentRoomStudents.length">
                <td colspan="9" class="empty-cell">
                  {{ riskOnly ? 'ไม่มีนักเรียนกลุ่มเสี่ยงในห้องนี้ 🎉' : 'ห้องนี้ยังไม่มีรายชื่อนักเรียน' }}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </template>

    <Transition name="toast">
      <div v-if="toast" class="toast" role="status">{{ toast }}</div>
    </Transition>
  </div>
</template>

<style scoped>
/* ---- search ---- */
.searchbar { position: relative; margin-bottom: var(--s4); }
.search-ico {
  position: absolute; left: 14px; top: 50%; transform: translateY(-50%);
  font-size: 16px; pointer-events: none; opacity: 0.65;
}
.searchbar .search { width: 100%; padding-left: 42px; }

/* ---- map: grade bands ---- */
.map { display: flex; flex-direction: column; gap: var(--s5); }
.grade-band { display: flex; flex-direction: column; gap: var(--s3); }
.band-head {
  display: flex; align-items: baseline; justify-content: space-between;
  gap: var(--s3); flex-wrap: wrap;
  padding-bottom: var(--s2); border-bottom: 1px solid var(--line);
}
.band-name { font-size: 19px; font-weight: 800; color: var(--ink); margin: 0; }
.band-meta { font-size: 14px; font-weight: 600; color: var(--ink-muted); }

.room-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(160px, 1fr)); gap: var(--s3); }
.room-card {
  display: flex; flex-direction: column; gap: 6px;
  text-align: left; cursor: pointer;
  padding: var(--s4); min-height: 112px;
  background: var(--surface); border: 1px solid var(--line); border-radius: var(--r);
  transition: transform 180ms var(--ease), box-shadow 180ms var(--ease), border-color 180ms var(--ease);
}
.room-card:hover { transform: translateY(-2px); box-shadow: var(--shadow); border-color: var(--brand); }
.room-card:focus-visible { outline: 2px solid var(--brand); outline-offset: 2px; }
.room-card:active { transform: translateY(0); }
.rc-name { font-size: 21px; font-weight: 800; color: var(--ink); line-height: 1.1; }
.rc-count { font-size: 13px; font-weight: 600; color: var(--ink-muted); }
.rc-tags { display: flex; flex-wrap: wrap; gap: 6px; margin-top: auto; }
.rc-tags .pill { font-size: 12px; }
.rc-tags .risk::before { display: none; }

/* ---- room actions (reused vocabulary) ---- */
.room-actions { display: grid; grid-template-columns: repeat(auto-fit, minmax(230px, 1fr)); gap: var(--s3); margin-bottom: var(--s4); }
.act-card {
  display: flex; align-items: center; gap: var(--s3); text-align: left; cursor: pointer;
  padding: var(--s4); background: var(--surface); border: 1px solid var(--line); border-radius: var(--r);
  transition: border-color 150ms var(--ease), background 150ms var(--ease);
}
.act-card:hover:not(:disabled) { border-color: var(--brand); background: var(--brand-tint); }
.act-card:focus-visible { outline: 2px solid var(--brand); outline-offset: 2px; }
.act-card:disabled { opacity: 0.5; cursor: not-allowed; }
.act-ico { font-size: 24px; }
.act-body { display: flex; flex-direction: column; gap: 2px; }
.act-title { font-weight: 700; color: var(--ink); }
.act-desc { font-size: 13.5px; color: var(--ink-muted); }

/* ---- risk filter chip ---- */
.chipbtn { border: 1px solid var(--line); background: var(--surface); border-radius: 999px; padding: 7px 14px; font-size: 13.5px; font-weight: 600; color: var(--ink-muted); cursor: pointer; display: inline-flex; align-items: center; gap: 6px; }
.chipbtn.on { background: var(--warn-tint); border-color: var(--warn); color: var(--warn); }
.chip-n { background: var(--warn); color: #fff; border-radius: 999px; padding: 0 7px; font-size: 12px; }
.chipbtn:not(.on) .chip-n { background: var(--line); color: var(--ink-muted); }

/* ---- round picker (measurement session selector) ---- */
.round-picker { display: flex; flex-direction: column; gap: 8px; margin-bottom: var(--s4); }
.round-label { font-size: 13px; font-weight: 700; color: var(--ink-muted); }
.round-tabs { display: inline-flex; gap: 4px; background: var(--surface-2); padding: 4px; border-radius: 12px; flex-wrap: wrap; align-self: flex-start; }
.session-tabs { flex-wrap: wrap; }
.round-tab {
  display: inline-flex; align-items: center; gap: 8px; border: none; background: transparent;
  border-radius: 9px; cursor: pointer; padding: 8px 14px; font-size: 14.5px; font-weight: 700;
  color: var(--ink-muted); transition: background 140ms var(--ease), color 140ms var(--ease);
}
.round-tab:hover:not(.on) { color: var(--ink); }
.round-tab.on { background: var(--surface); color: var(--brand-ink); box-shadow: 0 1px 3px rgba(20,30,35,0.12); }
.round-tab:focus-visible { outline: 2px solid var(--brand); outline-offset: 2px; }
.rt-count { font-size: 12px; font-weight: 800; padding: 1px 8px; border-radius: 999px; }
.rt-count.good { background: var(--good-tint); color: var(--good); }
.rt-count.warn { background: var(--warn-tint); color: var(--warn); }
.rt-count.neutral { background: var(--surface); color: var(--ink-muted); box-shadow: inset 0 0 0 1px var(--line); }
.round-tab.on .rt-count.neutral { background: var(--brand-tint); box-shadow: none; }

/* ---- round summary (replaces the redundant room title) ---- */
.round-summary { margin: 0; font-size: 14.5px; color: var(--ink-muted); }
.round-summary strong { color: var(--ink); font-weight: 800; }

/* ---- wide table ---- */
.ws-scroll { overflow-x: auto; }
.ws-table { min-width: 880px; }
.ws-table thead th { background: var(--surface-2); border-bottom: 1px solid var(--line); white-space: nowrap; }
.ws-table th.num, .ws-table td.num { text-align: right; white-space: nowrap; }
.ws-table th.ctr, .ws-table td.ctr { text-align: center; }
.ws-table .pill { white-space: normal; }
.ws-table td.id { font-variant-numeric: tabular-nums; color: var(--ink-muted); font-weight: 600; }
.ws-table td.num { font-variant-numeric: tabular-nums; font-weight: 600; }
.ws-table .unit { color: var(--ink-muted); font-weight: 500; font-size: 13px; }
.ws-table td.c-dash { color: var(--ink-muted); }
.ws-table td.unmeasured { text-align: center; }
.ws-table td.unmeasured .pill { opacity: 0.85; }

/* ---- table rows: clickable affordance ---- */
.ws-table tbody tr { cursor: pointer; transition: background 120ms var(--ease); }
.ws-table tbody tr:hover { background: var(--brand-tint); }
.ws-table tbody tr:focus-visible { outline: 2px solid var(--brand); outline-offset: -2px; }
.nm { font-weight: 600; }
.empty-cell { text-align: center; color: var(--ink-muted); padding: var(--s5); }

@media (prefers-reduced-motion: reduce) {
  .ws-table tbody tr, .round-tab { transition: none; }
}

/* ---- empty state ---- */
.blank { text-align: center; padding: var(--s6) var(--s4); color: var(--ink-muted); }
.blank-ico { font-size: 40px; }
.blank-title { font-weight: 700; color: var(--ink); margin: var(--s3) 0 4px; }
.blank-sub { font-size: 14px; margin: 0; }

/* ---- toast ---- */
.toast {
  position: fixed; left: 50%; bottom: 24px; transform: translateX(-50%);
  background: var(--ink); color: #fff; padding: 10px 18px; border-radius: 999px;
  font-size: 14.5px; font-weight: 600; box-shadow: var(--shadow); z-index: 60;
}
.toast-enter-active, .toast-leave-active { transition: opacity 200ms var(--ease), transform 200ms var(--ease); }
.toast-enter-from, .toast-leave-to { opacity: 0; transform: translate(-50%, 8px); }

@media (prefers-reduced-motion: reduce) {
  .room-card { transition: none; }
  .room-card:hover { transform: none; }
}
</style>
