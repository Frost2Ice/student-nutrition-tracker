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
  ministry: string;
  department: string;
  subdistrict: string;
  district: string;
  province: string;
  teacher: string;
  maxGrade: string;
}
