import { describe, it, expect } from 'vitest';
import { parseThaiDate, formatThaiDate, getAgeMonths, todayThai, normalizeThaiDate } from '../../src/domain/date/thai-date';

describe('parseThaiDate', () => {
  it('parses BE date (year > 2500 → -543)', () => {
    const d = parseThaiDate('15/5/2556')!;
    expect(d.getFullYear()).toBe(2013);
    expect(d.getMonth()).toBe(4); // May = index 4
    expect(d.getDate()).toBe(15);
  });
  it('returns null for malformed input', () => {
    expect(parseThaiDate('2013-05-15')).toBeNull();
    expect(parseThaiDate('')).toBeNull();
  });
});

describe('formatThaiDate', () => {
  it('formats to D/M/YYYY in BE', () => {
    expect(formatThaiDate(new Date(2013, 4, 15))).toBe('15/5/2556');
  });
});

describe('getAgeMonths', () => {
  it('computes whole months between dob and measurement', () => {
    expect(getAgeMonths('15/5/2556', '15/5/2560')).toBe(48);
  });
  it('subtracts a month when measurement day precedes birth day', () => {
    expect(getAgeMonths('15/5/2556', '14/5/2560')).toBe(47);
  });
  it('returns null for negative age', () => {
    expect(getAgeMonths('15/5/2560', '15/5/2556')).toBeNull();
  });
  it('returns null for bad dates', () => {
    expect(getAgeMonths('bad', '15/5/2560')).toBeNull();
  });
});

describe('todayThai', () => {
  it('returns today as BE D/M/YYYY', () => {
    const s = todayThai();
    expect(s).toMatch(/^\d{1,2}\/\d{1,2}\/\d{4}$/);
    expect(+s.split('/')[2]).toBe(new Date().getFullYear() + 543);
  });
});

describe('normalizeThaiDate', () => {
  // Already canonical D/M/YYYY BE → return as-is, converted:false
  it('returns canonical BE date unchanged (converted:false)', () => {
    const r = normalizeThaiDate('15/3/2558');
    expect(r).toEqual({ value: '15/3/2558', converted: false });
  });

  // CE date string → convert, converted:true
  it('converts CE year (1900–2200) to BE (converted:true)', () => {
    const r = normalizeThaiDate('15/3/2015');
    expect(r).toEqual({ value: '15/3/2558', converted: true });
  });

  // ISO date string YYYY-MM-DD → reorder + convert CE to BE
  it('converts ISO date YYYY-MM-DD to BE D/M/YYYY (converted:true)', () => {
    const r = normalizeThaiDate('2015-03-15');
    expect(r).toEqual({ value: '15/3/2558', converted: true });
  });

  // JS Date object → formatThaiDate, converted:true
  it('converts a JS Date object to BE D/M/YYYY (converted:true)', () => {
    const r = normalizeThaiDate(new Date(2015, 2, 15)); // March 15 2015 CE
    expect(r).toEqual({ value: '15/3/2558', converted: true });
  });

  // Excel serial number for 15 Mar 2015: days since 1899-12-30 = 42078
  it('converts Excel serial number to BE D/M/YYYY (converted:true)', () => {
    const r = normalizeThaiDate(42078); // Excel serial for 2015-03-15
    expect(r).toEqual({ value: '15/3/2558', converted: true });
  });

  // Thai abbreviated month name
  it('converts Thai abbreviated month name (มี.ค.) to BE D/M/YYYY (converted:true)', () => {
    const r = normalizeThaiDate('15 มี.ค. 2558');
    expect(r).toEqual({ value: '15/3/2558', converted: true });
  });

  // Thai full month name
  it('converts Thai full month name (มีนาคม) to BE D/M/YYYY (converted:true)', () => {
    const r = normalizeThaiDate('15 มีนาคม 2558');
    expect(r).toEqual({ value: '15/3/2558', converted: true });
  });

  // 2-digit CE year → assume 20xx + 543
  it('converts 2-digit CE year to BE (converted:true)', () => {
    const r = normalizeThaiDate('15/3/15');
    expect(r).toEqual({ value: '15/3/2558', converted: true });
  });

  // Invalid calendar day → null
  it('returns null for invalid calendar day (31/2/2558)', () => {
    const r = normalizeThaiDate('31/2/2558');
    expect(r).toBeNull();
  });

  // Junk input → null
  it('returns null for junk string input', () => {
    const r = normalizeThaiDate('ไม่ใช่วันที่');
    expect(r).toBeNull();
  });

  // Empty string → null
  it('returns null for empty string', () => {
    const r = normalizeThaiDate('');
    expect(r).toBeNull();
  });

  // Dot-separated date (Excel sometimes uses d.m.yyyy)
  it('handles dot-separated date with CE year (converted:true)', () => {
    const r = normalizeThaiDate('15.3.2015');
    expect(r).toEqual({ value: '15/3/2558', converted: true });
  });

  // Already BE with dots → converted:true (non-slash separator)
  it('handles dot-separated BE date (converted:true because non-slash separator)', () => {
    const r = normalizeThaiDate('15.3.2558');
    expect(r).toEqual({ value: '15/3/2558', converted: true });
  });

  // BE-ISO: 4-digit year ≥ 2400 in ISO format → treat as BE as-is (NOT +543 → NOT 3101)
  it('converts BE-ISO 2558-03-15 to 15/3/2558 (NOT 3101)', () => {
    const r = normalizeThaiDate('2558-03-15');
    expect(r).not.toBeNull();
    expect(r!.value).toBe('15/3/2558');
    // Ensure year is not mangled to CE+543 = 3101
    expect(r!.value).not.toContain('3101');
  });
});
