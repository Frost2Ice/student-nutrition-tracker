import { describe, it, expect } from 'vitest';
import { ReadonlyYearError } from '../../src/domain/types';

describe('ReadonlyYearError', () => {
  it('is an Error with the year in its message', () => {
    const e = new ReadonlyYearError('2568');
    expect(e).toBeInstanceOf(Error);
    expect(e.name).toBe('ReadonlyYearError');
    expect(e.message).toContain('2568');
  });
});
