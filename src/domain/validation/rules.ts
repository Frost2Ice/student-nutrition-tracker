export const WEIGHT_MIN = 5, WEIGHT_MAX = 150;
export const HEIGHT_MIN = 40, HEIGHT_MAX = 210;

export function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

export function validateWeight(kg: number): string | null {
  if (isNaN(kg)) return 'กรุณากรอกน้ำหนักเป็นตัวเลข';
  if (kg < WEIGHT_MIN || kg > WEIGHT_MAX)
    return `น้ำหนักต้องอยู่ระหว่าง ${WEIGHT_MIN}–${WEIGHT_MAX} กก.`;
  return null;
}

export function validateHeight(cm: number): string | null {
  if (isNaN(cm)) return 'กรุณากรอกส่วนสูงเป็นตัวเลข';
  if (cm < HEIGHT_MIN || cm > HEIGHT_MAX)
    return `ส่วนสูงต้องอยู่ระหว่าง ${HEIGHT_MIN}–${HEIGHT_MAX} ซม.`;
  return null;
}

export function validateThaiDate(str: string, isDob: boolean, periodYear?: number): string | null {
  if (!str) return 'กรุณากรอกวันที่';
  const p = str.split('/');
  if (p.length !== 3) return 'รูปแบบ: วัน/เดือน/ปีพ.ศ. เช่น 15/05/2556';
  const d = +p[0], m = +p[1], y = +p[2];
  if (isNaN(d) || isNaN(m) || isNaN(y)) return 'กรุณากรอกตัวเลขให้ครบถ้วน';
  if (p[2].length !== 4 || y < 2400) return 'ปีพ.ศ. ต้องเป็น 4 หลัก เช่น 2556';
  if (isDob && typeof periodYear === 'number' && !isNaN(periodYear)) {
    const min = periodYear - 19;
    const max = periodYear - 2;
    if (y < min || y > max)
      return `ปีเกิดควรอยู่ระหว่าง พ.ศ. ${min}–${max} (อายุ 2–18 ปี)`;
  }
  if (m < 1 || m > 12) return 'เดือนต้องอยู่ระหว่าง 1–12';
  if (d < 1 || d > 31) return 'วันต้องอยู่ระหว่าง 1–31';
  const daysInMonth = new Date(y - 543, m, 0).getDate();
  if (d > daysInMonth) return `เดือน ${m} มีแค่ ${daysInMonth} วัน`;
  return null;
}
