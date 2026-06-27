import type { Student, Measurement, Setup } from '../types';

const VERSION = 'ntr2-1';

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
