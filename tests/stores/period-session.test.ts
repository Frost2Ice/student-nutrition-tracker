import { describe, it, expect, beforeEach, vi } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { useData } from '../../src/stores/data';

// Minimal localStorage mock for node test environment
const store: Record<string, string> = {};
const localStorageMock = {
  getItem: (key: string) => store[key] ?? null,
  setItem: (key: string, value: string) => { store[key] = value; },
  removeItem: (key: string) => { delete store[key]; },
  clear: () => { Object.keys(store).forEach((k) => delete store[k]); },
};
vi.stubGlobal('localStorage', localStorageMock);

describe('period year-only + measureSession', () => {
  beforeEach(() => {
    localStorage.clear();
    setActivePinia(createPinia());
  });

  it('drops stray term/round from an old persisted period', () => {
    localStorage.setItem('ntr2_period', JSON.stringify({ year: '2568', term: '2', round: '2' }));
    const data = useData();
    expect(data.period).toEqual({ year: '2568' });
  });

  it('setPeriod renames the active year snapshot (year only)', () => {
    const data = useData();
    data.setPeriod({ year: '2569' });
    expect(data.period).toEqual({ year: '2569' });
    const snap = JSON.parse(localStorage.getItem('ntr2_v2_year_2569')!);
    expect(snap.year).toBe('2569');
  });

  it('measureSession starts null and is settable', () => {
    const data = useData();
    expect(data.measureSession).toBeNull();
    data.measureSession = { term: '2', round: '1' };
    expect(data.measureSession).toEqual({ term: '2', round: '1' });
    // not persisted
    expect(localStorage.getItem('ntr2_session')).toBeNull();
  });
});
