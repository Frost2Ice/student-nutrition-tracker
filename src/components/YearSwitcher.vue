<script setup lang="ts">
defineOptions({ name: 'YearSwitcher' });
import { computed } from 'vue';
import Dialog from './Dialog.vue';
import { useData } from '../stores/data';
import { useSchool } from '../stores/school';
import { downloadBlob } from '../features/download';

const props = defineProps<{ open: boolean }>();
const emit = defineEmits<{ close: []; createYear: [] }>();

const data = useData();
const school = useSchool();

interface Row { year: string; active: boolean; count: number }

const rows = computed<Row[]>(() =>
  [...school.years]
    .sort((a, b) => b.createdAt - a.createdAt)
    .map((m) => ({
      year: m.year,
      active: m.status === 'active',
      count: school.loadYear(m.year)?.students.length ?? 0,
    }))
    .sort((a, b) => Number(b.active) - Number(a.active)),
);

function pick(row: Row) {
  if (row.active) data.viewActive();
  else data.viewYear(row.year);
  emit('close');
}

function exportRow(year: string) {
  downloadBlob(new Blob([school.exportYear(year)], { type: 'application/json' }), `ปีการศึกษา ${year}.json`);
}

function startCreate() {
  emit('close');
  emit('createYear');
}
</script>

<template>
  <Dialog :open="props.open" title="ปีการศึกษา" @close="emit('close')">
    <p class="ys-help">ปีที่กำลังใช้งานแก้ไขได้ ปีที่ผ่านมาเก็บไว้ดูอย่างเดียว</p>
    <ul class="ys-list">
      <li v-for="r in rows" :key="r.year" class="ys-row" :class="{ on: r.year === data.viewingYear, archived: !r.active }">
        <button class="ys-pick" @click="pick(r)">
          <span class="ys-dot" :class="{ filled: r.active }" aria-hidden="true"></span>
          <span class="ys-year">{{ r.year || '—' }}</span>
          <span class="ys-meta">
            <template v-if="r.active">กำลังใช้งาน</template>
            <template v-else>เก็บถาวร · {{ r.count }} คน</template>
          </span>
          <span class="ys-tag">{{ r.active ? 'แก้ไขอยู่' : 'ดู →' }}</span>
        </button>
        <button class="ys-export" :aria-label="`ส่งออกปีการศึกษา ${r.year}`" title="ส่งออกเป็นไฟล์" @click="exportRow(r.year)">⬇️</button>
      </li>
    </ul>
    <button class="btn primary block ys-new" @click="startCreate">+ ขึ้นปีการศึกษาใหม่</button>
  </Dialog>
</template>

<style scoped>
.ys-help { color: var(--ink-muted); font-size: 14px; margin-bottom: var(--s4); }
.ys-list { list-style: none; margin: 0 0 var(--s4); padding: 0; display: flex; flex-direction: column; gap: var(--s2); }
.ys-row {
  display: flex; align-items: stretch;
  border: 1px solid var(--line); border-radius: var(--r-sm); background: var(--surface);
  overflow: hidden;
  transition: background 150ms var(--ease), border-color 150ms var(--ease);
}
.ys-row.on { border-color: var(--brand); background: var(--brand-tint); }
.ys-row.archived { background: var(--surface-2); }
.ys-pick {
  flex: 1; min-width: 0; display: grid; grid-template-columns: auto 1fr auto; align-items: center;
  gap: var(--s2) var(--s3); text-align: left;
  background: transparent; border: none; padding: var(--s3) var(--s4); cursor: pointer;
}
.ys-pick:hover { background: var(--surface-2); }
.ys-row.archived .ys-pick:hover { background: var(--surface); }
.ys-export {
  flex-shrink: 0; width: 48px; border: none; border-left: 1px solid var(--line);
  background: transparent; cursor: pointer; font-size: 16px; color: var(--ink-muted);
}
.ys-export:hover { background: var(--surface-2); }
.ys-dot { width: 10px; height: 10px; border-radius: 50%; border: 2px solid var(--ink-muted); }
.ys-dot.filled { background: var(--brand); border-color: var(--brand); }
.ys-year { font-weight: 700; font-size: 17px; color: var(--ink); }
.ys-meta { grid-column: 2; grid-row: 2; font-size: 13px; color: var(--ink-muted); }
.ys-tag { grid-row: 1 / span 2; font-size: 13px; font-weight: 600; color: var(--brand-ink); }
.ys-row.archived .ys-tag { color: var(--ink-muted); }
.ys-new { margin-top: var(--s2); }
</style>
