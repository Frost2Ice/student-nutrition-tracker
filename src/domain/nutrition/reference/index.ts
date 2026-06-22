import type { Gender } from '../../types';
import { AGE_DATA, type AgeRef } from './age-data';

export function findRef(gender: Gender, ageMonths: number): AgeRef | null {
  const g = gender === 'ชาย' ? 'M' : 'F';
  let best: AgeRef | null = null;
  let bestDiff = 999;
  for (const key of Object.keys(AGE_DATA)) {
    const [gk, am] = key.split('-');
    if (gk !== g) continue;
    const diff = Math.abs(+am - ageMonths);
    if (diff < bestDiff) { bestDiff = diff; best = AGE_DATA[key]; }
  }
  return bestDiff <= 6 ? best : null;
}

export type { AgeRef };
