<script setup lang="ts">
defineOptions({ name: 'MeasureView' });
import { ref, computed, watch, onBeforeUnmount, onMounted } from 'vue';
import { useData } from '../stores/data';
import { validateWeight, validateHeight, validateThaiDate, round1 } from '../domain/validation/rules';
import { calcNutrition } from '../domain/nutrition/engine';
import { todayThai } from '../domain/date/thai-date';
import type { Term, Round, Student } from '../domain/types';
import { aoaToXlsxBlob, measureTemplateAoa } from '../domain/transfer/xlsx';
import { downloadBlob } from './download';
import ImportDialog from '../components/ImportDialog.vue';
import { useHeader } from '../stores/header';

defineEmits<{ done: []; exit: [] }>();
const data = useData();

// Two surfaces only: pick a room, then a data table for that room. No wizard.
const view = ref<'rooms' | 'table'>('rooms');

const sessYear = ref(data.period.year);
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
  if (isActiveSession(term, round)) return;
  sessTerm.value = term;
  sessRound.value = round;
  data.measureSession = { term, round };
  loadRows();
}
// students in the picked room with a record for this exact session
function sessionCount(term: Term, round: Round): number {
  return data
    .roomStudents(pickedGrade.value, pickedRoom.value)
    .filter((s) => data.findDuplicate(s.id, sessYear.value, term, round) !== null).length;
}
const sessDate = ref(todayThai());

const pickedGrade = ref('');
const pickedRoom = ref('');
const picked = computed(() => (pickedGrade.value && pickedRoom.value ? `${pickedGrade.value}/${pickedRoom.value}` : ''));

const header = useHeader();
function syncHeader() {
  if (view.value === 'table') {
    header.setHeader({
      title: `ผลการวัด · ห้อง ${picked.value}`,
      back: () => { view.value = 'rooms'; },
      context: 'session',
    });
  } else {
    header.setHeader({ title: 'บันทึกการวัด', back: null, context: 'year' });
  }
}
onMounted(syncHeader);
watch([view, picked], syncHeader);

// A row carries the current inputs plus the originally-loaded values, so we can
// tell which rows the teacher actually changed (dirty) and only save those.
interface Row {
  student: Student;
  w: string;
  h: string;
  origW: string;
  origH: string;
  date: string; // measurement date for this row (editable per student)
  origDate: string; // date as loaded, to detect date-only edits
}
const rows = ref<Row[]>([]);

// roster for the picked room, sorted by student id (numeric-aware)
function sortedRoom(grade: string, room: string): Student[] {
  return data
    .roomStudents(grade, room)
    .slice()
    .sort((a, b) => a.id.localeCompare(b.id, undefined, { numeric: true }));
}

const roomTotal = computed(() => data.roomStudents(pickedGrade.value, pickedRoom.value).length);
function roomMeasuredCount(grade: string, room: string): number {
  return data
    .roomStudents(grade, room)
    .filter((s) => data.measuresFor(s.id).some((m) => m.year === data.period.year)).length;
}

const allRooms = computed(() =>
  data.structure.flatMap((g) =>
    g.rooms.map((r) => ({ grade: g.grade, room: r, total: data.roomStudents(g.grade, r).length })),
  ),
);

// Load the table for the picked room + current round, prefilling existing results.
function loadRows() {
  rows.value = sortedRoom(pickedGrade.value, pickedRoom.value).map((s) => {
    const ex = data.findDuplicate(s.id, sessYear.value, sessTerm.value, sessRound.value);
    const w = ex ? String(ex.weightKg) : '';
    const h = ex ? String(ex.heightCm) : '';
    // recorded rows keep their own date; new rows default to the session date
    const date = ex ? ex.date : sessDate.value;
    return { student: s, w, h, origW: w, origH: h, date, origDate: ex ? ex.date : '' };
  });
}

function start(grade: string, room: string) {
  pickedGrade.value = grade;
  pickedRoom.value = room;
  sessYear.value = data.period.year;
  sessTerm.value = '1';
  sessRound.value = '1';
  sessDate.value = todayThai();
  data.measureSession = { term: '1', round: '1' };
  loadRows();
  view.value = 'table';
}

// Live nutrition result for a row (shows existing results too, since prefilled).
function assess(row: Row) {
  const w = parseFloat(row.w);
  const h = parseFloat(row.h);
  if (isNaN(w) || isNaN(h)) return null;
  if (validateWeight(round1(w)) || validateHeight(round1(h))) return null;
  return calcNutrition(row.student, {
    studentId: row.student.id,
    year: sessYear.value,
    term: sessTerm.value,
    round: sessRound.value,
    date: row.date || sessDate.value,
    weightKg: round1(w),
    heightCm: round1(h),
    savedAt: Date.now(),
    gradeAtMeasure: row.student.grade,
    roomAtMeasure: row.student.room,
  });
}

function rowErr(row: Row) {
  const w = parseFloat(row.w);
  const h = parseFloat(row.h);
  return {
    w: row.w ? validateWeight(round1(w)) : null,
    h: row.h ? validateHeight(round1(h)) : null,
  };
}
function rowValid(row: Row) {
  const w = parseFloat(row.w);
  const h = parseFloat(row.h);
  return (
    !isNaN(w) && !isNaN(h) &&
    !validateWeight(round1(w)) && !validateHeight(round1(h)) &&
    !validateThaiDate(row.date, false)
  );
}
function rowDirty(row: Row) {
  return rowValid(row) && (row.w !== row.origW || row.h !== row.origH || row.date !== row.origDate);
}
function isRecorded(row: Row) {
  return row.origW !== '' && row.origH !== '';
}

const recordedCount = computed(() => rows.value.filter((r) => isRecorded(r)).length);
const dirtyCount = computed(() => rows.value.filter((r) => rowDirty(r)).length);

function save() {
  let n = 0;
  for (const r of rows.value) {
    if (!rowDirty(r)) continue;
    data.upsertMeasure({
      studentId: r.student.id,
      year: sessYear.value,
      term: sessTerm.value,
      round: sessRound.value,
      date: r.date || sessDate.value,
      weightKg: round1(parseFloat(r.w)),
      heightCm: round1(parseFloat(r.h)),
      gradeAtMeasure: r.student.grade,
      roomAtMeasure: r.student.room,
      savedAt: Date.now(),
    });
    n++;
  }
  loadRows();
  say(`บันทึกผลการวัด ${n} คน เรียบร้อย`);
}

// toast
const toast = ref('');
let toastT: ReturnType<typeof setTimeout> | undefined;
function say(msg: string) {
  toast.value = msg;
  if (toastT) clearTimeout(toastT);
  toastT = setTimeout(() => (toast.value = ''), 3000);
}

// Excel import (shared dialog, scoped to this session)
const importOpen = ref(false);
function onImported(r: { added: number; updated: number }) {
  loadRows();
  say(`นำเข้า Excel แล้ว · เพิ่ม ${r.added} · อัปเดต ${r.updated}`);
}

// Session date is the default for new entries; propagate to not-yet-recorded rows.
watch(sessDate, (d) => {
  for (const r of rows.value) if (r.origDate === '') r.date = d;
});

// Mirror the round tabs + default date into the sticky footer, but only once
// the top toolbar has scrolled out of view (avoids duplicate controls on screen).
const tbarEl = ref<HTMLElement | null>(null);
const tbarOffscreen = ref(false);
let io: IntersectionObserver | null = null;
watch(tbarEl, (el) => {
  io?.disconnect();
  tbarOffscreen.value = false;
  if (el) {
    io = new IntersectionObserver(([e]) => { tbarOffscreen.value = !e.isIntersecting; }, { threshold: 0 });
    io.observe(el);
  }
});
onBeforeUnmount(() => {
  io?.disconnect();
  data.measureSession = null;
});

watch(view, (v) => {
  if (v === 'rooms') data.measureSession = null;
});

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
</script>

<template>
  <div class="proto-screen proto-wide" :class="{ 'proto-xwide': view === 'table' }">
    <!-- archived year: recording is disabled -->
    <div v-if="data.isReadonly" class="panel">
      <div class="empty">
        <span class="ico" aria-hidden="true">🔒</span>
        <div>ปีการศึกษา {{ data.viewingYear }} เก็บถาวรแล้ว ดูข้อมูลได้ แต่บันทึกการวัดเพิ่มไม่ได้</div>
        <button class="btn primary" @click="data.viewActive()">กลับไปปีปัจจุบันเพื่อบันทึก</button>
      </div>
    </div>

    <!-- ===== room list ===== -->
    <template v-else-if="view === 'rooms'">
      <p class="page-sub">เลือกห้องเพื่อดูและบันทึกผลการวัดของห้องนั้น</p>

      <div v-if="!data.students.length" class="panel">
        <div class="empty">
          <span class="ico">📏</span>
          <div>ยังไม่มีนักเรียน เพิ่มรายชื่อก่อนจึงจะบันทึกการวัดได้</div>
        </div>
      </div>
      <div v-else class="panel" style="padding: 0">
        <div class="mrow head" style="grid-template-columns: 1.4fr 1fr auto"><div>ห้อง</div><div>สถานะการวัดปีนี้</div><div></div></div>
        <button
          v-for="c in allRooms"
          :key="c.grade + c.room"
          class="mrow room-row"
          style="grid-template-columns: 1.4fr 1fr auto"
          @click="start(c.grade, c.room)"
        >
          <div class="nm">{{ c.grade }}/{{ c.room }} <span style="color: var(--ink-muted); font-weight: 400">· {{ c.total }} คน</span></div>
          <span class="pill" :class="roomMeasuredCount(c.grade, c.room) === c.total && c.total > 0 ? 'good' : roomMeasuredCount(c.grade, c.room) === 0 ? 'neutral' : 'warn'">
            {{ roomMeasuredCount(c.grade, c.room) === c.total && c.total > 0 ? 'วัดครบแล้ว' : roomMeasuredCount(c.grade, c.room) === 0 ? 'ยังไม่วัด' : `วัดแล้ว ${roomMeasuredCount(c.grade, c.room)}/${c.total}` }}
          </span>
          <span class="chev" aria-hidden="true">›</span>
        </button>
      </div>
      <div class="wiz-foot"><button class="btn quiet" @click="$emit('exit')">ออก</button></div>
    </template>

    <!-- ===== room measurement table ===== -->
    <template v-else>
      <p class="page-sub">ปีการศึกษา {{ sessYear }} · ภาคเรียนที่ {{ sessTerm }} · {{ roomTotal }} คน — กรอกหรือแก้ไขได้ในตาราง</p>

      <!-- round selector (tabs, not dropdown) + measure date -->
      <div ref="tbarEl" class="tbar">
        <div class="round-tabs session-tabs" role="tablist">
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
            <span class="rt-count" :class="sessionCount(s.term, s.round) === roomTotal && roomTotal > 0 ? 'good' : sessionCount(s.term, s.round) === 0 ? 'neutral' : 'warn'">{{ sessionCount(s.term, s.round) }}/{{ roomTotal }}</span>
          </button>
        </div>
      </div>

      <!-- Excel actions in context, at the top, with descriptions -->
      <div class="room-actions">
        <button class="act-card" @click="importOpen = true">
          <span class="act-ico">📥</span>
          <span class="act-body">
            <span class="act-title">นำเข้าผลการวัด</span>
            <span class="act-desc">นำเข้าผลการวัดของห้องนี้ (ภาคเรียนที่ {{ sessTerm }} ครั้งที่ {{ sessRound }}) จากไฟล์ Excel</span>
          </span>
        </button>
        <button class="act-card" @click="downloadBlob(aoaToXlsxBlob(measureTemplateAoa(), 'ผลการวัด'), 'แม่แบบผลการวัด.xlsx')">
          <span class="act-ico">📄</span>
          <span class="act-body">
            <span class="act-title">ดาวน์โหลดแม่แบบ Excel</span>
            <span class="act-desc">ดาวน์โหลดไฟล์ตัวอย่างสำหรับกรอกผลการวัดห้องนี้</span>
          </span>
        </button>
      </div>

      <!-- summary line -->
      <div class="tbl-summary">
        บันทึกแล้ว <strong>{{ recordedCount }}</strong>/{{ roomTotal }} คนในภาคเรียนที่ {{ sessTerm }} ครั้งที่ {{ sessRound }}
        <template v-if="dirtyCount"> · มีการแก้ไขที่ยังไม่บันทึก <strong>{{ dirtyCount }}</strong></template>
      </div>

      <!-- data table: existing values prefilled + 4 criteria in separate columns -->
      <div class="panel tbl-scroll" style="padding: 0">
        <div class="mrow head measure-grid">
          <div>รหัส</div><div>ชื่อ-สกุล</div><div>น้ำหนัก</div><div>ส่วนสูง</div><div>วันที่วัด</div>
          <div>น้ำหนัก/อายุ</div><div>ส่วนสูง/อายุ</div><div>น้ำหนัก/ส่วนสูง</div><div>สูงดีสมส่วน</div>
        </div>
        <div v-for="r in rows" :key="r.student.id" class="mrow datarow measure-grid">
          <div class="c-id">{{ r.student.id }}</div>
          <div class="c-name">
            <span class="nm">{{ r.student.firstName }} {{ r.student.lastName }}</span>
          </div>
          <div class="c-num">
            <input v-model="r.w" type="number" step="0.1" inputmode="decimal" placeholder="กก." :class="{ dirty: rowDirty(r) }" />
            <div v-if="rowErr(r).w" class="err">{{ rowErr(r).w }}</div>
          </div>
          <div class="c-num">
            <input v-model="r.h" type="number" step="0.1" inputmode="decimal" placeholder="ซม." :class="{ dirty: rowDirty(r) }" />
            <div v-if="rowErr(r).h" class="err">{{ rowErr(r).h }}</div>
          </div>
          <div class="c-date">
            <input v-model="r.date" type="text" inputmode="numeric" placeholder="ว/ด/ปปปป" :class="{ dirty: rowDirty(r) }" />
            <div v-if="r.date && validateThaiDate(r.date, false)" class="err">{{ validateThaiDate(r.date, false) }}</div>
          </div>
          <template v-if="assess(r)">
            <div><span class="pill" :class="wfaClass[assess(r)!.wfa]">{{ assess(r)!.wfa }}</span></div>
            <div><span class="pill" :class="hfaClass[assess(r)!.hfa]">{{ assess(r)!.hfa }}</span></div>
            <div><span class="pill" :class="wfhClass[assess(r)!.wfh]">{{ assess(r)!.wfh }}</span></div>
            <div><span class="pill" :class="assess(r)!.tall ? 'good' : 'warn'">{{ assess(r)!.tall ? 'สูงดีสมส่วน' : 'ไม่สมส่วน' }}</span></div>
          </template>
          <template v-else>
            <div class="empty-c">—</div><div class="empty-c">—</div><div class="empty-c">—</div><div class="empty-c">—</div>
          </template>
        </div>
      </div>

      <!-- sticky save bar — also mirrors round tabs + date once the top bar is offscreen -->
      <div class="save-bar">
        <template v-if="tbarOffscreen">
          <div class="round-tabs round-tabs-sm session-tabs" role="tablist">
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
              <span class="rt-count" :class="sessionCount(s.term, s.round) === roomTotal && roomTotal > 0 ? 'good' : sessionCount(s.term, s.round) === 0 ? 'neutral' : 'warn'">{{ sessionCount(s.term, s.round) }}/{{ roomTotal }}</span>
            </button>
          </div>
        </template>
        <span v-else class="save-hint">
          {{ dirtyCount > 0 ? `มีการแก้ไข ${dirtyCount} รายการที่ยังไม่บันทึก` : 'บันทึกผลครบแล้ว' }}
        </span>
        <span class="spacer"></span>
        <button class="btn-save" :disabled="dirtyCount === 0" @click="save">
          {{ dirtyCount > 0 ? `บันทึก ${dirtyCount} รายการ` : '✓ บันทึกแล้ว' }}
        </button>
      </div>
    </template>

    <ImportDialog
      :open="importOpen"
      kind="measure"
      :grade="pickedGrade"
      :room="pickedRoom"
      :year="sessYear"
      :term="sessTerm"
      :round="sessRound"
      @imported="onImported"
      @close="importOpen = false"
    />

    <Transition name="toast"><div v-if="toast" class="toast">✓ {{ toast }}</div></Transition>
  </div>
</template>

<style scoped>
.room-row {
  width: 100%; text-align: left; background: var(--surface); border: none;
  border-bottom: 1px solid var(--line-soft); cursor: pointer; align-items: center;
  transition: background 120ms var(--ease);
}
.room-row:hover { background: var(--brand-tint); }
.room-row:last-child { border-bottom: none; }
.room-row .pill { justify-self: start; }
.chev { color: var(--ink-muted); font-size: 22px; line-height: 1; }

/* toolbar: round tabs + date */
.tbar { display: flex; align-items: flex-end; gap: var(--s3); flex-wrap: wrap; margin-bottom: var(--s3); }
.round-tabs { display: inline-flex; gap: 4px; background: var(--surface-2); padding: 4px; border-radius: 12px; }
.session-tabs { flex-wrap: wrap; }
.session-tabs .round-tab { flex: 1 1 auto; justify-content: center; white-space: nowrap; }
.round-tab {
  display: inline-flex; align-items: center; gap: 8px;
  border: none; background: transparent; border-radius: 9px; cursor: pointer;
  padding: 8px 16px; font-size: 15px; font-weight: 700; color: var(--ink-muted);
  transition: background 120ms var(--ease), color 120ms var(--ease);
}
.round-tab.on { background: var(--surface); color: var(--brand-ink); box-shadow: 0 1px 3px rgba(20,30,35,0.12); }
.rt-count { font-size: 12px; font-weight: 700; padding: 1px 8px; border-radius: 999px; }
.rt-count.good { background: var(--good-tint); color: var(--good); }
.rt-count.warn { background: var(--warn-tint); color: var(--warn); }
.rt-count.neutral { background: var(--surface-2); color: var(--ink-muted); }
.round-tab.on .rt-count.neutral { background: var(--brand-tint); }

.tbl-summary { font-size: 14px; color: var(--ink-muted); margin-bottom: var(--s2); }

/* in-context Excel action cards (top of table) */
.room-actions { display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: var(--s3); margin-bottom: var(--s4); }
.act-card {
  display: flex; gap: var(--s3); align-items: flex-start; text-align: left;
  background: var(--surface); border: 1px solid var(--line); border-radius: var(--rounded-md, 16px);
  padding: var(--s3) var(--s4); cursor: pointer; transition: border-color 120ms var(--ease), background 120ms var(--ease);
}
.act-card:hover { border-color: var(--brand); background: var(--brand-tint); }
.act-card:disabled { opacity: 0.5; cursor: not-allowed; }
.act-ico { font-size: 22px; line-height: 1.2; flex-shrink: 0; }
.act-body { display: flex; flex-direction: column; gap: 2px; }
.act-title { font-weight: 700; color: var(--ink); }
.act-desc { font-size: 13px; color: var(--ink-muted); line-height: 1.4; }

/* wider canvas for the data table */
.proto-xwide { max-width: 1340px; }

/* measurement table: each value in its own column */
.tbl-scroll { overflow-x: auto; }
.measure-grid {
  grid-template-columns:
    72px              /* รหัส */
    minmax(150px, 1.4fr) /* ชื่อ-สกุล */
    88px 88px         /* น้ำหนัก / ส่วนสูง */
    120px             /* วันที่วัด */
    1fr 1fr 1fr minmax(104px, 0.95fr); /* 4 criteria */
  min-width: 980px;
  align-items: center;
  column-gap: var(--s3);
}
.measure-grid > div { min-width: 0; }

.c-id { font-family: monospace; font-size: 13px; font-weight: 700; color: var(--ink-muted); }
.c-name { display: flex; flex-direction: column; gap: 3px; }
.c-name .nm { font-weight: 600; }
.c-num { display: flex; flex-direction: column; gap: 3px; }
.c-num input { width: 100%; }
.c-date { display: flex; flex-direction: column; gap: 3px; }
.c-date input { width: 100%; }

/* allow long criterion labels to wrap inside their column instead of overflowing */
.measure-grid .pill { white-space: normal; max-width: 100%; align-items: flex-start; }
.measure-grid .pill::before { margin-top: 5px; }
.empty-c { color: var(--ink-muted); text-align: center; }
.datarow input.dirty { border-color: var(--brand); background: var(--brand-tint); }
.err { color: var(--bad); font-size: 12px; line-height: 1.3; }

/* save bar: solid footer, saturated primary */
.save-bar {
  position: sticky; bottom: 0; z-index: 5;
  display: flex; align-items: center; gap: var(--s3); flex-wrap: wrap;
  margin-top: var(--s4); padding: var(--s3) var(--s4);
  background: var(--surface); border: 1px solid var(--line); border-radius: var(--rounded-md, 16px);
  box-shadow: 0 -6px 18px rgba(20, 30, 35, 0.06);
}
.save-bar .save-hint { font-size: 13.5px; color: var(--ink-muted); }
/* compact mirrored controls in the footer */
.round-tabs-sm { padding: 3px; }
.round-tabs-sm .round-tab { padding: 6px 12px; font-size: 14px; }
.btn-save {
  border: none; border-radius: 12px; cursor: pointer;
  padding: 12px 28px; font-size: 16px; font-weight: 700; color: #fff;
  background: var(--brand-strong); box-shadow: 0 4px 12px oklch(0.55 0.16 200 / 0.35);
  transition: transform 120ms var(--ease), box-shadow 120ms var(--ease), background 120ms var(--ease);
}
.btn-save:hover:not(:disabled) { transform: translateY(-1px); box-shadow: 0 6px 18px oklch(0.55 0.16 200 / 0.45); }
.btn-save:active:not(:disabled) { transform: translateY(0); }
.btn-save:disabled { background: var(--surface-2); color: var(--ink-muted); cursor: not-allowed; box-shadow: none; }

.toast {
  position: fixed; left: 50%; bottom: 24px; transform: translateX(-50%);
  background: var(--ink); color: #fff; padding: 10px 18px; border-radius: 999px;
  font-weight: 600; font-size: 14.5px; z-index: 50; box-shadow: 0 6px 20px rgba(0,0,0,0.25);
}
.toast-enter-active, .toast-leave-active { transition: opacity 200ms, transform 200ms; }
.toast-enter-from, .toast-leave-to { opacity: 0; transform: translate(-50%, 8px); }

@media (max-width: 560px) {
  .tbar { align-items: stretch; }
  .round-tabs { width: 100%; }
  .round-tab { flex: 1; justify-content: center; }
}
</style>
