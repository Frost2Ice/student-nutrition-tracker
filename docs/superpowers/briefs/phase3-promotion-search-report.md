# Phase 3 Promotion Search — Implementation Report

**Date:** 2026-06-21  
**Status:** DONE

## What Was Done

Replaced the full-school per-student list in the ตรวจสอบ step of `PromotionView.vue` with a
search-first UI, as specified in `phase3-promotion-search-brief.md`.

## Changes Made

**File:** `src/features/PromotionView.vue`

### Script changes

Removed:
- `adjustList` computed (mapped all students with decisions)
- `filteredAdjust` computed (filtered all students by search query)

Added:
- `searchQ` ref — search box text
- `selectedId` ref — currently selected student ID
- `searchResults` computed — matches up to 20 students by ID or name when query is non-empty
- `selectedStudent` computed — resolves the selected student object
- `selectStudent(id)` — sets selectedId, clears search box
- `clearSelection()` — clears selectedId
- `resetDecision(id)` — removes an explicit override from decisions map
- `overrideList` computed — students with an explicit override (for "ปรับแล้ว N คน" summary)
- `repeatCount` — now derived from `overrideList` (explicit repeat overrides only, not default)

### Template changes (step i === 2)

Removed the full-school per-student list rendered via `v-for="s in filteredAdjust"`.

Added three conditional sections inside the "ปรับรายคน (กรณีพิเศษ)" panel:
1. **Search box + results** (shown when no student selected): empty box shows nothing; typing
   shows up to 20 matching student cards with "เลือก →" / "ปรับแล้ว" badge indicators.
2. **Override controls** (shown when a student is selected): name/ID/grade info, action buttons
   (เลื่อนปกติ / ซ้ำชั้น / จบการศึกษา), ห้องใหม่ picker (room buttons from structure, fallback
   free input), "บันทึกและปิด" and "ยกเลิกการปรับ" buttons.
3. **Override summary** ("ปรับแล้ว N คน"): list of all explicitly overridden students with
   แก้ไข (re-opens override controls) and ยกเลิก (removes override) actions.

## Verification

| Check | Result |
|-------|--------|
| `npx vue-tsc --noEmit` | Clean (no output) |
| `npm test` (167 tests) | All passed |
| `npm run build` | Success — 929.98 kB gzip 316.01 kB |
| Playwright screenshot | `.playwright-mcp/promotion-search.png` |

## Playwright Verification

Navigated to `:5173` → เลื่อนชั้นปีใหม่ → completed backup step → ตรวจสอบ step shows:
- Grouped summary table (อ.1–ป.6 with counts)
- No full-school list (removed)
- "ปรับรายคน (กรณีพิเศษ)" panel with empty search box

Searched "ชัยวัฒน์" → four matching students appeared. Selected ชัยวัฒน์ บุญมา (อ.1) →
override controls appeared. Clicked ซ้ำชั้น → saved. Result:
- Summary updated to "รวม: เลื่อน 122 คน · คงชั้นเดิม 1 คน · จบการศึกษา 10 คน"
- "ปรับแล้ว 1 คน" section appeared showing ชัยวัฒน์ บุญมา อ.1 with ซ้ำชั้น badge

## What Was Kept Unchanged

- Grouped summary (previewRows table + callout with counts)
- Backup step (step i === 1)
- Graduate export step (step i === 3, required, blocks next)
- Confirm/apply step (step i === 4, `confirm()` function unchanged)
- Success screen (step i === 5)
- `planPromotion`, `applyPromotion`, `decisions` map logic
- `promote as promoteGrade` usage in grade display
