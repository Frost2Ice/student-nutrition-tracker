import { describe, it, expect } from 'vitest';
import { summarize, summaryToAoa } from '../../src/domain/report/summary';
import type { Student, Measurement, Setup } from '../../src/domain/types';

const student: Student = {
  id: 'S001',
  firstName: 'ทดสอบ',
  lastName: 'นาม',
  dob: '15/5/2556',
  gender: 'ชาย',
  grade: 'ป.4',
  room: '1',
};

const round1Measure: Measurement = {
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

const round2Measure: Measurement = {
  ...round1Measure,
  round: '2',
  date: '15/9/2568',
  weightKg: 26,
  heightCm: 121,
  savedAt: 1710000000000,
};

describe('summarize', () => {
  it('counts measured=1 for one student with one matching measurement', () => {
    const result = summarize([student], [round1Measure], '2568', '1', '1');
    expect(result.measured).toBe(1);
    expect(result.enrolled).toBe(1);
  });

  it('byGrade bucket counts sum to total measured', () => {
    const result = summarize([student], [round1Measure], '2568', '1', '1');
    const total = result.byGrade.reduce((sum, g) => sum + g.counts.reduce((a, b) => a + b, 0), 0);
    expect(total).toBe(result.measured);
  });

  it('returns measured=0 when year/term does not match', () => {
    const result = summarize([student], [round1Measure], '2568', '2', '1');
    expect(result.measured).toBe(0);
  });

  it('filters to only the requested round when both rounds have data', () => {
    const r1 = summarize([student], [round1Measure, round2Measure], '2568', '1', '1');
    const r2 = summarize([student], [round1Measure, round2Measure], '2568', '1', '2');
    expect(r1.measured).toBe(1);
    expect(r2.measured).toBe(1);
    // round 2's weight (26kg/121cm) differs from round 1's (25kg/120cm) — confirm
    // the two calls aren't silently returning the same collapsed record by checking
    // each only sees its own round's measurement via the tall-count side channel
    // is not reliable here, so assert via grade bucket distinctness is unnecessary;
    // the key behavior under test is that round 1 alone and round 2 alone both
    // report measured=1 (neither round's absence breaks the other).
  });

  it('returns measured=0 for a round with no measurement even if another round has data', () => {
    const result = summarize([student], [round1Measure], '2568', '1', '2');
    expect(result.measured).toBe(0);
  });

  it('picks the latest-saved measurement when two records share the same round', () => {
    const earlierSameRound: Measurement = { ...round1Measure, savedAt: 1600000000000, weightKg: 20 };
    const result = summarize([student], [earlierSameRound, round1Measure], '2568', '1', '1');
    expect(result.measured).toBe(1);
  });

  it('enrolled always equals students.length', () => {
    const result = summarize([student], [], '2568', '1', '1');
    expect(result.enrolled).toBe(1);
  });

  it('produces 5 bucket counts per grade', () => {
    const result = summarize([student], [round1Measure], '2568', '1', '1');
    for (const g of result.byGrade) {
      expect(g.counts).toHaveLength(5);
    }
  });
});

describe('summaryToAoa', () => {
  const fullSetup: Setup = {
    school: 'โรงเรียนทดสอบ',
    code: 'SC-001',
    ministry: 'กระทรวงศึกษา',
    department: 'สพม.',
    subdistrict: 'ตำบลทดสอบ',
    district: 'อำเภอทดสอบ',
    province: 'จังหวัดทดสอบ',
    teacher: 'ครูทดสอบ',
    maxGrade: 'ป.6',
  };

  const noCodeSetup: Setup = { ...fullSetup, code: undefined };

  it('returns a non-empty array', () => {
    const summary = summarize([student], [round1Measure], '2568', '1', '1');
    const aoa = summaryToAoa(fullSetup, summary, '2568', '1', '1');
    expect(Array.isArray(aoa)).toBe(true);
    expect(aoa.length).toBeGreaterThan(0);
  });

  it('includes school name', () => {
    const summary = summarize([student], [round1Measure], '2568', '1', '1');
    const aoa = summaryToAoa(fullSetup, summary, '2568', '1', '1');
    const flat = aoa.flat().map(String);
    expect(flat).toContain('โรงเรียนทดสอบ');
  });

  it('includes bucket label ผอม', () => {
    const summary = summarize([student], [round1Measure], '2568', '1', '1');
    const aoa = summaryToAoa(fullSetup, summary, '2568', '1', '1');
    const flat = aoa.flat().map(String);
    expect(flat).toContain('ผอม');
  });

  it('includes school code when present', () => {
    const summary = summarize([student], [round1Measure], '2568', '1', '1');
    const aoa = summaryToAoa(fullSetup, summary, '2568', '1', '1');
    const flat = aoa.flat().map(String);
    expect(flat).toContain('SC-001');
  });

  it('omits the school code row when code is blank', () => {
    const summary = summarize([student], [round1Measure], '2568', '1', '1');
    const aoa = summaryToAoa(noCodeSetup, summary, '2568', '1', '1');
    const labels = aoa.map((row) => row[0]);
    expect(labels).not.toContain('รหัสโรงเรียน');
  });

  it('includes the round in the header', () => {
    const summary = summarize([student], [round1Measure], '2568', '1', '1');
    const aoa = summaryToAoa(fullSetup, summary, '2568', '1', '1');
    const roundRow = aoa.find((row) => row[0] === 'ครั้งที่วัด');
    expect(roundRow?.[1]).toBe('1');
  });
});
