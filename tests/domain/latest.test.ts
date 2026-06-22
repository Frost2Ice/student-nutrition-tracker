import { describe, it, expect } from 'vitest';
import { isNewerMeasure, latestPerStudent } from '../../src/domain/nutrition/latest';
import type { Measurement } from '../../src/domain/types';

const mk = (over: Partial<Measurement>): Measurement => ({
  studentId: '1', year: '2560', term: '1', round: '1', date: '1/1/2560', weightKg: 20, heightCm: 110, savedAt: 1,
  gradeAtMeasure: '', roomAtMeasure: '', ...over,
});

describe('isNewerMeasure', () => {
  it('true when prev is null', () => { expect(isNewerMeasure(mk({}), null)).toBe(true); });
  it('compares by year first', () => { expect(isNewerMeasure(mk({ year: '2561' }), mk({ year: '2560' }))).toBe(true); });
  it('then term', () => { expect(isNewerMeasure(mk({ term: '2' }), mk({ term: '1' }))).toBe(true); });
  it('then round', () => { expect(isNewerMeasure(mk({ round: '2' }), mk({ round: '1' }))).toBe(true); });
  it('then savedAt tie-break', () => { expect(isNewerMeasure(mk({ savedAt: 9 }), mk({ savedAt: 5 }))).toBe(true); });
  it('false when older', () => { expect(isNewerMeasure(mk({ year: '2559' }), mk({ year: '2560' }))).toBe(false); });
});

describe('latestPerStudent', () => {
  it('keeps the newest record per student', () => {
    const a1 = mk({ studentId: 'A', round: '1', savedAt: 1 });
    const a2 = mk({ studentId: 'A', round: '2', savedAt: 2 });
    const b1 = mk({ studentId: 'B', savedAt: 1 });
    const map = latestPerStudent([a1, a2, b1]);
    expect(map.get('A')).toBe(a2);
    expect(map.get('B')).toBe(b1);
    expect(map.size).toBe(2);
  });
});
