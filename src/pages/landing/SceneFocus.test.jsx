// Scena Focus della landing a 320 px (1.4.10): la colonna unica non si allarga oltre la pagina.
// jsdom non valuta le media query: si leggono le regole di `min-width: 0` (xs di MUI).
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import SceneFocus from './SceneFocus';
import { ThemeModeProvider } from '../../context/ThemeModeContext';
import { mediaStyle } from '../../test/mediaStyle';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import i18n from '../../i18n';

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

describe('scena Focus animata: il testo dei passi resta nell\'albero di accessibilità (1.3.1, 2.1.1)', () => {
  beforeEach(() => {
    // Movimento normale e schermo alto: la scena è a scorrimento, con la timeline GSAP
    window.matchMedia = (query) => ({
      matches: query.includes('min-height'), media: query, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {},
    });
  });
  afterEach(() => { ScrollTrigger.getAll().forEach((trigger) => trigger.kill()); });

  const titles = ['home.landing.focus.s1.title', 'home.landing.focus.s2.title', 'home.landing.focus.s3.title'].map((key) => i18n.t(key));
  const stepTitleNames = () => screen.queryAllByRole('heading', { level: 3 }).map((h) => h.textContent);

  it('a inizio pagina i titoli di tutti e tre i passi sono già esposti, non solo il primo', () => {
    render(<ThemeModeProvider><SceneFocus /></ThemeModeProvider>);
    expect(stepTitleNames()).toEqual(titles);
  });

  it.each([0, 0.3, 0.5, 0.7, 1])('con lo scorrimento a %s i tre passi non sono mai nascosti (né visibility né display)', (progress) => {
    const { container } = render(<ThemeModeProvider><SceneFocus /></ThemeModeProvider>);
    ScrollTrigger.getAll()[0].animation.progress(progress);
    const steps = [...container.querySelectorAll('[data-step]')];
    expect(steps).toHaveLength(3);
    steps.forEach((step) => {
      expect(getComputedStyle(step).visibility).not.toBe('hidden');
      expect(getComputedStyle(step).display).not.toBe('none');
    });
    expect(stepTitleNames()).toEqual(titles);
  });
});
