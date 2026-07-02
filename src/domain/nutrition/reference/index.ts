import type { Gender } from '../../types';
import { AGE_DATA, type AgeRef } from './age-data';

// Reference tables run to 216 months (18y0m). A student who is 18-and-some-months
// is still "18 years old" (e.g. 18y300d), so ages from the terminal row up to —
// but not including — 19y (228mo) are assessed against the 216 row. 19y+ is over 18.
const TERMINAL_AGE_MONTHS = 216;
const UPPER_AGE_LIMIT_MONTHS = 228; // 19y0m — at/after this, out of the 2–18 band

export function findRef(gender: Gender, ageMonths: number): AgeRef | null {
  const g = gender === 'ชาย' ? 'M' : 'F';
  // Clamp the 18-and-fraction band down to the terminal reference age.
  const lookup =
    ageMonths > TERMINAL_AGE_MONTHS && ageMonths < UPPER_AGE_LIMIT_MONTHS
      ? TERMINAL_AGE_MONTHS
      : ageMonths;
  let best: AgeRef | null = null;
  let bestDiff = 999;
  for (const key of Object.keys(AGE_DATA)) {
    const [gk, am] = key.split('-');
    if (gk !== g) continue;
    const diff = Math.abs(+am - lookup);
    if (diff < bestDiff) { bestDiff = diff; best = AGE_DATA[key]; }
  }
  return bestDiff <= 6 ? best : null;
}

export type { AgeRef };
