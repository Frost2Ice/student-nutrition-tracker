# Phase 3 Thai DateField — Implementation Report

**Date:** 2026-06-21  
**Status:** DONE

---

## Summary

All four items from the brief (A, B, C, D) are implemented, tested, type-checked, and built successfully.

---

## A. Excel TEXT columns (`src/domain/transfer/xlsx.ts`)

### Change
`aoaToXlsxBlob(aoa, sheetName?, textCols?: number[])` now accepts an optional `textCols` array.  
For each data row (row ≥ 1) and each column index in `textCols`, the SheetJS cell is patched:
```ts
cell.t = 's';   // string type — Excel won't auto-convert on open
cell.z = '@';   // number format TEXT
cell.v = String(cell.v ?? '');
```

### Call sites updated (DOB/วันที่วัด = col 3 in all templates)

| File | Call | textCols |
|---|---|---|
| `ImportView.vue` | `studentClassroomTemplateAoa()` download | `[3]` |
| `StudentsView.vue` | `studentTemplateAoa()` download | `[3]` |
| `StudentsView.vue` | `studentsToAoa(data.students)` export | `[3]` |
| `MeasureView.vue` | `measureTemplateAoa()` download | `[3]` |
| `PromotionView.vue` | `graduatesToAoa(...)` export | `[3]` |

### Test added (`tests/transfer/xlsx.test.ts`)
`aoaToXlsxBlob textCols` — verifies that after applying textCols logic, the target cell has `t === 's'` and `z === '@'`, and the blob is produced correctly.

---

## B. `ThaiDateField.vue` (`src/features/ThaiDateField.vue`)

### New reusable component
- Props: `modelValue: string` (canonical `D/M/YYYY` BE or `''`), `yearMin?: number` (default 2540), `yearMax?: number` (default 2590)
- Emits `update:modelValue` with canonical `D/M/YYYY` BE string, or `''` until all three selects are chosen
- Three inline `<select>` elements: วัน (1–31), เดือนไทย (ม.ค.–ธ.ค., value 1–12), ปี พ.ศ. (descending from yearMax to yearMin)
- Parses `modelValue` on each prop change to populate the selects
- Compact scoped CSS (`tdf-sel`), fits inline in table rows and dialogs

---

## C. ThaiDateField wired into views

### `ImportView.vue`
- Replaced the free-text `<input type="text">` DOB inline fix with `<ThaiDateField :model-value="..." :year-min="2540" :year-max="2590" @update:model-value="..." />`
- The `onDobOverride(rowNum, v)` handler is unchanged — the component emits the same canonical string

### `MeasureView.vue`
- Step 0 session "วันที่วัด" field: replaced `<input v-model="measureDate" placeholder="...">` with `<ThaiDateField v-model="measureDate" :year-min="2555" :year-max="measureYearMax" />`
- Excel preview inline date fix: replaced free-text input with `<ThaiDateField>` using same year range
- `measureYearMax = new Date().getFullYear() + 544` computed once in script (2569 as of 2026)

### `StudentsView.vue`
- Student add/edit dialog วันเกิด: replaced `<input v-model="sForm.dob">` with `<ThaiDateField v-model="sForm.dob" :year-min="2540" :year-max="2590" />`
- Measurement add/edit dialog วันที่วัด: replaced `<input v-model="mForm.date">` with `<ThaiDateField v-model="mForm.date" :year-min="2555" :year-max="measureYearMax" />`
- Validation errors (`sErrors.dob`, `mErrors.date`) still display below the field as before

Dead free-text date inputs removed from all four locations.

---

## D. Normalizer BE-ISO verification (`src/domain/date/thai-date.ts`)

### Finding
The existing `normalizeThaiDate` already handles `'2558-03-15'` correctly:
- ISO path: `parts[0].length === 4` → `n0=2558, n1=3, n2=15` → `buildAndValidate(15, 3, 2558, false)`
- `resolveYearToBE(2558)`: `y >= 2400` → returns `{ year: 2558, wasConverted: false }` (no +543)
- Result: `{ value: '15/3/2558', converted: true }` (converted:true because non-slash separator)

**No code change required.** The year 3101 bug does NOT exist in the current code.

### Test added (`tests/domain/thai-date.test.ts`)
```ts
it('converts BE-ISO 2558-03-15 to 15/3/2558 (NOT 3101)', () => {
  const r = normalizeThaiDate('2558-03-15');
  expect(r!.value).toBe('15/3/2558');
  expect(r!.value).not.toContain('3101');
});
```

---

## Verification

### Tests
```
Test Files  14 passed (14)
Tests       151 passed (151)
```

### Type-check
```
npx vue-tsc --noEmit   →  (no output, clean)
```

### Build
```
npm run build  →  dist/index.html 874.51 kB | gzip: 297.05 kB  ✓ built in 1.25s
```

### Playwright screenshots
- `.playwright-mcp/datefield-form.png` — Student add dialog showing ThaiDateField วัน/เดือน/ปีพ.ศ. dropdowns for วันเกิด
- `.playwright-mcp/datefield-import.png` — Import wizard step 1 (grade/room selected, ready for file upload with TEXT-formatted template)

---

## Files changed

| File | Change |
|---|---|
| `src/domain/transfer/xlsx.ts` | Added `textCols` param to `aoaToXlsxBlob` |
| `src/features/ThaiDateField.vue` | **New** — reusable BE date picker component |
| `src/features/ImportView.vue` | Import ThaiDateField; replace inline DOB text input; pass `[3]` textCols to template download |
| `src/features/MeasureView.vue` | Import ThaiDateField; replace session date input and inline date fix; pass `[3]` textCols to template download |
| `src/features/StudentsView.vue` | Import ThaiDateField; replace student DOB and measure date inputs; pass `[3]` textCols to exports |
| `src/features/PromotionView.vue` | Pass `[3]` textCols to graduates export |
| `tests/transfer/xlsx.test.ts` | Added `aoaToXlsxBlob textCols` test |
| `tests/domain/thai-date.test.ts` | Added BE-ISO `normalizeThaiDate('2558-03-15')` regression test |
