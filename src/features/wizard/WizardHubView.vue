<script setup lang="ts">
import { ref } from 'vue';
import AddStudentsWizard from './AddStudentsWizard.vue';
import AddMeasuresWizard from './AddMeasuresWizard.vue';
import ExportWizard from './ExportWizard.vue';

const emit = defineEmits<{ go: [dest: string] }>();

type Active = 'students' | 'measures' | 'export' | null;
const active = ref<Active>(null);

const cards: { id: Exclude<Active, null>; cls: string; no: string; ico: string; title: string; desc: string; go: string }[] = [
  { id: 'students', cls: 'j-students', no: 'ขั้นที่ 1', ico: '👥', title: 'เพิ่มรายชื่อนักเรียน', desc: 'เลือกชั้น/ห้อง ดาวน์โหลดแม่แบบ กรอกรายชื่อ แล้วอัปโหลดหรือวางจาก Excel', go: 'เริ่มเพิ่มรายชื่อ' },
  { id: 'measures', cls: 'j-measure', no: 'ขั้นที่ 2', ico: '📏', title: 'บันทึกการวัด', desc: 'เลือกห้อง ดาวน์โหลดแม่แบบที่มีชื่อนักเรียนอยู่แล้ว กรอกน้ำหนัก/ส่วนสูง แล้วอัปโหลด', go: 'เริ่มบันทึกการวัด' },
  { id: 'export', cls: 'j-export', no: 'ขั้นที่ 3', ico: '📤', title: 'ส่งออกรายงาน', desc: 'เลือกขอบเขตและรูปแบบ แล้วดาวน์โหลดไฟล์เพื่อส่งให้หน่วยงาน', go: 'เริ่มส่งออก' },
];

function back() { active.value = null; }
</script>

<template>
  <Transition name="view" mode="out-in">
  <div v-if="active === null" key="hub" class="container">
    <div class="hub-head">
      <span class="hub-kicker">🧭 ผู้ช่วยจัดการข้อมูล</span>
      <h1 class="hub-title">ทำงานกับข้อมูลทีละขั้น สบายใจ ไม่ต้องกลัวพลาด</h1>
      <p class="hub-sub">งานข้อมูลทั้งหมดอยู่ในรูปไฟล์ Excel ที่คุณครูคุ้นเคย ระบบจะพาทำทีละขั้นตั้งแต่เพิ่มรายชื่อ บันทึกการวัด จนถึงส่งออกรายงาน</p>
    </div>

    <div class="hub-flow">
      <button
        v-for="(c, i) in cards"
        :key="c.id"
        class="jcard stagger-item"
        :class="c.cls"
        :style="{ '--i': i }"
        @click="active = c.id"
      >
        <span class="step-no">{{ c.no }}</span>
        <span class="medallion">{{ c.ico }}</span>
        <span class="jt">{{ c.title }}</span>
        <span class="jd">{{ c.desc }}</span>
        <span class="jgo">{{ c.go }} <span class="arr">→</span></span>
      </button>
    </div>

    <div class="hub-advanced">
      <span>ต้องการดูหรือแก้ไขแบบละเอียด?</span>
      <button class="btn quiet" @click="emit('go', 'students')">📋 ดูรายชื่อแบบตาราง</button>
      <button class="btn quiet" @click="emit('go', 'reports')">📊 ดูรายงาน</button>
    </div>
  </div>

  <AddStudentsWizard v-else-if="active === 'students'" key="students" @done="back" @exit="back" />
  <AddMeasuresWizard v-else-if="active === 'measures'" key="measures" @done="back" @exit="back" />
  <ExportWizard v-else-if="active === 'export'" key="export" @done="back" @exit="back" />
  </Transition>
</template>
