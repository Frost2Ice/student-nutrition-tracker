import type { Student, Measurement, Setup, Round } from '../types';
import { calcNutrition } from '../nutrition/engine';
import { latestPerStudent } from '../nutrition/latest';
import { GRADE_ORDER } from '../grade/ladder';
import type { WfhLabel } from '../nutrition/engine';

export const WFH_BUCKET_LABELS = ['ผอม', 'ค่อนข้างผอม', 'สมส่วน', 'ท้วม/เริ่มอ้วน', 'อ้วน'] as const;
export type WfhBucketLabel = (typeof WFH_BUCKET_LABELS)[number];

/** Map engine WFH label → bucket index (0-4) */
function wfhBucket(label: WfhLabel): number {
  switch (label) {
    case 'ผอม': return 0;
    case 'ค่อนข้างผอม': return 1;
    case 'สมส่วน': return 2;
    case 'ท้วม': return 3;
    case 'เริ่มอ้วน': return 3;
    case 'อ้วน': return 4;
  }
}

export interface GradeSummary {
  grade: string;
  counts: number[]; // 5-bucket tallies
  tall: number;
}

export interface ReportSummary {
  measured: number;
  enrolled: number;
  byGrade: GradeSummary[];
  tall: number;
}

export function summarize(
  students: Student[],
  measures: Measurement[],
  year: string,
  term: string,
  round: Round,
): ReportSummary {
  const enrolled = students.length;

  // Filter to matching year+term+round (round is a real filter, not cosmetic —
  // each report shows exactly one measurement round)
  const filtered = measures.filter((m) => m.year === year && m.term === term && m.round === round);

  // If a room re-measured a student twice within the same round, keep the latest-saved one
  const latestMap = latestPerStudent(filtered);

  // Gather grade → counts
  const gradeMap = new Map<string, { counts: number[]; tall: number }>();

  let measured = 0;
  let tallTotal = 0;

  for (const student of students) {
    const m = latestMap.get(student.id);
    if (!m) continue;
    const result = calcNutrition(student, m);
    if (!result) continue;

    measured++;

    // Use student's current grade (BRD §6.3)
    const grade = student.grade;
    if (!gradeMap.has(grade)) {
      gradeMap.set(grade, { counts: [0, 0, 0, 0, 0], tall: 0 });
    }
    const entry = gradeMap.get(grade)!;
    entry.counts[wfhBucket(result.wfh)]++;
    if (result.tall) {
      entry.tall++;
      tallTotal++;
    }
  }

  // Sort by GRADE_ORDER
  const grades = [...gradeMap.keys()].sort((a, b) => {
    const ai = GRADE_ORDER.indexOf(a);
    const bi = GRADE_ORDER.indexOf(b);
    return (ai === -1 ? Infinity : ai) - (bi === -1 ? Infinity : bi);
  });

  const byGrade: GradeSummary[] = grades.map((grade) => ({
    grade,
    counts: gradeMap.get(grade)!.counts,
    tall: gradeMap.get(grade)!.tall,
  }));

  return { measured, enrolled, byGrade, tall: tallTotal };
}

export function summaryToAoa(
  setup: Setup,
  summary: ReportSummary,
  year: string,
  term: string,
  round: Round,
): (string | number)[][] {
  const aoa: (string | number)[][] = [];

  // Header info — omit a row entirely when the value is blank (legacy profiles
  // without a school code, or schools that never filled optional address fields)
  const headerLine = (label: string, value: string | undefined) => {
    if (value) aoa.push([label, value]);
  };

  headerLine('โรงเรียน', setup.school);
  headerLine('รหัสโรงเรียน', setup.code);
  headerLine('สังกัดกระทรวง', setup.ministry);
  headerLine('สังกัดกรม/หน่วยงาน', setup.department);
  headerLine('ตำบล/แขวง', setup.subdistrict);
  headerLine('อำเภอ/เขต', setup.district);
  headerLine('จังหวัด', setup.province);
  aoa.push(['ปีการศึกษา', year]);
  aoa.push(['ภาคเรียน', term]);
  aoa.push(['ครั้งที่วัด', round]);
  aoa.push(['นักเรียนทั้งหมด', summary.enrolled]);
  aoa.push(['นักเรียนที่วัด', summary.measured]);
  aoa.push([]);

  // Table header row
  aoa.push(['ระดับชั้น', ...WFH_BUCKET_LABELS, 'รวมที่วัด', 'สูงดีสมส่วน']);

  // Grade rows
  for (const g of summary.byGrade) {
    const total = g.counts.reduce((a, b) => a + b, 0);
    aoa.push([g.grade, ...g.counts, total, g.tall]);
  }

  // Totals row
  const catTotals = WFH_BUCKET_LABELS.map((_, i) =>
    summary.byGrade.reduce((s, g) => s + g.counts[i], 0),
  );
  aoa.push(['รวมทั้งโรงเรียน', ...catTotals, summary.measured, summary.tall]);

  // Percentage row (as strings with %)
  const pctVal = (n: number, d: number): string =>
    (d ? (Math.round((n / d) * 1000) / 10).toFixed(1) : '0.0') + '%';
  const pctRow = catTotals.map((n) => pctVal(n, summary.measured));
  aoa.push(['ร้อยละ', ...pctRow, '100%', pctVal(summary.tall, summary.measured)]);

  aoa.push([]);
  aoa.push(['แหล่งเกณฑ์', 'สำนักโภชนาการ กรมอนามัย พ.ศ. 2564']);

  return aoa;
}
