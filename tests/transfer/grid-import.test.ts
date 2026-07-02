import { describe, it, expect } from 'vitest';
import { gridRowsToAoa, parseClipboardGrid, STUDENT_CLASSROOM_HEADERS, type GridRow } from '../../src/domain/transfer/xlsx';

const row = (p: Partial<GridRow> = {}): GridRow => ({
  id: '', firstName: '', lastName: '', gender: '', dob: '', ...p,
});

describe('gridRowsToAoa', () => {
  it('emits the classroom header row first', () => {
    const aoa = gridRowsToAoa([row({ id: '1', firstName: 'ก', lastName: 'ข', gender: 'ชาย', dob: '5/3/2558' })]);
    expect(aoa[0]).toEqual([...STUDENT_CLASSROOM_HEADERS]);
  });

  it('emits single DOB cell in column order', () => {
    const aoa = gridRowsToAoa([row({ id: '10', firstName: 'ก', lastName: 'ข', gender: 'หญิง', dob: '5/3/2558' })]);
    expect(aoa[1]).toEqual(['10', 'ก', 'ข', '5/3/2558', 'หญิง']);
  });

  it('leaves dob cell empty when dob is blank', () => {
    const aoa = gridRowsToAoa([row({ id: '10', firstName: 'ก', lastName: 'ข', gender: 'ชาย', dob: '' })]);
    expect(aoa[1]).toEqual(['10', 'ก', 'ข', '', 'ชาย']);
  });

  it('skips fully blank rows', () => {
    const aoa = gridRowsToAoa([row(), row({ id: '1', firstName: 'ก', lastName: 'ข', dob: '1/1/2558' }), row()]);
    expect(aoa).toHaveLength(2); // header + 1 real row
  });

  it('returns header-only for all-blank input', () => {
    expect(gridRowsToAoa([row(), row()])).toEqual([[...STUDENT_CLASSROOM_HEADERS]]);
  });
});

describe('parseClipboardGrid', () => {
  // Matches the Excel แม่แบบ layout (5 cols):
  // รหัสนักเรียน, ชื่อ, นามสกุล, วันเกิด, เพศ
  it('parses tab-separated 5-column template rows', () => {
    const out = parseClipboardGrid('10\tสมชาย\tใจดี\t15/3/2558\tชาย\n11\tมาลี\tดี\t1/12/2557\tหญิง');
    expect(out).toEqual([
      { id: '10', firstName: 'สมชาย', lastName: 'ใจดี', dob: '15/3/2558', gender: 'ชาย' },
      { id: '11', firstName: 'มาลี', lastName: 'ดี', dob: '1/12/2557', gender: 'หญิง' },
    ]);
  });

  it('parses comma-separated rows', () => {
    const out = parseClipboardGrid('10,ก,ข,5/3/2558,ชาย');
    expect(out[0]).toEqual({ id: '10', firstName: 'ก', lastName: 'ข', dob: '5/3/2558', gender: 'ชาย' });
  });

  it('normalizes dob via normalizeThaiDate', () => {
    const out = parseClipboardGrid('10\tก\tข\t2 ต.ค. 2558\tชาย');
    expect(out[0].dob).toBe('2/10/2558');
  });

  it('leaves dob empty when dob column is missing', () => {
    const out = parseClipboardGrid('10\tก\tข\t\tหญิง');
    expect(out[0].dob).toBe('');
    expect(out[0].gender).toBe('หญิง');
  });

  it('skips the template header line', () => {
    const out = parseClipboardGrid(
      'รหัสนักเรียน\tชื่อ\tนามสกุล\tวันเกิด\tเพศ\n10\tก\tข\t15/3/2558\tชาย',
    );
    expect(out).toHaveLength(1);
    expect(out[0]).toEqual({ id: '10', firstName: 'ก', lastName: 'ข', dob: '15/3/2558', gender: 'ชาย' });
  });

  it('ignores extra columns and blank lines', () => {
    const out = parseClipboardGrid('\n10\tก\tข\t15/3/2558\tชาย\textra\n\n');
    expect(out).toEqual([{ id: '10', firstName: 'ก', lastName: 'ข', dob: '15/3/2558', gender: 'ชาย' }]);
  });

  it('returns empty for empty input', () => {
    expect(parseClipboardGrid('   ')).toEqual([]);
  });
});
