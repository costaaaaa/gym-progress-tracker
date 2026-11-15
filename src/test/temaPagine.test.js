// Tema delle pagine statiche (privacy, termini, 404) e dell'app: public/tema.js legge themeMode dal localStorage;
// senza scelta vale la preferenza del sistema (scuro solo se la chiede).
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const script = readFileSync(join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'public', 'tema.js'), 'utf8');
const run = () => new Function(script)();
const theme = () => document.documentElement.getAttribute('data-theme');
const system = (dark) => vi.stubGlobal('matchMedia', (q) => ({ matches: dark && q === '(prefers-color-scheme: dark)' }));

describe('public/tema.js', () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.removeAttribute('data-theme');
  });
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('senza scelta salvata e sistema chiaro la pagina è chiara', () => {
    system(false);
    run();
    expect(theme()).toBe('light');
  });

  it('senza scelta salvata e sistema scuro la pagina è scura', () => {
    system(true);
    run();
    expect(theme()).toBe('dark');
  });

  it('la scelta salvata scura vince sul sistema chiaro', () => {
    system(false);
    localStorage.setItem('themeMode', 'dark');
    run();
    expect(theme()).toBe('dark');
  });

  it('la scelta salvata chiara vince sul sistema scuro', () => {
    system(true);
    localStorage.setItem('themeMode', 'light');
    run();
    expect(theme()).toBe('light');
  });

  it('un valore sconosciuto è come nessuna scelta: segue il sistema', () => {
    localStorage.setItem('themeMode', 'blu');
    system(true);
    run();
    expect(theme()).toBe('dark');
  });

  it.each([[true, 'dark'], [false, 'light']])('con lo storage bloccato segue il sistema (scuro: %s)', (dark, expected) => {
    system(dark);
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('bloccato'); });
    run();
    expect(theme()).toBe(expected);
  });

  it('senza matchMedia resta chiaro', () => {
    vi.stubGlobal('matchMedia', undefined);
    run();
    expect(theme()).toBe('light');
  });
});
