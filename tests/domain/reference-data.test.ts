// tests/domain/reference-data.test.ts
import { describe, it, expect } from 'vitest';
import { WFH_M } from '../../src/domain/nutrition/reference/wfh-male';
import { WFH_F } from '../../src/domain/nutrition/reference/wfh-female';
import { AGE_DATA } from '../../src/domain/nutrition/reference/age-data';

describe('WFH tables', () => {
  it('male rows have 7 numeric columns and ascending height', () => {
    expect(WFH_M.length).toBeGreaterThan(100);
    for (const row of WFH_M) {
      expect(row).toHaveLength(7);
      row.forEach((v) => expect(typeof v).toBe('number'));
    }
    for (let i = 1; i < WFH_M.length; i++) expect(WFH_M[i][0]).toBeGreaterThan(WFH_M[i - 1][0]);
  });
  it('first male row matches the legacy anchor value', () => {
    expect(WFH_M[0]).toEqual([65, 6.3, 6.5, 8.45, 8.8, 9.6, 11]);
  });
  it('female table is present', () => {
    expect(WFH_F.length).toBeGreaterThan(100);
    expect(WFH_F[0][0]).toBe(65);
  });
});

describe('AGE_DATA', () => {
  it('parses keyed rows for both genders', () => {
    expect(AGE_DATA['M-24']).toBeDefined();
    expect(AGE_DATA['F-72']).toBeDefined();
  });
  it('maps columns correctly for M-24', () => {
    expect(AGE_DATA['M-24']).toEqual({
      mw: 12.35, sdw: 1.4, sd2w: 9.7, sd15w: 10.25, sd15pw: 14.45, sd2pw: 15.3,
      mh: 87.12, sdh: 3.05, sd2h: 81.0, sd15h: 82.55, sd15ph: 91.7, sd2ph: 93.2,
    });
  });
});
