<script setup lang="ts">
defineOptions({ name: 'ThaiDateField' });
import { computed } from 'vue';

const props = withDefaults(defineProps<{
  modelValue: string;
  yearMin?: number;
  yearMax?: number;
}>(), {
  yearMin: new Date().getFullYear() + 443,  // current CE + 543 - 100
  yearMax: new Date().getFullYear() + 543,
});

const emit = defineEmits<{ 'update:modelValue': [v: string] }>();

const THAI_MONTHS = [
  'ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.',
  'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.',
];

/** Parse canonical D/M/YYYY into parts; return {d,m,y} or null */
function parse(v: string): { d: number; m: number; y: number } | null {
  if (!v) return null;
  const parts = v.split('/');
  if (parts.length !== 3) return null;
  const d = parseInt(parts[0], 10);
  const m = parseInt(parts[1], 10);
  const y = parseInt(parts[2], 10);
  if (isNaN(d) || isNaN(m) || isNaN(y)) return null;
  return { d, m, y };
}

const parsed = computed(() => parse(props.modelValue));

const selDay = computed(() => parsed.value?.d ?? 0);
const selMonth = computed(() => parsed.value?.m ?? 0);
const selYear = computed(() => parsed.value?.y ?? 0);

const days = Array.from({ length: 31 }, (_, i) => i + 1);
const months = THAI_MONTHS.map((label, i) => ({ label, value: i + 1 }));
const years = computed(() => {
  const arr: number[] = [];
  for (let y = props.yearMax; y >= props.yearMin; y--) arr.push(y);
  return arr;
});

function emit3(d: number, m: number, y: number) {
  if (d > 0 && m > 0 && y > 0) {
    emit('update:modelValue', `${d}/${m}/${y}`);
  } else {
    emit('update:modelValue', '');
  }
}

function onDay(e: Event) {
  emit3(parseInt((e.target as HTMLSelectElement).value, 10), selMonth.value, selYear.value);
}
function onMonth(e: Event) {
  emit3(selDay.value, parseInt((e.target as HTMLSelectElement).value, 10), selYear.value);
}
function onYear(e: Event) {
  emit3(selDay.value, selMonth.value, parseInt((e.target as HTMLSelectElement).value, 10));
}
</script>

<template>
  <span class="thai-date-field">
    <select :value="selDay || ''" @change="onDay" class="tdf-sel tdf-day" aria-label="วัน">
      <option value="">วัน</option>
      <option v-for="d in days" :key="d" :value="d">{{ d }}</option>
    </select>
    <select :value="selMonth || ''" @change="onMonth" class="tdf-sel tdf-mon" aria-label="เดือน">
      <option value="">เดือน</option>
      <option v-for="m in months" :key="m.value" :value="m.value">{{ m.label }}</option>
    </select>
    <select :value="selYear || ''" @change="onYear" class="tdf-sel tdf-yr" aria-label="ปี พ.ศ.">
      <option value="">ปี พ.ศ.</option>
      <option v-for="y in years" :key="y" :value="y">{{ y }}</option>
    </select>
  </span>
</template>

<style scoped>
.thai-date-field {
  display: inline-flex;
  gap: 4px;
  align-items: center;
}
.tdf-sel {
  border: 1px solid var(--line, #d0d5dd);
  border-radius: 6px;
  padding: 3px 4px;
  font-size: 13px;
  background: var(--surface, #fff);
  color: var(--ink, #1a1a2e);
  cursor: pointer;
  height: 28px;
}
.tdf-sel:focus {
  outline: 2px solid var(--brand, #3b6ef8);
  outline-offset: 1px;
}
.tdf-day  { width: 52px; }
.tdf-mon  { width: 68px; }
.tdf-yr   { width: 82px; }
</style>
