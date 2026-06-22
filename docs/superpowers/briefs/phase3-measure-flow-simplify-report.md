# Phase 3 Measure Flow Simplify — Report

**Status:** DONE  
**Date:** 2026-06-21  
**File modified:** `src/features/MeasureView.vue` (sole change)

---

## What was done

### Stepper collapsed from 5 steps to 4

Old (separate modes, 5 steps each):
- Manual: เลือกห้อง → ตั้งค่ารอบการวัด → บันทึกการวัด → ตรวจทาน → เสร็จสิ้น
- Excel: เลือกห้อง → ตั้งค่ารอบการวัด → นำเข้าไฟล์ → ตรวจ/แก้ → เสร็จสิ้น

New (single stepper, unified):
- เลือกห้อง → บันทึกการวัด → ตรวจทาน → เสร็จสิ้น

### Step 0 — เลือกห้อง: Excel link removed

Removed the per-row `📄 นำเข้า Excel` link and the `start(grade, room, 'excel')` path from the room list. Each room row now has only a chevron `›`. Clicking a room calls `start(grade, room)` with mode always starting as `'manual'`.

### Step 1 — บันทึกการวัด: inline context bar + action row

The old `ตั้งค่ารอบการวัด` panel (step 1 previously, now removed) is replaced by a compact **context bar** rendered at the top of the record screen:
- ปีการศึกษา (number input, defaults to `data.period.year`)
- ภาคเรียน (select, defaults to `data.period.term`)
- ครั้งที่ (select, defaults to `'1'`)
- วันที่วัด (ThaiDateField, defaults to `todayThai()`)

`sessDate` now initialises to `todayThai()` (was `''`). Because it starts valid, no button is ever disabled on arrival. Inline error on the date field only shows if the teacher clears/breaks it.

The action row (bottom of step 1) now carries:
- **← ย้อนกลับ** (quiet)
- กรอกแล้ว X/N คน (count)
- **📄 นำเข้า Excel** (secondary label/file-input) — triggers file picker; on file read, parses with current session refs, sets `mode = 'excel'`, advances to step 2 (Excel preview)
- **ดาวน์โหลดแม่แบบ** (quiet) — calls `downloadBlob(aoaToXlsxBlob(measureTemplateAoa(),'ผลการวัด'),'แม่แบบผลการวัด.xlsx')`
- **ตรวจทานก่อนบันทึก** (primary lg) — advances to step 2 (manual review)

The `goToRecord()` function and its `sessDate` gate were removed. `goToReview()` now simply sets `i = 2`.

### Step 2 — ตรวจทาน (manual) / Excel preview (excel mode)

Unchanged in logic; step index renumbered from 3 → 2.  
Excel back button resets `mode = 'manual'` and returns to step 1.

### Step 3 — เสร็จสิ้น

"วัดห้องถัดไป" (was "วัดห้องอื่น") resets to step 0.

### Removed dead code

- `stepsManual`, `stepsExcel` refs (replaced by single `steps` const)
- `start()` second parameter `m: 'manual' | 'excel'` removed (mode always starts manual)
- `goToRecord()` function removed
- `excel-link` CSS class removed

---

## Verification

### Type-check
```
npx vue-tsc --noEmit  →  (no output, clean)
```

### Tests
```
npm test  →  167 passed (14 test files), build test included
```

### Browser (localhost:5173, mock data)

**measure-roomlist.png** — room list with 4-step stepper; no Excel link on rows; clean chevron-only rows.

**measure-record-inline.png** — after clicking อ.1/1:
- Stepper: เลือกห้อง ✓ → บันทึกการวัด (active) → ตรวจทาน → เสร็จสิ้น
- Context bar prefilled: ปีการศึกษา 2569 · ภาคเรียน 1 · ครั้งที่ 1 · วันที่วัด 21/6/2569 (today)
- All buttons enabled immediately — nothing gated
- Action row: ← ย้อนกลับ | กรอกแล้ว 0/11 คน | 📄 นำเข้า Excel | ดาวน์โหลดแม่แบบ | ตรวจทานก่อนบันทึก

Screenshots saved to `.playwright-mcp/`.

---

## Constraints honoured

- `noUnusedLocals` — all imports used; removed unused `stepsManual`/`stepsExcel`
- No git operations
- No server start/kill
- Editor tools only (Write/Edit), no heredoc/echo
- 4 criteria preserved (wfa/hfa/wfh/tall) — no changes to engine or reference tables
- Dup gate intact: `isDup()` checks `sessYear/sessTerm/sessRound`; dup rows require explicit "บันทึกทับ" confirm
