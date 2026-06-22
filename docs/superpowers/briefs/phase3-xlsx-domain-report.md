# Phase 3 — xlsx Domain Module: Implementation Report

## Status: DONE

## Summary

The xlsx domain module has been implemented in full per the brief. All verification
steps pass cleanly with no regressions.

---

## Files Created / Modified

| File | Action |
|---|---|
| `src/domain/transfer/xlsx.ts` | Created — full xlsx module |
| `tests/transfer/xlsx.test.ts` | Created — 9 tests |
| `src/domain/report/summary.ts` | Modified — added `summaryToAoa` |

---

## API Implemented (`src/domain/transfer/xlsx.ts`)

**Constants**
- `STUDENT_HEADERS` — 7-element Thai header tuple
- `MEASURE_HEADERS` — 4-element Thai header tuple

**Pure AOA builders (no SheetJS needed)**
- `studentTemplateAoa()` → `string[][]` with header + sample row
- `measureTemplateAoa()` → `string[][]` with header + sample row
- `studentsToAoa(students)` → header + one row per student
- `graduatesToAoa(students)` → same columns (delegates to studentsToAoa)

**SheetJS wrappers**
- `aoaToXlsxBlob(aoa, sheetName?)` → `Blob` (xlsx mime type)
- `readXlsxToAoa(buf: ArrayBuffer)` → `string[][]` (all cells trimmed strings)

**Parsers**
- `parseStudentAoa(aoa)` — skips missing id / missing ชื่อ; defaults gender to ชาย
- `parseMeasureAoa(aoa, period)` — validates weight/height/date via domain rules; stamps period, `savedAt`, empty `gradeAtMeasure`/`roomAtMeasure`

**Merge helpers (mirror csv.ts semantics)**
- `mergeStudents(store, rows)` → `{ added, updated }`
- `mergeMeasures(store, rows)` → `{ added, skippedDup, orphans }` — fills `gradeAtMeasure`/`roomAtMeasure` from matched student

**`MergeStore` interface** exported for store/UI layer wiring.

## summary.ts Addition

`summaryToAoa(setup, summary, year, term): (string|number)[][]`

Produces the same content as `toSummaryCsv` (school/province/year/term meta,
per-bucket counts, by-grade rows, totals row, percentage row, source citation)
as an AOA suitable for `aoaToXlsxBlob`. `toSummaryCsv` is untouched.

---

## Test Results

```
Test Files  15 passed (15)
     Tests  126 passed (126)   (+9 new xlsx tests)
  Duration  3.56s
```

New xlsx tests cover:
1. `studentTemplateAoa()[0]` equals `STUDENT_HEADERS`
2. `measureTemplateAoa()[0]` equals `MEASURE_HEADERS`
3. `studentsToAoa` emits correct header + row
4. `parseStudentAoa` skips missing id (row 2, reason set)
5. `parseStudentAoa` skips missing ชื่อ
6. `parseStudentAoa` defaults gender to ชาย when blank
7. `parseMeasureAoa` skips invalid weight 999 at row 2
8. Round-trip: `readXlsxToAoa(XLSX.write(...studentTemplateAoa...))` → headers as strings
9. `aoaToXlsxBlob` returns Blob with correct mime type

---

## Type-check

`npx vue-tsc --noEmit` — clean (zero errors, zero warnings).

---

## Build

`npm run build` — succeeded.

```
dist/index.html  481.08 kB │ gzip: 166.95 kB
```

SheetJS was already installed and bundles cleanly into the single-file output.
No measurable bundle size delta was observable because SheetJS was already a
dependency prior to this task (it was just unused in the bundle). The inlined
output is 481 kB (gzip: 167 kB).

---

## Non-Breaking Guarantees

- `csv.ts` untouched — `toCsv`, `parseImport`, `mergeImport`, `toSummaryCsv` all unchanged.
- `backup.ts` untouched.
- No new `noUnusedLocals` violations introduced.
- Dev server not started or killed.
- No git operations performed.
