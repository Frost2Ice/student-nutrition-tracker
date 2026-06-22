# mockdata

ไฟล์ข้อมูลจำลองสำหรับทดสอบแอปพลิเคชัน Student Nutrition Tracker

## ไฟล์หลัก

| ไฟล์ | คำอธิบาย |
|------|-----------|
| `generate.mjs` | ตัวสร้างข้อมูลจำลองแบบ deterministic (PRNG seed 42 สำหรับชุดหลัก, seed 99 สำหรับ import-samples) |
| `sample-school.json` | ข้อมูลสำรองครบทั้งโรงเรียน (format `ntr2-1`) สร้างโดย generate.mjs |

## import-samples/

ไฟล์ Excel สำเร็จรูปสำหรับทดสอบการนำเข้าข้อมูลจากการติดตั้งใหม่ (clean install)

### ห้องเรียนที่รวมอยู่

| ห้อง | จำนวนนักเรียน | ไฟล์รายชื่อ | ไฟล์การวัด |
|------|--------------|------------|------------|
| ป.1/1 | 13 | `roster-ป.1-1.xlsx` | `measure-ป.1-1.xlsx` |
| ป.1/2 | 15 | `roster-ป.1-2.xlsx` | `measure-ป.1-2.xlsx` |
| ป.2/1 | 12 | `roster-ป.2-1.xlsx` | `measure-ป.2-1.xlsx` |

### โครงสร้างคอลัมน์

**ไฟล์รายชื่อ (roster):**
`รหัสนักเรียน | ชื่อ | นามสกุล | วันเกิด-วัน | วันเกิด-เดือน | วันเกิด-ปี(พ.ศ.) | เพศ`

- วันเกิดแยกเป็น 3 คอลัมน์ตัวเลข (วัน, เดือน, ปี พ.ศ.)
- เพศ: `ชาย` หรือ `หญิง`
- รหัสนักเรียนเริ่มต้นที่ 90001 (ไม่ซ้ำกับชุดข้อมูลหลัก)

**ไฟล์การวัด (measure):**
`รหัสนักเรียน | น้ำหนัก(กก.) | ส่วนสูง(ซม.) | วันที่วัด`

- วันที่วัด: `15/6/2569` (รูปแบบ D/M/YYYY พ.ศ.)
- ประมาณ 20% ของนักเรียนอยู่ในกลุ่มเสี่ยง (ผอม/เริ่มอ้วน/เตี้ย) เพื่อทดสอบการจำแนกประเภท

### ขั้นตอนทดสอบจาก clean install

1. เปิดแอปใหม่ (ไม่มีข้อมูลใดๆ)
2. ตั้งค่าโรงเรียนและระยะเวลาการวัด (ปีการศึกษา 2569 ภาคเรียนที่ 1)
3. ไปที่หน้านำเข้าข้อมูลของห้อง **ป.1/1**
4. นำเข้าไฟล์รายชื่อก่อน: `roster-ป.1-1.xlsx`
5. ตรวจสอบว่านักเรียนปรากฏในระบบครบ 13 คน
6. นำเข้าไฟล์การวัด: `measure-ป.1-1.xlsx`
7. ตรวจสอบว่าการวัดตรงกับนักเรียนทุกคน (ไม่มี ID ที่ไม่พบในระบบ)
8. ทำซ้ำสำหรับ ป.1/2 และ ป.2/1

**สำคัญ:** ต้องนำเข้า roster ก่อนเสมอ เพราะ measure ใช้ `รหัสนักเรียน` เพื่อค้นหาข้อมูลนักเรียนที่มีอยู่ในระบบ

---

## English summary

Run `node mockdata/generate.mjs` to regenerate all files. The generator is fully deterministic (no random drift between runs).

The `import-samples/` directory contains ready-to-import Excel files for three classrooms (ป.1/1, ป.1/2, ป.2/1). Each classroom has:
- A **roster** file with student IDs, names, split DOB columns (day/month/BE-year), and gender
- A **measurement** file with matching student IDs, weight (kg), height (cm), and a fixed BE date `15/6/2569`

~20% of students fall in at-risk ranges (thin/overweight/short) to exercise the classification engine. Import roster first, then measurements — the app requires students to exist before measurements can be matched.
