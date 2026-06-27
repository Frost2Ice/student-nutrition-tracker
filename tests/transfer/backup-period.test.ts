import { describe, it, expect } from 'vitest';
import { serializeBackup, parseBackup } from '../../src/domain/transfer/backup';

const base = {
  students: [],
  measures: [],
  setup: {
    school: 'x', ministry: '', department: '', subdistrict: '',
    district: '', province: '', teacher: '', maxGrade: 'ป.6',
  },
  classrooms: [],
};

describe('backup period year-only', () => {
  it('serializes period as year only', () => {
    const text = serializeBackup({ ...base, period: { year: '2568' } });
    expect(JSON.parse(text).period).toEqual({ year: '2568' });
  });

  it('parses an old payload with stray term/round to year only', () => {
    const old = JSON.stringify({
      version: 'ntr2-1', ...base,
      period: { year: '2568', term: '2', round: '2' },
    });
    expect(parseBackup(old).period).toEqual({ year: '2568' });
  });
});
