# Phase 3 Task 4 Report — Swap entry to the real App shell

## Status
DONE

## Files Changed
- **Created**: `src/AppShell.vue`
- **Modified**: `src/main.ts`

## What was done

### `src/AppShell.vue`
Ported `ProtoShell.vue` template and logic, with the following changes per brief:

1. **Demo ribbon removed** — the `.proto-ribbon` block and its `setUp` checkbox are gone.
2. **Pinia store wired** — `const data = useData()`. School name, period line, and welcome gate all read from the store.
   - `data.setup.school` → sidebar brand sub-line
   - `data.period.{year,term,round}` → `periodLine` computed for sidebar chip; `periodShort` computed for topbar chip
   - `v-if="!data.isSetup"` drives the welcome gate (replaces `setUp` ref)
3. **All `./mock` imports removed** — no prototype mock data at all.
4. **Prototype journey components removed** — `HomeDashboard`, `StudentProfileView`, `MeasureJourney`, `ReportsView`, `SettingsView`, `OnboardingJourney`, `ImportJourney`, `PromotionJourney` not imported.
5. **Placeholder views** — the `<Transition>` content host renders a single `<div class="container">` with `destLabel` (computed from nav) and "(กำลังพัฒนา)"; similarly for each overlay (`onboarding`/`import`/`promotion`).
6. **`dest`, `overlay`, `go()` kept exactly** — shape matches what later tasks (5–15) depend on.
7. **`finishOnboarding` removed** — was unused (placeholder overlays don't emit events); removing it satisfies `noUnusedLocals`.
8. **Restore path stub** — "เลือกไฟล์สำรอง" button in the restore panel has no `@click` handler (stub); the close button returns to the choose screen as in the prototype.

### `src/main.ts`
Replaced `ProtoShell` import with `AppShell`; mount call unchanged: `createApp(AppShell).use(createPinia()).mount('#app')`.

## Verification

### Type-check
```
npx vue-tsc --noEmit   → exit 0 (no output)
```

### Build
```
npm run build
→ vite v5.4.21, 36 modules, dist/index.html 112.82 kB (gzip: 45.00 kB)
→ exit 0
```

### Runtime (localhost:5173)
With an empty store (`isSetup = false`), the welcome screen renders with both choice cards. Clicking "เริ่มใช้งานครั้งแรก" opens the onboarding overlay placeholder. The full app shell (sidebar/topbar/bottomnav) is reachable once Task 5 saves a school name.

No browser screenshot taken (browser tools not invoked — tsc + build clean is the stated fallback).
