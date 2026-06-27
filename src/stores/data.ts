import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import type { Student, Measurement, Setup, Term, Round } from '../domain/types';
import { calcNutrition } from '../domain/nutrition/engine';
import { latestPerStudent } from '../domain/nutrition/latest';
import { GRADE_ORDER } from '../domain/grade/ladder';

const KS = 'ntr2_students';
const KM = 'ntr2_measures';
const KST = 'ntr2_setup';
const KP = 'ntr2_period';
const KB = 'ntr2_backup_at';
const KC = 'ntr2_classrooms';

function load<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

export const useData = defineStore('data', () => {
  const classrooms = ref<{ grade: string; rooms: string[] }[]>(
    load<{ grade: string; rooms: string[] }[]>(KC, []),
  );
  const students = ref<Student[]>(load<Student[]>(KS, []));
  const measures = ref<Measurement[]>(load<Measurement[]>(KM, []));
  const period = ref<{ year: string }>(
    (() => {
      const raw = load<{ year: string; term?: string; round?: string }>(KP, { year: '' });
      return { year: raw.year ?? '' };
    })(),
  );
  const measureSession = ref<{ term: Term; round: Round } | null>(null);

  const lastBackupAt = ref<number>(load<number>(KB, 0));

  const backupOverdueDays = computed(() => {
    if (lastBackupAt.value === 0) return 999999;
    return Math.floor((Date.now() - lastBackupAt.value) / 86400000);
  });

  function markBackup() {
    lastBackupAt.value = Date.now();
    localStorage.setItem(KB, String(lastBackupAt.value));
  }

  function replaceAll(parsed: {
    students: Student[];
    measures: Measurement[];
    setup: Setup;
    period: { year: string };
    classrooms?: { grade: string; rooms: string[] }[];
  }) {
    students.value = parsed.students;
    measures.value = parsed.measures;
    setup.value = parsed.setup;
    period.value = parsed.period;
    classrooms.value = parsed.classrooms ?? [];
    persist();
  }

  const setup = ref<Setup>(
    load<Setup>(KST, {
      school: '',
      ministry: '',
      department: '',
      subdistrict: '',
      district: '',
      province: '',
      teacher: '',
      maxGrade: '',
    }),
  );

  function persist() {
    localStorage.setItem(KS, JSON.stringify(students.value));
    localStorage.setItem(KM, JSON.stringify(measures.value));
    localStorage.setItem(KST, JSON.stringify(setup.value));
    localStorage.setItem(KP, JSON.stringify(period.value));
    localStorage.setItem(KC, JSON.stringify(classrooms.value));
  }

  function setClassrooms(list: { grade: string; rooms: string[] }[]) {
    classrooms.value = list;
    persist();
  }

  /**
   * Given a proposed structure (grade → room count), return the grade/rooms
   * that still hold students but would be dropped by the change. Used to block
   * removal and warn the teacher instead of silently orphaning students.
   * `next` rooms count N means allowed rooms are '1'..'N'.
   */
  function classroomRemovalBlockers(
    next: { grade: string; rooms: number }[],
  ): { grade: string; room: string; count: number }[] {
    const allowed = new Map(next.map((g) => [g.grade, g.rooms]));
    const orphan = new Map<string, number>(); // "grade/room" → count
    for (const s of students.value) {
      const max = allowed.get(s.grade) ?? 0;
      const roomNum = Number(s.room);
      const kept = Number.isFinite(roomNum) && roomNum >= 1 && roomNum <= max;
      if (!kept) {
        const key = `${s.grade}/${s.room}`;
        orphan.set(key, (orphan.get(key) ?? 0) + 1);
      }
    }
    return [...orphan.entries()].map(([key, count]) => {
      const [grade, room] = key.split('/');
      return { grade, room, count };
    });
  }

  function setPeriod(p: { year: string }) {
    period.value = p;
    persist();
  }

  const isSetup = computed(() => setup.value.school.trim() !== '');

  function findStudent(id: string) {
    return students.value.find((s) => s.id === id) ?? null;
  }

  function addStudent(s: Student) {
    students.value.push(s);
    persist();
  }

  function updateStudent(id: string, patch: Partial<Student>) {
    const s = findStudent(id);
    if (s) {
      Object.assign(s, patch);
      persist();
    }
  }

  function deleteStudent(id: string) {
    students.value = students.value.filter((s) => s.id !== id);
    measures.value = measures.value.filter((m) => m.studentId !== id);
    persist();
  }

  function addMeasure(m: Measurement) {
    measures.value.push(m);
    persist();
  }

  /**
   * One record per student per (year, term, round). If a matching record
   * exists it is overwritten; otherwise the measurement is appended.
   * Returns 'added' or 'updated' so callers can report accurately.
   */
  function upsertMeasure(m: Measurement): 'added' | 'updated' {
    const idx = measures.value.findIndex(
      (x) =>
        x.studentId === m.studentId &&
        x.year === m.year &&
        x.term === m.term &&
        x.round === m.round,
    );
    if (idx >= 0) {
      measures.value.splice(idx, 1, m);
      persist();
      return 'updated';
    }
    measures.value.push(m);
    persist();
    return 'added';
  }

  function deleteMeasure(m: Measurement) {
    measures.value = measures.value.filter((x) => x !== m);
    persist();
  }

  function measuresFor(id: string) {
    return measures.value.filter((m) => m.studentId === id);
  }

  function findDuplicate(studentId: string, year: string, term: Term, round: Round): Measurement | null {
    return measures.value.find(
      (m) => m.studentId === studentId && m.year === year && m.term === term && m.round === round,
    ) ?? null;
  }

  function saveSetup(next: Setup) {
    setup.value = next;
    persist();
  }

  // dashboard aggregates from each student's latest measurement
  const latest = computed(() => latestPerStudent(measures.value));

  const AT_RISK = new Set([
    'ผอม',
    'เริ่มอ้วน',
    'อ้วน',
    'น้ำหนักน้อย',
    'น้ำหนักมาก',
    'เตี้ย',
  ]);

  const stats = computed(() => {
    let normal = 0;
    let followUp = 0;
    const atRiskList: { student: Student; flags: string[] }[] = [];
    for (const [id, m] of latest.value) {
      const s = findStudent(id);
      if (!s) continue;
      const r = calcNutrition(s, m);
      if (!r) continue;
      const flags = [r.wfh, r.wfa, r.hfa].filter((l) => AT_RISK.has(l));
      if (flags.length) {
        followUp++;
        atRiskList.push({ student: s, flags });
      } else {
        normal++;
      }
    }
    return {
      totalStudents: students.value.length,
      totalMeasures: measures.value.length,
      normal,
      followUp,
      atRiskList,
    };
  });

  const structure = computed(() => {
    const gradeRooms = new Map<string, Set<string>>();
    if (classrooms.value.length > 0) {
      // Declared classrooms are authoritative: a grade with 0 rooms does not
      // exist and is excluded everywhere. Student-derived grades are NOT
      // unioned in — removing a room hides nothing because removal is blocked
      // while students still live there (classroomRemovalBlockers).
      for (const { grade, rooms } of classrooms.value) {
        if (rooms.length === 0) continue;
        gradeRooms.set(grade, new Set(rooms));
      }
    } else {
      // Legacy fallback: no structure configured (e.g. backup without
      // classrooms) — derive grades/rooms from students so the app still works.
      for (const s of students.value) {
        if (!gradeRooms.has(s.grade)) gradeRooms.set(s.grade, new Set());
        gradeRooms.get(s.grade)!.add(s.room);
      }
    }
    const grades = [...gradeRooms.keys()];
    grades.sort((a, b) => {
      const ai = GRADE_ORDER.indexOf(a);
      const bi = GRADE_ORDER.indexOf(b);
      const an = ai === -1 ? Infinity : ai;
      const bn = bi === -1 ? Infinity : bi;
      return an - bn;
    });
    return grades.map((grade) => ({
      grade,
      rooms: [...gradeRooms.get(grade)!].sort((a, b) => Number(a) - Number(b)),
    }));
  });

  function roomInfo(grade: string, room: string): { total: number; measured: number } {
    const inRoom = students.value.filter((s) => s.grade === grade && s.room === room);
    const measured = inRoom.filter((s) => latest.value.has(s.id)).length;
    return { total: inRoom.length, measured };
  }

  function gradeInfo(grade: string): { total: number; measured: number; rooms: number } {
    const entry = structure.value.find((e) => e.grade === grade);
    const rooms = entry ? entry.rooms : [];
    let total = 0;
    let measured = 0;
    for (const room of rooms) {
      const ri = roomInfo(grade, room);
      total += ri.total;
      measured += ri.measured;
    }
    return { total, measured, rooms: rooms.length };
  }

  function roomStudents(grade: string, room: string): Student[] {
    return students.value
      .filter((s) => s.grade === grade && s.room === room)
      .sort((a, b) => a.id.localeCompare(b.id));
  }

  function searchStudents(q: string): Student[] {
    const trimmed = q.trim();
    if (!trimmed) return [];
    return students.value
      .filter((s) => s.id.includes(trimmed) || `${s.firstName} ${s.lastName}`.includes(trimmed))
      .slice(0, 30);
  }

  return {
    classrooms,
    setClassrooms,
    classroomRemovalBlockers,
    students,
    measures,
    setup,
    period,
    measureSession,
    lastBackupAt,
    backupOverdueDays,
    markBackup,
    replaceAll,
    setPeriod,
    isSetup,
    findStudent,
    addStudent,
    updateStudent,
    deleteStudent,
    addMeasure,
    upsertMeasure,
    deleteMeasure,
    measuresFor,
    findDuplicate,
    saveSetup,
    latest,
    stats,
    structure,
    roomInfo,
    gradeInfo,
    roomStudents,
    searchStudents,
  };
});
