## Task 1: Project scaffold + single-file build proof

**Files:**
- Create: `package.json`, `tsconfig.json`, `vite.config.ts`, `vitest.config.ts`, `index.html`, `src/main.ts`, `src/App.vue`
- Test: `tests/build.test.ts`

**Interfaces:**
- Produces: working `npm run dev`, `npm run build` (emits single `dist/index.html`), `npm test` (Vitest).

- [ ] **Step 1: Create `package.json`**

```json
{
  "name": "nutrition-tracker",
  "private": true,
  "version": "2.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vue-tsc --noEmit && vite build",
    "preview": "vite preview",
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "dependencies": {
    "chart.js": "^4.4.1",
    "pinia": "^2.1.7",
    "vue": "^3.4.0"
  },
  "devDependencies": {
    "@vitejs/plugin-vue": "^5.0.0",
    "typescript": "^5.4.0",
    "vite": "^5.2.0",
    "vite-plugin-singlefile": "^2.0.1",
    "vitest": "^1.5.0",
    "vue-tsc": "^2.0.0"
  }
}
```

- [ ] **Step 2: Create `tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2017",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "strict": true,
    "noUnusedLocals": true,
    "noImplicitReturns": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "lib": ["ES2017", "DOM", "DOM.Iterable"],
    "types": ["vitest/globals"]
  },
  "include": ["src", "tests"]
}
```

- [ ] **Step 3: Create `vite.config.ts`**

```ts
import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import { viteSingleFile } from 'vite-plugin-singlefile';

export default defineConfig({
  plugins: [vue(), viteSingleFile()],
  build: { target: 'es2017', cssCodeSplit: false, assetsInlineLimit: 100000000 },
});
```

- [ ] **Step 4: Create `vitest.config.ts`**

```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: { globals: true, environment: 'node', include: ['tests/**/*.test.ts'] },
});
```

- [ ] **Step 5: Create `index.html`**

```html
<!DOCTYPE html>
<html lang="th">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>ระบบติดตามภาวะโภชนาการนักเรียน</title>
  </head>
  <body>
    <div id="app"></div>
    <script type="module" src="/src/main.ts"></script>
  </body>
</html>
```

- [ ] **Step 6: Create `src/App.vue`**

```vue
<script setup lang="ts"></script>

<template>
  <main style="font-family: 'Sarabun','Leelawadee UI','Tahoma',sans-serif">
    ระบบติดตามภาวะโภชนาการนักเรียน
  </main>
</template>
```

- [ ] **Step 7: Create `src/main.ts`**

```ts
import { createApp } from 'vue';
import { createPinia } from 'pinia';
import App from './App.vue';

createApp(App).use(createPinia()).mount('#app');
```

- [ ] **Step 8: Install dependencies**

Run: `npm install`
Expected: completes, creates `node_modules/` and `package-lock.json`.

- [ ] **Step 9: Write the single-file build assertion test**

```ts
// tests/build.test.ts
import { existsSync, readFileSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { describe, it, expect } from 'vitest';

describe('single-file build', () => {
  it('emits one self-contained index.html with no external script/link refs', () => {
    execSync('npm run build', { stdio: 'inherit' });
    const path = 'dist/index.html';
    expect(existsSync(path)).toBe(true);
    const html = readFileSync(path, 'utf8');
    // no external bundle references — everything inlined
    expect(html).not.toMatch(/<script[^>]+src="\.?\/assets/);
    expect(html).not.toMatch(/<link[^>]+href="\.?\/assets/);
    expect(html).toContain('ระบบติดตามภาวะโภชนาการนักเรียน');
  });
});
```

- [ ] **Step 10: Run the build test**

Run: `npx vitest run tests/build.test.ts`
Expected: PASS (build succeeds, single inlined file present).

- [ ] **Step 11: Checkpoint**

Run: `npm test`
Expected: all tests PASS.

---

