import { describe, it, expect } from 'vitest';
import { measureRosterTemplateAoa } from '../../src/domain/transfer/xlsx';
import type { Student } from '../../src/domain/types';

const stu = (p: Partial<Student> = {}): Student => ({
  id: '1', firstName: 'ก', lastName: 'ข', dob: '1/1/2558',
  gender: 'ชาย', grade: 'ป.1', room: '1', ...p,
});

describe('measureRosterTemplateAoa', () => {
  it('emits the 6-column friendly header first', () => {
    const aoa = measureRosterTemplateAoa([]);
    expect(aoa[0]).toEqual(['รหัสนักเรียน', 'ชื่อ', 'นามสกุล', 'น้ำหนัก(กก.)', 'ส่วนสูง(ซม.)', 'วันที่วัด']);
  });

  it('prefills id/name and leaves measurement columns blank, preserving order', () => {
    const aoa = measureRosterTemplateAoa([stu({ id: '10', firstName: 'สมชาย', lastName: 'ใจดี' }), stu({ id: '11', firstName: 'มาลี', lastName: 'ดี' })]);
    expect(aoa[1]).toEqual(['10', 'สมชาย', 'ใจดี', '', '', '']);
    expect(aoa[2]).toEqual(['11', 'มาลี', 'ดี', '', '', '']);
  });
});
