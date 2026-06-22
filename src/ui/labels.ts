// Maps a Thai nutrition label to a badge severity class (good / warn / bad / neutral).
const MAP: Record<string, string> = {
  // weight-for-age
  'น้ำหนักน้อย': 'bad',
  'น้ำหนักค่อนข้างน้อย': 'warn',
  'น้ำหนักตามเกณฑ์': 'good',
  'น้ำหนักค่อนข้างมาก': 'warn',
  'น้ำหนักมาก': 'bad',
  // height-for-age
  'เตี้ย': 'bad',
  'ค่อนข้างเตี้ย': 'warn',
  'สูงตามเกณฑ์': 'good',
  'ค่อนข้างสูง': 'good',
  'สูง': 'good',
  // weight-for-height
  'ผอม': 'bad',
  'ค่อนข้างผอม': 'warn',
  'สมส่วน': 'good',
  'ท้วม': 'warn',
  'เริ่มอ้วน': 'warn',
  'อ้วน': 'bad',
  // tall & proportionate
  'ใช่': 'good',
  'ไม่ใช่': 'neutral',
};

export function badgeClass(label: string): string {
  return MAP[label] ?? 'neutral';
}
