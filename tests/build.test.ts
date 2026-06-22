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
