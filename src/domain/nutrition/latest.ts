import type { Measurement } from '../types';

export function isNewerMeasure(m: Measurement, prev: Measurement | null): boolean {
  if (!prev) return true;
  if (+m.year !== +prev.year) return +m.year > +prev.year;
  if (+m.term !== +prev.term) return +m.term > +prev.term;
  if (+m.round !== +prev.round) return +m.round > +prev.round;
  return (m.savedAt || 0) > (prev.savedAt || 0);
}

export function latestPerStudent(ms: Measurement[]): Map<string, Measurement> {
  const map = new Map<string, Measurement>();
  for (const m of ms) {
    const prev = map.get(m.studentId) ?? null;
    if (isNewerMeasure(m, prev)) map.set(m.studentId, m);
  }
  return map;
}
