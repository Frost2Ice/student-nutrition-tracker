import { describe, it, expect } from 'vitest';
import { serializeBackup, parseBackup } from '../../src/domain/transfer/backup';
import type { Student, Measurement, Setup } from '../../src/domain/types';

const student: Student = {
  id: 'S001',
  firstName: 'สมชาย',
  lastName: 'ใจดี',
  dob: '1/1/2560',
  gender: 'ชาย',
  grade: 'ป.1',
  room: '1',
};

const measure: Measurement = {
  studentId: 'S001',
  year: '2568',
  term: '1',
  round: '1',
  date: '15/5/2568',
  weightKg: 25,
  heightCm: 120,
  savedAt: 1700000000000,
  gradeAtMeasure: 'ป.1',
  roomAtMeasure: '1',
};

const setup: Setup = {
  school: 'โรงเรียนทดสอบ',
  ministry: 'กระทรวงศึกษาธิการ',
  department: '',
  subdistrict: '',
  district: '',
  province: 'กรุงเทพฯ',
  teacher: 'ครูสมหญิง',
  maxGrade: 'ป.6',
};

const period = { year: '2568', term: '1' as const, round: '1' as const };

describe('serializeBackup', () => {
  it('produces JSON with version ntr2-1 and all four fields', () => {
    const json = serializeBackup({ students: [student], measures: [measure], setup, period, classrooms: [] });
    const parsed = JSON.parse(json);
    expect(parsed.version).toBe('ntr2-1');
    expect(parsed.students).toHaveLength(1);
    expect(parsed.measures).toHaveLength(1);
    expect(parsed.setup).toBeDefined();
    expect(parsed.period).toBeDefined();
  });

  it('preserves setup.school through round-trip', () => {
    const json = serializeBackup({ students: [student], measures: [measure], setup, period, classrooms: [] });
    const result = parseBackup(json);
    expect(result.setup.school).toBe('โรงเรียนทดสอบ');
  });
});

describe('parseBackup', () => {
  it('round-trips students and measures correctly', () => {
    const json = serializeBackup({ students: [student], measures: [measure], setup, period, classrooms: [] });
    const result = parseBackup(json);
    expect(result.students[0].id).toBe('S001');
    expect(result.measures[0].weightKg).toBe(25);
  });

  it('assigns Date.now() to measures missing savedAt (FR-9.4)', () => {
    const before = Date.now();
    const measureWithoutSavedAt = { ...measure };
    delete (measureWithoutSavedAt as Partial<Measurement>).savedAt;
    const payload = JSON.stringify({
      version: 'ntr2-1',
      students: [student],
      measures: [measureWithoutSavedAt],
      setup,
      period,
    });
    const result = parseBackup(payload);
    const after = Date.now();
    expect(result.measures[0].savedAt).toBeGreaterThanOrEqual(before);
    expect(result.measures[0].savedAt).toBeLessThanOrEqual(after);
  });

  it('throws Thai error message for invalid JSON', () => {
    expect(() => parseBackup('not-json')).toThrow('ไฟล์สำรองไม่ถูกต้อง');
  });

  it('throws Thai error message when shape is wrong (missing version)', () => {
    expect(() => parseBackup(JSON.stringify({ students: [], measures: [] }))).toThrow(
      'ไฟล์สำรองไม่ถูกต้อง',
    );
  });

  it('round-trips classrooms correctly', () => {
    const classrooms = [
      { grade: 'ป.1', rooms: ['1', '2'] },
      { grade: 'ป.2', rooms: ['1'] },
    ];
    const json = serializeBackup({ students: [student], measures: [measure], setup, period, classrooms });
    const result = parseBackup(json);
    expect(result.classrooms).toEqual(classrooms);
  });

  it('returns empty classrooms array when field is absent (back-compat)', () => {
    const payload = JSON.stringify({
      version: 'ntr2-1',
      students: [student],
      measures: [measure],
      setup,
      period,
    });
    const result = parseBackup(payload);
    expect(result.classrooms).toEqual([]);
  });
});
