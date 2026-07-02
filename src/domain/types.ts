export type Gender = 'ชาย' | 'หญิง';
export type Term = '1' | '2';
export type Round = '1' | '2';

export interface Student {
  id: string;
  firstName: string;
  lastName: string;
  dob: string; // Thai BE D/M/YYYY
  gender: Gender;
  grade: string;
  room: string;
}

export interface Measurement {
  studentId: string;
  year: string;
  term: Term;
  round: Round;
  date: string; // Thai BE D/M/YYYY
  weightKg: number;
  heightCm: number;
  savedAt: number; // epoch ms tie-breaker
  gradeAtMeasure: string;
  roomAtMeasure: string;
}

export interface Setup {
  school: string;
  code?: string;
  ministry: string;
  department: string;
  subdistrict: string;
  district: string;
  province: string;
  teacher: string;
  maxGrade: string;
}

export interface SchoolIdentity {
  school: string;
  code?: string;
  ministry: string;
  department: string;
  subdistrict: string;
  district: string;
  province: string;
}

export interface YearSnapshot {
  year: string;
  createdAt: number;
  teacher: string;
  maxGrade: string;
  classrooms: { grade: string; rooms: string[] }[];
  students: Student[];
  measures: Measurement[];
}

export type YearStatus = 'active' | 'archived';
export interface YearMeta { year: string; status: YearStatus; createdAt: number }
export interface SchoolManifest { schemaVersion: 2; years: YearMeta[] }
export interface SchoolFile { schemaVersion: 2; identity: SchoolIdentity; years: YearSnapshot[] }

export class ReadonlyYearError extends Error {
  constructor(year: string) {
    super(`ปีการศึกษา ${year} เก็บถาวรแล้ว (อ่านอย่างเดียว)`);
    this.name = 'ReadonlyYearError';
  }
}
