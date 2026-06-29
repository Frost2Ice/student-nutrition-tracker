# Year-Based Dataset — UI Design

**Date:** 2026-06-29 · **Status:** Shape (no code written) · **Branch:** master (no commits)
Consulted: `frontend-design`, `impeccable`. Grounded in `DESIGN.md` ("The Calm
Clinic") + `PRODUCT.md`. **Read `…-OPEN-QUESTIONS.md` first — Blocker 1 may move
this foundation.**

## Design stance

No new visual language. This feature lives entirely inside the existing system:
teal `--brand`, Sarabun, soft 16px panels, the **order-ticket wizard** pattern, the
**period-chip**. The whole job is making *time* (which year, is it frozen) legible to
a non-technical teacher without adding chrome or fear. The one new idea the feature
needs is a **"frozen past" visual register** — and it must read as *safe and
preserved*, never *locked-out*. That is the single deliberate move; everything else
reuses what's there.

Anti-goal: a "version history" / SIS-timeline UI. PRODUCT.md forbids it. Archived
years are a **shelf of finished books**, not an admin audit log.

---

## 1. Year switcher — reuse the period-chip, don't add chrome

The header already renders `📅 ปีการศึกษา 2569` (`AppHeader.vue` → `.period-chip`)
and tapping it is documented to open year/round change. Make that the one entry
point. No sidebar item, no new button.

**Tap → bottom sheet (mobile) / centered panel (≥900px)**, titled
**"ปีการศึกษา"**, helper *"ปีที่กำลังใช้งานแก้ไขได้ ปีที่ผ่านมาเก็บไว้ดูอย่างเดียว"*:

```text
┌─ ปีการศึกษา ───────────────────────────┐
│  ● 2569   กำลังใช้งาน        [แก้ไขอยู่] │  ← active: brand-tint row, brand-ink
│ ────────────────────────────────────── │
│  ○ 2568   เก็บถาวร · 412 คน      ดู →   │  ← archived: surface-2, ink-muted
│  ○ 2567   เก็บถาวร · 398 คน      ดู →   │
│ ────────────────────────────────────── │
│        [ + ขึ้นปีการศึกษาใหม่ ]          │  ← primary, launches wizard
└────────────────────────────────────────┘
```

- Active year = `brand-tint` fill + filled dot + `[แก้ไขอยู่]` pill (period-chip
  colors). Exactly one, always top.
- Archived = `surface-2` tonal layer, hollow dot, `เก็บถาวร` + student count, a quiet
  **"ดู →"** link. Tapping opens that year **read-only** (§2).
- The chip itself, when an archived year is being viewed, swaps to a muted state
  (see §2) so the teacher never loses track of which year they're looking at.
- Sorted newest-first; active pinned top regardless.

Why a sheet, not a `<select>`: a dropdown hides the active/frozen distinction and the
counts. The list makes "this is the live one, those are kept safe" unmistakable —
the four-questions checklist (*ฉันอยู่ปีไหน? ปลอดภัยไหม?*).

---

## 2. The "frozen past" register — viewing an archived year

When a teacher opens an archived year, the whole app shifts into a calm read-only
skin so the state is impossible to miss, yet never alarming.

**Persistent banner** below the header, full width, `surface-2` bg + hairline, NOT
red (red = error; this is safe):

```text
🔒  กำลังดูปีการศึกษา 2568 (เก็บถาวร · อ่านอย่างเดียว)        [กลับไปปีปัจจุบัน]
```

- Lock glyph reads "preserved," paired with the Thai label (never color alone).
- `[กลับไปปีปัจจุบัน]` is a `quiet` button → jumps back to the active year.
- Period-chip in the header desaturates: `surface-2` bg + `ink-muted` text + 🔒
  instead of 📅, so even if the banner scrolls the chip still signals "past."

**Mutation controls are removed, not disabled.** Per your note, an attempted write
throws `ReadonlyYearError` in dev, but the UI never shows a dead greyed button —
"เพิ่ม / แก้ไข / บันทึกการวัด / ลบ" simply aren't rendered in archived view. Reports,
charts, the roster table, and **export** remain fully available (history is the whole
point of keeping the year). Empty-state and helper copy switch to past tense where
relevant.

Motion: entering/leaving archived view does a 180ms `ease-out` crossfade of the
banner + chip only (no layout animation). Full `prefers-reduced-motion` = instant.

---

## 3. New-Year wizard — evolve the flagship Promotion Wizard

Do **not** build a parallel wizard (DESIGN.md: "two doorways, not two apps"). The
existing **Promotion Wizard** (`PromotionView.vue`, the documented flagship) becomes
the year-rollover flow. It already owns explain → backup → review promotion → review
graduates → export → confirm. We retarget its final write from *mutate-in-place* to
*build a new active snapshot + freeze the old one*, and add a naming step. Reuses the
`Stepper` component and the `order-ticket` pattern.

Steps (Stepper across top, one task per screen):

1. **อธิบาย** — "ขึ้นปีการศึกษาใหม่" + plain-Thai what-happens: *ปีนี้จะถูกเก็บไว้ดูได้
   เสมอ และเราจะสร้างปีใหม่ให้* . Reassure: nothing is deleted.
2. **สำรองข้อมูลก่อน (บังคับ)** — mandatory backup, unchanged. The flagship's
   forced-backup safety stays.
3. **ตั้งปีการศึกษาใหม่** — order-ticket row: pick/confirm the new year number
   (default = active + 1), reject duplicates against the manifest. Carry
   ครู / ชั้นสูงสุด / ห้องเรียน forward, editable here.
4. **เลื่อนชั้นนักเรียน** — existing per-student promote / ซ้ำชั้น / จบการศึกษา + room
   pick (the current promotion UX, untouched logic: `planPromotion`/`applyPromotion`).
5. **นักเรียนที่จบการศึกษา** — export graduates with full history, show the exact
   filename (`รายชื่อนักเรียนจบการศึกษา ปีการศึกษา 2569.xlsx`) — existing reassurance
   pattern. Graduates are simply *not copied* into the new year; the frozen 2569 keeps
   them.
6. **🧾 ยืนยัน** — order-ticket summary: *"ปี 2570 · นำนักเรียนมา 380 คน · จบการศึกษา 32
   คน · เริ่มบันทึกการวัดใหม่ · ปี 2569 เก็บถาวรแล้ว"* + full-width
   **[ขึ้นปีการศึกษาใหม่]** enabled only when every step is done.

After confirm → success summary (existing pattern) → land on the new active year's
home. Copy stays warm/Thai-first; every destructive-sounding word paired with
"เก็บไว้/ย้าย ไม่ได้หาย."

---

## 4. Backup & Restore — your scoped menu, in the system's clothes

Lives in `SettingsView.vue` (or its own panel reachable from Settings). Section
title **"สำรองและกู้คืนข้อมูล"**. Reuse `ImportDialog.vue` for the import side. The
menu structure carries the meaning (your insight — scope-by-label):

```text
สำรองและกู้คืนข้อมูล

ส่งออก (ดาวน์โหลดไฟล์เก็บไว้)
  [ ปีการศึกษาเดียว ]   เลือกปี → ได้ไฟล์พกพาได้ (รวมข้อมูลโรงเรียน)
  [ ทั้งโรงเรียน ]      สำรองทุกปีในไฟล์เดียว

นำเข้า (กู้คืนจากไฟล์)
  [ ปีการศึกษาเดียว ]   เพิ่มปีเข้าไป — ถ้ามีปีนั้นแล้วจะถามก่อนเขียนทับ
  [ ทั้งโรงเรียน ]      กู้คืนทั้งหมด — จะแทนที่ข้อมูลปัจจุบัน (ยืนยันก่อน)
```

- Two clear groups (ส่งออก / นำเข้า), each with a one-line plain-Thai consequence —
  no JSON/CSV jargon (PRODUCT.md Don't).
- **Year import conflict** uses the existing confirmation pattern: states the year,
  the student count, and overwrite-vs-skip, with recovery wording.
- **Full import** = the only "replace" path → strong confirm stating it wipes current
  data, recovery = "ไฟล์เดิมของคุณยังอยู่."
- No nested cards: a single `panel` with two labeled groups of `secondary` buttons.

---

## Reused components / tokens (nothing new invented)

| Need | Reuse |
|------|-------|
| Year switcher trigger | `.period-chip` in `AppHeader.vue` |
| Switcher list rows | `nav-item` (active) / `surface-2` rows; `Badge.vue` for เก็บถาวร |
| Read-only banner | `panel`/`surface-2` + hairline; `Badge` + `quiet` button |
| Wizard | `PromotionView.vue` + `Stepper.vue` + `.order`/`.order-row`/`.order-ticket`/`.tile` (`journeys.css`) |
| Import | `ImportDialog.vue` |
| Confirms | existing confirmation pattern (stakes + count + recovery) |
| Status pills | `Badge` good/warn/bad |

New CSS: only the archived "frozen" skin (banner + desaturated chip variant) — a
small additive block in `journeys.css`, accent-aware, with reduced-motion fallback.

## Accessibility (carried from DESIGN.md, non-negotiable)

- Switcher sheet: focus-trapped, `Esc` closes, returns focus to the chip; rows are
  real buttons, keyboard-navigable.
- Read-only banner: `role="status"`, announced on year change.
- Lock/dot states never rely on color alone — always the Thai label beside them.
- All targets ≥44px, body ≥17px, focus-visible 3px brand ring, contrast ≥4.5:1.
- Reduced-motion: crossfades become instant.

## Open questions

See `2026-06-29-year-based-dataset-OPEN-QUESTIONS.md` — especially **Blocker 1**
(this UI assumes the approved snapshot spec; if PRODUCT.md wins or we go hybrid, §2–3
change).
