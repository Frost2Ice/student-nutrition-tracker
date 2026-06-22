import { describe, it, expect, beforeEach, vi } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { useData } from '../../src/stores/data';

// Minimal localStorage mock for node test environment
const store: Record<string, string> = {};
const localStorageMock = {
  getItem: (key: string) => store[key] ?? null,
  setItem: (key: string, value: string) => { store[key] = value; },
  removeItem: (key: string) => { delete store[key]; },
  clear: () => { Object.keys(store).forEach((k) => delete store[k]); },
};
vi.stubGlobal('localStorage', localStorageMock);

describe('useData store', () => {
  beforeEach(() => {
    localStorage.clear();
    setActivePinia(createPinia());
  });

  it('isSetup is false by default', () => {
    const store = useData();
    expect(store.isSetup).toBe(false);
  });

  it('isSetup becomes true after saveSetup with a school name', () => {
    const store = useData();
    store.saveSetup({
      school: 'โรงเรียนทดสอบ',
      ministry: '',
      department: '',
      subdistrict: '',
      district: '',
      province: '',
      teacher: '',
      maxGrade: '',
    });
    expect(store.isSetup).toBe(true);
  });

  it('period has correct defaults and can be updated via setPeriod', () => {
    const store = useData();
    expect(store.period).toEqual({ year: '', term: '1', round: '1' });

    store.setPeriod({ year: '2567', term: '2', round: '1' });
    expect(store.period).toEqual({ year: '2567', term: '2', round: '1' });

    // persisted to localStorage
    const stored = JSON.parse(localStorage.getItem('ntr2_period') ?? '{}');
    expect(stored).toEqual({ year: '2567', term: '2', round: '1' });
  });

  it('structure, roomInfo, gradeInfo, roomStudents, searchStudents work correctly', () => {
    const data = useData();
    data.setPeriod({ year: '2568', term: '1', round: '1' });

    const s1: Parameters<typeof data.addStudent>[0] = {
      id: '1', firstName: 'คณิต', lastName: 'ดี', grade: 'ป.1', room: '1',
      gender: 'ชาย', dob: '1/1/2560',
    };
    const s2: Parameters<typeof data.addStudent>[0] = {
      id: '2', firstName: 'คณา', lastName: 'สุข', grade: 'ป.1', room: '1',
      gender: 'หญิง', dob: '1/6/2560',
    };
    data.addStudent(s1);
    data.addStudent(s2);

    data.addMeasure({
      studentId: '1', year: '2568', term: '1', round: '1',
      date: '2568-05-01', weightKg: 22, heightCm: 115,
      gradeAtMeasure: 'ป.1', roomAtMeasure: '1', savedAt: 1000000,
    });

    // structure
    expect(data.structure).toEqual([{ grade: 'ป.1', rooms: ['1'] }]);

    // roomInfo
    expect(data.roomInfo('ป.1', '1')).toEqual({ total: 2, measured: 1 });

    // gradeInfo
    expect(data.gradeInfo('ป.1')).toEqual({ total: 2, measured: 1, rooms: 1 });

    // roomStudents sorted by id
    expect(data.roomStudents('ป.1', '1').map((s) => s.id)).toEqual(['1', '2']);

    // searchStudents
    expect(data.searchStudents('').length).toBe(0);
    expect(data.searchStudents('ค')[0].id).toBe('1');
    expect(data.searchStudents('2')[0].id).toBe('2');
  });

  it('findDuplicate returns matching measurement or null', () => {
    const data = useData();
    data.addMeasure({
      studentId: '1',
      year: '2569',
      term: '1',
      round: '1',
      date: '2569-01-01',
      weightKg: 20,
      heightCm: 110,
      gradeAtMeasure: '1',
      roomAtMeasure: '1',
      savedAt: 1000000,
    });
    expect(data.findDuplicate('1', '2569', '1', '1')?.weightKg).toBe(20);
    expect(data.findDuplicate('1', '2569', '2', '1')).toBeNull();
  });

  // --- Task 11-12: backup tracking + replaceAll ---

  it('markBackup sets lastBackupAt and backupOverdueDays becomes 0', () => {
    const data = useData();
    data.markBackup();
    expect(data.backupOverdueDays).toBe(0);
  });

  it('backupOverdueDays is large when lastBackupAt is 0 (never backed up)', () => {
    const data = useData();
    // fresh store, never backed up
    expect(data.backupOverdueDays).toBeGreaterThan(1000);
  });

  it('lastBackupAt is persisted to localStorage', () => {
    const data = useData();
    data.markBackup();
    const stored = Number(localStorage.getItem('ntr2_backup_at'));
    expect(stored).toBeGreaterThan(0);
  });

  it('declared classrooms are authoritative; undeclared grades are excluded', () => {
    const d = useData();
    d.setClassrooms([{ grade: 'ป.1', rooms: ['1', '2'] }, { grade: 'ป.2', rooms: ['1'] }]);
    expect(d.structure.find((s) => s.grade === 'ป.1')?.rooms).toEqual(['1', '2']);
    expect(d.roomInfo('ป.1', '2')).toEqual({ total: 0, measured: 0 }); // declared, empty
    d.addStudent({ id: '1', firstName: 'ก', lastName: 'ข', dob: '1/1/2560', gender: 'ชาย', grade: 'ป.3', room: '1' });
    // ป.3 not declared → must NOT appear (classrooms config is the source of truth)
    expect(d.structure.some((s) => s.grade === 'ป.3')).toBe(false);
  });

  it('excludes grades configured with 0 rooms', () => {
    const d = useData();
    d.setClassrooms([{ grade: 'อ.1', rooms: [] }, { grade: 'ป.1', rooms: ['1'] }]);
    expect(d.structure.some((s) => s.grade === 'อ.1')).toBe(false);
    expect(d.structure.some((s) => s.grade === 'ป.1')).toBe(true);
  });

  it('falls back to student-derived structure when no classrooms configured', () => {
    const d = useData();
    d.addStudent({ id: '1', firstName: 'ก', lastName: 'ข', dob: '1/1/2560', gender: 'ชาย', grade: 'ป.3', room: '1' });
    expect(d.structure.some((s) => s.grade === 'ป.3')).toBe(true);
  });

  it('classroomRemovalBlockers flags grades/rooms that still hold students', () => {
    const d = useData();
    d.setClassrooms([{ grade: 'ป.1', rooms: ['1', '2'] }]);
    d.addStudent({ id: '1', firstName: 'ก', lastName: 'ข', dob: '1/1/2560', gender: 'ชาย', grade: 'ป.1', room: '2' });
    // Proposing ป.1 with 1 room would orphan the student in room 2
    const blockers = d.classroomRemovalBlockers([{ grade: 'ป.1', rooms: 1 }]);
    expect(blockers).toEqual([{ grade: 'ป.1', room: '2', count: 1 }]);
    // Keeping 2 rooms → no blockers
    expect(d.classroomRemovalBlockers([{ grade: 'ป.1', rooms: 2 }])).toEqual([]);
  });

  it('upsertMeasure overwrites the same round and adds new rounds', () => {
    const d = useData();
    const base = { studentId: '1', year: '2567', term: '1' as const, round: '1' as const, date: '1/6/2567', heightCm: 120, savedAt: 1, gradeAtMeasure: 'ป.1', roomAtMeasure: '1' };
    expect(d.upsertMeasure({ ...base, weightKg: 20 })).toBe('added');
    expect(d.upsertMeasure({ ...base, weightKg: 25 })).toBe('updated');
    expect(d.measures.filter((m) => m.studentId === '1')).toHaveLength(1);
    expect(d.measures.find((m) => m.studentId === '1')?.weightKg).toBe(25);
    expect(d.upsertMeasure({ ...base, round: '2', weightKg: 30 })).toBe('added');
    expect(d.measures.filter((m) => m.studentId === '1')).toHaveLength(2);
  });

  it('replaceAll replaces all four refs and persists', () => {
    const data = useData();
    // Add something first
    data.addStudent({ id: 'OLD', firstName: 'เก่า', lastName: 'แล้ว', dob: '1/1/2560', gender: 'ชาย', grade: 'ป.1', room: '1' });

    const newStudents = [{ id: 'NEW', firstName: 'ใหม่', lastName: 'เลย', dob: '1/1/2561', gender: 'หญิง' as const, grade: 'ป.2', room: '2' }];
    const newSetup = { school: 'โรงเรียนใหม่', ministry: '', department: '', subdistrict: '', district: '', province: '', teacher: '', maxGrade: '' };
    const newPeriod = { year: '2569', term: '2' as const, round: '1' as const };

    data.replaceAll({ students: newStudents, measures: [], setup: newSetup, period: newPeriod });

    expect(data.students).toHaveLength(1);
    expect(data.students[0].id).toBe('NEW');
    expect(data.setup.school).toBe('โรงเรียนใหม่');
    expect(data.period.year).toBe('2569');
    expect(data.measures).toHaveLength(0);
  });
});
