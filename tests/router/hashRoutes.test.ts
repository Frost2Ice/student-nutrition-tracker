import { describe, it, expect } from 'vitest';
import { parseHash, destToHash, type Dest } from '../../src/router/hashRoutes';

describe('parseHash', () => {
  it('maps empty / root forms to home', () => {
    expect(parseHash('')).toBe('home');
    expect(parseHash('#')).toBe('home');
    expect(parseHash('#/')).toBe('home');
  });
  it('maps the five live routes', () => {
    expect(parseHash('#/students')).toBe('students-poc');
    expect(parseHash('#/reports')).toBe('reports');
    expect(parseHash('#/settings')).toBe('settings');
    expect(parseHash('#/data')).toBe('wizard');
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
    expect(destToHash('wizard')).toBe('#/data');
  });
  it('maps unroutable dests to root', () => {
    expect(destToHash('measure')).toBe('#/');
    expect(destToHash('students')).toBe('#/');
  });
  it('round-trips the five live dests', () => {
    const live: Dest[] = ['home', 'students-poc', 'reports', 'settings', 'wizard'];
    for (const d of live) expect(parseHash(destToHash(d))).toBe(d);
  });
});
