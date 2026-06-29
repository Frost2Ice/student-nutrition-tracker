import { describe, it, expect, beforeEach, vi } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';

// Minimal window mock for the node test environment: a mutable location.hash
// whose setter fires `hashchange` to registered listeners, mirroring browsers.
const listeners: Record<string, Array<() => void>> = {};
let hash = '';
const windowMock = {
  location: {
    get hash() { return hash; },
    set hash(v: string) {
      const norm = v.startsWith('#') ? v : '#' + v;
      if (norm === hash) return;
      hash = norm;
      (listeners['hashchange'] ?? []).forEach((fn) => fn());
    },
  },
  addEventListener(type: string, fn: () => void) {
    (listeners[type] ??= []).push(fn);
  },
};
vi.stubGlobal('window', windowMock);

import { useRoute } from '../../src/stores/route';

function setHash(h: string) {
  windowMock.location.hash = h;
}

describe('useRoute', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    hash = '';
  });

  it('initializes current from the existing hash', () => {
    hash = '#/reports';
    const r = useRoute();
    expect(r.current).toBe('reports');
  });

  it('start() sets #/ when hash is empty and current is home', () => {
    hash = '';
    const r = useRoute();
    r.start();
    expect(window.location.hash).toBe('#/');
    expect(r.current).toBe('home');
  });

  it('navigate() writes the hash and updates current', () => {
    const r = useRoute();
    r.start();
    r.navigate('settings');
    expect(window.location.hash).toBe('#/settings');
    expect(r.current).toBe('settings');
  });

  it('reacts to a manual hash change (Back/Forward)', () => {
    const r = useRoute();
    r.start();
    setHash('#/wizard');
    expect(r.current).toBe('wizard');
  });

  it('exposes params parsed from the hash', () => {
    hash = '#/students/student/s-7';
    const r = useRoute();
    expect(r.current).toBe('students-poc');
    expect(r.params).toEqual({ studentId: 's-7' });
  });

  it('navigate() with params writes the param hash and updates state', () => {
    const r = useRoute();
    r.start();
    r.navigate('students-poc', { classSlug: 'อ-2-1' });
    expect(window.location.hash).toBe('#/students/class/' + encodeURIComponent('อ-2-1'));
    expect(r.current).toBe('students-poc');
    expect(r.params).toEqual({ classSlug: 'อ-2-1' });
  });

  it('navigate() with no params clears prior params', () => {
    const r = useRoute();
    r.start();
    r.navigate('students-poc', { studentId: 's-7' });
    r.navigate('students-poc');
    expect(window.location.hash).toBe('#/students');
    expect(r.params).toEqual({});
  });
});
