// Classifica del gruppo: la riga «tu» in scuro deve avere almeno 4.5 : 1 per il testo secondario sul suo fondo.
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import LeaderboardTable from './LeaderboardTable';
import { ThemeModeProvider } from '../../context/ThemeModeContext';

const rows = [
  { rank: 1, username: 'atleta_2', is_me: false, workouts: 3, goal: 3, volume_kg: 5200, adherence: 1 },
  { rank: 4, username: 'atleta_demo', is_me: true, workouts: 2, goal: 3, volume_kg: 4820, adherence: 0.66 },
];

const toRgb = (css) => css.match(/[\d.]+/g).map(Number);
const luminance = ([r, g, b]) => {
  const [lr, lg, lb] = [r, g, b].map((v) => { const c = v / 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; });
  return 0.2126 * lr + 0.7152 * lg + 0.0722 * lb;
};
const contrast = (a, b) => { const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x); return (hi + 0.05) / (lo + 0.05); };
// Fondo della riga steso sul fondo della card (#ffffff in chiaro, #141416 in scuro)
const over = (rgba, base) => { const [r, g, b, a = 1] = rgba; return [r, g, b].map((v, i) => v * a + base[i] * (1 - a)); };

describe.each([
  ['light', [255, 255, 255]],
  ['dark', [20, 20, 22]],
])('classifica in %s', (mode, paper) => {
  it('il testo secondario della riga «tu» ha almeno 4,5:1 sul fondo della riga', () => {
    localStorage.setItem('themeMode', mode);
    render(<ThemeModeProvider><LeaderboardTable rows={rows} board="week" /></ThemeModeProvider>);
    const row = screen.getByText('atleta_demo').closest('li');
    const bg = over(toRgb(getComputedStyle(row).backgroundColor), paper);
    const secondary = toRgb(getComputedStyle(screen.getByText('4820 kg', { exact: false })).color);
    expect(contrast(secondary, bg)).toBeGreaterThanOrEqual(4.5);
  });
});
