import { describe, it, expect } from 'vitest';
import { defaultRound, SESSION_ORDER } from '../../src/domain/measure/default-round';

describe('defaultRound', () => {
  it('falls back to term 1 round 1 when no round has data', () => {
    expect(defaultRound(() => false)).toEqual({ term: '1', round: '1' });
  });
  it('returns the latest round that has data', () => {
    const withData = new Set(['1-1', '2-1']);
    const pick = defaultRound((s) => withData.has(`${s.term}-${s.round}`));
    expect(pick).toEqual({ term: '2', round: '1' });
  });
  it('returns the only round that has data', () => {
    const withData = new Set(['1-2']);
    const pick = defaultRound((s) => withData.has(`${s.term}-${s.round}`));
    expect(pick).toEqual({ term: '1', round: '2' });
  });
  it('exposes the canonical session order', () => {
    expect(SESSION_ORDER).toEqual([
      { term: '1', round: '1' },
      { term: '1', round: '2' },
      { term: '2', round: '1' },
      { term: '2', round: '2' },
    ]);
  });
});
