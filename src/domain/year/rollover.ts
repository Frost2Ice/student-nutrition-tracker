import type { Student, YearSnapshot } from '../types';
import { promote } from '../grade/ladder';

export type RolloverAction = 'promote' | 'repeat' | 'graduate';
export interface RolloverDecision { action: RolloverAction; room?: string }
export interface NextYearMeta {
  year: string; teacher: string; maxGrade: string;
  classrooms: { grade: string; rooms: string[] }[];
}

export function buildNextYear(
  prev: YearSnapshot,
  decisions: Record<string, RolloverDecision>,
  meta: NextYearMeta,
): YearSnapshot {
  const students: Student[] = [];
  for (const s of prev.students) {
    const action = decisions[s.id]?.action ?? 'promote';
    if (action === 'graduate') continue;
    const room = decisions[s.id]?.room ?? s.room;
    const grade = action === 'promote' ? promote(s.grade) : s.grade;
    students.push({ ...s, grade, room });
  }
  return {
    year: meta.year,
    createdAt: Date.now(),
    teacher: meta.teacher,
    maxGrade: meta.maxGrade,
    classrooms: meta.classrooms,
    students,
    measures: [],
  };
}
