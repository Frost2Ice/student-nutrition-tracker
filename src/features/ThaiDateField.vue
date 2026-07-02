<script setup lang="ts">
defineOptions({ name: 'ThaiDateField' });
import { ref, computed, watch } from 'vue';

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

// Local part state, so a partial selection (day chosen, month/year not yet)
// persists in the UI. The value emitted upward is only canonical once all three
// are set; until then the parent gets '' — but that '' echo must NOT wipe the
// in-progress local parts (that was the "first pick doesn't stick" bug).
const selDay = ref(0);
const selMonth = ref(0);
const selYear = ref(0);

function applyParts(p: { d: number; m: number; y: number } | null) {
  selDay.value = p?.d ?? 0;
  selMonth.value = p?.m ?? 0;
  selYear.value = p?.y ?? 0;
}
applyParts(parse(props.modelValue));

// Resync only when the parent pushes a real, parseable date (e.g. paste/normalize).
// Ignore '' / unparseable echoes so a mid-entry partial selection survives.
watch(() => props.modelValue, (v) => {
  const p = parse(v);
  if (p && (p.d !== selDay.value || p.m !== selMonth.value || p.y !== selYear.value)) {
    applyParts(p);
  }
});

const days = Array.from({ length: 31 }, (_, i) => i + 1);
const months = THAI_MONTHS.map((label, i) => ({ label, value: i + 1 }));
const years = computed(() => {
  const arr: number[] = [];
  for (let y = props.yearMax; y >= props.yearMin; y--) arr.push(y);
  return arr;
});

function emitCurrent() {
  if (selDay.value > 0 && selMonth.value > 0 && selYear.value > 0) {
    emit('update:modelValue', `${selDay.value}/${selMonth.value}/${selYear.value}`);
  } else {
    emit('update:modelValue', '');
  }
}

function onDay(e: Event) {
  selDay.value = parseInt((e.target as HTMLSelectElement).value, 10) || 0;
  emitCurrent();
}
function onMonth(e: Event) {
  selMonth.value = parseInt((e.target as HTMLSelectElement).value, 10) || 0;
  emitCurrent();
}
function onYear(e: Event) {
  selYear.value = parseInt((e.target as HTMLSelectElement).value, 10) || 0;
  emitCurrent();
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
  border-radius: 8px;
  padding: 4px 6px;
  font-size: 15px;
  background: var(--surface, #fff);
  color: var(--ink, #1a1a2e);
  cursor: pointer;
  height: 42px;
}
.tdf-sel:focus {
  outline: 2px solid var(--brand, #3b6ef8);
  outline-offset: 1px;
}
.tdf-day  { width: 58px; }
.tdf-mon  { width: 76px; }
.tdf-yr   { width: 92px; }
</style>
