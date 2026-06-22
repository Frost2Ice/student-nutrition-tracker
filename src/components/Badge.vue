<script setup lang="ts">
import { badgeClass } from '../ui/labels';
defineProps<{ label: string }>();
</script>

<template>
  <span class="pill" :class="badgeClass(label)">{{ label }}</span>
</template>
