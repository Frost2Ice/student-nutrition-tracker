import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import type { SchoolIdentity, YearSnapshot, YearMeta, SchoolFile, Measurement } from '../domain/types';
import { migrateV1, type V1State } from '../domain/school/migrate';
import {
  serializeYearBundle, parseYearBundle, serializeSchool, parseSchool,
} from '../domain/transfer/backup';

const MAN = 'ntr2_v2_manifest';
const IDK = 'ntr2_v2_identity';
const yearKey = (y: string) => `ntr2_v2_year_${y}`;

// legacy v1 keys (migration source — left intact)
const L = {
  S: 'ntr2_students', M: 'ntr2_measures', ST: 'ntr2_setup',
  P: 'ntr2_period', C: 'ntr2_classrooms',
};

const EMPTY_IDENTITY: SchoolIdentity = {
  school: '', ministry: '', department: '', subdistrict: '', district: '', province: '',
};

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

export const useSchool = defineStore('school', () => {
  const identity = ref<SchoolIdentity>({ ...EMPTY_IDENTITY });
  const years = ref<YearMeta[]>([]);

  const activeYear = computed<string | null>(
    () => years.value.find((m) => m.status === 'active')?.year ?? null,
  );
  const archivedYears = computed(() => years.value.filter((m) => m.status === 'archived'));
  const hasSchool = computed(
    () => years.value.length > 0 || identity.value.school.trim() !== '',
  );

  function persistIdentity() { localStorage.setItem(IDK, JSON.stringify(identity.value)); }
  function persistManifest() {
    localStorage.setItem(MAN, JSON.stringify({ schemaVersion: 2, years: years.value }));
  }
  function persistAll() { persistIdentity(); persistManifest(); }

  function loadYear(year: string): YearSnapshot | null {
    return read<YearSnapshot | null>(yearKey(year), null);
  }
  function saveYear(y: YearSnapshot) { localStorage.setItem(yearKey(y.year), JSON.stringify(y)); }

  /** Read-only: the manifest metas (does not mutate or change active year). */
  function listYears(): YearMeta[] { return years.value; }

  /** Read-only alias for loadYear. */
  function snapshotForYear(year: string): YearSnapshot | null { return loadYear(year); }

  /** Read-only: every measure for a student across ALL years, sorted ascending by savedAt. */
  function measuresForStudent(studentId: string): Measurement[] {
    const out: Measurement[] = [];
    for (const m of years.value) {
      const snap = loadYear(m.year);
      if (!snap) continue;
      for (const ms of snap.measures) if (ms.studentId === studentId) out.push(ms);
    }
    return out.sort((x, y) => x.savedAt - y.savedAt);
  }

  /** Append a year and make it the sole active one (archives any prior active). */
  function createYear(snap: YearSnapshot) {
    saveYear(snap);
    const others = years.value
      .filter((m) => m.year !== snap.year)
      .map((m) => ({ ...m, status: 'archived' as const }));
    years.value = [...others, { year: snap.year, status: 'active', createdAt: snap.createdAt }];
    persistAll();
  }

  function setIdentity(next: SchoolIdentity) { identity.value = next; persistIdentity(); }

  /** Rename a year (changes its storage key + manifest meta; status/createdAt kept). */
  function renameYear(oldYear: string, newYear: string) {
    if (oldYear === newYear) return;
    const snap = loadYear(oldYear);
    if (snap) { saveYear({ ...snap, year: newYear }); }
    localStorage.removeItem(yearKey(oldYear));
    years.value = years.value.map((m) => (m.year === oldYear ? { ...m, year: newYear } : m));
    persistManifest();
  }

  function setActive(year: string) {
    years.value = years.value.map((m) => ({
      ...m, status: m.year === year ? 'active' : 'archived',
    }));
    persistManifest();
  }

  function archiveYear(year: string) {
    years.value = years.value.map((m) => (m.year === year ? { ...m, status: 'archived' } : m));
    persistManifest();
  }

  function deleteYear(year: string) {
    localStorage.removeItem(yearKey(year));
    years.value = years.value.filter((m) => m.year !== year);
    persistManifest();
  }

  /** Replace the whole school (disaster-recovery restore). Newest year becomes active. */
  function writeFile(file: SchoolFile) {
    for (const m of years.value) localStorage.removeItem(yearKey(m.year));
    identity.value = file.identity;
    for (const y of file.years) saveYear(y);
    const lastIdx = file.years.length - 1;
    years.value = file.years.map((y, i) => ({
      year: y.year, status: i === lastIdx ? 'active' : 'archived', createdAt: y.createdAt,
    }));
    persistAll();
  }

  function exportYear(year: string): string {
    const y = loadYear(year);
    if (!y) throw new Error(`ไม่พบปีการศึกษา ${year}`);
    return serializeYearBundle(identity.value, y);
  }

  function exportSchool(): string {
    const file: SchoolFile = {
      schemaVersion: 2,
      identity: identity.value,
      years: years.value.map((m) => loadYear(m.year)!).filter(Boolean),
    };
    return serializeSchool(file);
  }

  /** Merge a single year. Keep destination identity unless the school is empty. */
  function importYearBundle(text: string): { merged: string; replaced: boolean } {
    const { identity: incoming, year } = parseYearBundle(text);
    if (!hasSchool.value) identity.value = incoming;
    const exists = years.value.some((m) => m.year === year.year);
    saveYear(year);
    if (!exists) {
      const status = activeYear.value ? 'archived' : 'active';
      years.value = [...years.value, { year: year.year, status, createdAt: year.createdAt }];
    }
    persistAll();
    return { merged: year.year, replaced: exists };
  }

  /** Replace everything from a full-school backup. */
  function importSchool(text: string) { writeFile(parseSchool(text)); }

  /** One-time legacy v1 → v2 migration. Idempotent (guarded by manifest presence). */
  function ensureMigrated() {
    if (localStorage.getItem(MAN)) return;
    const hasLegacy = localStorage.getItem(L.S) || localStorage.getItem(L.ST) || localStorage.getItem(L.P);
    if (!hasLegacy) return;
    const v1: V1State = {
      students: read(L.S, []),
      measures: read(L.M, []),
      setup: read(L.ST, { ...EMPTY_IDENTITY, teacher: '', maxGrade: '' }),
      period: read(L.P, { year: '' }),
      classrooms: read(L.C, []),
    };
    writeFile(migrateV1(v1));
  }

  // boot: migrate if needed, then hydrate from storage
  ensureMigrated();
  identity.value = read<SchoolIdentity>(IDK, { ...EMPTY_IDENTITY });
  years.value = read<{ years: YearMeta[] }>(MAN, { years: [] }).years ?? [];

  return {
    identity, years, activeYear, archivedYears, hasSchool,
    loadYear, saveYear, createYear, setActive, archiveYear, deleteYear,
    listYears, snapshotForYear, measuresForStudent,
    setIdentity, renameYear,
    exportYear, exportSchool, importYearBundle, importSchool, ensureMigrated,
  };
});
