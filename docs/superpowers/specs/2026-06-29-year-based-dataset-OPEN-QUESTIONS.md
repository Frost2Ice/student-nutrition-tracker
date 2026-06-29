# Year-Based Dataset — Open Questions (read first)

Left for you while you slept. Nothing here was committed to git. Still on `master`.
The UI design lives in `2026-06-29-year-based-dataset-ui-design.md`; this file is
the blockers + decisions I need from you before that UI is safe to build.

---

## ✅ RESOLVED 2026-06-29 — decisions

- **Blocker 1 → Option A (supersede PRODUCT.md).** Snapshot-first is the new product
  direction. `PRODUCT.md` §Student Lifecycle, the priority-order line, §Flagship
  Workflows, and Design Principle 4 were rewritten; `DESIGN.md` flagship Do-line
  updated to match. Done.
- **Blocker 2:** stay at shape-level for now; build Vue only after the impl plan
  exists (writing-plans is next).
- Small Qs: 1 ✅ reuse period-chip · 2 ✅ "เก็บถาวร" · 3 ✅ archived browsable
  read-only + export · 4 ✅ evolve the Promotion Wizard (no parallel wizard) · 5 ✅
  defer storage meter.

Original blocker text kept below for the record.

---

## 🚨 BLOCKER 1 (RESOLVED — A) — The spec contradicted PRODUCT.md head-on

This is the big one. `PRODUCT.md` §"Student Lifecycle (kept deliberately simple)"
**explicitly rejects the exact model we just designed.** Direct quote:

> **One living roster, run endlessly.** The app holds a single rolling roster of
> *currently-enrolled* students — never a separate per-year roster. […]
> A per-year-roster model (duplicating students into each new academic year) **was
> deliberately rejected** — promotion/graduation already give the year roll, history
> is preserved on measurements, and duplication would add id-collision and
> edit-propagation problems for no gain.

And §"Out of Scope" + Don'ts: *"Don't build SIS features (status timelines,
enrolment history)… if it doesn't help measure/track, leave it out."* The product
priority order even ends with **"current data > historical administration."**

The year-based dataset IS the per-year-roster model PRODUCT.md rejected. The two
documented objections are real and we should answer them, not ignore them:

1. **id-collision** — our design answers this: `studentId` stable by intent, copied
   not regenerated. Arguably solved.
2. **edit-propagation** — our design *accepts* non-propagation as a feature (fix a
   typo in 2569, 2568 stays as it was = historical truth). PRODUCT.md frames the
   same behavior as a *defect*. Same mechanism, opposite value judgment. **This is a
   product-philosophy call only you can make.**

**What I need:** a ruling. Three honest options:

- **(A) Supersede PRODUCT.md.** You've changed your mind; snapshot-first is the new
  direction. Then PRODUCT.md §Student Lifecycle + Out-of-Scope + the priority line
  must be rewritten in the same change, or the next session re-derives the old model
  and undoes us. I can draft that rewrite.
- **(B) Keep the rolling roster.** Honor PRODUCT.md; drop the year-dataset redesign;
  instead solve the *original* pain (lost grade history) with the lighter
  measurement-snapshot reads we already discussed — no copy, no archive. Much
  smaller change.
- **(C) Hybrid.** Keep one live roster for the active year (PRODUCT.md intact for
  day-to-day), add **read-only archived year snapshots** taken at promotion time
  purely for history/reporting. Promotion still rolls the live roster forward; it
  *also* freezes a snapshot. Gets historical snapshots without a per-year *editable*
  roster. This may be the real reconciliation.

My read: **(C)** likely satisfies both the new goal and PRODUCT.md's intent, but it
changes our approved spec (archived years become read-only *byproducts* of
promotion, not the primary editable boundary). Your call. Everything below assumes
the approved spec; if you pick B or C I'll revise.

---

## BLOCKER 2 — "craft" means build code; spec isn't plan-approved yet

You asked me to *craft* the UI (impeccable craft = shape → build real Vue). I did
**not** write component code, on purpose:

- The data-model spec is approved as a brainstorm but has **no implementation plan**
  yet (writing-plans is the agreed next step), and
- Blocker 1 could move the whole foundation.

Building `NewYearWizard.vue` etc. now risks throwing it away. So I produced a
**UI shape doc** (design decisions, layouts, copy, component reuse) instead of code.
**Confirm:** want me to proceed to actual Vue implementation once the plan exists,
or keep me at shape-level until you review?

---

## Smaller questions (non-blocking — I picked a default, override if wrong)

1. **Year switcher placement.** The header already shows a `period-chip`
   (📅 ปีการศึกษา 2569) and tapping it is documented to open
   "เปลี่ยนปีการศึกษา/รอบการวัด". I made that chip the year switcher entry point
   (open active year + list archived, read-only). Default: reuse the chip, don't add
   new chrome. OK?

2. **Thai label for "archived".** I used **"เก็บถาวร"** (archived/stored) for status
   and **"ปีที่ผ่านมา (อ่านอย่างเดียว)"** for the read-only banner. Confirm wording —
   you're the Thai-native voice. Alternatives: "ปิดปีแล้ว", "บันทึกถาวร".

3. **Can teachers view an archived year's screens at all,** or only export it?
   I assumed **view (read-only) + export**: they can open old StudentsView/Reports
   for a frozen year, every mutation control hidden, a persistent read-only banner on
   top. Cheaper alternative: archived years are export-only, never browsable. Default
   = browsable read-only. OK?

4. **New-Year wizard = its own flow or fold into existing Promotion Wizard?**
   PRODUCT.md calls the Promotion Wizard "the flagship." Our new-year wizard *is*
   promotion + snapshot. I assumed we **evolve the existing Promotion Wizard** into
   the year-rollover flow (don't build a second parallel wizard — DESIGN.md "two
   doorways not two apps" warns against duplication). Confirm.

5. **Storage-full UX.** localStorage ~5MB; multiple full-roster years can approach
   it. Do you want a visible per-year storage meter + "export & delete old year to
   free space" prompt in this first cut, or defer? Default: **defer** (note it, don't
   build), keep first cut focused.
