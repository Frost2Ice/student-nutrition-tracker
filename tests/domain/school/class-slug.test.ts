import { describe, it, expect } from 'vitest';
import { classSlug } from '../../../src/domain/school/class-slug';

describe('classSlug', () => {
  it('replaces the grade dot and the grade/room boundary with dashes', () => {
    expect(classSlug('อ.2', '1')).toBe('อ-2-1');
    expect(classSlug('ป.1', '2')).toBe('ป-1-2');
    expect(classSlug('ม.6', '3')).toBe('ม-6-3');
  });
  it('is stable for plain (dotless) grades', () => {
    expect(classSlug('K', '1')).toBe('K-1');
  });
  it('collapses whitespace in either part', () => {
    expect(classSlug('ป.1', ' 2 ')).toBe('ป-1-2');
  });
});
