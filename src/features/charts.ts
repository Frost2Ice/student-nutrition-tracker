import type { ChartConfiguration, ChartDataset } from 'chart.js';
import type { Student, Measurement } from '../domain/types';
import { WFH_M } from '../domain/nutrition/reference/wfh-male';
import { WFH_F } from '../domain/nutrition/reference/wfh-female';
import { AGE_DATA } from '../domain/nutrition/reference/age-data';
import { getAgeMonths } from '../domain/date/thai-date';

type XY = { x: number; y: number };

const C = {
  red: 'rgba(220,38,38,0.18)',
  org: 'rgba(234,88,12,0.18)',
  lgr: 'rgba(250,204,21,0.18)',
  grn: 'rgba(22,163,74,0.20)',
  pink: 'rgba(236,72,153,0.18)',
  blu: 'rgba(37,99,235,0.18)',
};

// Builds stacked area "zones" between successive boundary lines (bottom → top).
// Each boundary line fills down to the previous dataset.
// stepped: 'middle' for age-based charts (HFA/WFA) to match engine's nearest-row snap;
// omit (falsy) for height-based charts (WFH) which use linear interpolation.
function zones(
  baseline: XY[],
  bands: { label: string; line: XY[]; color: string }[],
  stepped?: 'middle',
): ChartDataset<'line'>[] {
  const ds: ChartDataset<'line'>[] = [
    { label: '_base', data: baseline, borderWidth: 0, pointRadius: 0, fill: false } as ChartDataset<'line'>,
  ];
  for (const b of bands) {
    const dataset: ChartDataset<'line'> = {
      label: b.label,
      data: b.line,
      borderColor: b.color.replace('0.1', '0.6').replace('0.20', '0.6').replace('0.18', '0.6'),
      borderWidth: 1,
      pointRadius: 0,
      backgroundColor: b.color,
      fill: '-1',
      tension: 0,
    } as ChartDataset<'line'>;
    if (stepped) (dataset as unknown as Record<string, unknown>).stepped = stepped;
    ds.push(dataset);
  }
  return ds;
}

function studentPoints(
  measures: Measurement[],
  xy: (m: Measurement) => XY | null,
): ChartDataset<'line'> {
  const pts = measures
    .map(xy)
    .filter((p): p is XY => p !== null)
    .sort((a, b) => a.x - b.x);
  return {
    label: 'นักเรียน',
    data: pts,
    borderColor: '#0f172a',
    backgroundColor: '#0f172a',
    borderWidth: 2,
    pointRadius: 5,
    pointHoverRadius: 7,
    fill: false,
    tension: 0,
  } as ChartDataset<'line'>;
}

const baseOpts = (xTitle: string, yTitle: string, xMax?: number): ChartConfiguration<'line'>['options'] => ({
  responsive: true,
  maintainAspectRatio: false,
  animation: false,
  interaction: { mode: 'nearest', intersect: false },
  plugins: {
    legend: { labels: { font: { family: 'Sarabun' }, filter: (i) => i.text !== '_base' } },
  },
  scales: {
    x: { type: 'linear', max: xMax, title: { display: true, text: xTitle, font: { family: 'Sarabun' } } },
    y: { title: { display: true, text: yTitle, font: { family: 'Sarabun' } } },
  },
});

export function buildWfh(student: Student, measures: Measurement[]): ChartConfiguration<'line'> {
  const T = student.gender === 'ชาย' ? WFH_M : WFH_F;
  const col = (c: number): XY[] => T.map((r) => ({ x: r[0], y: r[c] }));
  const baseline: XY[] = T.map((r) => ({ x: r[0], y: 0 }));
  const maxLine: XY[] = T.map((r) => ({ x: r[0], y: r[6] + 8 }));
  const bands = [
    { label: 'ผอม', line: col(1), color: C.org },
    { label: 'ค่อนข้างผอม', line: col(2), color: C.lgr },
    { label: 'สมส่วน', line: col(3), color: C.grn },
    { label: 'ท้วม', line: col(4), color: C.lgr },
    { label: 'เริ่มอ้วน', line: col(5), color: C.pink },
    { label: 'อ้วน', line: maxLine, color: C.red },
  ];
  const pts = studentPoints(measures, (m) => ({ x: m.heightCm, y: m.weightKg }));
  return {
    type: 'line',
    data: { datasets: [...zones(baseline, bands), pts] },
    options: baseOpts('ส่วนสูง (ซม.)', 'น้ำหนัก (กก.)'),
  };
}

function ageRows(gender: Student['gender']) {
  const g = gender === 'ชาย' ? 'M' : 'F';
  return Object.keys(AGE_DATA)
    .filter((k) => k.startsWith(g + '-'))
    .map((k) => ({ mo: +k.split('-')[1], r: AGE_DATA[k] }))
    .sort((a, b) => a.mo - b.mo);
}

export function buildHfa(student: Student, measures: Measurement[]): ChartConfiguration<'line'> {
  const rows = ageRows(student.gender);
  const line = (f: 'sd2h' | 'sd15h' | 'sd15ph' | 'sd2ph'): XY[] =>
    rows.map((x) => ({ x: +(x.mo / 12).toFixed(2), y: x.r[f] }));
  const baseline: XY[] = rows.map((x) => ({ x: +(x.mo / 12).toFixed(2), y: Math.max(0, x.r.sd2h - 12) }));
  const maxLine: XY[] = rows.map((x) => ({ x: +(x.mo / 12).toFixed(2), y: x.r.sd2ph + 12 }));
  const bands = [
    { label: 'เตี้ย', line: line('sd2h'), color: C.org },
    { label: 'ค่อนข้างเตี้ย', line: line('sd15h'), color: C.lgr },
    { label: 'สูงตามเกณฑ์', line: line('sd15ph'), color: C.grn },
    { label: 'ค่อนข้างสูง', line: line('sd2ph'), color: C.lgr },
    { label: 'สูง', line: maxLine, color: C.blu },
  ];
  const pts = studentPoints(measures, (m) => {
    const age = getAgeMonths(student.dob, m.date);
    return age === null ? null : { x: +(age / 12).toFixed(2), y: m.heightCm };
  });
  return {
    type: 'line',
    data: { datasets: [...zones(baseline, bands, 'middle'), pts] },
    options: baseOpts('อายุ (ปี)', 'ส่วนสูง (ซม.)', 19),
  };
}

export function buildWfa(student: Student, measures: Measurement[]): ChartConfiguration<'line'> {
  const rows = ageRows(student.gender);
  const line = (f: 'sd2w' | 'sd15w' | 'sd15pw' | 'sd2pw'): XY[] =>
    rows.map((x) => ({ x: +(x.mo / 12).toFixed(2), y: x.r[f] }));
  const baseline: XY[] = rows.map((x) => ({ x: +(x.mo / 12).toFixed(2), y: Math.max(0, x.r.sd2w - 5) }));
  const maxLine: XY[] = rows.map((x) => ({ x: +(x.mo / 12).toFixed(2), y: x.r.sd2pw + 8 }));
  const bands = [
    { label: 'น้ำหนักน้อย', line: line('sd2w'), color: C.org },
    { label: 'น้ำหนักค่อนข้างน้อย', line: line('sd15w'), color: C.lgr },
    { label: 'น้ำหนักตามเกณฑ์', line: line('sd15pw'), color: C.grn },
    { label: 'น้ำหนักค่อนข้างมาก', line: line('sd2pw'), color: C.lgr },
    { label: 'น้ำหนักมาก', line: maxLine, color: C.red },
  ];
  const pts = studentPoints(measures, (m) => {
    const age = getAgeMonths(student.dob, m.date);
    return age === null ? null : { x: +(age / 12).toFixed(2), y: m.weightKg };
  });
  return {
    type: 'line',
    data: { datasets: [...zones(baseline, bands, 'middle'), pts] },
    options: baseOpts('อายุ (ปี)', 'น้ำหนัก (กก.)', 19),
  };
}
