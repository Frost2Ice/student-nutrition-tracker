import { describe, it, expect } from 'vitest';
import { GRADE_ORDER, promote, demote, isMaxGrade, gradesUpTo } from '../../src/domain/grade/ladder';

describe('grade ladder', () => {
  it('has 15 grades in order', () => {
    expect(GRADE_ORDER[0]).toBe('อ.1');
    expect(GRADE_ORDER[GRADE_ORDER.length - 1]).toBe('ม.6');
    expect(GRADE_ORDER).toHaveLength(15);
  });
  it('promotes across bands (อ.3 → ป.1)', () => { expect(promote('อ.3')).toBe('ป.1'); });
  it('promotes within band (ป.1 → ป.2)', () => { expect(promote('ป.1')).toBe('ป.2'); });
  it('does not promote past the top', () => { expect(promote('ม.6')).toBe('ม.6'); });
  it('returns same grade for unknown input', () => { expect(promote('zzz')).toBe('zzz'); });
  it('demotes (ป.1 → อ.3)', () => { expect(demote('ป.1')).toBe('อ.3'); });
  it('does not demote past the bottom', () => { expect(demote('อ.1')).toBe('อ.1'); });
  it('detects max grade', () => {
    expect(isMaxGrade('ป.6', 'ป.6')).toBe(true);
    expect(isMaxGrade('ป.5', 'ป.6')).toBe(false);
  });
  it('generates grades up to the configured max', () => {
    expect(gradesUpTo('อ.3')).toEqual(['อ.1', 'อ.2', 'อ.3']);
    expect(gradesUpTo('ป.6')).toEqual(['อ.1','อ.2','อ.3','ป.1','ป.2','ป.3','ป.4','ป.5','ป.6']);
    const ms = gradesUpTo('ม.3');
    expect(ms[ms.length - 1]).toBe('ม.3');
    expect(gradesUpTo('นonsense')).toEqual([]);
  });
});
