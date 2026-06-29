import { describe, it, expect } from 'vitest';
import { parseHash, destToHash, type Dest } from '../../src/router/hashRoutes';

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
