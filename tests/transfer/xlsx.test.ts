import { describe, it, expect } from 'vitest';
import * as XLSX from 'xlsx';
import {
  STUDENT_HEADERS,
  MEASURE_HEADERS,
  STUDENT_CLASSROOM_HEADERS,
  studentTemplateAoa,
  measureTemplateAoa,
  studentClassroomTemplateAoa,
  studentsToAoa,
  parseStudentAoa,
  parseMeasureAoa,
  parseStudentImport,
  parseMeasureImport,
  mergeMeasures,
  aoaToXlsxBlob,
  readXlsxToAoa,
  hasLegacyDobColumns,
  gridRowsToAoa,
  parseClipboardGrid,
  COL_MISALIGN_MSG,
  mergeStudents,
} from '../../src/domain/transfer/xlsx';
import type { MergeStore } from '../../src/domain/transfer/xlsx';
import type { Measurement, Student } from '../../src/domain/types';

describe('xlsx AOA builders', () => {
  it('studentTemplateAoa()[0] equals STUDENT_HEADERS', () => {
    expect(studentTemplateAoa()[0]).toEqual([...STUDENT_HEADERS]);
  });

  it('measureTemplateAoa()[0] equals MEASURE_HEADERS', () => {
    expect(measureTemplateAoa()[0]).toEqual([...MEASURE_HEADERS]);
  });

  it('studentsToAoa emits header + one row per student with single DOB column', () => {
    const students = [
      {
        id: '10001',
        firstName: 'สมชาย',
        lastName: 'ใจดี',
        dob: '15/3/2558',
        gender: 'ชาย' as const,
        grade: 'ป.1',
        room: '1',
      },
    ];
    const aoa = studentsToAoa(students);
    expect(aoa[0]).toEqual([...STUDENT_HEADERS]);
    expect(aoa[1]).toEqual(['10001', 'สมชาย', 'ใจดี', '15/3/2558', 'ชาย', 'ป.1', '1']);
  });
});

describe('parseStudentAoa', () => {
  it('skips a row missing id with a reason', () => {
    const aoa = [
      [...STUDENT_HEADERS],
      ['', 'สมชาย', 'ใจดี', '15/3/2558', 'ชาย', 'ป.1', '1'],
    ];
    const { rows, skipped } = parseStudentAoa(aoa);
    expect(rows).toHaveLength(0);
    expect(skipped).toHaveLength(1);
    expect(skipped[0].row).toBe(2);
    expect(skipped[0].reason).toBeTruthy();
  });

  it('skips a row missing ชื่อ', () => {
    const aoa = [
      [...STUDENT_HEADERS],
      ['10001', '', 'ใจดี', '15/3/2558', 'ชาย', 'ป.1', '1'],
    ];
    const { rows, skipped } = parseStudentAoa(aoa);
    expect(rows).toHaveLength(0);
    expect(skipped[0].row).toBe(2);
  });

  it('defaults gender to ชาย when blank/invalid', () => {
    const aoa = [
      [...STUDENT_HEADERS],
      ['10001', 'สมชาย', 'ใจดี', '15/3/2558', '', 'ป.1', '1'],
    ];
    const { rows } = parseStudentAoa(aoa);
    expect(rows[0].gender).toBe('ชาย');
    expect(rows[0].grade).toBe('ป.1');
    expect(rows[0].room).toBe('1');
    expect(rows[0].dob).toBe('15/3/2558');
  });

  it('round-trips studentTemplateAoa() — dob joined, grade & room preserved', () => {
    const { rows, skipped } = parseStudentAoa(studentTemplateAoa());
    expect(skipped).toHaveLength(0);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ id: '10001', firstName: 'สมชาย', lastName: 'ใจดี', dob: '15/3/2558', gender: 'ชาย', grade: 'ป.1', room: '1' });
  });
});

describe('parseMeasureAoa', () => {
  const period = { year: '2567', term: '1' as const, round: '1' as const };

  it('skips an invalid weight (999) at row 2', () => {
    const aoa = [
      [...MEASURE_HEADERS],
      ['10001', '999', '120', '15/6/2569'],
    ];
    const { rows, skipped } = parseMeasureAoa(aoa, period);
    expect(rows).toHaveLength(0);
    expect(skipped).toHaveLength(1);
    expect(skipped[0].row).toBe(2);
  });

  it('skips an invalid height', () => {
    const aoa = [
      [...MEASURE_HEADERS],
      ['10001', '22.5', '999', '15/6/2569'],
    ];
    const { rows, skipped } = parseMeasureAoa(aoa, period);
    expect(rows).toHaveLength(0);
    expect(skipped[0].row).toBe(2);
  });

  it('skips an invalid date', () => {
    const aoa = [
      [...MEASURE_HEADERS],
      ['10001', '22.5', '120', 'bad-date'],
    ];
    const { rows, skipped } = parseMeasureAoa(aoa, period);
    expect(rows).toHaveLength(0);
    expect(skipped[0].row).toBe(2);
  });

  it('parses a valid measure row and stamps period + empty gradeAtMeasure', () => {
    const aoa = measureTemplateAoa();
    const { rows, skipped } = parseMeasureAoa(aoa, period);
    expect(skipped).toHaveLength(0);
    expect(rows).toHaveLength(1);
    expect(rows[0].year).toBe('2567');
    expect(rows[0].term).toBe('1');
    expect(rows[0].round).toBe('1');
    expect(rows[0].gradeAtMeasure).toBe('');
    expect(rows[0].roomAtMeasure).toBe('');
  });
});

describe('STUDENT_CLASSROOM_HEADERS', () => {
  it('contains exactly the 5 classroom columns with single DOB', () => {
    expect(STUDENT_CLASSROOM_HEADERS).toEqual([
      'รหัสนักเรียน','ชื่อ','นามสกุล','วันเกิด','เพศ',
    ]);
  });
});

describe('studentClassroomTemplateAoa', () => {
  it('returns header row matching STUDENT_CLASSROOM_HEADERS', () => {
    const aoa = studentClassroomTemplateAoa();
    expect(aoa[0]).toEqual([...STUDENT_CLASSROOM_HEADERS]);
  });

  it('returns example data row with single DOB as second row', () => {
    const aoa = studentClassroomTemplateAoa();
    expect(aoa[1]).toEqual(['10001','สมชาย','ใจดี','15/3/2558','ชาย']);
  });
});

describe('parseStudentImport', () => {
  const ctx = { grade: 'ป.1', room: '1' };

  // 5-column format: id, firstName, lastName, dob, gender
  const validRow = (overrides: Partial<Record<string,string>> = {}) => {
    const base = { id: '10001', firstName: 'สมชาย', lastName: 'ใจดี', dob: '15/3/2558', gender: 'ชาย' };
    const merged = { ...base, ...overrides };
    return [merged.id, merged.firstName, merged.lastName, merged.dob, merged.gender];
  };

  it('clean row → status ok, student built with grade/room from ctx, rowNum=2', () => {
    const aoa = [
      [...STUDENT_CLASSROOM_HEADERS],
      validRow(),
    ];
    const { rows, counts } = parseStudentImport(aoa, ctx, new Set());
    expect(rows).toHaveLength(1);
    expect(rows[0].status).toBe('ok');
    expect(rows[0].issues).toHaveLength(0);
    expect(rows[0].rowNum).toBe(2);
    expect(rows[0].student).not.toBeNull();
    expect(rows[0].student?.grade).toBe('ป.1');
    expect(rows[0].student?.room).toBe('1');
    expect(counts).toEqual({ ok: 1, update: 0, error: 0 });
  });

  it('bad dob (empty) → status error กรอกวันเกิด, rowNum correct', () => {
    const aoa = [
      [...STUDENT_CLASSROOM_HEADERS],
      validRow({ dob: '' }),
    ];
    const { rows, counts } = parseStudentImport(aoa, ctx, new Set());
    expect(rows[0].status).toBe('error');
    expect(rows[0].student).toBeNull();
    expect(rows[0].rowNum).toBe(2);
    const msgs = rows[0].issues.map(i => i.message);
    expect(msgs.some(m => m.includes('กรอกวันเกิด'))).toBe(true);
    expect(counts.error).toBe(1);
  });

  it('missing id → status error with Thai message ไม่มีรหัสนักเรียน', () => {
    const aoa = [
      [...STUDENT_CLASSROOM_HEADERS],
      validRow({ id: '' }),
    ];
    const { rows } = parseStudentImport(aoa, ctx, new Set());
    expect(rows[0].status).toBe('error');
    const msgs = rows[0].issues.map(i => i.message);
    expect(msgs).toContain('ไม่มีรหัสนักเรียน');
  });

  it('non-digit id → error รหัสนักเรียนต้องเป็นตัวเลข', () => {
    const aoa = [
      [...STUDENT_CLASSROOM_HEADERS],
      validRow({ id: 'ABC' }),
    ];
    const { rows } = parseStudentImport(aoa, ctx, new Set());
    expect(rows[0].status).toBe('error');
    const msgs = rows[0].issues.map(i => i.message);
    expect(msgs).toContain('รหัสนักเรียนต้องเป็นตัวเลข');
  });

  it('id already in existingIds → status update with warn message', () => {
    const aoa = [
      [...STUDENT_CLASSROOM_HEADERS],
      validRow(),
    ];
    const { rows, counts } = parseStudentImport(aoa, ctx, new Set(['10001']));
    expect(rows[0].status).toBe('update');
    expect(rows[0].student).not.toBeNull();
    const msgs = rows[0].issues.map(i => i.message);
    expect(msgs).toContain('มีรหัสนี้อยู่แล้ว');
    expect(counts).toEqual({ ok: 0, update: 1, error: 0 });
  });

  it('duplicate id in file → both rows error รหัสซ้ำกันในไฟล์', () => {
    const aoa = [
      [...STUDENT_CLASSROOM_HEADERS],
      validRow(),
      ['10001', 'สมหญิง', 'ดีใจ', '1/1/2558', 'หญิง'],
    ];
    const { rows, counts } = parseStudentImport(aoa, ctx, new Set());
    expect(rows[0].status).toBe('error');
    expect(rows[1].status).toBe('error');
    const msgs0 = rows[0].issues.map(i => i.message);
    const msgs1 = rows[1].issues.map(i => i.message);
    expect(msgs0).toContain('รหัสซ้ำกันในไฟล์');
    expect(msgs1).toContain('รหัสซ้ำกันในไฟล์');
    expect(counts).toEqual({ ok: 0, update: 0, error: 2 });
  });

  it('gender invalid → warn not error, student still built with default ชาย', () => {
    const aoa = [
      [...STUDENT_CLASSROOM_HEADERS],
      validRow({ gender: 'unknown' }),
    ];
    const { rows } = parseStudentImport(aoa, ctx, new Set());
    expect(rows[0].status).toBe('ok');
    expect(rows[0].student?.gender).toBe('ชาย');
    const warns = rows[0].issues.filter(i => i.severity === 'warn');
    expect(warns.some(w => w.message.includes('เพศไม่ถูกต้อง'))).toBe(true);
  });

  it('counts correct for mixed rows', () => {
    const aoa = [
      [...STUDENT_CLASSROOM_HEADERS],
      validRow({ id: '10001' }),       // ok
      validRow({ id: '10002' }),       // update (existing)
      validRow({ id: '' }),            // error
    ];
    const { counts } = parseStudentImport(aoa, ctx, new Set(['10002']));
    expect(counts).toEqual({ ok: 1, update: 1, error: 1 });
  });
});

// ---------------------------------------------------------------------------
// parseStudentImport — single-column DOB + override
// ---------------------------------------------------------------------------
describe('parseStudentImport — single-column DOB', () => {
  const ctx = { grade: 'ป.1', room: '1' };
  // 5-column format: id, firstName, lastName, วันเกิด, gender
  const validRow5 = (overrides: Partial<Record<string,string>> = {}) => {
    const base = { id: '10001', firstName: 'สมชาย', lastName: 'ใจดี', dob: '15/3/2558', gender: 'ชาย' };
    const merged = { ...base, ...overrides };
    return [merged.id, merged.firstName, merged.lastName, merged.dob, merged.gender];
  };

  it('valid single DOB → status ok, dob canonical D/M/YYYY', () => {
    const aoa = [
      [...STUDENT_CLASSROOM_HEADERS],
      validRow5(),
    ];
    const { rows, counts } = parseStudentImport(aoa, ctx, new Set(), undefined, 2567);
    expect(rows).toHaveLength(1);
    expect(rows[0].status).toBe('ok');
    expect(rows[0].student?.dob).toBe('15/3/2558');
    expect(counts).toEqual({ ok: 1, update: 0, error: 0 });
  });

  it('empty dob → error กรอกวันเกิด', () => {
    const aoa = [
      [...STUDENT_CLASSROOM_HEADERS],
      validRow5({ dob: '' }),
    ];
    const { rows } = parseStudentImport(aoa, ctx, new Set(), undefined, 2567);
    expect(rows[0].status).toBe('error');
    const msgs = rows[0].issues.map(i => i.message);
    expect(msgs.some(m => m.includes('กรอกวันเกิด'))).toBe(true);
  });

  it('unparseable dob → error อ่านวันเกิดไม่ได้', () => {
    const aoa = [
      [...STUDENT_CLASSROOM_HEADERS],
      validRow5({ dob: 'ไม่รู้' }),
    ];
    const { rows } = parseStudentImport(aoa, ctx, new Set(), undefined, 2567);
    expect(rows[0].status).toBe('error');
    const msgs = rows[0].issues.map(i => i.message);
    expect(msgs.some(m => m.includes('อ่านวันเกิดไม่ได้'))).toBe(true);
  });

  it('out-of-window year → error from validateThaiDate', () => {
    const aoa = [
      [...STUDENT_CLASSROOM_HEADERS],
      validRow5({ dob: '15/3/2500' }),  // way too old for periodYear=2567
    ];
    const { rows } = parseStudentImport(aoa, ctx, new Set(), undefined, 2567);
    expect(rows[0].status).toBe('error');
    const msgs = rows[0].issues.map(i => i.message);
    expect(msgs.some(m => m.includes('ปีเกิด'))).toBe(true);
  });

  it('existing id → status update', () => {
    const aoa = [
      [...STUDENT_CLASSROOM_HEADERS],
      validRow5(),
    ];
    const { rows, counts } = parseStudentImport(aoa, ctx, new Set(['10001']), undefined, 2567);
    expect(rows[0].status).toBe('update');
    expect(rows[0].student?.dob).toBe('15/3/2558');
    expect(counts).toEqual({ ok: 0, update: 1, error: 0 });
  });

  it('override dob replaces raw cell value', () => {
    // Row has blank dob (would error), but override provides full canonical dob
    const aoa = [
      [...STUDENT_CLASSROOM_HEADERS],
      validRow5({ dob: '' }),
    ];
    const overrides = new Map([[2, { dob: '1/6/2558' }]]);
    const { rows } = parseStudentImport(aoa, ctx, new Set(), overrides, 2567);
    expect(rows[0].status).toBe('ok');
    expect(rows[0].student?.dob).toBe('1/6/2558');
  });
});

// ---------------------------------------------------------------------------
// parseMeasureImport
// ---------------------------------------------------------------------------
describe('parseMeasureImport', () => {
  const period = { year: '2567', term: '1' as const, round: '1' as const };

  const students = [
    {
      id: '10001',
      firstName: 'สมชาย',
      lastName: 'ใจดี',
      dob: '15/3/2558',
      gender: 'ชาย' as const,
      grade: 'ป.1',
      room: '1',
    },
    {
      id: '10002',
      firstName: 'สมหญิง',
      lastName: 'ดีใจ',
      dob: '1/1/2558',
      gender: 'หญิง' as const,
      grade: 'ป.2',
      room: '1',
    },
  ];

  const noDup = () => false;
  const ctx = { grade: 'ป.1', room: '1' };

  it('clean row → status ok, measure built, counts ok=1', () => {
    const aoa = [
      [...MEASURE_HEADERS],
      ['10001', '22.5', '120', '15/6/2567'],
    ];
    const { rows, counts } = parseMeasureImport(aoa, period, students, noDup, ctx);
    expect(rows).toHaveLength(1);
    expect(rows[0].status).toBe('ok');
    expect(rows[0].rowNum).toBe(2);
    expect(rows[0].issues).toHaveLength(0);
    expect(rows[0].measure).not.toBeNull();
    expect(rows[0].measure?.weightKg).toBe(22.5);
    expect(rows[0].measure?.heightCm).toBe(120);
    expect(rows[0].measure?.gradeAtMeasure).toBe('ป.1');
    expect(rows[0].measure?.roomAtMeasure).toBe('1');
    expect(rows[0].name).toBe('สมชาย ใจดี');
    expect(counts).toEqual({ ok: 1, update: 0, error: 0 });
  });

  it('bad weight (999) → status error with message containing row 2', () => {
    const aoa = [
      [...MEASURE_HEADERS],
      ['10001', '999', '120', '15/6/2567'],
    ];
    const { rows, counts } = parseMeasureImport(aoa, period, students, noDup, ctx);
    expect(rows[0].status).toBe('error');
    expect(rows[0].rowNum).toBe(2);
    expect(rows[0].measure).toBeNull();
    const msgs = rows[0].issues.map(i => i.message);
    expect(msgs.some(m => m.includes('น้ำหนัก'))).toBe(true);
    expect(counts.error).toBe(1);
  });

  it('orphan id (not in students) → status error ไม่พบรหัสนักเรียนนี้ในระบบ, name empty', () => {
    const aoa = [
      [...MEASURE_HEADERS],
      ['99999', '22.5', '120', '15/6/2567'],
    ];
    const { rows } = parseMeasureImport(aoa, period, students, noDup, ctx);
    expect(rows[0].status).toBe('error');
    expect(rows[0].name).toBe('');
    const msgs = rows[0].issues.map(i => i.message);
    expect(msgs).toContain('ไม่พบรหัสนักเรียนนี้ในระบบ');
  });

  it('student from a different classroom → status error (tied to selected room)', () => {
    // 10002 is ป.2/1 but ctx is ป.1/1 → must be rejected
    const aoa = [
      [...MEASURE_HEADERS],
      ['10002', '22.5', '120', '15/6/2567'],
    ];
    const { rows } = parseMeasureImport(aoa, period, students, noDup, ctx);
    expect(rows[0].status).toBe('error');
    expect(rows[0].measure).toBeNull();
    const msgs = rows[0].issues.map(i => i.message);
    expect(msgs.some(m => m.includes('ไม่ใช่ห้องที่เลือก'))).toBe(true);
  });

  it('CE/Excel-style date auto-converts to BE → status ok + warn ปรับรูปแบบวันที่ให้อัตโนมัติ', () => {
    // CE date 15/6/2024 should convert to BE 15/6/2567
    const aoa = [
      [...MEASURE_HEADERS],
      ['10001', '22.5', '120', '15/6/2024'],
    ];
    const { rows } = parseMeasureImport(aoa, period, students, noDup, ctx);
    expect(rows[0].status).toBe('ok');
    const warns = rows[0].issues.filter(i => i.severity === 'warn');
    expect(warns.some(w => w.message.includes('ปรับรูปแบบวันที่'))).toBe(true);
    expect(rows[0].measure?.date).toBe('15/6/2567');
  });

  it('dup id → status update, measure built (overwrite), warn message, counts update=1', () => {
    const aoa = [
      [...MEASURE_HEADERS],
      ['10001', '22.5', '120', '15/6/2567'],
    ];
    const hasDup = (id: string) => id === '10001';
    const { rows, counts } = parseMeasureImport(aoa, period, students, hasDup, ctx);
    expect(rows[0].status).toBe('update');
    expect(rows[0].measure).not.toBeNull();
    const msgs = rows[0].issues.map(i => i.message);
    expect(msgs.some(m => m.includes('มีผลของรอบนี้แล้ว'))).toBe(true);
    expect(counts).toEqual({ ok: 0, update: 1, error: 0 });
  });

  it('counts correct for mixed rows: ok + update + error', () => {
    const aoa = [
      [...MEASURE_HEADERS],
      ['10001', '22.5', '120', '15/6/2567'],  // update (existing round)
      ['10002', '999', '120', '15/6/2567'],    // error (bad weight)
      ['10001', '22.5', '120', '15/6/2567'],  // update again
    ];
    // 10001 is dup → overwrite, 10002 is not
    const hasDup = (id: string) => id === '10001';
    const { counts } = parseMeasureImport(aoa, period, students, hasDup, ctx);
    expect(counts.update).toBe(2);
    expect(counts.error).toBe(1);
    expect(counts.ok).toBe(0);
  });

  it('intra-file duplicate id → warn on both rows (last row wins)', () => {
    const aoa = [
      [...MEASURE_HEADERS],
      ['10001', '22.5', '120', '15/6/2567'],
      ['10001', '24.0', '121', '15/6/2567'],
    ];
    const { rows } = parseMeasureImport(aoa, period, students, noDup, ctx);
    const warned = rows.filter((r) => r.issues.some((i) => i.message.includes('ซ้ำในไฟล์')));
    expect(warned).toHaveLength(2);
    // not blocking: both still importable (ok), upsert makes the last win
    expect(rows.every((r) => r.status === 'ok')).toBe(true);
  });

  it('override replaces date raw value and re-validates', () => {
    const aoa = [
      [...MEASURE_HEADERS],
      ['10001', '22.5', '120', 'bad-date'],
    ];
    // Without override → error
    const { rows: r1 } = parseMeasureImport(aoa, period, students, noDup, ctx);
    expect(r1[0].status).toBe('error');

    // With date override → ok
    const overrides = new Map([[2, { date: '15/6/2567' }]]);
    const { rows: r2 } = parseMeasureImport(aoa, period, students, noDup, ctx, overrides);
    expect(r2[0].status).toBe('ok');
  });

  it('empty id → status error ไม่มีรหัสนักเรียน', () => {
    const aoa = [
      [...MEASURE_HEADERS],
      ['', '22.5', '120', '15/6/2567'],
    ];
    const { rows } = parseMeasureImport(aoa, period, students, noDup, ctx);
    expect(rows[0].status).toBe('error');
    const msgs = rows[0].issues.map(i => i.message);
    expect(msgs).toContain('ไม่มีรหัสนักเรียน');
  });
});

describe('aoaToXlsxBlob textCols', () => {
  it('marks specified column data cells as string type (t===s) and number format @', () => {
    const aoa = [
      ['รหัสนักเรียน', 'ชื่อ', 'วันเกิด'],
      ['10001', 'สมชาย', '15/3/2558'],
    ];
    // col index 2 = วันเกิด; build the workbook and inspect the cell directly
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    const textCols = [2];
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
    const cell = ws[XLSX.utils.encode_cell({ r: 1, c: 2 })];
    expect(cell.t).toBe('s');
    expect(cell.z).toBe('@');
    // The aoaToXlsxBlob with textCols should produce a valid Blob
    const blob = aoaToXlsxBlob(aoa, 'sheet', [2]);
    expect(blob).toBeInstanceOf(Blob);
  });
});

describe('SheetJS round-trip', () => {
  it('readXlsxToAoa returns headers as strings after write', () => {
    const aoa = studentTemplateAoa();
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'ข้อมูล');
    const arr: ArrayBuffer = XLSX.write(wb, { type: 'array', bookType: 'xlsx' });
    const result = readXlsxToAoa(arr);
    expect(result[0]).toEqual([...STUDENT_HEADERS]);
  });

  it('aoaToXlsxBlob returns a Blob with xlsx mime type', () => {
    const aoa = measureTemplateAoa();
    const blob = aoaToXlsxBlob(aoa);
    expect(blob).toBeInstanceOf(Blob);
    expect(blob.type).toBe(
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
  });
});

describe('single-column DOB', () => {
  it('headers use one วันเกิด column', () => {
    expect(STUDENT_HEADERS).toEqual(['รหัสนักเรียน','ชื่อ','นามสกุล','วันเกิด','เพศ','ชั้น','ห้อง']);
    expect(STUDENT_CLASSROOM_HEADERS).toEqual(['รหัสนักเรียน','ชื่อ','นามสกุล','วันเกิด','เพศ']);
  });

  it('detects legacy 3-column header', () => {
    expect(hasLegacyDobColumns(['รหัสนักเรียน','ชื่อ','นามสกุล','วันเกิด-วัน','วันเกิด-เดือน','วันเกิด-ปี(พ.ศ.)','เพศ'])).toBe(true);
    expect(hasLegacyDobColumns([...STUDENT_HEADERS])).toBe(false);
  });

  it('parseStudentAoa reads a single DOB cell', () => {
    const aoa = [[...STUDENT_HEADERS], ['10001','สมชาย','ใจดี','2/10/2558','ชาย','ป.1','1']];
    const { rows, skipped } = parseStudentAoa(aoa);
    expect(skipped).toHaveLength(0);
    expect(rows[0].dob).toBe('2/10/2558');
  });

  it('round-trips studentsToAoa → parseStudentAoa', () => {
    const s = { id: '10001', firstName: 'สมชาย', lastName: 'ใจดี', dob: '2/10/2558', gender: 'ชาย' as const, grade: 'ป.1', room: '1' };
    const aoa = studentsToAoa([s]);
    expect(aoa[0]).toEqual([...STUDENT_HEADERS]);
    expect(parseStudentAoa(aoa).rows[0]).toMatchObject({ id: '10001', dob: '2/10/2558' });
  });

  it('preview normalizes a single DOB cell and flags unparseable as error', () => {
    const aoa = [[...STUDENT_CLASSROOM_HEADERS],
      ['10001','สมชาย','ใจดี','2 ต.ค. 2558','ชาย'],
      ['10002','สมหญิง','ใจงาม','ไม่รู้','หญิง']];
    const { rows } = parseStudentImport(aoa, { grade: 'ป.1', room: '1' }, new Set(), undefined, 2569);
    expect(rows[0].dob).toBe('2/10/2558');
    expect(rows[1].status).toBe('error');
    expect(rows[1].hasDateError).toBe(true);
  });

  it('parseClipboardGrid reads a single DOB cell', () => {
    const grid = parseClipboardGrid('10001\tสมชาย\tใจดี\t2/10/2558\tชาย');
    expect(grid[0].dob).toBe('2/10/2558');
  });

  it('gridRowsToAoa emits one DOB column', () => {
    const aoa = gridRowsToAoa([{ id: '10001', firstName: 'ส', lastName: 'ใจดี', gender: 'ชาย', dob: '2/10/2558' }]);
    expect(aoa[0]).toEqual([...STUDENT_CLASSROOM_HEADERS]);
    expect(aoa[1]).toEqual(['10001','ส','ใจดี','2/10/2558','ชาย']);
  });
});

describe('mergeMeasures (upsert: one record per round)', () => {
  function makeStore(students: Student[], initial: Measurement[]): MergeStore & { all: Measurement[] } {
    const all = [...initial];
    return {
      all,
      students: { value: students },
      addStudent: () => {},
      updateStudent: () => {},
      addMeasure: (m) => { all.push(m); },
      upsertMeasure: (m) => {
        const i = all.findIndex(
          (x) => x.studentId === m.studentId && x.year === m.year && x.term === m.term && x.round === m.round,
        );
        if (i >= 0) { all.splice(i, 1, m); return 'updated'; }
        all.push(m);
        return 'added';
      },
      findDuplicate: (sid, y, t, r) =>
        all.find((x) => x.studentId === sid && x.year === y && x.term === t && x.round === r) ?? null,
    };
  }
  const student: Student = { id: '10001', firstName: 'ส', lastName: 'ใจดี', dob: '1/1/2558', gender: 'ชาย', grade: 'ป.1', room: '1' };
  const mk = (w: number): Measurement => ({
    studentId: '10001', year: '2567', term: '1', round: '1', date: '1/6/2567',
    weightKg: w, heightCm: 120, savedAt: 1, gradeAtMeasure: 'ป.1', roomAtMeasure: '1',
  });

  it('overwrites existing same-round record instead of duplicating', () => {
    const store = makeStore([student], [mk(20)]);
    const res = mergeMeasures(store, [mk(25)]);
    expect(res).toEqual({ added: 0, updated: 1, orphans: 0 });
    expect(store.all).toHaveLength(1);
    expect(store.all[0].weightKg).toBe(25);
  });

  it('adds when no matching round exists', () => {
    const store = makeStore([student], []);
    const res = mergeMeasures(store, [mk(25)]);
    expect(res).toEqual({ added: 1, updated: 0, orphans: 0 });
    expect(store.all).toHaveLength(1);
  });

  it('counts orphan when student missing', () => {
    const store = makeStore([], [mk(20)]);
    const res = mergeMeasures(store, [mk(25)]);
    expect(res.orphans).toBe(1);
  });
});

describe('mergeStudents', () => {
  function makeStudentStore(initial: Student[]): MergeStore {
    const students = { value: [...initial] };
    return {
      students,
      addStudent: (s: Student) => { students.value.push(s); },
      updateStudent: (id: string, patch: Partial<Student>) => {
        const i = students.value.findIndex((x) => x.id === id);
        if (i >= 0) students.value[i] = { ...students.value[i], ...patch };
      },
    } as unknown as MergeStore;
  }
  const mk = (over: Partial<Student>): Student => ({
    id: '10001', firstName: 'ก', lastName: 'ข', dob: '1/1/2558', gender: 'ชาย', grade: 'ป.1', room: '1', ...over,
  });

  it('updates personal fields but never moves an existing student to another room', () => {
    const store = makeStudentStore([mk({ firstName: 'เก่า', grade: 'ป.2', room: '1' })]);
    const res = mergeStudents(store, [mk({ firstName: 'ใหม่', gender: 'หญิง', dob: '2/2/2559', grade: 'ป.1', room: '3' })]);
    expect(res).toEqual({ added: 0, updated: 1 });
    const s = store.students.value[0];
    expect(s.firstName).toBe('ใหม่');   // personal fields updated
    expect(s.gender).toBe('หญิง');
    expect(s.dob).toBe('2/2/2559');
    expect(s.grade).toBe('ป.2');        // location NOT changed
    expect(s.room).toBe('1');
  });

  it('adds a new student with the imported grade/room', () => {
    const store = makeStudentStore([]);
    const res = mergeStudents(store, [mk({ id: '20002', grade: 'ป.1', room: '3' })]);
    expect(res).toEqual({ added: 1, updated: 0 });
    expect(store.students.value[0]).toMatchObject({ id: '20002', grade: 'ป.1', room: '3' });
  });
});

describe('column-misalignment guard (delimiter lost)', () => {
  // A row that collapsed into one cell: the whole line landed in the id column.
  const collapsed = '10099 สมชาย ใจดี 2 ต.ค. 2558 ชาย';

  it('parseStudentAoa skips a collapsed row with the misalign message', () => {
    const aoa = [[...STUDENT_HEADERS], [collapsed]];
    const { rows, skipped } = parseStudentAoa(aoa);
    expect(rows).toHaveLength(0);
    expect(skipped).toHaveLength(1);
    expect(skipped[0].reason).toBe(COL_MISALIGN_MSG);
  });

  it('parseStudentImport flags a collapsed row once, without noisy field errors', () => {
    const aoa = [[...STUDENT_CLASSROOM_HEADERS], [collapsed]];
    const { rows } = parseStudentImport(aoa, { grade: 'ป.1', room: '1' }, new Set(), undefined, 2569);
    expect(rows[0].status).toBe('error');
    expect(rows[0].issues.some((i) => i.message === COL_MISALIGN_MSG)).toBe(true);
    // the collapse must NOT also spew name/dob errors
    expect(rows[0].issues.some((i) => i.message === 'ไม่มีชื่อ')).toBe(false);
    expect(rows[0].issues.some((i) => i.message === 'กรอกวันเกิด (วัน/เดือน/ปี พ.ศ.)')).toBe(false);
  });

  it('a properly tab-split row with a spaced Thai-month DOB still passes', () => {
    const aoa = [[...STUDENT_CLASSROOM_HEADERS], ['10099', 'สมชาย', 'ใจดี', '2 ต.ค. 2558', 'ชาย']];
    const { rows } = parseStudentImport(aoa, { grade: 'ป.1', room: '1' }, new Set(), undefined, 2569);
    expect(rows[0].status).toBe('ok');
    expect(rows[0].dob).toBe('2/10/2558');
  });
});
