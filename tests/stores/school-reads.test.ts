import { describe, it, expect, beforeEach, vi } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { useSchool } from '../../src/stores/school';
import type { YearSnapshot, Measurement } from '../../src/domain/types';

const store: Record<string, string> = {};
const localStorageMock = {
  getItem: (k: string) => store[k] ?? null,
  setItem: (k: string, v: string) => { store[k] = v; },
  removeItem: (k: string) => { delete store[k]; },
  clear: () => { Object.keys(store).forEach((k) => delete store[k]); },
};
vi.stubGlobal('localStorage', localStorageMock);

const mkMeasure = (year: string, savedAt: number): Measurement => ({
  studentId: 'a', year, term: '1', round: '1', date: '1/1/2568',
  weightKg: 20, heightCm: 120, savedAt, gradeAtMeasure: 'ป.1', roomAtMeasure: '1',
});

const mkYear = (year: string, measures: Measurement[]): YearSnapshot => ({
  year, createdAt: 1, teacher: 'ค', maxGrade: 'ป.6', classrooms: [], students: [], measures,
});

describe('useSchool cross-year reads', () => {
  beforeEach(() => { localStorage.clear(); setActivePinia(createPinia()); });

  it('measuresForStudent concats across years sorted by savedAt', () => {
    const s = useSchool();
    s.createYear(mkYear('2568', [mkMeasure('2568', 200)]));
    s.createYear(mkYear('2569', [mkMeasure('2569', 100)]));
    const ms = s.measuresForStudent('a');
    expect(ms).toHaveLength(2);
    expect(ms.map((m) => m.savedAt)).toEqual([100, 200]);
    expect(ms.map((m) => m.year)).toEqual(['2569', '2568']);
  });

  it('measuresForStudent ignores other students', () => {
    const s = useSchool();
    const other: Measurement = { ...mkMeasure('2568', 50), studentId: 'b' };
    s.createYear(mkYear('2568', [mkMeasure('2568', 200), other]));
    expect(s.measuresForStudent('a')).toHaveLength(1);
  });

  it('listYears returns the manifest metas', () => {
    const s = useSchool();
    s.createYear(mkYear('2568', []));
    s.createYear(mkYear('2569', []));
    expect(s.listYears()).toHaveLength(2);
  });

  it('snapshotForYear returns the stored snapshot', () => {
    const s = useSchool();
    s.createYear(mkYear('2568', []));
    expect(s.snapshotForYear('2568')!.teacher).toBe('ค');
    expect(s.snapshotForYear('9999')).toBeNull();
  });

  it('reads do not change the active year', () => {
    const s = useSchool();
    s.createYear(mkYear('2568', [mkMeasure('2568', 1)]));
    s.createYear(mkYear('2569', [mkMeasure('2569', 2)]));
    s.measuresForStudent('a');
    s.listYears();
    s.snapshotForYear('2568');
    expect(s.activeYear).toBe('2569');
  });
});
