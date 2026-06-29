import { describe, it, expect } from 'vitest';
import { shortWfa, shortHfa } from '../../src/domain/nutrition/labels';

describe('shortWfa', () => {
  it('strips the น้ำหนัก prefix that duplicates the column header', () => {
    expect(shortWfa('น้ำหนักน้อย')).toBe('น้อย');
    expect(shortWfa('น้ำหนักค่อนข้างน้อย')).toBe('ค่อนข้างน้อย');
    expect(shortWfa('น้ำหนักตามเกณฑ์')).toBe('ตามเกณฑ์');
    expect(shortWfa('น้ำหนักค่อนข้างมาก')).toBe('ค่อนข้างมาก');
    expect(shortWfa('น้ำหนักมาก')).toBe('มาก');
  });
  it('passes through unknown values unchanged', () => {
    expect(shortWfa('ยังไม่วัด')).toBe('ยังไม่วัด');
  });
});

describe('shortHfa', () => {
  it('shortens สูงตามเกณฑ์ only; already-short labels pass through', () => {
    expect(shortHfa('สูงตามเกณฑ์')).toBe('ตามเกณฑ์');
    expect(shortHfa('เตี้ย')).toBe('เตี้ย');
    expect(shortHfa('ค่อนข้างเตี้ย')).toBe('ค่อนข้างเตี้ย');
    expect(shortHfa('ค่อนข้างสูง')).toBe('ค่อนข้างสูง');
    expect(shortHfa('สูง')).toBe('สูง');
  });
});
