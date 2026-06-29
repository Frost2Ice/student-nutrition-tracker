/**
 * URL-safe slug for a class. The class is identified in the domain by the
 * `(grade, room)` composite, but `grade` contains a `.` (e.g. `อ.2`) and the
 * raw `grade/room` form contains a reserved `/`. For the route we collapse both
 * into a single clean token by replacing `.`, `/`, and whitespace with `-`:
 *
 *   classSlug('อ.2', '1') === 'อ-2-1'
 *   classSlug('ป.1', '2') === 'ป-1-2'
 *
 * This is intentionally minimal — just enough for the current class naming
 * scheme. It is NOT reversible on its own; the slug is resolved back to
 * `(grade, room)` by matching against the year's known classes
 * (see `findClassBySlug` in the data store).
 */
export function classSlug(grade: string, room: string): string {
  const seg = (s: string) => s.trim().replace(/[./\s]+/g, '-');
  return seg(grade) + '-' + seg(room);
}
