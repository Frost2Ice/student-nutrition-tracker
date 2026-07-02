import { describe, it, expect } from 'vitest';
import {
  injectGradeRoom, parseStudentAoa, pasteToAoa,
  STUDENT_HEADERS, STUDENT_CLASSROOM_HEADERS, studentClassroomTemplateAoa,
} from '../../src/domain/transfer/xlsx';

describe('injectGradeRoom', () => {
  it('appends grade/room to each row and normalizes the header to STUDENT_HEADERS', () => {
    const aoa = [[...STUDENT_CLASSROOM_HEADERS], ['10001', 'สมชาย', 'ใจดี', '15/3/2558', 'ชาย']];
    const full = injectGradeRoom(aoa, 'ป.1', '2');
    expect(full[0]).toEqual([...STUDENT_HEADERS]);
    expect(full[1]).toEqual(['10001', 'สมชาย', 'ใจดี', '15/3/2558', 'ชาย', 'ป.1', '2']);
  });

  it('round-trips classroom template → parseStudentAoa with the picked grade/room', () => {
    const full = injectGradeRoom(studentClassroomTemplateAoa(), 'ป.3', '1');
    const { rows, skipped } = parseStudentAoa(full);
    expect(skipped).toHaveLength(0);
    expect(rows[0]).toMatchObject({ id: '10001', dob: '15/3/2558', grade: 'ป.3', room: '1' });
  });

  it('works with pasted classroom rows (no grade/room in the paste)', () => {
    const aoa = pasteToAoa('20001\tมานี\tดี\t1/1/2559\tหญิง', STUDENT_CLASSROOM_HEADERS);
    const { rows } = parseStudentAoa(injectGradeRoom(aoa, 'ป.2', '3'));
    expect(rows[0]).toMatchObject({ id: '20001', grade: 'ป.2', room: '3', gender: 'หญิง' });
  });

  it('returns input unchanged when empty', () => {
    expect(injectGradeRoom([], 'ป.1', '1')).toEqual([]);
  });
});
