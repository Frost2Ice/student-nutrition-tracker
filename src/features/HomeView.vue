<script setup lang="ts">
defineOptions({ name: 'HomeView' });
import { computed, onMounted } from 'vue';
import { useData } from '../stores/data';
import { useHeader } from '../stores/header';

const data = useData();
const header = useHeader();
onMounted(() => header.setHeader({ title: 'หน้าหลัก', back: null, context: 'year' }));
const emit = defineEmits<{ go: [dest: string, payload?: { start: string }] }>();

const periodLine = computed(() => {
  const s = data.measureSession;
  const base = `ปีการศึกษา ${data.period.year}`;
  return s ? `${base} · ภาคเรียนที่ ${s.term} · ครั้งที่ ${s.round}` : base;
});

const studentCount = computed(() => data.stats.totalStudents);
const roomCount = computed(() => data.structure.reduce((n, g) => n + g.rooms.length, 0));

// Daily work: the workflows teachers reach for every day.
const mainCards = [
  {
    ico: '👥', tone: 'brand', title: 'รายชื่อนักเรียน',
    desc: 'จัดการข้อมูลนักเรียน ค้นหา และติดตามข้อมูลนักเรียน',
    dest: 'students-poc' as const, payload: undefined,
  },
  {
    ico: '📊', tone: 'warn', title: 'รายงาน',
    desc: 'ดูรายงาน สรุปผล และส่งออกข้อมูล',
    dest: 'reports' as const, payload: undefined,
  },
];

// Guided workflow: milestone tasks completed in order across the school year,
// not daily actions. The numbers are the point — they carry the sequence.
const flowSteps = [
  {
    ico: '📥', title: 'เพิ่มรายชื่อนักเรียน',
    desc: 'นำเข้ารายชื่อนักเรียนจากไฟล์ Excel',
    dest: 'wizard-students' as const,
  },
  {
    ico: '📏', title: 'บันทึกการวัด',
    desc: 'บันทึกข้อมูลการวัดจากไฟล์แม่แบบ Excel',
    dest: 'wizard-measures' as const,
  },
  {
    ico: '📄', title: 'ส่งออกรายงาน',
    desc: 'ดาวน์โหลดไฟล์รายงานเพื่อส่งให้หน่วยงาน',
    dest: 'wizard-export' as const,
  },
  {
    ico: '💾', title: 'สำรองข้อมูล',
    desc: 'สำรองข้อมูลไว้เพื่อป้องกันข้อมูลสูญหาย',
    dest: 'wizard-backup' as const,
  },
];
</script>

<template>
  <div class="container home">
    <!-- Hero: who/where/when, no greetings or widgets -->
    <section class="identity">
      <div class="id-text">
        <h1 class="id-school">{{ data.setup.school }}</h1>
        <p class="id-period">{{ periodLine }}</p>
      </div>
      <div class="id-count" aria-label="จำนวนนักเรียนและห้องเรียน">
        <span><strong>{{ studentCount.toLocaleString('th-TH') }}</strong> นักเรียน</span>
        <span class="id-dot" aria-hidden="true">·</span>
        <span><strong>{{ roomCount.toLocaleString('th-TH') }}</strong> ห้องเรียน</span>
      </div>
    </section>

    <!-- Daily work -->
    <section class="group">
      <h2 class="group-title">งานหลัก</h2>
      <nav class="cards cards-2" aria-label="งานหลัก">
        <button
          v-for="c in mainCards"
          :key="c.title"
          class="card"
          :class="`tone-${c.tone}`"
          @click="emit('go', c.dest, c.payload)"
        >
          <span class="card-ico" aria-hidden="true">{{ c.ico }}</span>
          <span class="card-body">
            <span class="card-title">{{ c.title }}</span>
            <span class="card-desc">{{ c.desc }}</span>
          </span>
          <span class="card-arrow" aria-hidden="true">→</span>
        </button>
      </nav>
    </section>

    <!-- Guided workflow (ordered milestones) -->
    <section class="group">
      <h2 class="group-title">ผู้ช่วยจัดการข้อมูล</h2>
      <p class="group-note">ทำตามลำดับเพื่อจัดการข้อมูลให้ครบตลอดปีการศึกษา — เริ่มต้นปี นำเข้าข้อมูล ส่งออกรายงาน และสำรองข้อมูล</p>
      <ol class="cards cards-flow" aria-label="ขั้นตอนการจัดการข้อมูลตามลำดับ">
        <li v-for="(c, i) in flowSteps" :key="c.title" class="flow-item">
          <button class="card card-step" @click="emit('go', c.dest)">
            <span class="step-num" aria-hidden="true">{{ i + 1 }}</span>
            <span class="card-ico" aria-hidden="true">{{ c.ico }}</span>
            <span class="card-body">
              <span class="card-title">{{ c.title }}</span>
              <span class="card-desc">{{ c.desc }}</span>
            </span>
            <span class="card-arrow" aria-hidden="true">→</span>
          </button>
        </li>
      </ol>
    </section>
  </div>
</template>

<style scoped>
.home { display: flex; flex-direction: column; gap: var(--s6); }

/* identity band */
.identity {
  display: flex; align-items: flex-start; justify-content: space-between;
  gap: var(--s4); flex-wrap: wrap;
  background: var(--surface); border: 1px solid var(--line); border-radius: var(--r);
  padding: var(--s5);
  box-shadow: var(--shadow-sm);
}
.id-school { font-size: 30px; font-weight: 700; line-height: 1.2; color: var(--ink); text-wrap: balance; }
.id-period { margin-top: var(--s2); font-size: 16px; color: var(--brand-ink); font-weight: 600; }
.id-count {
  display: inline-flex; align-items: baseline; gap: var(--s2);
  background: var(--brand-tint); color: var(--brand-ink);
  padding: var(--s2) var(--s4); border-radius: 999px; font-size: 15px; white-space: nowrap;
}
.id-count strong { font-size: 17px; font-weight: 700; }
.id-dot { opacity: 0.5; }

/* section grouping */
.group { display: flex; flex-direction: column; gap: var(--s4); }
.group-title { font-size: 20px; font-weight: 700; color: var(--ink); }
.group-note { font-size: 15px; line-height: 1.5; color: var(--ink-muted); margin-top: calc(var(--s3) * -1); }

/* task cards */
.cards { display: grid; gap: var(--s4); }
.cards-2 { grid-template-columns: repeat(2, 1fr); }
.cards-flow { grid-template-columns: repeat(2, 1fr); list-style: none; padding: 0; margin: 0; }
.flow-item { display: flex; }
.flow-item .card { width: 100%; }
@media (max-width: 720px) { .cards-2, .cards-flow { grid-template-columns: 1fr; } }

.card {
  display: grid; grid-template-columns: auto 1fr auto; align-items: center; gap: var(--s4);
  text-align: left; background: var(--surface); border: 1px solid var(--line);
  border-radius: var(--r); padding: var(--s5); min-height: 116px;
  box-shadow: var(--shadow-sm); cursor: pointer;
  transition: transform 180ms var(--ease), box-shadow 180ms var(--ease), border-color 180ms var(--ease);
}
.card:hover { transform: translateY(-2px); box-shadow: var(--shadow); border-color: var(--brand); }
.card:focus-visible { outline: 3px solid var(--brand); outline-offset: 2px; }
.card:active { transform: translateY(0); }

/* ordered-flow step: leading number carries the sequence */
.card-step { grid-template-columns: auto auto 1fr auto; }
.step-num {
  display: grid; place-items: center; width: 32px; height: 32px; flex-shrink: 0;
  border-radius: 999px; background: var(--brand); color: var(--surface);
  font-size: 16px; font-weight: 700; line-height: 1;
}

.card-ico {
  display: grid; place-items: center; width: 56px; height: 56px;
  border-radius: var(--r-sm); font-size: 28px; flex-shrink: 0;
}
.tone-brand .card-ico { background: var(--brand-tint); }
.tone-good .card-ico { background: var(--good-tint); }
.tone-warn .card-ico { background: var(--warn-tint); }
.tone-neutral .card-ico { background: var(--surface-2); }
.card-step .card-ico { background: var(--brand-tint); }

.card-body { display: flex; flex-direction: column; gap: 6px; min-width: 0; }
.card-title { font-size: 20px; font-weight: 700; color: var(--ink); }
.card-desc { font-size: 15px; line-height: 1.5; color: var(--ink-muted); }
.card-arrow {
  font-size: 22px; color: var(--ink-muted); flex-shrink: 0;
  transition: transform 180ms var(--ease), color 180ms var(--ease);
}
.card:hover .card-arrow { color: var(--brand); transform: translateX(3px); }

@media (prefers-reduced-motion: reduce) {
  .card, .card-arrow { transition: none; }
  .card:hover { transform: none; }
  .card:hover .card-arrow { transform: none; }
}
</style>
