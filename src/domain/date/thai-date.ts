// ---------------------------------------------------------------------------
// Thai month name maps
// ---------------------------------------------------------------------------
const THAI_MONTH_FULL: Record<string, number> = {
  มกราคม: 1, กุมภาพันธ์: 2, มีนาคม: 3, เมษายน: 4, พฤษภาคม: 5, มิถุนายน: 6,
  กรกฎาคม: 7, สิงหาคม: 8, กันยายน: 9, ตุลาคม: 10, พฤศจิกายน: 11, ธันวาคม: 12,
};
const THAI_MONTH_ABBR: Record<string, number> = {
  'ม.ค.': 1, 'ก.พ.': 2, 'มี.ค.': 3, 'เม.ย.': 4, 'พ.ค.': 5, 'มิ.ย.': 6,
  'ก.ค.': 7, 'ส.ค.': 8, 'ก.ย.': 9, 'ต.ค.': 10, 'พ.ย.': 11, 'ธ.ค.': 12,
};

// Resolve year: 4-digit ≥2400 = BE; 4-digit 1900–2200 = CE → +543; 2-digit = BE short (65 → 2565)
function resolveYearToBE(y: number): { year: number; wasConverted: boolean } {
  if (y >= 2400) return { year: y, wasConverted: false };
  if (y >= 100 && y <= 2200) return { year: y + 543, wasConverted: true };
  if (y >= 0 && y < 100) return { year: 2500 + y, wasConverted: true }; // 2-digit → BE short (65 → 2565)
  return { year: y, wasConverted: false };
}

// Thai digit → Arabic digit
function normalizeDigits(s: string): string {
  return s.replace(/[๐-๙]/g, (ch) => String('๐๑๒๓๔๕๖๗๘๙'.indexOf(ch)));
}

function buildAndValidate(
  d: number, m: number, rawY: number, inputWasSlashSep: boolean,
): { value: string; converted: boolean } | null {
  if (m < 1 || m > 12) return null;
  if (d < 1 || d > 31) return null;
  const { year, wasConverted } = resolveYearToBE(rawY);
  // Sanity-check real calendar day
  const ceY = year > 2500 ? year - 543 : year;
  const daysInMonth = new Date(ceY, m, 0).getDate();
  if (d > daysInMonth) return null;
  // converted:false only when BE and slash-separated
  const converted = wasConverted || !inputWasSlashSep;
  return { value: `${d}/${m}/${year}`, converted };
}

/**
 * Normalize any common date representation to canonical D/M/YYYY BE string.
 * Returns { value, converted } or null if uninterpretable.
 */
export function normalizeThaiDate(
  input: string | number | Date,
): { value: string; converted: boolean } | null {
  // JS Date object
  if (input instanceof Date) {
    return { value: formatThaiDate(input), converted: true };
  }

  // Excel serial (number)
  if (typeof input === 'number') {
    // Excel epoch: 1899-12-30
    const ms = (input - 25569) * 86400 * 1000; // 25569 = days from 1899-12-30 to 1970-01-01
    const d = new Date(ms);
    return { value: formatThaiDate(d), converted: true };
  }

  // String handling — normalize Thai digits and collapse whitespace first
  const s = normalizeDigits(input).trim().replace(/\s+/g, ' ');
  if (!s) return null;

  // Try Thai month names (full and abbreviated): pattern "D <month> YYYY"
  for (const [name, monthNum] of [
    ...Object.entries(THAI_MONTH_FULL),
    ...Object.entries(THAI_MONTH_ABBR),
  ]) {
    if (s.includes(name)) {
      const withoutMonth = s.replace(name, ' ').trim();
      const parts = withoutMonth.split(/\s+/).filter(Boolean);
      if (parts.length === 2) {
        const day = parseInt(parts[0], 10);
        const year = parseInt(parts[1], 10);
        if (!isNaN(day) && !isNaN(year)) {
          return buildAndValidate(day, monthNum, year, false);
        }
      }
      return null;
    }
  }

  // 3-part numeric: split on / . - or space
  const parts = s.split(/[\/.\-\s]+/);
  if (parts.length === 3) {
    const n0 = parseInt(parts[0], 10);
    const n1 = parseInt(parts[1], 10);
    const n2 = parseInt(parts[2], 10);
    if (isNaN(n0) || isNaN(n1) || isNaN(n2)) return null;

    // ISO: first part is 4 digits → YYYY-MM-DD reorder
    if (parts[0].length === 4) {
      // n0=YYYY, n1=MM, n2=DD
      const isSlash = s.includes('/') && !s.includes('.') && !s.includes('-');
      return buildAndValidate(n2, n1, n0, isSlash);
    }

    // Otherwise treat as D/M/Y (Thai order)
    const isSlash = s.includes('/') && !s.includes('.') && !s.includes('-') && !s.includes(' ');
    return buildAndValidate(n0, n1, n2, isSlash);
  }

  return null;
}

export function parseThaiDate(str: string): Date | null {
  if (!str) return null;
  const p = str.split('/');
  if (p.length !== 3) return null;
  const d = +p[0], m = +p[1], y = +p[2];
  if (isNaN(d) || isNaN(m) || isNaN(y)) return null;
  const ce = y > 2500 ? y - 543 : y;
  return new Date(ce, m - 1, d);
}

export function formatThaiDate(d: Date): string {
  return `${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear() + 543}`;
}

export function getAgeMonths(dob: string, measureDate: string): number | null {
  const b = parseThaiDate(dob), m = parseThaiDate(measureDate);
  if (!b || !m) return null;
  let months = (m.getFullYear() - b.getFullYear()) * 12 + (m.getMonth() - b.getMonth());
  if (m.getDate() < b.getDate()) months--;
  return months < 0 ? null : months;
}

export function todayThai(): string {
  return formatThaiDate(new Date());
}
