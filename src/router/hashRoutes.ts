export type Dest =
  | 'home' | 'students' | 'students-poc' | 'measure' | 'reports' | 'settings'
  | 'wizard' | 'wizard-students' | 'wizard-measures' | 'wizard-export' | 'wizard-backup';

// `classSlug` is a URL-safe single token for a class (e.g. `อ-2-1`); the view
// resolves it back to (grade, room) against the year's known classes. The raw
// (grade, room) never enters the route layer — it's a presentation concern here.
export type RouteParams = { classSlug?: string; studentId?: string };

const PATH_TO_DEST: Record<string, Dest> = {
  '/': 'home',
  '/students': 'students-poc',
  '/reports': 'reports',
  '/settings': 'settings',
  '/wizard': 'wizard',
  // Guided workflows are first-class pages so browser Back / refresh / deep-link
  // all behave; each is its own hash entry. Named by workflow (not by data) so the
  // URLs are self-documenting, and /data stays free for a future data-management area.
  '/wizard/import-students': 'wizard-students',
  '/wizard/import-measurements': 'wizard-measures',
  '/wizard/export-reports': 'wizard-export',
  '/wizard/backup': 'wizard-backup',
};

const DEST_TO_PATH: Partial<Record<Dest, string>> = {
  home: '/',
  'students-poc': '/students',
  reports: '/reports',
  settings: '/settings',
  wizard: '/wizard',
  'wizard-students': '/wizard/import-students',
  'wizard-measures': '/wizard/import-measurements',
  'wizard-export': '/wizard/export-reports',
  'wizard-backup': '/wizard/backup',
};

const CLASS_RE = /^\/students\/class\/([^/]+)$/;
const STUDENT_RE = /^\/students\/student\/([^/]+)$/;

/** Normalize a raw location.hash to a routable dest + params. */
export function parseRoute(hash: string): { dest: Dest; params: RouteParams } {
  let p = hash.replace(/^#/, '');
  if (p === '' || p === '/') return { dest: 'home', params: {} };
  if (!p.startsWith('/')) p = '/' + p;
  p = p.replace(/\/+$/, '') || '/';

  const cls = CLASS_RE.exec(p);
  if (cls) return { dest: 'students-poc', params: { classSlug: decodeURIComponent(cls[1]) } };
  const stu = STUDENT_RE.exec(p);
  if (stu) return { dest: 'students-poc', params: { studentId: decodeURIComponent(stu[1]) } };

  return { dest: PATH_TO_DEST[p] ?? 'home', params: {} };
}

/** Back-compat: dest only. */
export function parseHash(hash: string): Dest {
  return parseRoute(hash).dest;
}

/** Dest (+ optional params) -> hash string. Unroutable dests -> '#/'. */
export function destToHash(dest: Dest, params?: RouteParams): string {
  if (dest === 'students-poc' && params) {
    if (params.studentId) return '#/students/student/' + encodeURIComponent(params.studentId);
    if (params.classSlug) return '#/students/class/' + encodeURIComponent(params.classSlug);
  }
  return '#' + (DEST_TO_PATH[dest] ?? '/');
}
