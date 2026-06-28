# Business Requirements Document
## Student Nutrition Tracking System (ระบบติดตามภาวะโภชนาการนักเรียน)

| | |
|---|---|
| **Document version** | 1.0 |
| **Application version** | 1.1.0 |
| **Application type** | Single-file offline web application (HTML) |
| **Primary language (UI)** | Thai |
| **Target users** | Thai school teachers (individual use, including non-technical and elderly users) |
| **Nutrition criteria source** | สำนักโภชนาการ กรมอนามัย กระทรวงสาธารณสุข (Bureau of Nutrition, Department of Health, Ministry of Public Health) — growth reference for children aged 2–18 years, B.E. 2564 (2021) |

---

## 1. Overview & Purpose

### 1.1 Background
Thai schools are required to monitor students' physical growth (weight and height) and assess their nutritional status against national reference standards. This tool digitizes that process for an individual teacher working on their own device.

### 1.2 Business Goal
Enable a single teacher to record, store, classify, visualize, and report student nutritional status — fully offline, with no server, no login, and no internet dependency — while remaining usable by non-technical and elderly users.

### 1.3 Operating Model
- **Single-teacher, single-device.** Each teacher runs the app on their own machine. There is no multi-user concurrency, no real-time sync, and no central server.
- **Data sharing is file-based.** If another teacher must contribute, data is exported to a file, transferred manually, and imported on the other device.
- **All data is stored locally** in the browser's local storage on the teacher's device.

### 1.4 Design Principles
- **Offline-first.** All dependencies (charting library, fonts) are embedded or fall back to system resources. No CDN or network calls are required at runtime.
- **Purpose-driven UI.** Menus and labels are organized around what the teacher wants to accomplish, not the underlying technical mechanism (e.g., teachers are never asked to understand "JSON" vs "CSV").
- **Single task per screen.** Each surface has one clear purpose with no redundant inputs.
- **Current-state master data, historical measurements.** Student grade/room reflect the present registry; measurements are retained per academic year/term/round.
- **Soft deletion.** Graduated/inactive students are flagged, not deleted, preserving history while keeping current views clean.
- **Cross-browser & multi-device.** Must run on PC, tablet, and iPad across modern browsers (Chrome, Edge, Safari, Firefox).

---

## 2. Stakeholders & User Roles

| Role | Description | System Interaction |
|---|---|---|
| **Teacher (primary user)** | Classroom teacher responsible for measuring and recording students | Full use of all features on their own device |
| **Supervising agency** | Organization overseeing multiple schools | Receives PDF reports and summary spreadsheets exported by teachers |
| **Other teachers** | Colleagues who help record data | Receive exported data files, import them, contribute, and re-export |

There is **no role-based access control** within the application; a single device equals a single user context.

---

## 3. Scope

### 3.1 In Scope
- Student registry management (add, edit, delete, search, grade promotion, graduation)
- Recording weight/height measurements per academic year, term, and measurement round
- Automated nutritional classification against the national reference tables
- Dashboard with summary statistics and an at-risk student list
- Per-student growth charts (3 chart types)
- PDF report generation (summary report and per-student report)
- Spreadsheet (CSV) export and import for data transfer and Excel use
- Full data backup and restore (single-file)
- School profile configuration
- Backup reminders
- Full offline operation
- Responsive layout for PC, tablet, and phone

### 3.2 Out of Scope
- Multi-user concurrent editing or real-time synchronization
- Cloud storage, server-side persistence, or automatic cloud backup
- User authentication, authorization, or audit logging
- Data encryption at rest
- Historical grade/room snapshots per measurement (by design, reports reflect current registry — see §6.3)
- Children outside the 2–18 year reference range (measurements are not classified)

---

## 4. Data Model

### 4.1 Student (master record)
Represents the **current state** of a student.

| Field | Type | Notes |
|---|---|---|
| `id` | string | Student ID. Unique. Required. |
| `fn` | string | First name. Required. |
| `ln` | string | Last name. Required. |
| `dob` | string | Date of birth in Thai Buddhist-era format `D/M/YYYY` (e.g., `15/5/2556`). |
| `gender` | string | `ชาย` (male) or `หญิง` (female). Required. |
| `grade` | string | Current grade level (อ.1–อ.3, ป.1–ป.6, ม.1–ม.6). Required. |
| `room` | string | Current classroom. Required. |
| `graduated` | boolean | Soft flag. `true` = graduated/no longer studying. Defaults to absent/false. |

### 4.2 Measurement record
Represents one weight/height capture for a student in a given period.

| Field | Type | Notes |
|---|---|---|
| `id` | string | Student ID this measurement belongs to. |
| `year` | string | Academic year (Buddhist era). |
| `term` | string | Term: `1` or `2`. |
| `round` | string | Measurement round: `1` or `2`. |
| `date` | string | Measurement date, Thai format `D/M/YYYY`. |
| `weight` | number | Weight in kilograms. |
| `height` | number | Height in centimeters. |
| `_t` | number | Internal save timestamp (epoch ms). Used to break ties when a student has duplicate records in the same period. |
| `gradeAtMeasure` | string | Grade snapshot at the time of measurement. |
| `roomAtMeasure` | string | Classroom snapshot at the time of measurement. |

**Note:** Grade and room are **snapshotted onto each measurement** at save time
(`gradeAtMeasure` / `roomAtMeasure`), so historical reports reflect where the
student was when measured, not their current grade/room. Measurements are
immutable history and never change after promotion or room moves.

### 4.3 School profile (`setup`)
| Field | Type | Notes |
|---|---|---|
| `school` | string | School name |
| `ministry` | string | Affiliation/ministry |
| `department` | string | Department/division |
| `subdistrict` | string | Subdistrict (ตำบล) |
| `district` | string | District (อำเภอ) |
| `province` | string | Province (จังหวัด) |
| `teacher` | string | Responsible teacher's name |
| `maxGrade` | string | Highest grade in the school; used to determine graduation on promotion |

### 4.4 Persistence
- Data is stored in browser local storage under three keys: students, measurements, and setup.
- Additional local-storage keys track the last successful backup time and a backup-reminder snooze timestamp.
- Backup/restore moves the entire dataset (students + measurements + setup + version metadata) through a single file.

---

## 5. Functional Requirements

### 5.1 School Profile Configuration
- **FR-1.1** The teacher can open a setup dialog to enter school name, affiliation, department, subdistrict, district, province, responsible teacher name, and highest grade offered.
- **FR-1.2** The school name (and province, if set) is displayed persistently in the header.
- **FR-1.3** The highest-grade setting determines which students are treated as "graduating" during grade promotion.
- **FR-1.4** Profile data is included in reports and the full backup file.

### 5.2 Student Registry Management
- **FR-2.1** The teacher can add a student with ID, first name, last name, date of birth, gender, grade, and room.
- **FR-2.2** Required-field validation: ID, first name, last name, gender, grade, and room must be provided; otherwise inline field errors are shown.
- **FR-2.3** Date of birth must be a valid Thai-format date; birth year must be within B.E. 2540–2590.
- **FR-2.4** Duplicate student IDs are rejected.
- **FR-2.5** The teacher can edit any student's details.
- **FR-2.6** The teacher can delete a student (with confirmation).
- **FR-2.7** Students can be searched by ID.
- **FR-2.8** The registry list shows each student's ID, name, grade, room, and status badge (studying / graduated).
- **FR-2.9** Graduated students are flagged (soft delete), not removed; their measurement history is preserved.

### 5.3 Grade Promotion & Graduation
- **FR-3.1** The teacher can open a promotion dialog that lists all currently-studying students (graduated students are excluded).
- **FR-3.2** "Promote all +1" and "Demote all −1" bulk actions adjust every listed student's grade by one level.
- **FR-3.3** Students at the highest configured grade are marked as "graduating" when promoted.
- **FR-3.4** The teacher can override grade/room per student before confirming.
- **FR-3.5** On confirmation:
  - Students flagged as graduating have their `graduated` status set to true and their grade/room left unchanged.
  - All other students have their grade/room updated.
- **FR-3.6** A summary toast reports how many students were updated and how many graduated.

### 5.4 Measurement Recording
- **FR-4.1** The teacher records weight and height for a selected student under a chosen academic year, term, round, and date.
- **FR-4.2** Year/term/round/date and class context are retained ("sticky") across consecutive entries to speed up batch recording.
- **FR-4.3** The measurement date picker defaults to the current date.
- **FR-4.4** Weight must be within 5–150 kg; height within 40–210 cm. Out-of-range values are rejected with an error message.
- **FR-4.5** Date must be a valid Thai-format date.
- **FR-4.6** A live preview shows the preliminary nutritional classification before saving.
- **FR-4.7** **Duplicate detection:** if a record already exists for the same student + year + term + round, the system warns and asks whether to save an additional record. If confirmed, the new record is added with its own save timestamp.
- **FR-4.8** Each saved measurement stores a save timestamp (`_t`).
- **FR-4.9** The teacher can edit a measurement; editing refreshes its save timestamp.
- **FR-4.10** The teacher can delete a measurement (with confirmation).
- **FR-4.11** The measurement list supports filtering (by grade, room, year, term, round) and pagination, and searching by student ID.

### 5.5 Nutritional Classification (Core Logic)
All classification uses the national reference tables for the **same gender and exact height/age**, applied consistently across the results table, dashboard, charts, PDF, and CSV.

- **FR-5.1 Eligibility:** Classification requires the student's age at measurement to be ≥ 24 months (2 years) and within the supported reference range. If age is outside range or no reference is found, the record is treated as "not assessable" and is excluded from classified outputs (it is **not** defaulted to "normal").

- **FR-5.2 Weight-for-Height (WFH / น้ำหนักตามส่วนสูง):** Classified by interpolating the gender-specific weight-for-height reference table at the student's exact height, then placing the student's weight into one of six bands:
  1. ผอม (Wasted / underweight-for-height)
  2. ค่อนข้างผอม (At risk of wasting)
  3. สมส่วน (Normal / proportionate)
  4. ท้วม (Risk of overweight)
  5. เริ่มอ้วน (Overweight)
  6. อ้วน (Obese)

  **Critical requirement:** The classification shown in the results table, dashboard, PDF, and CSV must be derived from the **same reference table that draws the chart zones**, so that a student's textual classification always matches their position on the chart. (Earlier behavior using a fixed BMI threshold produced mismatches and is prohibited.)

- **FR-5.3 Weight-for-Age (WFA / น้ำหนักตามเกณฑ์อายุ):** Classified against the age/gender reference into: น้ำหนักน้อย (low), น้ำหนักค่อนข้างน้อย (rather low), น้ำหนักตามเกณฑ์ (normal), น้ำหนักค่อนข้างมาก (rather high), น้ำหนักมาก (high).

- **FR-5.4 Height-for-Age (HFA / ส่วนสูงตามเกณฑ์อายุ):** Classified into: เตี้ย (stunted), ค่อนข้างเตี้ย (rather short), สูงตามเกณฑ์ (normal), ค่อนข้างสูง (rather tall), สูง (tall).

- **FR-5.5 "Tall & proportionate" (สูงดีสมส่วน):** Derived flag = "yes" only when HFA is normal-or-above (สูงตามเกณฑ์ / ค่อนข้างสูง / สูง) **and** WFH is สมส่วน or ท้วม; otherwise "no".

- **FR-5.6 Reference lookup tolerance:** Age-based reference matching uses the nearest available age entry within a 6-month tolerance; beyond that, the record is not assessable.

- **FR-5.7 "Latest measurement per student":** When computing the latest result per student (for dashboard, reports, summaries), records are compared by year → term → round, with the save timestamp (`_t`) used as a tie-breaker so the most recently saved record wins when duplicates exist in the same period.

### 5.6 Dashboard
- **FR-6.1** Displays summary counts: total students, total measurements, count classified as normal/proportionate, and count requiring follow-up (at-risk).
- **FR-6.2** Displays an **at-risk student list** based on each student's latest measurement, flagging concerning categories (e.g., obese, overweight, wasted, low weight, stunted).
- **FR-6.3** Provides a getting-started guide for new users linking to key tasks.

### 5.7 Growth Charts (per student)
- **FR-7.1** The teacher selects a student (by dropdown or ID search) to view their growth charts.
- **FR-7.2** Three charts are rendered:
  1. Weight-for-Height (with colored classification zones and the student's measurement points)
  2. Height-for-Age
  3. Weight-for-Age
- **FR-7.3** Charts plot the student's measurement history as a trend line over the reference zones.
- **FR-7.4** Charts must render fully **offline** (charting library is embedded in the file).
- **FR-7.5** A legend explains each colored zone.
- **FR-7.6** The teacher can export the current student's charts and data as a PDF.

### 5.8 Reporting (for supervising agency)
The "Reports" screen contains **only** agency-facing outputs:
- **FR-8.1 Summary PDF report:** A printable report summarizing nutritional status, organized by academic year and term, including school profile and the criteria source/version in the footer. Filterable by academic year.
- **FR-8.2 Summary spreadsheet (CSV):** An aggregate summary including school name, location, and counts/percentages per category, suitable for an agency to combine multiple schools in Excel.
- **FR-8.3** Reports reflect the **current** registry (grade/room) — see constraint §6.3.
- **FR-8.4** PDF generation must work reliably across browsers and devices without freezing or requiring popup permissions (see §5.11).

### 5.9 Backup & Restore (for teacher)
Located in the "Program Settings" screen, organized by purpose.

- **FR-9.1 Back up data:** One action downloads the **entire dataset** (students + measurements + school profile + version metadata) as a single file. Intended as the teacher's primary safeguard.
- **FR-9.2 Restore data ("use backup data"):** The teacher selects a previously saved backup file to bring all data back — used when opening on a new device or recovering lost data. This **replaces all current data** on the device (with a confirmation warning).
- **FR-9.3** Backup is described to the teacher purely by purpose ("keep your data safe / move to a new device"); the file format is never surfaced as a technical concept.
- **FR-9.4** On restore, any records lacking a save timestamp are assigned one so that latest-result logic continues to work.
- **FR-9.5** A successful backup records the backup time and resets the reminder.

### 5.10 Data Transfer (CSV — for new academic year / sharing with other teachers)
Presented as a separate, secondary "occasional task" section labeled clearly as for new-year setup or handing off to another teacher.

- **FR-10.1 Export full data (spreadsheet):** Students + all measurements, openable in Excel, for another teacher to import and contribute to.
- **FR-10.2 Export student roster only (spreadsheet):** Registry fields only (no measurements), for starting a new academic year.
- **FR-10.3 Import spreadsheet:** The teacher imports a spreadsheet; the system shows a **review screen before saving**, allowing inspection, per-student grade/room edits, bulk grade promotion, and graduation marking.
- **FR-10.4 Merge semantics:** CSV import **merges** with existing data — new students are added, existing students are updated, and duplicate measurements (same student+year+term+round) are skipped. This is explicitly distinguished in the UI from "restore," which replaces everything.
- **FR-10.5 Import validation:** Each imported measurement row is validated with the **same rules as manual entry** (required fields: ID, year, term, round, date; valid date; weight 5–150 kg; height 40–210 cm). Invalid rows are skipped and reported to the teacher with the reason and row number.
- **FR-10.6 Graduation on import:** A student's graduated status is correctly carried from the file; importing an active row clears a stale graduated flag.
- **FR-10.7 Orphan handling:** Measurement rows with no matching student in the registry are skipped and counted.

### 5.11 PDF Generation (reliability requirement)
- **FR-11.1** PDF output must be produced via an in-page hidden iframe mechanism rather than opening a new browser window.
- **FR-11.2** This must avoid popup-blocker failures and must not freeze on tablet/iPad browsers.
- **FR-11.3** PDF generation must work offline (no external fonts or scripts loaded at print time); system font fallbacks are used.
- **FR-11.4** The print/save dialog is triggered automatically once content (including embedded chart images) has loaded.

### 5.12 Clear All Data
- **FR-12.1** The teacher can erase all data to start fresh, with a confirmation step and a reminder to back up first (deletion is irreversible without a backup file).

### 5.13 Backup Reminder
- **FR-13.1** The system tracks the last successful backup time.
- **FR-13.2** If 7 or more days have passed since the last backup, a reminder prompt is shown.
- **FR-13.3** The teacher can act on the reminder (which navigates to the backup screen and triggers a backup) or snooze it.

---

## 6. Business Rules & Constraints

### 6.1 Validation Rules (single source of truth)
| Rule | Value |
|---|---|
| Weight range | 5–150 kg |
| Height range | 40–210 cm |
| Date format | Thai Buddhist era `D/M/YYYY` |
| Birth year range | B.E. 2540–2590 |
| Minimum age for classification | 24 months (2 years) |
| Supported reference age | 2–18 years |
| Reference age match tolerance | ±6 months |

The **same** validation rules apply to manual entry and to CSV import.

### 6.2 Classification Consistency Rule
Table, dashboard, charts, PDF, and CSV must always use one shared classification function fed by the same reference tables that render the chart zones. No alternate or simplified classification (e.g., fixed BMI thresholds) is permitted anywhere.

### 6.3 Historical Grade/Room Snapshot
Each measurement snapshots the student's grade and room at save time
(`gradeAtMeasure` / `roomAtMeasure`). Historical reports therefore reflect where
the student was **when measured**, correct across promotions and room moves. The
student master record still holds only the **current** grade/room; the registry is
a single living roster (see PRODUCT.md "Student Lifecycle"), not a per-year store.

### 6.4 Duplicate Measurement Handling
The system permits multiple records in the same period only after an explicit confirmation. The latest-per-student computation uses the save timestamp as a tie-breaker to ensure the most recently saved record is the one used in dashboards and reports.

### 6.5 Offline Constraint
The application must function with no internet connection. The charting library is embedded in the file; fonts fall back to system Thai fonts (including Windows Thai fonts) if web fonts are unavailable. No runtime CDN calls are permitted.

### 6.6 Single-Device Data Ownership
There is no synchronization or merge across devices beyond manual file export/import. Concurrent multi-teacher editing is not supported and is not a requirement.

---

## 7. Non-Functional Requirements

### 7.1 Compatibility
- **NFR-1.1** Must run as a single self-contained HTML file with no installation.
- **NFR-1.2** Must work on the latest versions of Chrome, Edge, Safari, and Firefox.
- **NFR-1.3** Must work on PC, tablet, and iPad (landscape and portrait).
- **NFR-1.4** JavaScript must avoid syntax not supported by the above browsers' recent versions (backwards-compatible syntax is required for broad device support, including older tablets).

### 7.2 Usability
- **NFR-2.1** Usable by non-technical and elderly teachers; menus organized by intent, not technical concepts.
- **NFR-2.2** Thai-language interface throughout.
- **NFR-2.3** Inline validation with clear, friendly error messages.
- **NFR-2.4** No technical jargon (e.g., file format names) exposed to the teacher.

### 7.3 Responsiveness
- **NFR-3.1** Layout adapts across PC, tablet, and phone widths.
- **NFR-3.2** Forms collapse to fewer columns on narrow screens (≤820px → 2 columns; ≤520px → 1 column).
- **NFR-3.3** No horizontal page scrolling on small screens; the navigation tab bar scrolls internally instead of breaking layout.

### 7.4 Reliability
- **NFR-4.1** No operation (tab switching, modals, exports, PDF generation) may freeze the application on any supported device.
- **NFR-4.2** PDF generation must be popup-blocker-proof and offline-safe.

### 7.5 Data Integrity & Safety
- **NFR-5.1** Soft deletion preserves history.
- **NFR-5.2** Backups capture the complete dataset for full recovery.
- **NFR-5.3** Destructive actions (delete student, delete measurement, restore, clear all) require confirmation.

### 7.6 Maintainability
- **NFR-6.1** Application and criteria versions are tracked and displayed (footer and reports) and embedded in backup files.

---

## 8. Reference Data Requirements

- **REQ-8.1** The system embeds gender-specific reference tables for Weight-for-Height, Weight-for-Age, and Height-for-Age covering ages 2–18 years.
- **REQ-8.2** The source, owner, and version of the criteria must be displayed in the application footer and in generated reports:
  - Source/owner: สำนักโภชนาการ กรมอนามัย กระทรวงสาธารณสุข (Bureau of Nutrition, Department of Health, Ministry of Public Health)
  - Version: Growth reference for children aged 2–18 years, B.E. 2564 (2021)
- **REQ-8.3** Before official use, reference table values should be verified by a nutrition specialist.

---

## 9. Assumptions & Dependencies

- **A-1** Each teacher uses one device; no concurrent multi-user editing.
- **A-2** Teachers transfer data between devices/people via exported files.
- **A-3** The device's browser supports local storage and is not routinely cleared without a backup.
- **A-4** Dates are entered in the Thai Buddhist calendar.
- **A-5** The embedded reference tables accurately represent the B.E. 2564 standard (pending specialist verification per REQ-8.3).

---

## 10. Known Limitations (explicitly accepted)

| # | Limitation | Rationale |
|---|---|---|
| L-1 | Historical grade/room not stored per measurement | Aligns with current-state master data principle; notice shown to user |
| L-2 | Local-storage-only persistence (no cloud, no encryption, no audit log) | Out of scope for a single-file offline tool; mitigated by full backup |
| L-3 | No multi-device sync or concurrent editing | By design; file-based transfer used instead |
| L-4 | Students outside 2–18 years are not classified | Reference data does not cover them |

---

## 11. Glossary

| Term (Thai) | English |
|---|---|
| ภาวะโภชนาการ | Nutritional status |
| น้ำหนักตามส่วนสูง (WFH) | Weight-for-Height |
| น้ำหนักตามเกณฑ์อายุ (WFA) | Weight-for-Age |
| ส่วนสูงตามเกณฑ์อายุ (HFA) | Height-for-Age |
| สูงดีสมส่วน | Tall and well-proportioned |
| ผอม / ค่อนข้างผอม | Wasted / at risk of wasting |
| สมส่วน | Proportionate (normal) |
| ท้วม / เริ่มอ้วน / อ้วน | Risk of overweight / overweight / obese |
| เตี้ย / ค่อนข้างเตี้ย | Stunted / rather short |
| ชั้น / ห้อง | Grade / classroom |
| ปีการศึกษา / ภาคเรียน / ครั้งที่ | Academic year / term / measurement round |
| เลื่อนชั้น | Grade promotion |
| จบการศึกษา | Graduated |
| สำรองข้อมูล / กู้คืน | Back up / restore |

---

*End of document.*
