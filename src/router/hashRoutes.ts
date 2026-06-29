export type Dest =
  | 'home' | 'students' | 'students-poc' | 'measure' | 'reports' | 'settings' | 'wizard';

const PATH_TO_DEST: Record<string, Dest> = {
  '/': 'home',
  '/students': 'students-poc',
  '/reports': 'reports',
  '/settings': 'settings',
  '/data': 'wizard',
};

const DEST_TO_PATH: Partial<Record<Dest, string>> = {
  home: '/',
  'students-poc': '/students',
  reports: '/reports',
  settings: '/settings',
  wizard: '/data',
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
