import { describe, it, expect } from 'vitest';
import { pickMeasureColumns, MEASURE_HEADERS } from '../../src/domain/transfer/xlsx';

describe('pickMeasureColumns', () => {
  it('projects the friendly 6-col roster sheet down to id/weight/height/date', () => {
    const aoa = [
      ['รหัสนักเรียน', 'ชื่อ', 'นามสกุล', 'น้ำหนัก(กก.)', 'ส่วนสูง(ซม.)', 'วันที่วัด'],
      ['10', 'สมชาย', 'ใจดี', '22.5', '120', '15/6/2569'],
    ];
    const out = pickMeasureColumns(aoa);
    expect(out[0]).toEqual([...MEASURE_HEADERS]);
    expect(out[1]).toEqual(['10', '22.5', '120', '15/6/2569']);
  });

  it('returns input unchanged when a required header is missing (identity fallback)', () => {
    const aoa = [
      ['รหัสนักเรียน', 'น้ำหนัก(กก.)', 'ส่วนสูง(ซม.)'], // วันที่วัด missing
      ['10', '22.5', '120'],
    ];
    expect(pickMeasureColumns(aoa)).toBe(aoa);
  });

  it('handles reordered columns', () => {
    const aoa = [
      ['วันที่วัด', 'รหัสนักเรียน', 'ชื่อ', 'ส่วนสูง(ซม.)', 'น้ำหนัก(กก.)'],
      ['15/6/2569', '10', 'สมชาย', '120', '22.5'],
    ];
    const out = pickMeasureColumns(aoa);
    expect(out[1]).toEqual(['10', '22.5', '120', '15/6/2569']);
  });
});
