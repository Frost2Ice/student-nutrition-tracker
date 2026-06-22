import { describe, it, expect } from 'vitest';
import { summarize, summaryToAoa } from '../../src/domain/report/summary';
import type { Student, Measurement, Setup } from '../../src/domain/types';

// A boy born 15/5/2556 (Buddhist Era) — old enough to be classified
const student: Student = {
  id: 'S001',
  firstName: 'ทดสอบ',
  lastName: 'นาม',
  dob: '15/5/2556',
  gender: 'ชาย',
  grade: 'ป.4',
  room: '1',
};

// Measurement in year=2568, term=1 — well within assessable age range
const measure: Measurement = {
  studentId: 'S001',
  year: '2568',
  term: '1',
  round: '1',
  date: '15/5/2568',
  weightKg: 25,
  heightCm: 120,
  savedAt: 1700000000000,
  gradeAtMeasure: 'ป.4',
  roomAtMeasure: '1',
};

describe('summarize', () => {
  it('counts measured=1 for one student with one matching measurement', () => {
    const result = summarize([student], [measure], '2568', '1');
    expect(result.measured).toBe(1);
    expect(result.enrolled).toBe(1);
  });

  it('byGrade bucket counts sum to total measured', () => {
    const result = summarize([student], [measure], '2568', '1');
    const total = result.byGrade.reduce((sum, g) => sum + g.counts.reduce((a, b) => a + b, 0), 0);
    expect(total).toBe(result.measured);
  });

  it('returns measured=0 when year/term does not match', () => {
    const result = summarize([student], [measure], '2568', '2');
    expect(result.measured).toBe(0);
  });

  it('enrolled always equals students.length', () => {
    const result = summarize([student], [], '2568', '1');
    expect(result.enrolled).toBe(1);
  });

  it('produces 5 bucket counts per grade', () => {
    const result = summarize([student], [measure], '2568', '1');
    for (const g of result.byGrade) {
      expect(g.counts).toHaveLength(5);
    }
  });
});

describe('summaryToAoa', () => {
  const setup: Setup = {
    school: 'โรงเรียนทดสอบ',
    ministry: 'กระทรวงศึกษา',
    department: 'สพม.',
    subdistrict: 'ตำบลทดสอบ',
    district: 'อำเภอทดสอบ',
    province: 'จังหวัดทดสอบ',
    teacher: 'ครูทดสอบ',
    maxGrade: 'ป.6',
  };

  it('returns a non-empty array', () => {
    const summary = summarize([student], [measure], '2568', '1');
    const aoa = summaryToAoa(setup, summary, '2568', '1');
    expect(Array.isArray(aoa)).toBe(true);
    expect(aoa.length).toBeGreaterThan(0);
  });

  it('includes school name', () => {
    const summary = summarize([student], [measure], '2568', '1');
    const aoa = summaryToAoa(setup, summary, '2568', '1');
    const flat = aoa.flat().map(String);
    expect(flat).toContain('โรงเรียนทดสอบ');
  });

  it('includes bucket label ผอม', () => {
    const summary = summarize([student], [measure], '2568', '1');
    const aoa = summaryToAoa(setup, summary, '2568', '1');
    const flat = aoa.flat().map(String);
    expect(flat).toContain('ผอม');
  });
});
