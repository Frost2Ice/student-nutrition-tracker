/**
 * mockdata/generate.mjs
 * Deterministic full-school mock dataset generator.
 * Run: node mockdata/generate.mjs
 * Writes: mockdata/sample-school.json  (backup format version ntr2-1)
 *         mockdata/import-samples/roster-<grade>-<room>.xlsx
 *         mockdata/import-samples/measure-<grade>-<room>.xlsx
 */

import { writeFileSync, mkdirSync, readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import * as XLSX from 'xlsx';

const __dir = dirname(fileURLToPath(import.meta.url));

// ─── Deterministic PRNG (LCG) ──────────────────────────────────────────────
let seed = 42;
function rand() {
  seed = (seed * 1664525 + 1013904223) & 0xffffffff;
  return (seed >>> 0) / 0x100000000;
}
function randInt(min, max) { return Math.floor(rand() * (max - min + 1)) + min; }
function pick(arr) { return arr[Math.floor(rand() * arr.length)]; }

// ─── Name pools ────────────────────────────────────────────────────────────
const MALE_FIRST = [
  'สมชาย','ธนกร','ปิยะ','วรวุฒิ','ณัฐพล','ชัยวัฒน์','กฤษณะ','อภิชาติ',
  'สุรชัย','วิชัย','ปิติพงษ์','ณัฐวุฒิ','ภานุวัฒน์','กิตติพงศ์','เจษฎา',
  'ปราโมทย์','วุฒิชัย','ศุภกร','พงศ์พัฒน์','ธนภัทร',
];
const FEMALE_FIRST = [
  'สมหญิง','วิภาวี','ปณิตา','ณัฐธิดา','กนกวรรณ','อัญชลี','พิมพ์ใจ',
  'ชลธิชา','สุดารัตน์','วรัญญา','ภัทรวดี','ณิชนันทน์','ปาณิสรา','กัญญาณัฐ',
  'นันทิดา','อรัญญา','พรรณนิภา','สุภาวดี','ธัญญาลักษณ์','มนัสนันท์',
];
const LAST_NAMES = [
  'ใจดี','มีสุข','สุขใส','รักดี','มั่นคง','ทองคำ','แสงดาว','ศรีสุข',
  'วงศ์ทอง','บุญมา','พิมพ์ทอง','ดวงดี','ชัยชนะ','สมบูรณ์','ยิ้มแย้ม',
  'รุ่งเรือง','สว่างใจ','ศักดิ์ดี','หอมดี','ดีงาม',
];

// ─── Grade config ─────────────────────────────────────────────────────────
// grade label → { approxAge, rooms }
const GRADE_CONFIG = [
  { grade: 'อ.1', age: 3,  rooms: ['1'] },
  { grade: 'อ.2', age: 4,  rooms: ['1'] },
  { grade: 'อ.3', age: 5,  rooms: ['1'] },
  { grade: 'ป.1', age: 6,  rooms: ['1','2'] },
  { grade: 'ป.2', age: 7,  rooms: ['1','2'] },
  { grade: 'ป.3', age: 8,  rooms: ['1'] },
  { grade: 'ป.4', age: 9,  rooms: ['1'] },
  { grade: 'ป.5', age: 10, rooms: ['1'] },
  { grade: 'ป.6', age: 11, rooms: ['1'] },
];

// Grade order for historical snapshot (offset years back)
const GRADE_ORDER = ['อ.1','อ.2','อ.3','ป.1','ป.2','ป.3','ป.4','ป.5','ป.6'];
function gradeAtOffset(currentGrade, yearsBack) {
  const idx = GRADE_ORDER.indexOf(currentGrade);
  const past = Math.max(0, idx - yearsBack);
  return GRADE_ORDER[past];
}

// ─── Date helpers ──────────────────────────────────────────────────────────
// Thai BE = CE + 543
function ceToBE(ceYear) { return ceYear + 543; }
// Format D/M/YYYY (Thai BE)
function thaiDate(ceYear, month, day) {
  return `${day}/${month}/${ceToBE(ceYear)}`;
}
// Current year in CE for reference: 2569 BE = 2026 CE
const CURRENT_BE = 2569;
const CURRENT_CE = 2026;

function dobForAge(ageYears) {
  // dob so student is approxAge at academic year 2569
  const ceYear = CURRENT_CE - ageYears;
  const month = randInt(1, 12);
  const day = randInt(1, 28);
  return thaiDate(ceYear, month, day);
}

// ─── Weight/height curves ──────────────────────────────────────────────────
// Baseline weight/height for age (rough Thai average)
function baselineForAge(age) {
  // age 3–12
  const wBase = 10 + age * 2.5;   // kg
  const hBase = 80 + age * 6.5;   // cm
  return { wBase, hBase };
}

// ─── At-risk categories ────────────────────────────────────────────────────
// We'll flag ~20% of students as at-risk by adjusting their weight or height
// (deterministic: studentIndex % 5 === 0 → thin; % 7 === 0 → overweight; % 11 === 0 → short)
function atRiskType(idx) {
  if (idx % 11 === 0) return 'short';    // เตี้ย
  if (idx % 7 === 0) return 'overweight'; // เริ่มอ้วน
  if (idx % 5 === 0) return 'thin';      // ผอม
  return 'normal';
}

function measureForAge(age, atRisk, yearOffset) {
  // yearOffset = 0 means current, 1 = 1 year ago (student was 1 yr younger)
  const effectiveAge = Math.max(2, age - yearOffset);
  const { wBase, hBase } = baselineForAge(effectiveAge);
  let weight, height;
  if (atRisk === 'thin') {
    weight = wBase * 0.78 + rand() * 0.5;
    height = hBase - 2 + rand() * 2;
  } else if (atRisk === 'overweight') {
    weight = wBase * 1.35 + rand() * 1;
    height = hBase + rand() * 2;
  } else if (atRisk === 'short') {
    weight = wBase + rand() * 1;
    height = hBase * 0.88 - 2 + rand() * 2;
  } else {
    weight = wBase + rand() * 2 - 1;
    height = hBase + rand() * 3 - 1;
  }
  return {
    weightKg: parseFloat(weight.toFixed(1)),
    heightCm: parseFloat(height.toFixed(1)),
  };
}

// ─── Measurement date within a term ────────────────────────────────────────
// Term 1: June–September; Term 2: November–February (next CE year)
function measureDate(beYear, term) {
  const ceYear = beYear - 543;
  if (term === '1') {
    const month = randInt(6, 9);
    const day = randInt(1, 28);
    return thaiDate(ceYear, month, day);
  } else {
    // term 2: Nov-Dec in ceYear, Jan-Feb in ceYear+1
    const month = randInt(11, 14); // encode: 11,12 = same CE, 13,14 = Jan,Feb next CE
    if (month <= 12) {
      return thaiDate(ceYear, month, randInt(1, 28));
    } else {
      return thaiDate(ceYear + 1, month - 12, randInt(1, 28));
    }
  }
}

// ─── Build data ────────────────────────────────────────────────────────────
const setup = {
  school: 'โรงเรียนบ้านหนองสมบูรณ์',
  ministry: 'กระทรวงศึกษาธิการ',
  department: 'สพฐ.',
  subdistrict: 'หนองสมบูรณ์',
  district: 'สันทราย',
  province: 'เชียงใหม่',
  teacher: 'สมศรี ใจดี',
  maxGrade: 'ป.6',
};

const period = { year: String(CURRENT_BE), term: '1', round: '1' };

const classrooms = GRADE_CONFIG.map(({ grade, rooms }) => ({ grade, rooms }));

const students = [];
const measures = [];

let savedAtCursor = 1700000000000; // base epoch ms, strictly increasing
function nextSavedAt() {
  savedAtCursor += randInt(1000, 60000);
  return savedAtCursor;
}

let studentCounter = 1;

for (const { grade, age: gradeAge, rooms } of GRADE_CONFIG) {
  for (const room of rooms) {
    const count = randInt(10, 15);
    const riskTypes = ['thin','thin','overweight','short','normal','normal','normal','normal','normal','normal','normal','normal','normal','normal','normal'];
    // shuffle risk deterministically by studentCounter
    for (let i = 0; i < count; i++) {
      const gender = i % 2 === 0 ? 'ชาย' : 'หญิง';
      const firstName = gender === 'ชาย'
        ? MALE_FIRST[(studentCounter + i) % MALE_FIRST.length]
        : FEMALE_FIRST[(studentCounter + i) % FEMALE_FIRST.length];
      const lastName = LAST_NAMES[(studentCounter + i * 3) % LAST_NAMES.length];
      const id = String(studentCounter).padStart(5, '0');
      const dob = dobForAge(gradeAge);
      const atRisk = riskTypes[(studentCounter - 1) % riskTypes.length];

      const student = { id, firstName, lastName, dob, gender, grade, room };
      students.push(student);

      // Generate measurements: years 2567, 2568, 2569, each with term 1 and term 2
      const measureYears = [2567, 2568, 2569];
      for (const beYear of measureYears) {
        const yearOffset = CURRENT_BE - beYear; // 2, 1, 0
        const histGrade = gradeAtOffset(grade, yearOffset);

        for (const term of ['1', '2']) {
          // Skip term 2 of current year (not yet happened in academic year 2569 term 1)
          if (beYear === CURRENT_BE && term === '2') continue;

          const { weightKg, heightCm } = measureForAge(gradeAge, atRisk, yearOffset);
          const date = measureDate(beYear, term);
          measures.push({
            studentId: id,
            year: String(beYear),
            term,
            round: '1',
            date,
            weightKg,
            heightCm,
            savedAt: nextSavedAt(),
            gradeAtMeasure: histGrade,
            roomAtMeasure: room,
          });
        }
      }

      studentCounter++;
    }
  }
}

const payload = {
  version: 'ntr2-1',
  setup,
  period,
  classrooms,
  students,
  measures,
};

const outPath = join(__dir, 'sample-school.json');
writeFileSync(outPath, JSON.stringify(payload, null, 2), 'utf8');

console.log(`Written: ${outPath}`);
console.log(`  Students : ${students.length}`);
console.log(`  Measures : ${measures.length}`);
console.log(`  Classrooms: ${classrooms.length} grades, ${classrooms.reduce((a, c) => a + c.rooms.length, 0)} rooms`);

// ─── Import sample Excel files ─────────────────────────────────────────────
// Generates 3 classrooms × 2 files (roster + measure) for import-workflow testing.
// Uses a separate deterministic PRNG state (seeded separately) so the main
// dataset above is never disturbed.

function writeImportSamples() {
  // Separate LCG PRNG seeded at 99 (independent of seed=42 above)
  let s2 = 99;
  function r2() {
    s2 = (s2 * 1664525 + 1013904223) & 0xffffffff;
    return (s2 >>> 0) / 0x100000000;
  }
  function ri2(min, max) { return Math.floor(r2() * (max - min + 1)) + min; }
  function pk2(arr) { return arr[Math.floor(r2() * arr.length)]; }

  // Target classrooms for import samples
  const SAMPLE_CLASSROOMS = [
    { grade: 'ป.1', room: '1', age: 6 },
    { grade: 'ป.1', room: '2', age: 6 },
    { grade: 'ป.2', room: '1', age: 7 },
  ];

  // Student IDs for import samples start at 90001 (far from main dataset's range)
  let sampleIdCounter = 90001;

  const outDir = join(__dir, 'import-samples');
  mkdirSync(outDir, { recursive: true });

  const ROSTER_HEADERS = [
    'รหัสนักเรียน','ชื่อ','นามสกุล',
    'วันเกิด',
    'เพศ',
  ];
  const MEASURE_HEADERS = [
    'รหัสนักเรียน','น้ำหนัก(กก.)','ส่วนสูง(ซม.)','วันที่วัด',
  ];

  const FIXED_MEASURE_DATE = '15/6/2569'; // วันที่วัด fixed for all samples

  const summary = [];

  for (const { grade, room, age } of SAMPLE_CLASSROOMS) {
    const count = ri2(12, 15);
    const rosterRows = [ROSTER_HEADERS];
    const measureRows = [MEASURE_HEADERS];

    for (let i = 0; i < count; i++) {
      const gender = i % 2 === 0 ? 'ชาย' : 'หญิง';
      const firstName = gender === 'ชาย'
        ? MALE_FIRST[Math.floor(r2() * MALE_FIRST.length)]
        : FEMALE_FIRST[Math.floor(r2() * FEMALE_FIRST.length)];
      const lastName = LAST_NAMES[Math.floor(r2() * LAST_NAMES.length)];

      const id = String(sampleIdCounter++);

      // DOB: single D/M/BE string via thaiDate helper
      const dobCeYear = CURRENT_CE - age;
      const dobMonth = ri2(1, 12);
      const dobDay = ri2(1, 28);
      const dob = thaiDate(dobCeYear, dobMonth, dobDay); // D/M/BE

      rosterRows.push([id, firstName, lastName, dob, gender]);

      // Weight / height with ~20% at-risk (every 5th student is thin, every 7th overweight, every 11th short)
      const { wBase, hBase } = baselineForAge(age);
      let weight, height;
      if (i % 11 === 0) {
        // short
        weight = parseFloat((wBase + r2() * 1).toFixed(1));
        height = parseFloat((hBase * 0.88 - 2 + r2() * 2).toFixed(1));
      } else if (i % 7 === 0) {
        // overweight
        weight = parseFloat((wBase * 1.35 + r2() * 1).toFixed(1));
        height = parseFloat((hBase + r2() * 2).toFixed(1));
      } else if (i % 5 === 0) {
        // thin
        weight = parseFloat((wBase * 0.78 + r2() * 0.5).toFixed(1));
        height = parseFloat((hBase - 2 + r2() * 2).toFixed(1));
      } else {
        // normal
        weight = parseFloat((wBase + r2() * 2 - 1).toFixed(1));
        height = parseFloat((hBase + r2() * 3 - 1).toFixed(1));
      }

      measureRows.push([id, weight, height, FIXED_MEASURE_DATE]);
    }

    // Sanitize grade label for filename: replace '.' with '' and '/' with '-'
    const gradeSlug = grade.replace(/\./g, '').replace(/\//g, '-');
    const rosterFile = join(outDir, `roster-${grade}-${room}.xlsx`);
    const measureFile = join(outDir, `measure-${grade}-${room}.xlsx`);

    const rwb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(rwb, XLSX.utils.aoa_to_sheet(rosterRows), 'รายชื่อ');
    XLSX.writeFile(rwb, rosterFile);

    const mwb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(mwb, XLSX.utils.aoa_to_sheet(measureRows), 'วัดผล');
    XLSX.writeFile(mwb, measureFile);

    summary.push({ grade, room, students: count, rosterFile, measureFile });
    console.log(`  [import-samples] ${grade}/${room}: ${count} students → roster + measure xlsx`);
  }

  // Quick inline header verification (reads back first file)
  const check = summary[0];
  const wb2 = XLSX.read(readFileSync(check.rosterFile));
  const sheet = wb2.Sheets[wb2.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 });
  const actualHeaders = rows[0];
  const expectedHeaders = ROSTER_HEADERS;
  const match = JSON.stringify(actualHeaders) === JSON.stringify(expectedHeaders);
  if (!match) {
    console.error('ERROR: roster header mismatch!');
    console.error('  expected:', expectedHeaders);
    console.error('  actual  :', actualHeaders);
    process.exit(1);
  }
  console.log(`  [import-samples] Header verification OK (${check.rosterFile.split('/').pop()}, ${rows.length - 1} data rows)`);

  return summary;
}

const importSummary = writeImportSamples();
console.log(`\nImport samples written to mockdata/import-samples/ (${importSummary.length} classrooms × 2 files each)`);
