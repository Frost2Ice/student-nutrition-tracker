// Display-only label shortening. Engine values are unchanged; we only strip the
// prefix that duplicates the table column header (น้ำหนัก/อายุ, ส่วนสูง/อายุ).

const WFA_SHORT: Record<string, string> = {
  น้ำหนักน้อย: 'น้อย',
  น้ำหนักค่อนข้างน้อย: 'ค่อนข้างน้อย',
  น้ำหนักตามเกณฑ์: 'ตามเกณฑ์',
  น้ำหนักค่อนข้างมาก: 'ค่อนข้างมาก',
  น้ำหนักมาก: 'มาก',
};

const HFA_SHORT: Record<string, string> = {
  สูงตามเกณฑ์: 'ตามเกณฑ์',
};

export function shortWfa(label: string): string {
  return WFA_SHORT[label] ?? label;
}

export function shortHfa(label: string): string {
  return HFA_SHORT[label] ?? label;
}
