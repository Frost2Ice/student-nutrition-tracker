import { describe, it, expect } from 'vitest';
import { buildNextYear } from '../../src/domain/year/rollover';
import type { YearSnapshot } from '../../src/domain/types';

const prev: YearSnapshot = {
  year: '2568', createdAt: 1, teacher: 'ครูเอ', maxGrade: 'ป.6',
  classrooms: [{ grade: 'ป.1', rooms: ['1'] }, { grade: 'ป.6', rooms: ['1'] }],
  students: [
    { id: 'a', firstName: 'ก', lastName: 'x', dob: '1/1/2560', gender: 'ชาย', grade: 'ป.1', room: '1' },
    { id: 'z', firstName: 'จ', lastName: 'y', dob: '1/1/2555', gender: 'หญิง', grade: 'ป.6', room: '1' },
  ],
  measures: [{ studentId: 'a', year: '2568', term: '1', round: '1', date: '1/6/2568', weightKg: 20, heightCm: 120, savedAt: 1, gradeAtMeasure: 'ป.1', roomAtMeasure: '1' }],
};

describe('buildNextYear', () => {
  it('promotes by default, omits graduates, empties measures, keeps studentId', () => {
    const next = buildNextYear(prev, { z: { action: 'graduate' } }, {
      year: '2569', teacher: 'ครูบี', maxGrade: 'ป.6',
      classrooms: [{ grade: 'ป.2', rooms: ['1'] }],
    });
    expect(next.year).toBe('2569');
    expect(next.teacher).toBe('ครูบี');
    expect(next.measures).toEqual([]);
    expect(next.students.map((s) => s.id)).toEqual(['a']);
    expect(next.students[0].grade).toBe('ป.2');
  });

  it('repeat keeps grade; explicit room override applies', () => {
    const next = buildNextYear(prev, { a: { action: 'repeat', room: '2' }, z: { action: 'graduate' } },
      { year: '2569', teacher: 'ครูเอ', maxGrade: 'ป.6', classrooms: [] });
    expect(next.students[0].grade).toBe('ป.1');
    expect(next.students[0].room).toBe('2');
  });
});
