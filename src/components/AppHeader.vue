<script setup lang="ts">
import { computed } from 'vue';
import { useData } from '../stores/data';
import { useHeader, effectiveBack } from '../stores/header';

const props = defineProps<{ goHome: () => void; isHome: boolean }>();
const data = useData();
const header = useHeader();

const backHandler = computed(() => effectiveBack(header.back, props.isHome, props.goHome));

const yearLine = computed(() => `ปีการศึกษา ${data.period.year}`);
const sessionLine = computed(() => {
  const s = data.measureSession;
  return s ? `ภาคเรียนที่ ${s.term} · ครั้งที่ ${s.round}` : yearLine.value;
});
const contextText = computed(() =>
  header.context === 'session' ? sessionLine.value : yearLine.value,
);
</script>

<template>
  <header class="app-header">
    <div class="ah-left">
      <button v-if="backHandler" class="ah-back" type="button" aria-label="ย้อนกลับ" @click="backHandler()">
        ←
      </button>
    </div>
    <div class="ah-title">{{ header.title }}</div>
    <div class="ah-right">
      <div class="period-chip" style="width: auto">📅 {{ contextText }}</div>
    </div>
  </header>
</template>
