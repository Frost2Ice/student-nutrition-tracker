import type { Student, Measurement, Setup, SchoolFile, SchoolIdentity, YearSnapshot } from '../types';

const VERSION = 'ntr2-1';
const YEAR_VERSION = 'ntr2-year-1';

interface BackupPayload {
  version: string;
  students: Student[];
  measures: Measurement[];
  setup: Setup;
  period: { year: string };
  classrooms: { grade: string; rooms: string[] }[];
}

export function serializeBackup(state: {
  students: Student[];
  measures: Measurement[];
  setup: Setup;
  period: { year: string };
  classrooms: { grade: string; rooms: string[] }[];
}): string {
  const payload: BackupPayload = {
    version: VERSION,
    students: state.students,
    measures: state.measures,
    setup: state.setup,
    period: { year: state.period.year },
    classrooms: state.classrooms,
  };
  return JSON.stringify(payload);
}

export function parseBackup(text: string): {
  students: Student[];
  measures: Measurement[];
  setup: Setup;
  period: { year: string };
  classrooms: { grade: string; rooms: string[] }[];
} {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error('ไฟล์สำรองไม่ถูกต้อง');
  }

  const p = parsed as Record<string, unknown>;
  if (
    !p ||
    typeof p !== 'object' ||
    p.version !== VERSION ||
    !Array.isArray(p.students) ||
    !Array.isArray(p.measures) ||
    typeof p.setup !== 'object' ||
    !p.setup ||
    typeof p.period !== 'object' ||
    !p.period
  ) {
    throw new Error('ไฟล์สำรองไม่ถูกต้อง');
  }

  const measures = (p.measures as Measurement[]).map((m) => ({
    ...m,
    savedAt: m.savedAt ?? Date.now(),
  }));

  return {
    students: p.students as Student[],
    measures,
    setup: p.setup as Setup,
    period: { year: String((p.period as { year?: unknown }).year ?? '') },
    classrooms: Array.isArray(p.classrooms)
      ? (p.classrooms as { grade: string; rooms: string[] }[])
      : [],
  };
}

function backfillMeasures(y: YearSnapshot): YearSnapshot {
  return { ...y, measures: y.measures.map((m) => ({ ...m, savedAt: m.savedAt ?? Date.now() })) };
}

export function serializeYearBundle(identity: SchoolIdentity, year: YearSnapshot): string {
  return JSON.stringify({ version: YEAR_VERSION, identity, year });
}

export function parseYearBundle(text: string): { identity: SchoolIdentity; year: YearSnapshot } {
  let p: Record<string, unknown>;
  try { p = JSON.parse(text); } catch { throw new Error('ไฟล์ปีการศึกษาไม่ถูกต้อง'); }
  if (!p || p.version !== YEAR_VERSION || typeof p.identity !== 'object' || typeof p.year !== 'object') {
    throw new Error('ไฟล์ปีการศึกษาไม่ถูกต้อง');
  }
  return { identity: p.identity as SchoolIdentity, year: backfillMeasures(p.year as YearSnapshot) };
}

export function serializeSchool(file: SchoolFile): string {
  return JSON.stringify(file);
}

export function parseSchool(text: string): SchoolFile {
  let p: Record<string, unknown>;
  try { p = JSON.parse(text); } catch { throw new Error('ไฟล์สำรองทั้งโรงเรียนไม่ถูกต้อง'); }
  if (!p || p.schemaVersion !== 2 || typeof p.identity !== 'object' || !Array.isArray(p.years)) {
    throw new Error('ไฟล์สำรองทั้งโรงเรียนไม่ถูกต้อง');
  }
  return {
    schemaVersion: 2,
    identity: p.identity as SchoolIdentity,
    years: (p.years as YearSnapshot[]).map(backfillMeasures),
  };
}
