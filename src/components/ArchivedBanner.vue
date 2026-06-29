<script setup lang="ts">
import { useData } from '../stores/data';

const data = useData();
</script>

<template>
  <div v-if="data.isReadonly" class="arch-banner" role="status">
    <span class="arch-ico" aria-hidden="true">🔒</span>
    <span class="arch-text">กำลังดูปีการศึกษา {{ data.viewingYear }} (เก็บถาวร · อ่านอย่างเดียว)</span>
    <button class="btn quiet arch-back" @click="data.viewActive()">กลับไปปีปัจจุบัน</button>
  </div>
</template>

<style scoped>
.arch-banner {
  display: flex; align-items: center; gap: var(--s3);
  padding: var(--s3) var(--s5);
  background: var(--surface-2); border-bottom: 1px solid var(--line);
  animation: arch-fade 180ms var(--ease-out-expo);
}
.arch-ico { font-size: 18px; flex-shrink: 0; }
.arch-text { font-size: 14.5px; font-weight: 600; color: var(--ink); flex: 1; min-width: 0; }
.arch-back { flex-shrink: 0; min-height: 36px; }
@keyframes arch-fade { from { opacity: 0; } to { opacity: 1; } }
@media (prefers-reduced-motion: reduce) { .arch-banner { animation: none; } }
@media (max-width: 560px) {
  .arch-banner { flex-wrap: wrap; padding: var(--s3) var(--s4); }
  .arch-text { flex-basis: 100%; }
}
</style>
