// Tema del blog (blog/assets/tema.js): scelta salvata, altrimenti preferenza del sistema; il bottone salva la scelta.
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const script = readFileSync(join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'blog', 'assets', 'tema.js'), 'utf8');
const run = () => new Function(script)();
const theme = () => document.documentElement.getAttribute('data-theme');
const system = (dark) => vi.stubGlobal('matchMedia', (q) => ({ matches: dark && q === '(prefers-color-scheme: dark)' }));

describe('blog/assets/tema.js', () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.removeAttribute('data-theme');
    vi.unstubAllGlobals();
  });

  it('senza scelta e sistema scuro è scuro', () => {
    system(true);
    run();
    expect(theme()).toBe('dark');
  });

  it('senza scelta e sistema chiaro è chiaro', () => {
    system(false);
    run();
    expect(theme()).toBe('light');
  });

  it('la scelta salvata vince sul sistema', () => {
    system(true);
    localStorage.setItem('themeMode', 'light');
    run();
    expect(theme()).toBe('light');
  });

  it('il bottone cambia tema e salva la scelta', () => {
    system(true);
    document.body.innerHTML = '<button data-theme-toggle hidden></button>';
    run();
    document.dispatchEvent(new Event('DOMContentLoaded'));
    document.querySelector('[data-theme-toggle]').click();
    expect(theme()).toBe('light');
    expect(localStorage.getItem('themeMode')).toBe('light');
  });
});
