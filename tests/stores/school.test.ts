import { describe, it, expect, beforeEach, vi } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { useSchool } from '../../src/stores/school';
import type { YearSnapshot } from '../../src/domain/types';

const store: Record<string, string> = {};
const localStorageMock = {
  getItem: (k: string) => store[k] ?? null,
  setItem: (k: string, v: string) => { store[k] = v; },
  removeItem: (k: string) => { delete store[k]; },
  clear: () => { Object.keys(store).forEach((k) => delete store[k]); },
};
vi.stubGlobal('localStorage', localStorageMock);

const mkYear = (year: string): YearSnapshot => ({
  year, createdAt: 1, teacher: 'ค', maxGrade: 'ป.6', classrooms: [], students: [], measures: [],
});

describe('useSchool', () => {
  beforeEach(() => { localStorage.clear(); setActivePinia(createPinia()); });

  it('createYear archives the prior active and keeps exactly one active', () => {
    const s = useSchool();
    s.createYear(mkYear('2568'));
    s.createYear(mkYear('2569'));
    expect(s.activeYear).toBe('2569');
    expect(s.years.filter((y) => y.status === 'active')).toHaveLength(1);
    expect(s.years.find((y) => y.year === '2568')!.status).toBe('archived');
  });

  it('loadYear round-trips a saved snapshot', () => {
    const s = useSchool();
    s.createYear(mkYear('2568'));
    expect(s.loadYear('2568')!.teacher).toBe('ค');
  });

  it('manifest persists across store re-instantiation', () => {
    useSchool().createYear(mkYear('2568'));
    setActivePinia(createPinia());
    const s2 = useSchool();
    expect(s2.activeYear).toBe('2568');
  });

  it('year import into existing school keeps destination identity', () => {
    const s = useSchool();
    s.identity = { school: 'KEEP', ministry: '', department: '', subdistrict: '', district: '', province: '' };
    s.createYear(mkYear('2568'));
    const bundle = JSON.stringify({
      version: 'ntr2-year-1',
      identity: { school: 'OTHER', ministry: '', department: '', subdistrict: '', district: '', province: '' },
      year: mkYear('2570'),
    });
    const r = s.importYearBundle(bundle);
    expect(r.replaced).toBe(false);
    expect(s.identity.school).toBe('KEEP');
    expect(s.years.find((y) => y.year === '2570')!.status).toBe('archived');
  });

  it('full-school export/import round-trips and sets newest active', () => {
    const s = useSchool();
    s.createYear(mkYear('2568'));
    s.createYear(mkYear('2569'));
    const dump = s.exportSchool();
    setActivePinia(createPinia());
    const s2 = useSchool();
    s2.importSchool(dump);
    expect(s2.years).toHaveLength(2);
    expect(s2.activeYear).toBe('2569');
  });
});
