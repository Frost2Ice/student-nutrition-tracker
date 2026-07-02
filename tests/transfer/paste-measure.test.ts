import { describe, it, expect } from 'vitest';
import {
  pasteMeasureToAoa, pickMeasureColumns, parseMeasureAoa,
} from '../../src/domain/transfer/xlsx';

const period = { year: '2569', term: '1' as const, round: '1' as const };

// Mirror AddMeasuresWizard.process(): map columns by header name, then parse.
function parsePaste(text: string) {
  const aoa = pasteMeasureToAoa(text);
  return parseMeasureAoa(pickMeasureColumns(aoa), period);
}

describe('pasteMeasureToAoa — paste matches upload (name column optional)', () => {
  it('headerless rows WITHOUT name column (id, weight, height, date) are accepted', () => {
    const out = parsePaste('10001\t22.5\t120\t15/6/2569');
    expect(out.skipped).toEqual([]);
    expect(out.rows).toHaveLength(1);
    expect(out.rows[0]).toMatchObject({ studentId: '10001', weightKg: 22.5, heightCm: 120, date: '15/6/2569' });
  });

  it('headerless rows WITH name column (roster layout) are accepted', () => {
    const out = parsePaste('10001\tสมชาย\tใจดี\t22.5\t120\t15/6/2569');
    expect(out.skipped).toEqual([]);
    expect(out.rows).toHaveLength(1);
    expect(out.rows[0]).toMatchObject({ studentId: '10001', weightKg: 22.5, heightCm: 120 });
  });

  it('block WITH a pasted header but no name column is accepted (mapped by header name)', () => {
    const out = parsePaste('รหัสนักเรียน\tน้ำหนัก(กก.)\tส่วนสูง(ซม.)\tวันที่วัด\n10001\t22.5\t120\t15/6/2569');
    expect(out.skipped).toEqual([]);
    expect(out.rows).toHaveLength(1);
    expect(out.rows[0]).toMatchObject({ studentId: '10001', weightKg: 22.5, heightCm: 120 });
  });

  it('block WITH a pasted roster header (incl. name) is accepted', () => {
    const out = parsePaste('รหัสนักเรียน\tชื่อ\tนามสกุล\tน้ำหนัก(กก.)\tส่วนสูง(ซม.)\tวันที่วัด\n10001\tสมชาย\tใจดี\t22.5\t120\t15/6/2569');
    expect(out.skipped).toEqual([]);
    expect(out.rows).toHaveLength(1);
  });

  it('empty text yields no rows', () => {
    expect(pasteMeasureToAoa('   ')).toEqual([]);
    expect(parsePaste('').rows).toHaveLength(0);
  });
});
