// Tema delle pagine statiche (privacy, termini, 404): public/tema.js legge themeMode dal localStorage,
// come l'app e il blog; senza scelta vale la preferenza del sistema (scuro solo se la chiede).
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const script = readFileSync(join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'public', 'tema.js'), 'utf8');
const run = () => new Function(script)();

describe('public/tema.js', () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.removeAttribute('data-theme');
  });

  const system = (dark) => vi.stubGlobal('matchMedia', (q) => ({ matches: dark && q === '(prefers-color-scheme: dark)' }));

  it('senza scelta salvata e sistema chiaro la pagina è chiara', () => {
    system(false);
    run();
    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
    vi.unstubAllGlobals();
  });

  it('senza scelta salvata e sistema scuro la pagina è scura', () => {
    system(true);
    run();
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
    vi.unstubAllGlobals();
  });

  it('la scelta salvata chiara vince sul sistema scuro', () => {
    system(true);
    localStorage.setItem('themeMode', 'light');
    run();
    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
    vi.unstubAllGlobals();
  });

  it('con themeMode = dark la pagina è scura', () => {
    localStorage.setItem('themeMode', 'dark');
    run();
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
  });

  it('un valore sconosciuto è come nessuna scelta: sistema chiaro, chiaro', () => {
    localStorage.setItem('themeMode', 'blu');
    system(false);
    run();
    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
    vi.unstubAllGlobals();
  });

  it('con lo storage bloccato resta chiaro', () => {
    const spy = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('bloccato'); });
    run();
    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
    spy.mockRestore();
  });
});
