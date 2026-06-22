export const GRADE_ORDER: string[] = [
  'อ.1', 'อ.2', 'อ.3',
  'ป.1', 'ป.2', 'ป.3', 'ป.4', 'ป.5', 'ป.6',
  'ม.1', 'ม.2', 'ม.3', 'ม.4', 'ม.5', 'ม.6',
];

export function promote(grade: string): string {
  const i = GRADE_ORDER.indexOf(grade);
  if (i === -1 || i === GRADE_ORDER.length - 1) return grade;
  return GRADE_ORDER[i + 1];
}

export function demote(grade: string): string {
  const i = GRADE_ORDER.indexOf(grade);
  if (i <= 0) return grade;
  return GRADE_ORDER[i - 1];
}

export function isMaxGrade(grade: string, maxGrade: string): boolean {
  return grade === maxGrade;
}

export function gradesUpTo(maxGrade: string): string[] {
  const idx = GRADE_ORDER.indexOf(maxGrade);
  if (idx === -1) return [];
  return GRADE_ORDER.slice(0, idx + 1);
}
