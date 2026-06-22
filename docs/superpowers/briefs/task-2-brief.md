## Task 2: Domain types

**Files:**
- Create: `src/domain/types.ts`

**Interfaces:**
- Produces:
  ```ts
  type Gender = 'ชาย' | 'หญิง';
  type Term = '1' | '2';
  type Round = '1' | '2';
  interface Student { id: string; firstName: string; lastName: string; dob: string; gender: Gender; grade: string; room: string; }
  interface Measurement { studentId: string; year: string; term: Term; round: Round; date: string; weightKg: number; heightCm: number; savedAt: number; }
  interface Setup { school: string; ministry: string; department: string; subdistrict: string; district: string; province: string; teacher: string; maxGrade: string; }
  ```

- [ ] **Step 1: Create `src/domain/types.ts`**

```ts
export type Gender = 'ชาย' | 'หญิง';
export type Term = '1' | '2';
export type Round = '1' | '2';

export interface Student {
  id: string;
  firstName: string;
  lastName: string;
  dob: string; // Thai BE D/M/YYYY
  gender: Gender;
  grade: string;
  room: string;
}

export interface Measurement {
  studentId: string;
  year: string;
  term: Term;
  round: Round;
  date: string; // Thai BE D/M/YYYY
  weightKg: number;
  heightCm: number;
  savedAt: number; // epoch ms tie-breaker
}

export interface Setup {
  school: string;
  ministry: string;
  department: string;
  subdistrict: string;
  district: string;
  province: string;
  teacher: string;
  maxGrade: string;
}
```

- [ ] **Step 2: Type-check**

Run: `npx vue-tsc --noEmit`
Expected: no errors.

---

