export type Dest =
  | 'home' | 'students' | 'students-poc' | 'measure' | 'reports' | 'settings'
  | 'wizard' | 'wizard-students' | 'wizard-measures' | 'wizard-export' | 'wizard-backup';

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

/** Normalize a raw `location.hash` to a routable Dest. Unknown/empty -> 'home'. */
export function parseHash(hash: string): Dest {
  let p = hash.replace(/^#/, '');
  if (p === '' || p === '/') return 'home';
  if (!p.startsWith('/')) p = '/' + p;
  p = p.replace(/\/+$/, '') || '/';
  return PATH_TO_DEST[p] ?? 'home';
}

/** Dest -> hash string for writing `location.hash`. Unroutable dests -> '#/'. */
export function destToHash(dest: Dest): string {
  return '#' + (DEST_TO_PATH[dest] ?? '/');
}
