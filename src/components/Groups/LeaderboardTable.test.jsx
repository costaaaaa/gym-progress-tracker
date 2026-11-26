// Classifica del gruppo: la riga «tu» in scuro deve avere almeno 4.5 : 1 per il testo secondario sul suo fondo.
import { describe, it, expect } from 'vitest';
import { render, screen, within } from '@testing-library/react';
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
    const secondary = toRgb(getComputedStyle(screen.getByText('4.820 kg', { exact: false })).color);
    expect(contrast(secondary, bg)).toBeGreaterThanOrEqual(4.5);
  });
});

describe('migliaia a quattro cifre', () => {
  const level = (total_xp) => [{ rank: 1, username: 'luca', is_me: false, level: 12, total_xp, streak_weeks: null }];

  it('classifica dei livelli: gli XP hanno il punto da quattro cifre', () => {
    render(<ThemeModeProvider><LeaderboardTable rows={level(3140)} board="level" /></ThemeModeProvider>);
    expect(screen.getByText('3.140 XP')).toBeTruthy();
  });

  it('classifica dei livelli: sotto le quattro cifre niente punto', () => {
    render(<ThemeModeProvider><LeaderboardTable rows={level(950)} board="level" /></ThemeModeProvider>);
    expect(screen.getByText('950 XP')).toBeTruthy();
  });
});

describe('unità di peso', () => {
  it('in kg il volume è quello di sempre', () => {
    render(<ThemeModeProvider><LeaderboardTable rows={rows} board="week" /></ThemeModeProvider>);
    expect(screen.getByText('5.200 kg')).toBeTruthy();
  });

  it('in lb ognuno vede il volume (in kg dal server) convertito nel totale intero', () => {
    render(<ThemeModeProvider><LeaderboardTable rows={rows} board="week" weightUnit="lb" /></ThemeModeProvider>);
    expect(screen.getByText('11.464 lb')).toBeTruthy(); // 5200 kg
    expect(screen.getByText('10.626 lb')).toBeTruthy(); // 4820 kg
    expect(screen.queryByText(/kg/)).toBeNull();
  });
});

// Dati nascosti: il server manda null nei campi che chi guarda o il membro non mostra
describe('campi nascosti (null)', () => {
  const week = (over) => ({ rank: 1, username: 'luca', is_me: false, workouts: 3, goal: 3, volume_kg: 5200, adherence: 1, streak_weeks: null, level: null, total_xp: null, ...over });
  const renderBoard = (props) => render(<ThemeModeProvider><LeaderboardTable {...props} /></ThemeModeProvider>);

  it('settimana: una riga senza volume mostra gli allenamenti e la barra, ma né volume né «undefined» né zero finto', () => {
    renderBoard({ rows: [week(), week({ rank: 2, username: 'anna', volume_kg: null, workouts: 2, adherence: 0.66 })], board: 'week' });
    const row = screen.getByText('anna').closest('li');
    expect(row.textContent).toContain('2/3');
    expect(row.textContent).not.toMatch(/undefined|null|NaN|kg|—|nascost/i);
    expect(within(row).getByRole('progressbar')).toBeTruthy();
    expect(screen.getByText('5.200 kg')).toBeTruthy();
  });

  it('settimana: se nessuna riga ha il volume, non compare nessun volume', () => {
    renderBoard({ rows: [week({ volume_kg: null }), week({ rank: 2, username: 'anna', volume_kg: null })], board: 'week' });
    expect(document.body.textContent).not.toMatch(/kg|lb|undefined|null/);
    expect(screen.getAllByRole('progressbar')).toHaveLength(2);
  });

  it('settimana: la riga con il volume resta nella stessa colonna di quella senza (stessa larghezza minima)', () => {
    renderBoard({ rows: [week(), week({ rank: 2, username: 'anna', volume_kg: null })], board: 'week' });
    const bars = screen.getAllByRole('progressbar').map((bar) => bar.parentElement.parentElement);
    expect(getComputedStyle(bars[0]).minWidth).toBe(getComputedStyle(bars[1]).minWidth);
  });

  it('livello: una riga senza xp mostra solo il livello', () => {
    renderBoard({ rows: [week({ level: 4, total_xp: null })], board: 'level' });
    expect(screen.getByText('Livello 4')).toBeTruthy();
    expect(document.body.textContent).not.toMatch(/XP|undefined|null/);
  });

  it('streak: una riga con streak null non mostra «undefined» né un numero', () => {
    renderBoard({ rows: [week({ streak_weeks: null })], board: 'streak' });
    expect(document.body.textContent).not.toMatch(/undefined|null|NaN/);
    expect(screen.getByText('luca')).toBeTruthy();
  });
});
