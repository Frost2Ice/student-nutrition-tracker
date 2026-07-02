import { describe, it, expect } from 'vitest';
import { findRef } from '../../src/domain/nutrition/reference/index';
import { AGE_DATA } from '../../src/domain/nutrition/reference/age-data';

describe('findRef', () => {
  it('returns exact-age male reference', () => {
    expect(findRef('ชาย', 24)).toEqual(AGE_DATA['M-24']);
  });
  it('returns nearest within 6 months', () => {
    // legacy data jumps M-100 → M-108; age 103 is 3 months from 100
    expect(findRef('ชาย', 103)).toEqual(AGE_DATA['M-100']);
  });
  it('returns null when nearest entry exceeds 6 months', () => {
    // M-100 → M-108 gap: age 104 is 4 from 108 (closer) within tolerance; pick a true gap
    expect(findRef('ชาย', 1)).toBeNull();   // far below 24
    expect(findRef('ชาย', 999)).toBeNull(); // far above max
  });
  it('respects gender split', () => {
    expect(findRef('หญิง', 24)).toEqual(AGE_DATA['F-24']);
  });

  // A student who is 18-and-some-months is still "18 years old": ages between the
  // terminal reference row (216mo = 18y0m) and 19y (228mo) use the 216 row rather
  // than dropping out of assessment.
  describe('18-and-fraction stays in range', () => {
    it('exact terminal age (18y0m)', () => {
      expect(findRef('ชาย', 216)).toEqual(AGE_DATA['M-216']);
      expect(findRef('หญิง', 216)).toEqual(AGE_DATA['F-216']);
    });
    it('18y6m (was already ok)', () => {
      expect(findRef('ชาย', 222)).toEqual(AGE_DATA['M-216']);
    });
    it('18y11m / ~18y300d clamps to the 216 row (previously null)', () => {
      expect(findRef('ชาย', 227)).toEqual(AGE_DATA['M-216']);
      expect(findRef('หญิง', 227)).toEqual(AGE_DATA['F-216']);
    });
    it('19y0m and older is out of range (over 18)', () => {
      expect(findRef('ชาย', 228)).toBeNull();
      expect(findRef('ชาย', 240)).toBeNull();
    });
  });
});
