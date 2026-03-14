import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');

// ── CSS content (PRD-004 dark mode) ─────────────────────────

describe('docs-ui CSS', () => {
  const css = readFileSync(resolve(root, 'src/docs-ui.css'), 'utf-8');

  it('contains prefers-color-scheme: dark media query', () => {
    expect(css).toContain('prefers-color-scheme: dark');
  });

  it('contains --bg-primary CSS custom property', () => {
    expect(css).toContain('--bg-primary');
  });

  it('contains HTTP POST accent color #49cc90', () => {
    expect(css).toContain('#49cc90');
  });

  it('contains HTTP GET accent color #61affe', () => {
    expect(css).toContain('#61affe');
  });

  it('contains HTTP DELETE accent color #f93e3e', () => {
    expect(css).toContain('#f93e3e');
  });
});

// ── JS module exports ───────────────────────────────────────

describe('docs-ui JS module', () => {
  it('exports init as a function', async () => {
    const mod = await import('../src/docs-ui.js');
    expect(typeof mod.init).toBe('function');
  });
});

// ── Build output (requires `vite build` before running) ─────

describe('docs-ui build output', () => {
  it('produces dist/docs-ui.js', () => {
    expect(existsSync(resolve(root, 'dist/docs-ui.js'))).toBe(true);
  });

  it('produces dist/docs-ui.css', () => {
    expect(existsSync(resolve(root, 'dist/docs-ui.css'))).toBe(true);
  });
});
