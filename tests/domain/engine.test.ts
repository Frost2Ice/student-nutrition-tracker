// tests/domain/engine.test.ts
import { describe, it, expect } from 'vitest';
import { classifyWFH, calcNutrition } from '../../src/domain/nutrition/engine';
import type { Student, Measurement } from '../../src/domain/types';

const boy: Student = { id: '1', firstName: 'ก', lastName: 'ข', dob: '15/5/2556', gender: 'ชาย', grade: 'ป.1', room: '1' };

describe('classifyWFH', () => {
  // WFH_M[0] = [65, 6.3, 6.5, 8.45, 8.8, 9.6, 11]; bands at height 65
  it('classifies below first band as ผอม', () => { expect(classifyWFH('ชาย', 65, 6.0)).toBe('ผอม'); });
  it('classifies into สมส่วน band', () => { expect(classifyWFH('ชาย', 65, 7.0)).toBe('สมส่วน'); });
  it('classifies above last band as อ้วน', () => { expect(classifyWFH('ชาย', 65, 12)).toBe('อ้วน'); });
  it('interpolates between rows', () => {
    // smoke: a value at an interpolated height returns a valid label
    expect(['ผอม','ค่อนข้างผอม','สมส่วน','ท้วม','เริ่มอ้วน','อ้วน']).toContain(classifyWFH('ชาย', 70.25, 9.0));
  });
});

describe('calcNutrition', () => {
  it('returns null when age < 24 months', () => {
    const m: Measurement = { studentId: '1', year: '2557', term: '1', round: '1', date: '15/5/2557', weightKg: 10, heightCm: 75, savedAt: 1, gradeAtMeasure: '', roomAtMeasure: '' };
    expect(calcNutrition(boy, m)).toBeNull(); // 12 months old
  });
  it('returns a full result for an assessable measurement', () => {
    const m: Measurement = { studentId: '1', year: '2560', term: '1', round: '1', date: '15/5/2560', weightKg: 16, heightCm: 104, savedAt: 1, gradeAtMeasure: '', roomAtMeasure: '' };
    const r = calcNutrition(boy, m)!;
    expect(r).not.toBeNull();
    expect(r.ageMonths).toBe(48);
    expect(['ผอม','ค่อนข้างผอม','สมส่วน','ท้วม','เริ่มอ้วน','อ้วน']).toContain(r.wfh);
    expect(['เตี้ย','ค่อนข้างเตี้ย','สูงตามเกณฑ์','ค่อนข้างสูง','สูง']).toContain(r.hfa);
    expect(typeof r.tall).toBe('boolean');
  });
});
