// Tema del blog (blog/assets/tema.js): il tema lo decide /tema.js (data-theme su <html>, caricato prima);
// qui resta solo il bottone, che cambia tema e salva la scelta.
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const script = readFileSync(join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'blog', 'assets', 'tema.js'), 'utf8');
const run = () => new Function(script)();
const theme = () => document.documentElement.getAttribute('data-theme');

describe('blog/assets/tema.js', () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.removeAttribute('data-theme');
    document.body.innerHTML = '<button data-theme-toggle hidden></button>';
  });

  afterEach(() => vi.unstubAllGlobals());

  it('non decide il tema da solo: senza data-theme e con il sistema scuro non lo imposta', () => {
    vi.stubGlobal('matchMedia', (q) => ({ matches: q === '(prefers-color-scheme: dark)' }));
    run();
    expect(theme()).toBeNull();
  });

  it('il bottone cambia tema e salva la scelta', () => {
    document.documentElement.setAttribute('data-theme', 'dark');
    run();
    document.dispatchEvent(new Event('DOMContentLoaded'));
    const button = document.querySelector('[data-theme-toggle]');
    expect(button.hidden).toBe(false);
    button.click();
    expect(theme()).toBe('light');
    expect(localStorage.getItem('themeMode')).toBe('light');
    button.click();
    expect(theme()).toBe('dark');
    expect(localStorage.getItem('themeMode')).toBe('dark');
  });
});
