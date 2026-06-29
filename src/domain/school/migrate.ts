import type { Setup, SchoolIdentity, SchoolFile, Student, Measurement } from '../types';

export interface V1State {
  students: Student[];
  measures: Measurement[];
  setup: Setup;
  period: { year: string };
  classrooms: { grade: string; rooms: string[] }[];
}

export function splitSetup(s: Setup): { identity: SchoolIdentity; teacher: string; maxGrade: string } {
  const { teacher, maxGrade, ...identity } = s;
  return { identity, teacher, maxGrade };
}

export function migrateV1(v1: V1State): SchoolFile {
  const { identity, teacher, maxGrade } = splitSetup(v1.setup);
  return {
    schemaVersion: 2,
    identity,
    years: [{
      year: v1.period.year,
      createdAt: Date.now(),
      teacher,
      maxGrade,
      classrooms: v1.classrooms,
      students: v1.students,
      measures: v1.measures,
    }],
  };
}
