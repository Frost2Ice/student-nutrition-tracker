# Student Registry Foundation & Promotion Wizard — Design

**Date:** 2026-06-20
**Status:** Approved direction (pre-implementation)
**Supersedes:** the registry/promotion portions of
`2026-06-19-nutrition-tracker-rewrite-design.md` (data model + lifecycle) and its
§6.3 current-state limitation.
**Register:** product (design serves the task). UX is the highest priority.

> This app is a **student nutrition tracking system**, not a student information
> system. Student data exists only to attach measurements and group reports.
> Litmus for every feature: *"Does this help a school health teacher measure and
> track students more effectively?"* If no, it is out of scope.

---

## 1. UX North Star

Target users: non-technical, often older Thai school health teachers, no IT
support. The interface must **hold their hand**. Every screen answers, in plain
friendly Thai:

1. **ฉันกำลังทำอะไร?** — a clear title + one-line purpose.
2. **ทำไมต้องทำ?** — short helper text when the reason isn't obvious.
3. **จะเกิดอะไรขึ้นต่อไป?** — preview the result before the user commits.
4. **กดต่อได้อย่างปลอดภัยไหม?** — confirmations that state stakes and recovery.

Principles: prevent mistakes but **never trap**; destructive-sounding actions must
prove **data is moved, not lost**; fewer features done excellently over many that
confuse. Large type, high contrast, generous spacing, big tap targets.

---

## 2. Data Model (minimal, final)

```ts
// Student — CURRENT STATE ONLY. No status timeline, no history.
interface Student {
  id: string;          // รหัสนักเรียน, unique in the active registry
  firstName: string;
  lastName: string;
  dob: string;         // Thai BE D/M/YYYY
  gender: 'ชาย' | 'หญิง';
  grade: string;       // current ชั้น
  room: string;        // current ห้อง
}

// Measurement — HISTORICAL, IMMUTABLE, self-describing.
interface Measurement {
  studentId: string;
  year: string;        // ปีการศึกษา (BE) at time of measurement
  term: '1' | '2';
  round: '1' | '2';
  grade: string;       // SNAPSHOT of ชั้น at record time
  room: string;        // SNAPSHOT of ห้อง at record time
  date: string;        // Thai BE D/M/YYYY
  weightKg: number;    // 1 decimal
  heightCm: number;    // 1 decimal
  savedAt: number;     // epoch ms tie-breaker
}
```

**Why this shape:** snapshotting grade/room/year onto each measurement gives full
historical correctness *without* a student-history subsystem. The student stays a
flat current-state row; promotion, room moves, and repeats never rewrite past
measurements. Reports/charts read context **from the measurement**, never derive
it from the current master.

**Active registry = only students who still need measuring.** Graduated /
transferred students are exported out and removed (§5, §6). Their measurements
leave with them inside the archive file (which is self-describing thanks to
snapshots).

**App state:** a single global **current working period** `{ year, term, round }`
plus `setup.lastPromotedYear` (advisory only, see §5). Persisted in localStorage.

---

## 3. Academic Period (always visible, always editable)

A persistent chip shows the working period everywhere:
> 📅 ปีการศึกษา 2569 · ภาคเรียน 1 · ครั้งที่ 1

- Set via **"เปลี่ยนปีการศึกษา/รอบการวัด"**, reachable any time. **Never locked** —
  if the teacher set it wrong (even after promotion) they can change it back.
- **Smart default** from today's date, handling the Thai academic calendar
  (ภาคเรียน 2 crosses into the next calendar year):
  - month 5–10 → ปี = พ.ศ.ปัจจุบัน, ภาค 1
  - month 11–12 → ปี = พ.ศ.ปัจจุบัน, ภาค 2
  - month 1–3 → ปี = พ.ศ.ปัจจุบัน − 1, ภาค 2  (the off-by-one fix)
  - month 4 → ช่วงปิดเทอม: เสนอ ปีใหม่ ภาค 1 พร้อมป้ายเตือน, แก้ได้
- Measurements copy this period (year/term/round) at save time; grade/room come
  from the student being measured.

---

## 4. Registry Management (scales to thousands)

Class-first, because that is the teacher's mental model.

- **Filter + search bar:** ชั้น, ห้อง, ค้นหาด้วยรหัส/ชื่อ. Each filter chip shows a
  live count ("ป.1 · 120 คน"). Total students always visible.
- **Virtualized/paginated list** so 1,000+ rows stay responsive.
- **Two ways to populate, both first-class:**
  - **นำเข้าจาก Excel** (whole school at once) — the backbone (§7).
  - **เพิ่มนักเรียนทีละคน** — transfers-in and corrections.
- **Per-row:** แก้ไข, นำออกจากทะเบียน (§6).
- **Bulk select** → ย้ายห้อง, นำออกจากทะเบียน.
- Empty state teaches the two population paths + offers the Excel template.

---

## 5. Academic Year Promotion Wizard (flagship)

The once-a-year flow a teacher most fears. Unhurried, fully explained, reversible
where possible, and it proves no data is lost before removing anyone. Full-screen,
stepper at top showing all 5 steps and where they are.

**Reversibility:** `lastPromotedYear` is **advisory, not a lock**. If the teacher
re-enters the wizard for a year already promoted, show a calm warning
("ปีการศึกษา 2569 เลื่อนชั้นไปแล้วเมื่อ … ต้องการทำอีกครั้งหรือไม่?") and let them
continue or back out. The current period itself remains editable elsewhere any
time.

### Step 1 — เริ่มต้น (orientation)
- *What/Why:* "ตัวช่วยเลื่อนชั้นนักเรียนเมื่อขึ้นปีการศึกษาใหม่ ทำปีละครั้ง"
- Plain summary of what the wizard will do, in order. "ใช้เวลาประมาณ 5 นาที"
- Shows current → next academic year. Single **"เริ่ม"** button.

### Step 2 — สำรองข้อมูลก่อน (safety, forced)
- *Why:* "เพื่อความปลอดภัย เราจะบันทึกสำเนาข้อมูลทั้งหมดไว้ก่อน หากมีอะไรผิดพลาด
  คุณครูสามารถนำกลับมาได้"
- **"สำรองข้อมูลทั้งหมด"** download. Next is disabled until the file is saved;
  confirms "สำรองข้อมูลเรียบร้อย ✓".

### Step 3 — ตรวจสอบและปรับ (review & adjust)
- *What:* table of all active students with **ชั้นปัจจุบัน → ชั้นใหม่** (default +1);
  students at `setup.maxGrade` are flagged **"จบการศึกษา"** with a distinct style.
- Per-row controls (only touch exceptions): **คงชั้นเดิม** (ซ้ำชั้น), edit ชั้นใหม่,
  edit ห้องใหม่, mark/unmark **จบการศึกษา**.
- Bulk + filter/search within the wizard for large schools; running tally:
  "เลื่อน N · คงชั้น N · จบ N".
- Inline helper: "ค่าเริ่มต้นคือเลื่อนทุกคนขึ้น 1 ชั้น คุณครูปรับเฉพาะคนที่ต่างออกไปได้"

### Step 4 — นำออกผู้จบการศึกษา (the reassurance step) ⭐
Shown only if anyone is graduating. Dedicated, explicit, calm:
- "มีนักเรียนจบการศึกษา **78 คน**"
- "ระบบจะสร้างไฟล์เก็บถาวรที่มี **รายชื่อนักเรียนและประวัติการวัดทั้งหมด** ของนักเรียนกลุ่มนี้"
- Show the exact filename: **`รายชื่อนักเรียนจบการศึกษา ปีการศึกษา 2569.xlsx`**
- "โปรดเก็บไฟล์นี้ไว้ใช้อ้างอิงในอนาคต ข้อมูลจะไม่หายไป เพียงย้ายออกจากรายชื่อที่ต้องวัด"
- **"ดาวน์โหลดไฟล์ผู้จบการศึกษา"**. Removal in Step 5 is blocked until this export
  **succeeds** (button confirms "บันทึกไฟล์แล้ว ✓").

### Step 5 — ยืนยันและทำรายการ (apply)
- Final plain-language summary of every change: counts promoted / held /
  graduated, and "นักเรียนที่จบจะถูกย้ายออกจากรายชื่อ (มีไฟล์เก็บไว้แล้ว)".
- On **"ยืนยันการเลื่อนชั้น"**: update continuing students' grade/room; remove
  graduated students from the active registry; advance the current period to the
  new academic year, ภาค 1; record `lastPromotedYear`.
- Success screen: "เลื่อนชั้นเรียบร้อย" + summary + next action
  ("เริ่มบันทึกการวัดของปีการศึกษาใหม่").

---

## 6. Transfer-out / Inactive (same reassurance pattern, any time)

Not part of the yearly wizard; a per-student / bulk action from the registry.

1. Select student(s) → **"นำออกจากทะเบียน"**.
2. Choose reason: **ย้ายโรงเรียน / ออกกลางคัน / อื่น ๆ**.
3. Explain + show filename, e.g. `นักเรียนย้ายออก 20 มิถุนายน 2569.xlsx`, including
   their full measurement history. "ข้อมูลจะถูกบันทึกเป็นไฟล์ ไม่ได้หายไป"
4. Export must succeed, then remove from the active registry.

**Restore without a subsystem:** archive files are normal import-compatible files.
If a student must come back, the teacher re-imports the archive file (§7). There is
no separate in-app archive store to maintain.

---

## 7. Import & Merge (tolerant, duplicate-aware)

`เลือกไฟล์ → จับคู่คอลัมน์ → ตรวจ/แก้ → จัดการรายการซ้ำ → ยืนยัน`

- **Template:** offer a downloadable Excel **แม่แบบ** with exact columns + an
  example row, so teachers aren't guessing.
- **Column mapping:** fuzzy header match (Thai+English aliases, any order, ignore
  case/spaces); unknown columns ignored; manual "จับคู่คอลัมน์" fallback when a
  required field can't be found.
- **Normalize:** trim spaces; numbers loose-parse + round to 1 decimal; **dates
  auto-detect BE vs CE** (> 2400 ⇒ BE) → BE `D/M/YYYY`; gender synonyms
  (ช/ชาย/M → ชาย).
- **Validate** with the same single-source rules as manual entry; invalid rows are
  flagged with a Thai reason and are **inline-editable** to rescue.
- **Duplicate รหัส handling (the one place duplicates are reconciled):** for each
  incoming row matching an existing student, present a conflict the teacher
  resolves — **อัปเดต / ข้าม / ดูรายละเอียด** — showing existing vs incoming side by
  side, with bulk **"อัปเดตทั้งหมด" / "ข้ามทั้งหมด"**.
- **Apply (merge, never silent replace):** add new, update chosen, skip chosen.
  Summary toast: "เพิ่ม 480 · อัปเดต 15 · ข้าม 5". Importing measurement rows skips
  duplicates of the same student+year+term+round.

---

## 8. Screen UX requirements (the four questions, concretely)

| Screen | ฉันกำลังทำอะไร | จะเกิดอะไรต่อ | ปลอดภัยไหม |
|---|---|---|---|
| Registry | title + total/class counts | filter/search live results | edits autosave; remove = export-first |
| Import | stepper with named steps | review screen previews every row before save | merge, never replace; conflicts explicit |
| Promotion | 5-step stepper, time estimate | each step previews counts/changes | forced backup; graduate export gate; reversible year |
| Transfer-out | reason + plain explanation | shows filename to be saved | export must succeed before removal |
| Period change | shows current vs chosen period | "วัดครั้งต่อไปจะถูกบันทึกในรอบนี้" | always editable, no lock |

Every confirmation states **what happens, how many records, and how to recover.**
All copy lives in `i18n/th.ts`. Status never by color alone — always a Thai label.

---

## 9. Gaps found & how handled

- **Wrong year after promotion** → period stays editable; `lastPromotedYear` only
  warns, never locks.
- **Double promotion** → calm "already promoted" warning, continue or cancel.
- **Measurement timing around promotion** → snapshots make pre/post records each
  correct automatically; no special handling.
- **Graduated cohorts in reports** → they leave the active dataset with their
  history in the archive file; active reports stay clean; past years remain correct
  via snapshots.
- **รหัสซ้ำ** → unique in the active registry; the import conflict flow is the sole
  reconciliation point.
- **Restore** → re-import the archive file; no bespoke restore subsystem.

---

## 10. Out of scope (kept out on purpose)
Per-student status timelines, enrolment history, attendance, multi-year in-app
archives, anything resembling a full SIS. If a request doesn't help measure and
track nutrition, it does not belong here.
