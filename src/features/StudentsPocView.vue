<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue';
import { useData } from '../stores/data';
import { useHeader } from '../stores/header';
import { calcNutrition } from '../domain/nutrition/engine';
import type { Student } from '../domain/types';
import { aoaToXlsxBlob, studentsToAoa } from '../domain/transfer/xlsx';
import { downloadBlob } from './download';
import ImportDialog from '../components/ImportDialog.vue';

defineEmits<{ (e: 'go', target: string): void }>();

const data = useData();
const header = useHeader();

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
function roomRisk(grade: string, room: string): number {
  return data.roomStudents(grade, room).filter((s) => statusOf(s).risk).length;
}
function progressClass(m: number, t: number): StatusCls { return t > 0 && m === t ? 'good' : m === 0 ? 'neutral' : 'warn'; }
function progressText(m: number, t: number) { return t > 0 && m === t ? 'วัดครบ' : m === 0 ? 'ยังไม่วัด' : `วัดแล้ว ${m}/${t}`; }

// ---- navigation: map (grades+rooms in one) → students ----
const view = ref<'map' | 'students'>('map');
const grade = ref('');
const room = ref('');

function openRoom(g: string, r: string) {
  grade.value = g;
  room.value = r;
  riskOnly.value = false;
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
const currentRoomStudents = computed(() =>
  riskOnly.value ? roomStudents.value.filter((s) => statusOf(s).risk) : roomStudents.value,
);
const roomRiskCount = computed(() => (grade.value && room.value ? roomRisk(grade.value, room.value) : 0));

// ---- room actions ----
const importOpen = ref(false);
function onImported(r: { added: number; updated: number }) {
  say(`นำเข้า Excel แล้ว · เพิ่ม ${r.added} · อัปเดต ${r.updated}`);
}
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
          <thead><tr><th>รหัส</th><th>ชื่อ-สกุล</th><th>ชั้น/ห้อง</th><th>ภาวะล่าสุด</th></tr></thead>
          <tbody>
            <tr v-for="s in results" :key="s.id" @click="openRoom(s.grade, s.room)">
              <td>{{ s.id }}</td>
              <td class="nm">{{ s.firstName }} {{ s.lastName }}</td>
              <td>{{ s.grade }}/{{ s.room }}</td>
              <td><span class="pill" :class="statusOf(s).cls">{{ statusOf(s).label }}</span></td>
            </tr>
            <tr v-if="!results.length">
              <td colspan="4" class="empty-cell">ไม่พบนักเรียนที่ตรงกับ “{{ search.trim() }}”</td>
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
              <span class="rc-tags">
                <span
                  class="pill"
                  :class="progressClass(data.roomInfo(g.grade, r).measured, data.roomInfo(g.grade, r).total)"
                >{{ progressText(data.roomInfo(g.grade, r).measured, data.roomInfo(g.grade, r).total) }}</span>
                <span v-if="roomRisk(g.grade, r)" class="pill warn risk">⚠️ {{ roomRisk(g.grade, r) }} เสี่ยง</span>
              </span>
            </button>
          </div>
        </section>
      </div>
    </template>

    <!-- STUDENTS: roster of the chosen room (in-place swap) -->
    <template v-else>
      <div class="room-actions">
        <button class="act-card" @click="importOpen = true">
          <span class="act-ico" aria-hidden="true">📥</span>
          <span class="act-body">
            <span class="act-title">นำเข้ารายชื่อนักเรียน</span>
            <span class="act-desc">นำเข้ารายชื่อนักเรียนของห้องนี้จากไฟล์ Excel</span>
          </span>
        </button>
        <button class="act-card" :disabled="!roomStudents.length" @click="exportRoom">
          <span class="act-ico" aria-hidden="true">📤</span>
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
        <div class="table-wrap">
          <table>
            <thead><tr><th>รหัส</th><th>ชื่อ-สกุล</th><th>เพศ</th><th>ภาวะล่าสุด</th></tr></thead>
            <tbody>
              <tr v-for="s in currentRoomStudents" :key="s.id">
                <td>{{ s.id }}</td>
                <td class="nm">{{ s.firstName }} {{ s.lastName }}</td>
                <td>{{ s.gender }}</td>
                <td><span class="pill" :class="statusOf(s).cls">{{ statusOf(s).label }}</span></td>
              </tr>
              <tr v-if="!currentRoomStudents.length">
                <td colspan="4" class="empty-cell">
                  {{ riskOnly ? 'ไม่มีนักเรียนกลุ่มเสี่ยงในห้องนี้ 🎉' : 'ห้องนี้ยังไม่มีรายชื่อนักเรียน' }}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </template>

    <ImportDialog
      :open="importOpen"
      kind="student"
      :grade="grade"
      :room="room"
      @close="importOpen = false"
      @imported="onImported"
    />

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

/* ---- table rows ---- */
tbody tr { cursor: pointer; }
.nm { font-weight: 600; }
.empty-cell { text-align: center; color: var(--ink-muted); padding: var(--s5); }

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
