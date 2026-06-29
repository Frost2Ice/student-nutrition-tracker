import { defineStore } from 'pinia';
import { ref } from 'vue';
import { parseRoute, destToHash, type Dest, type RouteParams } from '../router/hashRoutes';

export const useRoute = defineStore('route', () => {
  const initial = parseRoute(window.location.hash);
  const current = ref<Dest>(initial.dest);
  const params = ref<RouteParams>(initial.params);
  let started = false;

  function sync() {
    const r = parseRoute(window.location.hash);
    current.value = r.dest;
    params.value = r.params;
  }

  function start() {
    if (started) return;
    started = true;
    if (!window.location.hash) window.location.hash = '#/';
    window.addEventListener('hashchange', sync);
    sync();
  }

  // Single writer: set the hash; the hashchange listener updates state.
  // If the hash is already correct no event fires, so settle state directly.
  function navigate(dest: Dest, p?: RouteParams) {
    const next = destToHash(dest, p);
    if (window.location.hash === next) { sync(); return; }
    window.location.hash = next;
  }

  return { current, params, start, navigate };
});
