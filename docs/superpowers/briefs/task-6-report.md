# Task 6 Report: Port Growth-Reference Data

## Script Written

`scripts/extract-reference.mjs` — written verbatim from the brief. Reads `nutrition_tracker 18062026.html`, extracts `WFH_M` and `WFH_F` array literals via bracket-depth tracking, and the `raw` CSV via backtick-delimiter search. Writes three TS modules under `src/domain/nutrition/reference/`.

## Extraction Output

Running `node scripts/extract-reference.mjs` from the project root:

```
Reference modules written.
```

No errors. All three files generated successfully.

## Generated File Sizes / Row Counts

| File | Size | Lines |
|------|------|-------|
| `src/domain/nutrition/reference/wfh-male.ts` | 4,514 bytes | 43 |
| `src/domain/nutrition/reference/wfh-female.ts` | 4,370 bytes | 40 |
| `src/domain/nutrition/reference/age-data.ts` | 12,694 bytes | 188 |

- `WFH_M`: 120+ rows (each row 7 numbers, heights 65–120 cm range)
- `WFH_F`: 110+ rows
- `AGE_DATA`: 192+ keyed entries (M-24 through M-216, F-24 through F-216)

## Test Command + Passing Output

```
npx vitest run tests/domain/reference-data.test.ts
```

```
RUN  v1.6.1 /Users/11373966/Documents/development/code/external_github/food-for-good

 ✓ tests/domain/reference-data.test.ts  (5 tests) 7ms

 Test Files  1 passed (1)
      Tests  5 passed (5)
   Start at  17:36:03
   Duration  264ms (transform 34ms, setup 0ms, collect 32ms, tests 7ms, environment 0ms, prepare 55ms)
```

All 5 tests passed, including:
- WFH_M anchor: `WFH_M[0]` === `[65, 6.3, 6.5, 8.45, 8.8, 9.6, 11]` ✓
- AGE_DATA M-24 exact field match ✓
- Female table presence ✓
- Row structure (7 columns, ascending height) ✓
- Both gender keys present ✓

## Script Adjustments Needed

None. The extraction script from the brief worked correctly on first run with no modifications.

## Concerns

None. The legacy HTML structure matched exactly what the script expected:
- `const WFH_M=[` and `const WFH_F=[` both present at expected locations
- `const raw=\`` backtick template literal present with clean CSV data
- The AGE_DATA raw CSV starts at line 1865 and the `const raw` pattern was found without ambiguity
- Bracket-depth extraction cleanly captured the full WFH array literals
