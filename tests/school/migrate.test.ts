import { describe, it, expect } from 'vitest';
import { migrateV1, splitSetup } from '../../src/domain/school/migrate';
import type { Setup } from '../../src/domain/types';

const setup: Setup = {
  school: 'รร.ทดสอบ', ministry: 'ศธ', department: 'สพฐ',
  subdistrict: 'ต', district: 'อ', province: 'จ',
  teacher: 'ครูเอ', maxGrade: 'ป.6',
};

describe('splitSetup', () => {
  it('separates identity from year-specific teacher/maxGrade', () => {
    const r = splitSetup(setup);
    expect(r.teacher).toBe('ครูเอ');
    expect(r.maxGrade).toBe('ป.6');
    expect(r.identity.school).toBe('รร.ทดสอบ');
    expect('teacher' in r.identity).toBe(false);
  });
});

describe('migrateV1', () => {
  it('builds one active year from flat v1 state', () => {
    const s = migrateV1({
      students: [{ id: '1', firstName: 'ก', lastName: 'ข', dob: '1/1/2560', gender: 'ชาย', grade: 'ป.1', room: '1' }],
      measures: [],
      setup,
      period: { year: '2568' },
      classrooms: [{ grade: 'ป.1', rooms: ['1'] }],
    });
    expect(s.schemaVersion).toBe(2);
    expect(s.identity.province).toBe('จ');
    expect(s.years).toHaveLength(1);
    const y = s.years[0];
    expect(y.year).toBe('2568');
    expect(y.teacher).toBe('ครูเอ');
    expect(y.maxGrade).toBe('ป.6');
    expect(y.students).toHaveLength(1);
    expect(y.classrooms).toEqual([{ grade: 'ป.1', rooms: ['1'] }]);
  });
});
