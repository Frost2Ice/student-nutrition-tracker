<script setup lang="ts">
defineOptions({ name: 'HomeView' });
import { computed, onMounted } from 'vue';
import { useData } from '../stores/data';
import { useHeader } from '../stores/header';

const data = useData();
const header = useHeader();
onMounted(() => header.setHeader({ title: 'หน้าหลัก', back: null, context: 'year' }));
const emit = defineEmits<{ go: [dest: string, payload?: { start: string }] }>();

const wizardCards = [
  { cls: 'j-students', start: 'students', ico: '👥', title: 'เพิ่มรายชื่อนักเรียน', desc: 'เลือกห้อง แล้วอัปโหลดหรือวางจาก Excel' },
  { cls: 'j-measure', start: 'measures', ico: '📏', title: 'บันทึกการวัด', desc: 'กรอกน้ำหนัก/ส่วนสูงทีละห้อง' },
  { cls: 'j-export', start: 'export', ico: '📤', title: 'ส่งออกรายงาน', desc: 'ดาวน์โหลดไฟล์เพื่อส่งให้หน่วยงาน' },
];

const incompleteRooms = computed(() => {
  let count = 0;
  for (const { grade, rooms } of data.structure) {
    for (const room of rooms) {
      const info = data.roomInfo(grade, room);
      if (info.measured < info.total) count++;
    }
  }
  return count;
});

const atRiskList = computed(() => data.stats.atRiskList);
const noStudents = computed(() => data.students.length === 0);
</script>

<template>
  <div class="container">
    <p class="page-sub">ภาพรวมของวันนี้</p>

    <!-- today focus -->
    <div class="today">
      <div class="today-main">
        <div class="eyebrow" style="color: oklch(1 0 0 / 0.85)">📌 วันนี้ควรทำอะไร</div>
        <div v-if="noStudents" class="today-line">ยังไม่มีข้อมูลนักเรียน</div>
        <div v-else class="today-line">ยังมี {{ incompleteRooms }} ห้องที่ยังวัดไม่ครบในรอบนี้</div>
        <button v-if="noStudents" class="btn lg" style="background: #fff; color: var(--brand-strong); border: none" @click="emit('go', 'wizard', { start: 'students' })">
          เพิ่มรายชื่อนักเรียน →
        </button>
        <button v-else class="btn lg" style="background: #fff; color: var(--brand-strong); border: none" @click="emit('go', 'wizard', { start: 'measures' })">
          บันทึกการวัดต่อ →
        </button>
      </div>
      <div class="today-side">
        <div class="ts-num">{{ atRiskList.length }}</div>
        <div>นักเรียนที่ควรติดตาม</div>
      </div>
    </div>

    <!-- start a task — launches the wizard directly -->
    <div class="section-title">เริ่มงานได้เลย</div>
    <div class="hub-flow" style="margin-bottom: var(--s5)">
      <button v-for="c in wizardCards" :key="c.start" class="jcard" :class="c.cls" @click="emit('go', 'wizard', { start: c.start })">
        <span class="medallion">{{ c.ico }}</span>
        <span class="jt">{{ c.title }}</span>
        <span class="jd">{{ c.desc }}</span>
        <span class="jgo">เริ่มเลย <span class="arr">→</span></span>
      </button>
    </div>

    <!-- quick links -->
    <div class="quick">
      <button class="q" @click="emit('go', 'students')"><span>🔎</span>ค้นหานักเรียน</button>
      <button class="q" @click="emit('go', 'promotion')"><span>🎓</span>เลื่อนชั้นปีใหม่</button>
    </div>

    <!-- follow up -->
    <div class="panel">
      <div class="toolbar">
        <div class="section-title" style="margin: 0">นักเรียนที่ต้องติดตาม</div>
        <span class="pill warn">{{ atRiskList.length }} คน</span>
      </div>
      <div v-if="noStudents" class="empty">
        <span class="ico">📋</span>
        <div>ยังไม่มีข้อมูลนักเรียน — เริ่มเพิ่มรายชื่อนักเรียนก่อนนะคะ</div>
      </div>
      <div v-else-if="!atRiskList.length" class="empty">
        <span class="ico">✅</span>
        <div>นักเรียนทุกคนอยู่ในเกณฑ์ปกติ</div>
      </div>
      <div v-else class="table-wrap">
        <table>
          <thead><tr><th>ชื่อ-สกุล</th><th>ชั้น/ห้อง</th><th>ภาวะที่พบ</th><th></th></tr></thead>
          <tbody>
            <tr v-for="item in atRiskList" :key="item.student.id" style="cursor: pointer" @click="emit('go', 'students')">
              <td style="font-weight: 600">{{ item.student.firstName }} {{ item.student.lastName }}</td>
              <td>{{ item.student.grade }}/{{ item.student.room }}</td>
              <td><span class="pill bad">{{ item.flags[0] }}</span></td>
              <td><span style="color: var(--brand-ink); font-weight: 600">ดูประวัติ →</span></td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>
</template>

<style scoped>
.today {
  display: flex; gap: var(--s4); border-radius: var(--r); overflow: hidden;
  background: linear-gradient(135deg, var(--brand), var(--brand-strong)); color: #fff;
  margin-bottom: var(--s5); box-shadow: var(--shadow);
}
.today-main { flex: 1; padding: var(--s5); display: flex; flex-direction: column; gap: var(--s3); align-items: flex-start; }
.today-line { font-size: 21px; font-weight: 700; }
.today-side {
  width: 200px; flex-shrink: 0; padding: var(--s5);
  background: oklch(1 0 0 / 0.12); display: flex; flex-direction: column;
  align-items: center; justify-content: center; text-align: center; font-size: 14px;
}
.ts-num { font-size: 44px; font-weight: 800; line-height: 1; }
@media (max-width: 640px) { .today { flex-direction: column; } .today-side { width: auto; } }

.quick { display: grid; grid-template-columns: repeat(2, 1fr); gap: var(--s3); margin-bottom: var(--s5); }
@media (max-width: 640px) { .quick { grid-template-columns: repeat(2, 1fr); } }
.q {
  display: flex; flex-direction: column; align-items: center; gap: 6px;
  padding: var(--s4); border: 1px solid var(--line); border-radius: var(--r-sm);
  background: var(--surface); font-size: 14.5px; font-weight: 600; color: var(--ink);
  transition: background 150ms var(--ease), border-color 150ms var(--ease);
}
.q span { font-size: 26px; }
.q:hover { background: var(--brand-tint); border-color: var(--brand); }
</style>
