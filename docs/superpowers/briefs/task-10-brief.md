## Task 10: Full suite + build green checkpoint

**Files:** none (verification only).

- [ ] **Step 1: Run the whole test suite**

Run: `npm test`
Expected: all tests PASS.

- [ ] **Step 2: Type-check the project**

Run: `npx vue-tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Build the single file**

Run: `npm run build`
Expected: `dist/index.html` produced, single self-contained file.

---

## Self-Review (completed)

- **Spec coverage:** Build/offline (§2) → Task 1. Data model (§4) → Task 2. Date logic (§5, §6.1) → Task 3. Validation single-source + precision (§4, §6.1) → Task 4. Grade ladder (§7.2) → Task 5. Reference data port (§5, §8) → Task 6. Reference lookup ±6mo (FR-5.6) → Task 7. Engine + consistency (§5, §6.2) → Task 8. Latest-per-student (FR-5.7) → Task 9. Phases 3–9 (UI, persistence, promotion, import, reports) are intentionally out of this plan and get their own plans.
- **Placeholder scan:** none — all steps carry real code/commands.
- **Type consistency:** `AgeRef` defined in Task 6, re-exported via Task 7, consumed by Task 8 with identical field names (`sd2w/sd15w/sd15pw/sd2pw/sd2h/sd15h/sd15ph/sd2ph`). `Measurement.savedAt`/`studentId` consistent across Tasks 2/8/9. Label union types in Task 8 match the band order in the legacy engine.
