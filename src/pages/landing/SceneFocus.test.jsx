// Scena Focus della landing a 320 px (1.4.10): la colonna unica non si allarga oltre la pagina.
// jsdom non valuta le media query: si leggono le regole di `min-width: 0` (xs di MUI).
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import SceneFocus from './SceneFocus';
import { ThemeModeProvider } from '../../context/ThemeModeContext';
import { mediaStyle } from '../../test/mediaStyle';

beforeEach(() => {
  // Movimento ridotto: la scena si mostra ferma, senza GSAP
  window.matchMedia = (query) => ({
    matches: query.includes('prefers-reduced-motion'), media: query, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {},
  });
});

describe('scena Focus', () => {
  it('su telefono la colonna unica può restringersi sotto la larghezza del telefono finto (320 px)', () => {
    render(<ThemeModeProvider><SceneFocus /></ThemeModeProvider>);
    const grid = screen.getByRole('heading', { level: 2 }).parentElement.parentElement;
    expect(mediaStyle(grid, 0)['grid-template-columns']).toBe('minmax(0, 1fr)');
  });
});
