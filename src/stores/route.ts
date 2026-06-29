import { defineStore } from 'pinia';
import { ref } from 'vue';
import { parseHash, destToHash, type Dest } from '../router/hashRoutes';

export const useRoute = defineStore('route', () => {
  const current = ref<Dest>(parseHash(window.location.hash));
  let started = false;

  function sync() {
    current.value = parseHash(window.location.hash);
  }

  function start() {
    if (started) return;
    started = true;
    if (!window.location.hash) window.location.hash = '#/';
    window.addEventListener('hashchange', sync);
    sync();
  }

  // Single writer: set the hash; the hashchange listener updates `current`.
  // If the hash is already correct no event fires, so settle state directly.
  function navigate(dest: Dest) {
    const next = destToHash(dest);
    if (window.location.hash === next) { sync(); return; }
    window.location.hash = next;
  }

  return { current, start, navigate };
});
