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
});
