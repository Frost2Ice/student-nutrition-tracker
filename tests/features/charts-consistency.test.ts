// tests/features/charts-consistency.test.ts
// Invariant: chart zone boundaries must exactly match engine classification.
// This test MUST fail before charts.ts is fixed, and MUST pass after.

import { describe, it, expect } from 'vitest';
import type { ChartDataset } from 'chart.js';
import type { Student } from '../../src/domain/types';
import { buildWfh, buildHfa, buildWfa } from '../../src/features/charts';
import { classifyWFH, classifyWFA, classifyHFA } from '../../src/domain/nutrition/engine';
import { findRef } from '../../src/domain/nutrition/reference/index';
import { AGE_DATA } from '../../src/domain/nutrition/reference/age-data';
import { WFH_M } from '../../src/domain/nutrition/reference/wfh-male';
import { WFH_F } from '../../src/domain/nutrition/reference/wfh-female';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

type XY = { x: number; y: number };

/** Linear interpolation of a boundary curve at a given x. */
function interpolateBoundary(data: XY[], x: number): number {
  if (x <= data[0].x) return data[0].y;
  if (x >= data[data.length - 1].x) return data[data.length - 1].y;
  for (let i = 0; i < data.length - 1; i++) {
    const a = data[i], b = data[i + 1];
    if (a.x <= x && x <= b.x) {
      const t = (x - a.x) / (b.x - a.x);
      return a.y + (b.y - a.y) * t;
    }
  }
  return data[data.length - 1].y;
}

/**
 * For a WFH chart, extract the 5 boundary datasets (excluding _base and นักเรียน)
 * and classify a (height, weight) pair using linear boundary interpolation.
 */
function classifyFromWfhChart(
  datasets: ChartDataset<'line'>[],
  height: number,
  weight: number,
): string {
  // bands in order: ผอม, ค่อนข้างผอม, สมส่วน, ท้วม, เริ่มอ้วน, อ้วน
  const zoneBands = datasets.filter(
    (d) => d.label !== '_base' && d.label !== 'นักเรียน',
  );
  // Find which band the weight falls in (< each boundary in order)
  for (let i = 0; i < zoneBands.length - 1; i++) {
    const boundary = interpolateBoundary(zoneBands[i].data as XY[], height);
    if (weight < boundary) return zoneBands[i].label as string;
  }
  return zoneBands[zoneBands.length - 1].label as string;
}

/**
 * For a HFA/WFA chart using stepped nearest-row boundaries, classify by
 * directly comparing the value against the boundary dataset's y at the given age month.
 * At integer-month vertices the stepped value equals the row's field value.
 */
function classifyFromHfaChart(
  datasets: ChartDataset<'line'>[],
  ageMo: number,
  height: number,
): string {
  const ageYears = +(ageMo / 12).toFixed(2);
  const zoneBands = datasets.filter(
    (d) => d.label !== '_base' && d.label !== 'นักเรียน',
  );
  for (let i = 0; i < zoneBands.length - 1; i++) {
    const pts = zoneBands[i].data as XY[];
    const pt = pts.find((p) => p.x === ageYears);
    if (pt === undefined) throw new Error(`No data point found for age ${ageYears}`);
    if (height < pt.y) return zoneBands[i].label as string;
    // เตี้ย,ค่อนข้างเตี้ย use < but สูงตามเกณฑ์,ค่อนข้างสูง use <=
    if (i >= 2 && height <= pt.y) return zoneBands[i].label as string;
  }
  return zoneBands[zoneBands.length - 1].label as string;
}

function classifyFromWfaChart(
  datasets: ChartDataset<'line'>[],
  ageMo: number,
  weight: number,
): string {
  const ageYears = +(ageMo / 12).toFixed(2);
  const zoneBands = datasets.filter(
    (d) => d.label !== '_base' && d.label !== 'นักเรียน',
  );
  for (let i = 0; i < zoneBands.length - 1; i++) {
    const pts = zoneBands[i].data as XY[];
    const pt = pts.find((p) => p.x === ageYears);
    if (pt === undefined) throw new Error(`No data point found for age ${ageYears}`);
    if (weight < pt.y) return zoneBands[i].label as string;
    if (i >= 2 && weight <= pt.y) return zoneBands[i].label as string;
  }
  return zoneBands[zoneBands.length - 1].label as string;
}

// ---------------------------------------------------------------------------
// Structural checks
// ---------------------------------------------------------------------------

const GENDERS: Array<{ gender: 'ชาย' | 'หญิง'; label: string }> = [
  { gender: 'ชาย', label: 'male' },
  { gender: 'หญิง', label: 'female' },
];

const makeStudent = (gender: 'ชาย' | 'หญิง'): Student => ({
  id: '1',
  firstName: 'ก',
  lastName: 'ข',
  dob: '1/1/2550',
  gender,
  grade: 'ป.1',
  room: '1',
});

describe('charts-consistency: structural checks', () => {
  for (const { gender, label } of GENDERS) {
    describe(`buildWfh (${label})`, () => {
      const chart = buildWfh(makeStudent(gender), []);
      const zoneBands = chart.data.datasets.filter(
        (d) => d.label !== '_base' && d.label !== 'นักเรียน',
      ) as ChartDataset<'line'>[];

      it('all zone-band datasets have tension === 0', () => {
        for (const ds of zoneBands) {
          expect((ds as { tension?: number }).tension, `band "${ds.label}" tension`).toBe(0);
        }
      });

      it('zone-band datasets do NOT have stepped set', () => {
        for (const ds of zoneBands) {
          const stepped = (ds as { stepped?: unknown }).stepped;
          expect(stepped, `band "${ds.label}" stepped`).toBeFalsy();
        }
      });
    });

    describe(`buildHfa (${label})`, () => {
      const chart = buildHfa(makeStudent(gender), []);
      const zoneBands = chart.data.datasets.filter(
        (d) => d.label !== '_base' && d.label !== 'นักเรียน',
      ) as ChartDataset<'line'>[];

      it('all zone-band datasets have tension === 0', () => {
        for (const ds of zoneBands) {
          expect((ds as { tension?: number }).tension, `band "${ds.label}" tension`).toBe(0);
        }
      });

      it('all zone-band datasets have stepped === "middle"', () => {
        for (const ds of zoneBands) {
          expect((ds as { stepped?: unknown }).stepped, `band "${ds.label}" stepped`).toBe('middle');
        }
      });
    });

    describe(`buildWfa (${label})`, () => {
      const chart = buildWfa(makeStudent(gender), []);
      const zoneBands = chart.data.datasets.filter(
        (d) => d.label !== '_base' && d.label !== 'นักเรียน',
      ) as ChartDataset<'line'>[];

      it('all zone-band datasets have tension === 0', () => {
        for (const ds of zoneBands) {
          expect((ds as { tension?: number }).tension, `band "${ds.label}" tension`).toBe(0);
        }
      });

      it('all zone-band datasets have stepped === "middle"', () => {
        for (const ds of zoneBands) {
          expect((ds as { stepped?: unknown }).stepped, `band "${ds.label}" stepped`).toBe('middle');
        }
      });
    });
  }
});

// ---------------------------------------------------------------------------
// Behavioral checks: WFH
// ---------------------------------------------------------------------------

describe('charts-consistency: WFH behavioral check', () => {
  for (const { gender, label } of GENDERS) {
    describe(`WFH ${label}`, () => {
      const student = makeStudent(gender);
      const chart = buildWfh(student, []);
      const datasets = chart.data.datasets as ChartDataset<'line'>[];
      const T = gender === 'ชาย' ? WFH_M : WFH_F;
      const minH = T[0][0];
      const maxH = T[T.length - 1][0];

      it('chart zones match engine for sampled heights and weights', () => {
        const errors: string[] = [];
        // Sample every 0.25 cm
        for (let h = minH; h <= maxH; h += 0.25) {
          h = +h.toFixed(2);
          // Get the boundary values from the chart at this height
          const zoneBands = datasets.filter(
            (d) => d.label !== '_base' && d.label !== 'นักเรียน',
          );
          // Collect boundary y values
          const boundaries: number[] = zoneBands
            .slice(0, -1) // exclude the top "อ้วน" band (it's the ceiling)
            .map((ds) => interpolateBoundary(ds.data as XY[], h));

          // Test weights: midpoint below each boundary, and just below/above each cutoff
          const testWeights: number[] = [];
          testWeights.push(boundaries[0] - 0.05);
          for (let i = 0; i < boundaries.length; i++) {
            testWeights.push(boundaries[i] - 0.05);
            testWeights.push(boundaries[i] + 0.05);
            if (i < boundaries.length - 1) {
              testWeights.push((boundaries[i] + boundaries[i + 1]) / 2);
            }
          }
          testWeights.push(boundaries[boundaries.length - 1] + 0.5);

          for (const w of testWeights) {
            if (w <= 0) continue;
            const chartLabel = classifyFromWfhChart(datasets, h, w);
            const engineLabel = classifyWFH(gender, h, w);
            if (chartLabel !== engineLabel) {
              errors.push(
                `h=${h} w=${w.toFixed(3)}: chart="${chartLabel}" engine="${engineLabel}"`,
              );
            }
          }
        }
        if (errors.length > 0) {
          throw new Error(
            `WFH chart/engine diverge at ${errors.length} points:\n${errors.slice(0, 10).join('\n')}`,
          );
        }
      });
    });
  }
});

// ---------------------------------------------------------------------------
// Behavioral checks: HFA
// ---------------------------------------------------------------------------

describe('charts-consistency: HFA behavioral check', () => {
  for (const { gender, label } of GENDERS) {
    describe(`HFA ${label}`, () => {
      const student = makeStudent(gender);
      const chart = buildHfa(student, []);
      const datasets = chart.data.datasets as ChartDataset<'line'>[];
      const g = gender === 'ชาย' ? 'M' : 'F';

      it('chart zones match engine for all age-data months', () => {
        const errors: string[] = [];
        const months = Object.keys(AGE_DATA)
          .filter((k) => k.startsWith(g + '-'))
          .map((k) => +k.split('-')[1])
          .sort((a, b) => a - b);

        for (const mo of months) {
          const ref = findRef(gender, mo);
          if (!ref) continue;
          const thresholds = [ref.sd2h, ref.sd15h, ref.sd15ph, ref.sd2ph];
          const testHeights = [
            thresholds[0] - 0.05,
            ...thresholds.flatMap((t) => [t - 0.05, t + 0.05]),
            thresholds[thresholds.length - 1] + 0.5,
          ];
          for (const h of testHeights) {
            const chartLabel = classifyFromHfaChart(datasets, mo, h);
            const engineLabel = classifyHFA(ref, h);
            if (chartLabel !== engineLabel) {
              errors.push(
                `mo=${mo} h=${h.toFixed(3)}: chart="${chartLabel}" engine="${engineLabel}"`,
              );
            }
          }
        }
        if (errors.length > 0) {
          throw new Error(
            `HFA chart/engine diverge at ${errors.length} points:\n${errors.slice(0, 10).join('\n')}`,
          );
        }
      });
    });
  }
});

// ---------------------------------------------------------------------------
// Behavioral checks: WFA
// ---------------------------------------------------------------------------

describe('charts-consistency: WFA behavioral check', () => {
  for (const { gender, label } of GENDERS) {
    describe(`WFA ${label}`, () => {
      const student = makeStudent(gender);
      const chart = buildWfa(student, []);
      const datasets = chart.data.datasets as ChartDataset<'line'>[];
      const g = gender === 'ชาย' ? 'M' : 'F';

      it('chart zones match engine for all age-data months', () => {
        const errors: string[] = [];
        const months = Object.keys(AGE_DATA)
          .filter((k) => k.startsWith(g + '-'))
          .map((k) => +k.split('-')[1])
          .sort((a, b) => a - b);

        for (const mo of months) {
          const ref = findRef(gender, mo);
          if (!ref) continue;
          const thresholds = [ref.sd2w, ref.sd15w, ref.sd15pw, ref.sd2pw];
          const testWeights = [
            thresholds[0] - 0.05,
            ...thresholds.flatMap((t) => [t - 0.05, t + 0.05]),
            thresholds[thresholds.length - 1] + 0.5,
          ];
          for (const w of testWeights) {
            if (w <= 0) continue;
            const chartLabel = classifyFromWfaChart(datasets, mo, w);
            const engineLabel = classifyWFA(ref, w);
            if (chartLabel !== engineLabel) {
              errors.push(
                `mo=${mo} w=${w.toFixed(3)}: chart="${chartLabel}" engine="${engineLabel}"`,
              );
            }
          }
        }
        if (errors.length > 0) {
          throw new Error(
            `WFA chart/engine diverge at ${errors.length} points:\n${errors.slice(0, 10).join('\n')}`,
          );
        }
      });
    });
  }
});
