import { describe, it, expect } from 'vitest';
import { round1, validateWeight, validateHeight, validateThaiDate } from '../../src/domain/validation/rules';

describe('round1', () => {
  it('rounds to one decimal', () => {
    expect(round1(32.55)).toBe(32.6);
    expect(round1(32.04)).toBe(32);
    expect(round1(100)).toBe(100);
  });
});

describe('validateWeight', () => {
  it('accepts in-range', () => { expect(validateWeight(32.5)).toBeNull(); });
  it('accepts boundaries', () => {
    expect(validateWeight(5)).toBeNull();
    expect(validateWeight(150)).toBeNull();
  });
  it('rejects out-of-range with Thai message', () => {
    expect(validateWeight(250)).toContain('5');
    expect(validateWeight(4)).toContain('5');
  });
});

describe('validateHeight', () => {
  it('accepts boundaries', () => {
    expect(validateHeight(40)).toBeNull();
    expect(validateHeight(210)).toBeNull();
  });
  it('rejects out-of-range', () => { expect(validateHeight(250)).not.toBeNull(); });
});

describe('validateThaiDate', () => {
  it('accepts a valid BE date', () => { expect(validateThaiDate('15/5/2556', false)).toBeNull(); });
  it('rejects wrong segment count', () => { expect(validateThaiDate('2013-05-15', false)).not.toBeNull(); });
  it('rejects BE year out of dob range when periodYear given', () => { expect(validateThaiDate('15/5/2599', true, 2569)).not.toBeNull(); });
  it('rejects impossible day in month', () => { expect(validateThaiDate('31/2/2556', false)).not.toBeNull(); });
  it('rejects non-4-digit / pre-2400 year', () => { expect(validateThaiDate('15/5/556', false)).not.toBeNull(); });

  // Dynamic birth-year window from periodYear
  describe('with periodYear 2569', () => {
    // min = 2569-19 = 2550, max = 2569-2 = 2567
    it('accepts birth year 2550 (age 19, lower bound)', () => {
      expect(validateThaiDate('1/1/2550', true, 2569)).toBeNull();
    });
    it('accepts birth year 2558 (within range)', () => {
      expect(validateThaiDate('15/3/2558', true, 2569)).toBeNull();
    });
    it('accepts birth year 2567 (age 2, upper bound)', () => {
      expect(validateThaiDate('1/1/2567', true, 2569)).toBeNull();
    });
    it('rejects birth year 2549 (too old, age > 19)', () => {
      const err = validateThaiDate('1/1/2549', true, 2569);
      expect(err).not.toBeNull();
    });
    it('rejects birth year 2568 (too young)', () => {
      const err = validateThaiDate('1/1/2568', true, 2569);
      expect(err).not.toBeNull();
    });
    it('error message contains dynamic min-max (2550–2567)', () => {
      const err = validateThaiDate('1/1/2549', true, 2569);
      expect(err).toContain('2550');
      expect(err).toContain('2567');
    });
  });

  describe('without periodYear', () => {
    it('does not apply birth-window check when no periodYear given', () => {
      // 2549 would fail the old hardcoded check but also the dynamic one if periodYear=2569
      // Without periodYear, only format/calendar checks apply — so a valid date passes
      expect(validateThaiDate('1/1/2549', true)).toBeNull();
    });
    it('still validates format when isDob and no periodYear', () => {
      expect(validateThaiDate('32/1/2549', true)).not.toBeNull();
    });
  });
});
