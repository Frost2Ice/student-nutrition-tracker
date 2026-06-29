import type { Term, Round } from '../types';

export type Session = { term: Term; round: Round };

export const SESSION_ORDER: Session[] = [
  { term: '1', round: '1' },
  { term: '1', round: '2' },
  { term: '2', round: '1' },
  { term: '2', round: '2' },
];

export function defaultRound(hasData: (s: Session) => boolean): Session {
  for (let i = SESSION_ORDER.length - 1; i >= 0; i--) {
    if (hasData(SESSION_ORDER[i])) return SESSION_ORDER[i];
  }
  return SESSION_ORDER[0];
}
