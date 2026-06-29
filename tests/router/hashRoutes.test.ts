import { describe, it, expect } from 'vitest';
import { parseHash, destToHash, parseRoute, type Dest } from '../../src/router/hashRoutes';

describe('parseHash', () => {
  it('maps empty / root forms to home', () => {
    expect(parseHash('')).toBe('home');
    expect(parseHash('#')).toBe('home');
    expect(parseHash('#/')).toBe('home');
  });
  it('maps the live routes', () => {
    expect(parseHash('#/students')).toBe('students-poc');
    expect(parseHash('#/reports')).toBe('reports');
    expect(parseHash('#/settings')).toBe('settings');
    expect(parseHash('#/wizard')).toBe('wizard');
  });
  it('maps the workflow-named wizard sub-routes', () => {
    expect(parseHash('#/wizard/import-students')).toBe('wizard-students');
    expect(parseHash('#/wizard/import-measurements')).toBe('wizard-measures');
    expect(parseHash('#/wizard/export-reports')).toBe('wizard-export');
    expect(parseHash('#/wizard/backup')).toBe('wizard-backup');
  });
  it('tolerates a missing leading slash', () => {
    expect(parseHash('#students')).toBe('students-poc');
  });
  it('strips trailing slashes', () => {
    expect(parseHash('#/students/')).toBe('students-poc');
  });
  it('falls back to home for hidden or unknown paths', () => {
    expect(parseHash('#/measurement')).toBe('home');
    expect(parseHash('#/nope')).toBe('home');
  });
});

describe('destToHash', () => {
  it('maps each routable dest', () => {
    expect(destToHash('home')).toBe('#/');
    expect(destToHash('students-poc')).toBe('#/students');
    expect(destToHash('reports')).toBe('#/reports');
    expect(destToHash('settings')).toBe('#/settings');
    expect(destToHash('wizard')).toBe('#/wizard');
    expect(destToHash('wizard-students')).toBe('#/wizard/import-students');
    expect(destToHash('wizard-measures')).toBe('#/wizard/import-measurements');
    expect(destToHash('wizard-export')).toBe('#/wizard/export-reports');
    expect(destToHash('wizard-backup')).toBe('#/wizard/backup');
  });
  it('maps unroutable dests to root', () => {
    expect(destToHash('measure')).toBe('#/');
    expect(destToHash('students')).toBe('#/');
  });
  it('round-trips every live dest', () => {
    const live: Dest[] = [
      'home', 'students-poc', 'reports', 'settings', 'wizard',
      'wizard-students', 'wizard-measures', 'wizard-export', 'wizard-backup',
    ];
    for (const d of live) expect(parseHash(destToHash(d))).toBe(d);
  });
});

describe('parseRoute — student params', () => {
  it('parses the class drill-down route as an opaque slug', () => {
    expect(parseRoute('#/students/class/' + encodeURIComponent('อ-2-1')))
      .toEqual({ dest: 'students-poc', params: { classSlug: 'อ-2-1' } });
  });
  it('parses the student detail route', () => {
    expect(parseRoute('#/students/student/s-42'))
      .toEqual({ dest: 'students-poc', params: { studentId: 's-42' } });
  });
  it('returns empty params for static routes', () => {
    expect(parseRoute('#/reports')).toEqual({ dest: 'reports', params: {} });
    expect(parseRoute('#/students')).toEqual({ dest: 'students-poc', params: {} });
  });
  it('falls back to home with empty params for unknown', () => {
    expect(parseRoute('#/nope')).toEqual({ dest: 'home', params: {} });
  });
});

describe('destToHash — student params', () => {
  it('builds the class route from the slug', () => {
    expect(destToHash('students-poc', { classSlug: 'อ-2-1' }))
      .toBe('#/students/class/' + encodeURIComponent('อ-2-1'));
  });
  it('builds the student route', () => {
    expect(destToHash('students-poc', { studentId: 's-42' }))
      .toBe('#/students/student/' + encodeURIComponent('s-42'));
  });
  it('ignores empty params (plain students route)', () => {
    expect(destToHash('students-poc', {})).toBe('#/students');
    expect(destToHash('students-poc')).toBe('#/students');
  });
  it('round-trips the param routes', () => {
    const cases: { classSlug?: string; studentId?: string }[] = [
      { classSlug: 'อ-2-1' },
      { studentId: 's-42' },
    ];
    for (const p of cases) {
      const rt = parseRoute(destToHash('students-poc', p));
      expect(rt).toEqual({ dest: 'students-poc', params: p });
    }
  });
});
