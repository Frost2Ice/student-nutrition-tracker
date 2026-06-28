import { describe, it, expect, beforeEach, vi } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { useHeader, effectiveBack } from '../../src/stores/header';

describe('useHeader store', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  it('has correct defaults', () => {
    const header = useHeader();
    expect(header.title).toBe('');
    expect(header.back).toBeNull();
    expect(header.context).toBe('year');
  });

  it('setHeader merges partial — title+back set, context untouched stays year', () => {
    const header = useHeader();
    const fn = vi.fn();
    header.setHeader({ title: 'Students', back: fn });
    expect(header.title).toBe('Students');
    expect(header.back).toBe(fn);
    expect(header.context).toBe('year');
  });

  it('setHeader switches context to session', () => {
    const header = useHeader();
    header.setHeader({ context: 'session' });
    expect(header.context).toBe('session');
  });

  it('resetHeader restores defaults', () => {
    const header = useHeader();
    const fn = vi.fn();
    header.setHeader({ title: 'Foo', back: fn, context: 'session' });
    header.resetHeader();
    expect(header.title).toBe('');
    expect(header.back).toBeNull();
    expect(header.context).toBe('year');
  });
});

describe('effectiveBack', () => {
  it('returns viewBack when provided', () => {
    const viewBack = vi.fn();
    const goHome = vi.fn();
    expect(effectiveBack(viewBack, false, goHome)).toBe(viewBack);
  });

  it('falls back to goHome when no viewBack and not home', () => {
    const goHome = vi.fn();
    expect(effectiveBack(null, false, goHome)).toBe(goHome);
  });

  it('returns null when home and no viewBack', () => {
    const goHome = vi.fn();
    expect(effectiveBack(null, true, goHome)).toBeNull();
  });
});
