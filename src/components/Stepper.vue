<script setup lang="ts">
defineProps<{ steps: string[]; current: number }>();
</script>

<template>
  <div class="stepper">
    <template v-for="(s, i) in steps" :key="i">
      <div class="step" :class="{ active: i === current, done: i < current }">
        <span class="dot">{{ i < current ? '✓' : i + 1 }}</span>
        <span>{{ s }}</span>
      </div>
      <span v-if="i < steps.length - 1" class="sep"></span>
    </template>
  </div>
</template>
