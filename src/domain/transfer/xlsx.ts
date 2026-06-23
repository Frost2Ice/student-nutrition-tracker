/**
 * xlsx domain module — teacher data exchange in Excel format.
 * Uses SheetJS (xlsx). Backup stays JSON (backup.ts untouched).
 * All teacher data exchange is .xlsx; there is no CSV path in the app.
 */
import * as XLSX from 'xlsx';
import type { Student, Measurement, Term, Round, Gender } from '../types';
import {
  validateWeight,
  validateHeight,
  validateThaiDate,
  round1,
} from '../validation/rules';
import { normalizeThaiDate, formatThaiDate } from '../date/thai-date';

// ---------------------------------------------------------------------------
// Headers (exact Thai column labels)
// ---------------------------------------------------------------------------
export const STUDENT_HEADERS = [
  'รหัสนักเรียน',
  'ชื่อ',
  'นามสกุล',
  'วันเกิด-วัน',
  'วันเกิด-เดือน',
  'วันเกิด-ปี(พ.ศ.)',
  'เพศ',
  'ชั้น',
  'ห้อง',
] as const;

/** Per-classroom import template — no grade/room columns (taken from picker). */
export const STUDENT_CLASSROOM_HEADERS = [
  'รหัสนักเรียน',
  'ชื่อ',
  'นามสกุล',
  'วันเกิด-วัน',
  'วันเกิด-เดือน',
  'วันเกิด-ปี(พ.ศ.)',
  'เพศ',
] as const;

export const MEASURE_HEADERS = [
  'รหัสนักเรียน',
  'น้ำหนัก(กก.)',
  'ส่วนสูง(ซม.)',
  'วันที่วัด',
] as const;

// ---------------------------------------------------------------------------
// Pure AOA builders (unit-testable, no SheetJS needed)
// ---------------------------------------------------------------------------

export function studentTemplateAoa(): string[][] {
  return [
    [...STUDENT_HEADERS],
    ['10001', 'สมชาย', 'ใจดี', '15', '3', '2558', 'ชาย', 'ป.1', '1'],
  ];
}

export function studentClassroomTemplateAoa(): string[][] {
  return [
    [...STUDENT_CLASSROOM_HEADERS],
    ['10001', 'สมชาย', 'ใจดี', '15', '3', '2558', 'ชาย'],
  ];
}

export function measureTemplateAoa(): string[][] {
  return [
    [...MEASURE_HEADERS],
    ['10001', '22.5', '120', '15/6/2569'],
  ];
}

export function studentsToAoa(students: Student[]): string[][] {
  const rows: string[][] = [[...STUDENT_HEADERS]];
  for (const s of students) {
    const [dobDay, dobMonth, dobYear] = s.dob.split('/');
    rows.push([s.id, s.firstName, s.lastName, dobDay ?? '', dobMonth ?? '', dobYear ?? '', s.gender, s.grade, s.room]);
  }
  return rows;
}

export function graduatesToAoa(students: Student[]): string[][] {
  // Same columns as students — graduates list
  return studentsToAoa(students);
}

// ---------------------------------------------------------------------------
// SheetJS read/write thin wrappers
// ---------------------------------------------------------------------------

export function aoaToXlsxBlob(aoa: unknown[][], sheetName = 'ข้อมูล', textCols: number[] = []): Blob {
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  if (textCols.length > 0) {
    const rowCount = aoa.length;
    for (let r = 1; r < rowCount; r++) {
      for (const c of textCols) {
        const addr = XLSX.utils.encode_cell({ r, c });
        const cell = ws[addr];
        if (cell !== undefined) {
          cell.t = 's';
          cell.z = '@';
          cell.v = String(cell.v ?? '');
        }
      }
    }
  }
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName);
  const arr = XLSX.write(wb, { type: 'array', bookType: 'xlsx' });
  return new Blob([arr], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
}

export function readXlsxToAoa(buf: ArrayBuffer): string[][] {
  const wb = XLSX.read(buf, { type: 'array', cellDates: true });
  const wsName = wb.SheetNames[0];
  const ws = wb.Sheets[wsName];
  const raw: unknown[][] = XLSX.utils.sheet_to_json(ws, {
    header: 1,
    raw: true,
    defval: '',
  });
  // Coerce every cell to trimmed string; Date cells → formatThaiDate (BE)
  return raw.map((row) =>
    (row as unknown[]).map((cell) => {
      if (cell instanceof Date) return formatThaiDate(cell);
      return String(cell ?? '').trim();
    }),
  );
}

// ---------------------------------------------------------------------------
// Parsers (pure over AOA; row numbers 1-based incl. header → first data = 2)
// ---------------------------------------------------------------------------

export function parseStudentAoa(aoa: string[][]): {
  rows: Student[];
  skipped: { row: number; reason: string }[];
} {
  const rows: Student[] = [];
  const skipped: { row: number; reason: string }[] = [];

  // aoa[0] is header — data starts at index 1 → row number = index + 1
  for (let i = 1; i < aoa.length; i++) {
    const rowNum = i + 1;
    const cells = aoa[i];
    const [id, firstName, lastName, dob, gender, grade, room] = cells.map((c) =>
      (c ?? '').trim(),
    );

    if (!id) {
      skipped.push({ row: rowNum, reason: 'กรุณากรอกรหัสนักเรียน' });
      continue;
    }
    if (!firstName) {
      skipped.push({ row: rowNum, reason: 'กรุณากรอกชื่อ' });
      continue;
    }

    const validGenders: Gender[] = ['ชาย', 'หญิง'];
    const resolvedGender: Gender =
      validGenders.includes(gender as Gender) ? (gender as Gender) : 'ชาย';

    rows.push({
      id,
      firstName,
      lastName: lastName ?? '',
      dob: dob ?? '',
      gender: resolvedGender,
      grade: grade ?? '',
      room: room ?? '',
    });
  }

  return { rows, skipped };
}

export function parseMeasureAoa(
  aoa: string[][],
  period: { year: string; term: Term; round: Round },
): {
  rows: Measurement[];
  skipped: { row: number; reason: string }[];
} {
  const rows: Measurement[] = [];
  const skipped: { row: number; reason: string }[] = [];

  for (let i = 1; i < aoa.length; i++) {
    const rowNum = i + 1;
    const cells = aoa[i];
    const [studentId, weightStr, heightStr, date] = cells.map((c) =>
      (c ?? '').trim(),
    );

    const weightKg = parseFloat(weightStr);
    const heightCm = parseFloat(heightStr);

    const wErr = validateWeight(weightKg);
    if (wErr) {
      skipped.push({ row: rowNum, reason: wErr });
      continue;
    }
    const hErr = validateHeight(heightCm);
    if (hErr) {
      skipped.push({ row: rowNum, reason: hErr });
      continue;
    }
    const normDate = normalizeThaiDate(date);
    if (!normDate) {
      skipped.push({ row: rowNum, reason: 'อ่านวันที่วัดไม่ได้ — ใช้รูปแบบ วัน/เดือน/ปีพ.ศ.' });
      continue;
    }
    const resolvedDate = normDate.value;
    const dErr = validateThaiDate(resolvedDate, false);
    if (dErr) {
      skipped.push({ row: rowNum, reason: dErr });
      continue;
    }

    rows.push({
      studentId,
      year: period.year,
      term: period.term,
      round: period.round,
      date: resolvedDate,
      weightKg,
      heightCm,
      savedAt: Date.now(),
      gradeAtMeasure: '',
      roomAtMeasure: '',
    });
  }

  return { rows, skipped };
}

// ---------------------------------------------------------------------------
// Per-classroom import preview
// ---------------------------------------------------------------------------

export interface ImportPreviewRow {
  rowNum: number;
  id: string;
  firstName: string;
  lastName: string;
  dob: string;       // normalized canonical value (or raw if not parseable)
  rawDob: string;    // original file value (for inline-fix prefill)
  gender: string;
  issues: { message: string; severity: 'error' | 'warn' }[];
  status: 'ok' | 'update' | 'error';
  student: Student | null;
  /** true when issues include the date-unreadable error */
  hasDateError: boolean;
}

export function parseStudentImport(
  aoa: string[][],
  ctx: { grade: string; room: string },
  existingIds: Set<string>,
  overrides?: Map<number, { dob?: string }>,
  periodYear?: number,
): { rows: ImportPreviewRow[]; counts: { ok: number; update: number; error: number } } {
  // First pass: collect all ids to detect intra-file duplicates
  const idCounts = new Map<string, number>();
  for (let i = 1; i < aoa.length; i++) {
    const id = (aoa[i][0] ?? '').trim();
    if (id) idCounts.set(id, (idCounts.get(id) ?? 0) + 1);
  }

  const rows: ImportPreviewRow[] = [];

  for (let i = 1; i < aoa.length; i++) {
    const rowNum = i + 1;
    const cells = aoa[i];
    const id = (cells[0] ?? '').trim();
    const firstName = (cells[1] ?? '').trim();
    const lastName = (cells[2] ?? '').trim();
    const rawDay = (cells[3] ?? '').trim();
    const rawMonth = (cells[4] ?? '').trim();
    const rawYear = (cells[5] ?? '').trim();
    const genderRaw = (cells[6] ?? '').trim();
    // rawDob is the joined value shown in the preview (for hasDateError detection)
    const rawDob = rawDay && rawMonth && rawYear ? `${+rawDay}/${+rawMonth}/${rawYear}` : '';

    const issues: { message: string; severity: 'error' | 'warn' }[] = [];

    // id checks
    if (!id) {
      issues.push({ message: 'ไม่มีรหัสนักเรียน', severity: 'error' });
    } else if (!/^\d+$/.test(id)) {
      issues.push({ message: 'รหัสนักเรียนต้องเป็นตัวเลข', severity: 'error' });
    } else if ((idCounts.get(id) ?? 0) > 1) {
      issues.push({ message: 'รหัสซ้ำกันในไฟล์', severity: 'error' });
    }

    // name checks
    if (!firstName) issues.push({ message: 'ไม่มีชื่อ', severity: 'error' });
    if (!lastName) issues.push({ message: 'ไม่มีนามสกุล', severity: 'error' });

    // dob: use override if present, else build from three numeric columns
    const overrideDob = overrides?.get(rowNum)?.dob;
    let dob = '';
    if (overrideDob !== undefined) {
      // Override supplies full canonical D/M/YYYY — normalize and validate
      const normDob = normalizeThaiDate(overrideDob);
      if (!normDob) {
        issues.push({ message: 'อ่านวันเกิดไม่ได้ — แก้ไขในช่องด้านล่าง หรือใช้รูปแบบ วัน/เดือน/ปีพ.ศ.', severity: 'error' });
      } else {
        dob = normDob.value;
        if (normDob.converted) issues.push({ message: 'ปรับรูปแบบวันที่ให้อัตโนมัติ', severity: 'warn' });
        const dobErr = validateThaiDate(dob, true, periodYear);
        if (dobErr) issues.push({ message: dobErr, severity: 'error' });
      }
    } else {
      // Three-column DOB
      if (!rawDay || !rawMonth || !rawYear) {
        issues.push({ message: 'กรอกวันเกิดให้ครบ (วัน/เดือน/ปี พ.ศ.)', severity: 'error' });
      } else {
        dob = `${+rawDay}/${+rawMonth}/${rawYear}`;
        const dobErr = validateThaiDate(dob, true, periodYear);
        if (dobErr) issues.push({ message: dobErr, severity: 'error' });
      }
    }

    // gender check
    const validGenders: Gender[] = ['ชาย', 'หญิง'];
    let resolvedGender: Gender = 'ชาย';
    if (!validGenders.includes(genderRaw as Gender)) {
      issues.push({
        message: 'เพศไม่ถูกต้อง ใช้ค่าเริ่มต้น "ชาย"',
        severity: 'warn',
      });
    } else {
      resolvedGender = genderRaw as Gender;
    }

    const hasError = issues.some((is) => is.severity === 'error');

    let status: 'ok' | 'update' | 'error';
    let student: Student | null = null;

    if (hasError) {
      status = 'error';
    } else {
      student = {
        id,
        firstName,
        lastName,
        dob,
        gender: resolvedGender,
        grade: ctx.grade,
        room: ctx.room,
      };
      if (existingIds.has(id)) {
        status = 'update';
        issues.push({
          message: 'มีรหัสนี้อยู่แล้ว — จะอัปเดตข้อมูลเดิม',
          severity: 'warn',
        });
      } else {
        status = 'ok';
      }
    }

    const hasDateError = issues.some(
      (is) => is.severity === 'error' && (
        is.message.includes('วันเกิดไม่ได้') ||
        is.message.includes('กรอกวันเกิดให้ครบ') ||
        is.message.includes('ปีเกิด') ||
        is.message.includes('ปีพ.ศ.')
      ),
    );
    rows.push({ rowNum, id, firstName, lastName, dob, rawDob: rawDob, gender: genderRaw, issues, status, student, hasDateError });
  }

  const counts = { ok: 0, update: 0, error: 0 };
  for (const r of rows) counts[r.status]++;

  return { rows, counts };
}

// ---------------------------------------------------------------------------
// Measurement import preview (mirrors parseStudentImport pattern)
// ---------------------------------------------------------------------------

export interface MeasureImportPreviewRow {
  rowNum: number;
  id: string;
  weightRaw: string;
  heightRaw: string;
  dateRaw: string;
  name: string;
  issues: { message: string; severity: 'error' | 'warn' }[];
  status: 'ok' | 'update' | 'error';
  measure: Measurement | null;
}

export function parseMeasureImport(
  aoa: string[][],
  period: { year: string; term: Term; round: Round },
  students: Student[],
  hasDup: (studentId: string) => boolean,
  ctx: { grade: string; room: string },
  overrides?: Map<number, { date?: string; weight?: string; height?: string }>,
): { rows: MeasureImportPreviewRow[]; counts: { ok: number; update: number; error: number } } {
  const rows: MeasureImportPreviewRow[] = [];

  // Pre-count ids to flag intra-file duplicates (same student twice in one file).
  // With upsert semantics the last row silently wins; warn so the teacher knows.
  const idCounts = new Map<string, number>();
  for (let i = 1; i < aoa.length; i++) {
    const fid = (aoa[i][0] ?? '').trim();
    if (fid) idCounts.set(fid, (idCounts.get(fid) ?? 0) + 1);
  }

  for (let i = 1; i < aoa.length; i++) {
    const rowNum = i + 1;
    const cells = aoa[i];
    const ov = overrides?.get(rowNum);

    const id = (cells[0] ?? '').trim();
    const weightRaw = ov?.weight !== undefined ? ov.weight : (cells[1] ?? '').trim();
    const heightRaw = ov?.height !== undefined ? ov.height : (cells[2] ?? '').trim();
    const dateRaw = ov?.date !== undefined ? ov.date : (cells[3] ?? '').trim();

    const issues: { message: string; severity: 'error' | 'warn' }[] = [];

    // id empty
    if (!id) {
      issues.push({ message: 'ไม่มีรหัสนักเรียน', severity: 'error' });
    } else if ((idCounts.get(id) ?? 0) > 1) {
      issues.push({ message: 'รหัสนักเรียนซ้ำในไฟล์ — ระบบจะใช้ค่าจากแถวสุดท้าย', severity: 'warn' });
    }

    // student lookup — must exist AND belong to the selected classroom
    const matchedStudent = id ? students.find((s) => s.id === id) ?? null : null;
    if (id && !matchedStudent) {
      issues.push({ message: 'ไม่พบรหัสนักเรียนนี้ในระบบ', severity: 'error' });
    } else if (
      matchedStudent &&
      (matchedStudent.grade !== ctx.grade || matchedStudent.room !== ctx.room)
    ) {
      issues.push({
        message: `นักเรียนคนนี้อยู่ห้อง ${matchedStudent.grade}/${matchedStudent.room} ไม่ใช่ห้องที่เลือก`,
        severity: 'error',
      });
    }

    // weight
    const weightKg = round1(parseFloat(weightRaw));
    const wErr = validateWeight(weightKg);
    if (wErr) issues.push({ message: wErr, severity: 'error' });

    // height
    const heightCm = round1(parseFloat(heightRaw));
    const hErr = validateHeight(heightCm);
    if (hErr) issues.push({ message: hErr, severity: 'error' });

    // date
    let resolvedDate = '';
    const normDate = normalizeThaiDate(dateRaw);
    if (!normDate) {
      issues.push({ message: 'อ่านวันที่วัดไม่ได้ — แก้ไขในช่องด้านล่าง', severity: 'error' });
    } else {
      resolvedDate = normDate.value;
      const dErr = validateThaiDate(resolvedDate, false);
      if (dErr) {
        issues.push({ message: dErr, severity: 'error' });
      } else if (normDate.converted) {
        issues.push({ message: 'ปรับรูปแบบวันที่ให้อัตโนมัติ', severity: 'warn' });
      }
    }

    const hasError = issues.some((is) => is.severity === 'error');
    const name = matchedStudent ? `${matchedStudent.firstName} ${matchedStudent.lastName}` : '';

    let status: 'ok' | 'update' | 'error';
    let measure: Measurement | null = null;

    if (hasError) {
      status = 'error';
    } else if (hasDup(id)) {
      status = 'update';
      issues.push({ message: 'มีผลของรอบนี้แล้ว — จะอัปเดตทับของเดิม', severity: 'warn' });
      measure = {
        studentId: id,
        year: period.year,
        term: period.term,
        round: period.round,
        date: resolvedDate,
        weightKg,
        heightCm,
        savedAt: Date.now(),
        gradeAtMeasure: matchedStudent!.grade,
        roomAtMeasure: matchedStudent!.room,
      };
    } else {
      status = 'ok';
      measure = {
        studentId: id,
        year: period.year,
        term: period.term,
        round: period.round,
        date: resolvedDate,
        weightKg,
        heightCm,
        savedAt: Date.now(),
        gradeAtMeasure: matchedStudent!.grade,
        roomAtMeasure: matchedStudent!.room,
      };
    }

    rows.push({ rowNum, id, weightRaw, heightRaw, dateRaw, name, issues, status, measure });
  }

  const counts = { ok: 0, update: 0, error: 0 };
  for (const r of rows) counts[r.status]++;

  return { rows, counts };
}

// ---------------------------------------------------------------------------
// Merge helpers (mirror csv.ts mergeImport semantics, split by entity)
// ---------------------------------------------------------------------------

export interface MergeStore {
  students: { value: Student[] };
  addStudent: (s: Student) => void;
  updateStudent: (id: string, patch: Partial<Student>) => void;
  addMeasure: (m: Measurement) => void;
  upsertMeasure: (m: Measurement) => 'added' | 'updated';
  findDuplicate: (
    studentId: string,
    year: string,
    term: Term,
    round: Round,
  ) => Measurement | null;
}

export function mergeStudents(
  store: MergeStore,
  rows: Student[],
): { added: number; updated: number } {
  let added = 0;
  let updated = 0;

  for (const s of rows) {
    const existing = store.students.value.find((x) => x.id === s.id);
    if (existing) {
      store.updateStudent(s.id, s);
      updated++;
    } else {
      store.addStudent(s);
      added++;
    }
  }

  return { added, updated };
}

export function mergeMeasures(
  store: MergeStore,
  rows: Measurement[],
): { added: number; updated: number; orphans: number } {
  let added = 0;
  let updated = 0;
  let orphans = 0;

  for (const m of rows) {
    const student = store.students.value.find((s) => s.id === m.studentId);
    if (!student) {
      orphans++;
      continue;
    }
    // One record per (student, year, term, round): overwrite if it exists.
    const result = store.upsertMeasure({
      ...m,
      gradeAtMeasure: student.grade,
      roomAtMeasure: student.room,
    });
    if (result === 'updated') updated++;
    else added++;
  }

  return { added, updated, orphans };
}
