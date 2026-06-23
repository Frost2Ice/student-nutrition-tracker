<script setup lang="ts">
import { ref, watch, onBeforeUnmount } from 'vue';

const props = defineProps<{ open: boolean; title?: string }>();
const emit = defineEmits<{ close: [] }>();

const el = ref<HTMLDialogElement | null>(null);

watch(
  () => props.open,
  (open) => {
    const dlg = el.value;
    if (!dlg) return;
    if (open && !dlg.open) dlg.showModal();
    else if (!open && dlg.open) dlg.close();
  },
);

// Native Esc fires `cancel`; keep state controlled by routing it through close.
function onCancel(e: Event) {
  e.preventDefault();
  emit('close');
}
// Click on the backdrop (the dialog element itself, outside its content) closes.
function onClick(e: MouseEvent) {
  if (e.target === el.value) emit('close');
}

onBeforeUnmount(() => {
  if (el.value?.open) el.value.close();
});
</script>

<template>
  <dialog ref="el" class="dlg" @cancel="onCancel" @click="onClick">
    <div class="dlg-panel">
      <div class="dlg-bar">
        <div class="dlg-title">{{ title }}</div>
        <span class="spacer"></span>
        <button class="btn quiet" @click="emit('close')">✕ ปิด</button>
      </div>
      <div class="dlg-body">
        <slot />
      </div>
    </div>
  </dialog>
</template>

<style scoped>
.dlg {
  border: none;
  padding: 0;
  background: transparent;
  max-width: min(920px, 94vw);
  width: 100%;
  max-height: 92vh;
  color: var(--ink);
}
.dlg::backdrop {
  background: rgba(20, 30, 35, 0.45);
  backdrop-filter: blur(1.5px);
}
.dlg[open] {
  animation: dlg-in 220ms cubic-bezier(0.22, 1, 0.36, 1);
}
.dlg[open]::backdrop {
  animation: dlg-fade 220ms ease-out;
}
@keyframes dlg-in {
  from { opacity: 0; transform: translateY(12px) scale(0.985); }
  to { opacity: 1; transform: none; }
}
@keyframes dlg-fade {
  from { opacity: 0; }
  to { opacity: 1; }
}
.dlg-panel {
  background: var(--surface);
  border-radius: var(--rounded-md, 16px);
  box-shadow: 0 18px 50px rgba(20, 30, 35, 0.28);
  display: flex;
  flex-direction: column;
  max-height: 92vh;
  overflow: hidden;
}
.dlg-bar {
  display: flex;
  align-items: center;
  gap: var(--s3);
  padding: var(--s3) var(--s4);
  border-bottom: 1px solid var(--line);
  flex-shrink: 0;
}
.dlg-title { font-weight: 700; font-size: 17px; }
.dlg-bar .spacer { flex: 1 1 auto; }
.dlg-body { overflow: auto; padding: var(--s4); }
@media (prefers-reduced-motion: reduce) {
  .dlg[open], .dlg[open]::backdrop { animation: none; }
}
@media (max-width: 560px) {
  .dlg { max-width: 100vw; max-height: 100vh; }
  .dlg-panel { border-radius: 0; max-height: 100vh; }
}
</style>
