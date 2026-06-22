# Forgiving Excel date import — absorb Excel's date quirks

Problem: teacher downloads the .xlsx template, edits only a name, re-imports → fails with "invalid
BE year". Cause: Excel rewrites the date cell on save (serial number / CE date / locale reformat),
so it's no longer `D/M/YYYY` พ.ศ. and `validateThaiDate` rejects it. Make import forgiving: auto-detect
+ convert common date forms; if impossible, explain in plain Thai and let the teacher fix the row
IN-APP (no Excel troubleshooting).

## Global constraints
- `noUnusedLocals`. No git. No server start/kill (:5173). Editor tools only, no heredoc/echo.
- Canonical internal date stays `D/M/YYYY` พ.ศ. (BE). Validation via `rules.ts`.
- .xlsx only. Don't change backup (JSON).

## 1. Domain — `normalizeThaiDate` (TDD), in `src/domain/date/thai-date.ts`
```ts
export function normalizeThaiDate(input: string | number | Date): { value: string; converted: boolean } | null
```
Return canonical `D/M/YYYY` BE + whether a conversion happened; `null` if uninterpretable.
- `Date` → `formatThaiDate(date)` (already BE), converted:true.
- `number` (Excel serial; epoch 1899-12-30) → JS Date → `formatThaiDate`, converted:true.
- `string`: trim; if empty → null. Split on `/ . -` or spaces. Cases:
  - 3 numeric parts `a/b/c`:
    - ISO when first part is 4 digits (`YYYY-MM-DD`) → reorder to d/m/y.
    - else treat as D/M/Y (Thai order).
    - year: 4-digit ≥2400 → BE as-is (converted:false if input already `D/M/YYYY` BE with that
      separator, else converted:true); 4-digit 1900–2200 → CE, +543 → BE, converted:true;
      2-digit → assume CE 20xx → +543, converted:true.
    - zero-pad not required; output unpadded `d/m/yyyy`.
  - Thai month name present (`มกราคม…ธันวาคม` and abbrev `ม.ค. ก.พ. มี.ค. เม.ย. พ.ค. มิ.ย. ก.ค. ส.ค.
    ก.ย. ต.ค. พ.ย. ธ.ค.`) → map to 1–12; parse `D <month> YYYY`; year rule as above; converted:true.
  - else → null.
- After building `d/m/yyyy` BE, sanity-check month 1–12, day 1–31, real calendar day; if invalid → null.
- Tests (append `tests/domain/thai-date.test.ts`): `'15/3/2558'`→{value:'15/3/2558',converted:false};
  `'15/3/2015'`(CE)→'15/3/2558' converted; `'2015-03-15'`→'15/3/2558'; a Date(2015,2,15)→'15/3/2558';
  Excel serial for 15 Mar 2015 → '15/3/2558'; `'15 มี.ค. 2558'`→'15/3/2558'; `'31/2/2558'`→null; junk→null.

## 2. Read dates from Excel — `readXlsxToAoa` (`src/domain/transfer/xlsx.ts`)
- `XLSX.read(buf, { type: 'array', cellDates: true })` so date-formatted cells come back as JS `Date`.
- In coercion: if a cell is a `Date`, output `formatThaiDate(cell)` (BE string); else trimmed string.
  (Numbers that are really serials but untyped stay strings/numbers → `normalizeThaiDate` handles them.)

## 3. Use the normalizer in parsing
`parseStudentImport` (dob) and `parseMeasureAoa` (วันที่วัด): before `validateThaiDate`, run the raw
value through `normalizeThaiDate`:
- `null` → error: dob `'อ่านวันเกิดไม่ได้ — แก้ไขในช่องด้านล่าง หรือใช้รูปแบบ วัน/เดือน/ปีพ.ศ.'`;
  measure date similar wording.
- success → use `norm.value`; if `converted` add a `warn` issue `'ปรับรูปแบบวันที่ให้อัตโนมัติ'`
  (informational — NOT an error). Then run `validateThaiDate` on the normalized value for RANGE checks
  (e.g. birth-year window); a range failure is an error with that message.
- Net effect: the unmodified system template round-trips with status ok (auto-converted, no error).

## 4. In-app inline fix (preview) — `parseStudentImport` overrides + `ImportView.vue`
- Add optional 4th arg: `parseStudentImport(aoa, ctx, existingIds, overrides?: Map<number, { dob?: string }>)`
  — when an override exists for a rowNum, use the override `dob` (run it through the same
  normalize+validate path) instead of the file value.
- ImportView preview: for any row whose issues include a date problem, render an inline date input
  (prefilled with the row's current dob) right in the row. On change, set
  `overrides.set(rowNum, { dob })` and re-run `parseStudentImport` → the row re-validates live,
  status + summary counts update. So teachers fix bad dates without reopening Excel.
- Keep the existing highlight/summary/disabled-confirm behavior.

## 5. Mirror for measurement import (`MeasureView.vue` Excel step)
- Use `normalizeThaiDate` for วันที่วัด the same way (auto-convert; clear message if not possible).
  Inline-fix optional here (at minimum: auto-convert + clear skipped-row reason).

## Verify
- `npx vue-tsc --noEmit` clean; `npm test` green (incl normalize tests); `npm run build` ok.
- On :5173: import the official template with ONLY a name changed (dates as Excel re-saved them) →
  imports cleanly (auto-converted, no error). Import a genuinely bad date → row flagged with plain
  message + inline date field; fixing it in the preview flips the row to พร้อม and enables import.
  Screenshots `.playwright-mcp/dates-autoconvert.png`, `.playwright-mcp/dates-inlinefix.png`.

## Report contract
Write full report to `docs/superpowers/briefs/phase3-forgiving-dates-report.md`. Return short
summary + status.
