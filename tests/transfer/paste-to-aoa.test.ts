import { describe, it, expect } from 'vitest';
import { pasteToAoa, STUDENT_HEADERS, MEASURE_ROSTER_HEADERS, parseStudentAoa } from '../../src/domain/transfer/xlsx';

describe('pasteToAoa', () => {
  it('prepends the canonical header when the pasted block has no header (id rows)', () => {
    const text = '10001\tสมชาย\tใจดี\t15/3/2558\tชาย\tป.1\t1';
    const aoa = pasteToAoa(text, STUDENT_HEADERS);
    expect(aoa[0]).toEqual([...STUDENT_HEADERS]);
    expect(aoa[1]).toEqual(['10001', 'สมชาย', 'ใจดี', '15/3/2558', 'ชาย', 'ป.1', '1']);
  });

  it('drops a pasted header row and replaces it with the canonical header', () => {
    const text = [STUDENT_HEADERS.join('\t'), '10001\tสมชาย\tใจดี\t15/3/2558\tชาย\tป.1\t1'].join('\n');
    const aoa = pasteToAoa(text, STUDENT_HEADERS);
    expect(aoa).toHaveLength(2);
    expect(aoa[1][0]).toBe('10001');
  });

  it('handles comma-separated paste and skips blank lines', () => {
    const text = '\n10001,สมชาย,ใจดี,15/3/2558,ชาย,ป.1,1\n\n';
    const aoa = pasteToAoa(text, STUDENT_HEADERS);
    expect(aoa).toHaveLength(2);
    expect(aoa[1][4]).toBe('ชาย');
  });

  it('feeds parseStudentAoa correctly (round-trip from pasted rows)', () => {
    const text = '10001\tสมชาย\tใจดี\t15/3/2558\tชาย\tป.1\t1';
    const { rows, skipped } = parseStudentAoa(pasteToAoa(text, STUDENT_HEADERS));
    expect(skipped).toHaveLength(0);
    expect(rows[0]).toMatchObject({ id: '10001', dob: '15/3/2558', grade: 'ป.1', room: '1' });
  });

  it('returns empty for blank input', () => {
    expect(pasteToAoa('   \n  ', MEASURE_ROSTER_HEADERS)).toEqual([]);
  });
});
