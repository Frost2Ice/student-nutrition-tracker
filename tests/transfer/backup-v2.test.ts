import { describe, it, expect } from 'vitest';
import { serializeYearBundle, parseYearBundle, serializeSchool, parseSchool } from '../../src/domain/transfer/backup';
import type { SchoolFile, SchoolIdentity, YearSnapshot } from '../../src/domain/types';

const identity: SchoolIdentity = { school: 'ร', ministry: 'ศ', department: 'ส', subdistrict: 'ต', district: 'อ', province: 'จ' };
const year: YearSnapshot = { year: '2569', createdAt: 1, teacher: 'ค', maxGrade: 'ป.6', classrooms: [], students: [], measures: [{ studentId: 'a', year: '2569', term: '1', round: '1', date: '1/6/2569', weightKg: 20, heightCm: 120, savedAt: 0, gradeAtMeasure: 'ป.1', roomAtMeasure: '1' }] };

describe('year bundle round-trip', () => {
  it('round-trips identity + year', () => {
    const r = parseYearBundle(serializeYearBundle(identity, year));
    expect(r.identity).toEqual(identity);
    expect(r.year.year).toBe('2569');
  });
  it('backfills missing savedAt', () => {
    const raw = JSON.parse(serializeYearBundle(identity, year));
    raw.year.measures[0].savedAt = undefined;
    const r = parseYearBundle(JSON.stringify(raw));
    expect(typeof r.year.measures[0].savedAt).toBe('number');
  });
  it('rejects garbage', () => {
    expect(() => parseYearBundle('not json')).toThrow();
  });
});

describe('school round-trip', () => {
  it('round-trips a full school file', () => {
    const file: SchoolFile = { schemaVersion: 2, identity, years: [year] };
    const r = parseSchool(serializeSchool(file));
    expect(r.years).toHaveLength(1);
    expect(r.identity.school).toBe('ร');
  });
});
