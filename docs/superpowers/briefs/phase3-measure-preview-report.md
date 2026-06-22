# Phase 3 — Measurement Import Preview: Report

## Status: DONE

---

## What was built

### 1. `parseMeasureImport` — TDD (src/domain/transfer/xlsx.ts)

New exported interface and function mirroring the `parseStudentImport` pattern:

```ts
export interface MeasureImportPreviewRow {
  rowNum: number;
  id: string; weightRaw: string; heightRaw: string; dateRaw: string;
  name: string;
  issues: { message: string; severity: 'error' | 'warn' }[];
  status: 'ok' | 'dup' | 'error';
  measure: Measurement | null;
}

export function parseMeasureImport(
  aoa, period, students, hasDup, overrides?
): { rows: MeasureImportPreviewRow[]; counts: { ok, dup, error } }
```

Validation rules implemented per brief:
- Empty id → error `ไม่มีรหัสนักเรียน`
- Student not found → error `ไม่พบรหัสนักเรียนนี้ในระบบ`, name = ''
- `validateWeight` / `validateHeight` → error with message
- `normalizeThaiDate` fails → error `อ่านวันที่วัดไม่ได้ — แก้ไขในช่องด้านล่าง`
- Date normalized + `validateThaiDate(false)` range check
- `normDate.converted` → warn `ปรับรูปแบบวันที่ให้อัตโนมัติ`
- No errors + `hasDup(id)` → status `dup`, warn `มีผลของรอบนี้แล้ว — จะข้ามแถวนี้`, measure null
- No errors + not dup → status `ok`, full `Measurement` built with `round1`, `gradeAtMeasure`/`roomAtMeasure` from matched student
- Overrides map (date/weight/height per rowNum) applied before validation
- `round1` imported from rules.ts (was not previously imported in xlsx.ts)

### 2. TDD cycle (tests/transfer/xlsx.test.ts)

8 new test cases appended, all written **before** implementation:

| Test | Scenario |
|------|----------|
| clean row | status ok, measure built, gradeAtMeasure correct, name set |
| bad weight 999 | status error, issue message contains น้ำหนัก |
| orphan id | status error, `ไม่พบรหัสนักเรียนนี้ในระบบ`, name = '' |
| CE date auto-convert | status ok + warn `ปรับรูปแบบวันที่ให้อัตโนมัติ`, date = BE |
| dup id | status dup, measure null, warn message |
| mixed counts | ok/dup/error tallied correctly |
| override replaces date | bad-date → error; with override → ok |
| empty id | error `ไม่มีรหัสนักเรียน` |

All 8 were confirmed RED (TypeError: function not found) before implementation.

### 3. MeasureView.vue — Excel mode rewrite (src/features/MeasureView.vue)

Replaced the old `xlsxRows`/`xlsxSkipped` state with:
- `xlsxPreviewRows: MeasureImportPreviewRow[]`
- `xlsxCounts: { ok, dup, error }`
- `xlsxLastAoa`, `xlsxOverrides` (Map of per-row overrides)
- `runMeasureParse()` — calls `parseMeasureImport` reactively
- `onDateOverride(rowNum, date)` — updates overrides map + re-runs parse
- `canConfirmXlsx` — disabled when ok === 0

Step 3 preview table:
- Summary callout: `พร้อมบันทึก {ok} · ข้าม(มีผลแล้ว) {dup} · มีปัญหา {error}`
- Columns: แถว / รหัส / ชื่อ / น้ำหนัก / ส่วนสูง / วันที่ / สถานะ
- Row highlight: error → `bad-tint`, dup → `warn-tint`, ok → transparent
- Status pill: ✓ พร้อม / ⏭️ ข้าม / ⚠️ ปัญหา
- Issue messages rendered below pill
- Inline date input shown when row has `อ่านวันที่วัด` error; live re-validates on `@input`
- Confirm button `บันทึกผลการวัด {ok} รายการ` disabled when ok=0
- Confirm calls `mergeMeasures(store, okRows.map(r=>r.measure!))` then advances to done

Unused import `Measurement` removed to satisfy `noUnusedLocals`.

---

## Verification

| Check | Result |
|-------|--------|
| `npm test` | 149/149 passed (14 test files) |
| `npx vue-tsc --noEmit` | Clean |
| `npm run build` | 871.92 kB dist/index.html |
| Browser preview (4 statuses) | ✓ ok / ⚠️ error / warn-auto-date / ⏭️ dup all shown |
| Inline date fix flips to พร้อม | count 1→2 ok, 1→0 error live |
| Confirm saves only ok rows | mergeMeasures called with ok rows only |

### Screenshots
- `.playwright-mcp/measure-preview.png` — 4-row preview with all status variants
- `.playwright-mcp/measure-inlinefix.png` — after inline date fix, both rows show ✓ พร้อม

---

## Files modified

- `src/domain/transfer/xlsx.ts` — added `MeasureImportPreviewRow` interface + `parseMeasureImport` function; added `round1` to import
- `src/features/MeasureView.vue` — rewired Excel mode (step 2→3) to preview + inline fix; removed unused `Measurement` import
- `tests/transfer/xlsx.test.ts` — appended 8 `parseMeasureImport` test cases + import of `parseMeasureImport`
- `docs/superpowers/briefs/phase3-measure-preview-report.md` — this file
