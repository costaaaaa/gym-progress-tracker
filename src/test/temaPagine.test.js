// Tema delle pagine statiche (privacy, termini, 404): public/tema.js legge themeMode dal localStorage,
// come l'app e il blog; senza scelta resta chiaro, la preferenza del sistema non conta.
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

  it('senza scelta salvata la pagina è chiara', () => {
    run();
    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
  });

  it('con themeMode = dark la pagina è scura', () => {
    localStorage.setItem('themeMode', 'dark');
    run();
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
  });

  it('un valore sconosciuto vale chiaro', () => {
    localStorage.setItem('themeMode', 'blu');
    run();
    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
  });

  it('la preferenza di sistema scura non cambia nulla', () => {
    vi.stubGlobal('matchMedia', () => ({ matches: true }));
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
