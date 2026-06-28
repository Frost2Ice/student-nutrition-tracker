import { defineStore } from 'pinia';
import { ref } from 'vue';

export interface HeaderState {
  title: string;
  back: (() => void) | null;
  context: 'year' | 'session';
}

export const useHeader = defineStore('header', () => {
  const title = ref('');
  const back = ref<(() => void) | null>(null);
  const context = ref<'year' | 'session'>('year');

  function setHeader(partial: Partial<HeaderState>) {
    if (partial.title !== undefined) title.value = partial.title;
    if (partial.back !== undefined) back.value = partial.back;
    if (partial.context !== undefined) context.value = partial.context;
  }
  function resetHeader() {
    title.value = '';
    back.value = null;
    context.value = 'year';
  }
  return { title, back, context, setHeader, resetHeader };
});

export function effectiveBack(
  viewBack: (() => void) | null,
  isHome: boolean,
  goHome: () => void,
): (() => void) | null {
  if (viewBack) return viewBack;
  if (!isHome) return goHome;
  return null;
}
