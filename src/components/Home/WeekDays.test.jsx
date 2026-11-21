// I sette giorni della settimana: cerchi visivi nascosti, un testo solo per il lettore di schermo.
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import WeekDays from './WeekDays';
import { ThemeModeProvider } from '../../context/ThemeModeContext';
import i18n from '../../i18n';

const show = (props) => render(<ThemeModeProvider><WeekDays {...props} /></ThemeModeProvider>);
const circles = (container) => [...container.querySelectorAll('[data-circle]')];
const WEEK = [true, false, true, false, false, false, false];

afterEach(() => act(() => i18n.changeLanguage('it')));

describe('WeekDays', () => {
  it('ha sette cerchi con le iniziali dei giorni nella lingua dell\'app, da lunedì', () => {
    const { container } = show({ done: WEEK, today: 3 });
    expect(container.querySelectorAll('[data-day]').length).toBe(7);
    expect([...container.querySelectorAll('[data-day]')].map((el) => el.textContent.trim())).toEqual(['L', 'M', 'M', 'G', 'V', 'S', 'D']);
  });

  it('in inglese le iniziali sono quelle inglesi', async () => {
    await act(() => i18n.changeLanguage('en'));
    const { container } = show({ done: WEEK, today: 3 });
    expect([...container.querySelectorAll('[data-day]')].map((el) => el.textContent.trim())).toEqual(['M', 'T', 'W', 'T', 'F', 'S', 'S']);
  });

  it('un solo testo per il lettore di schermo; i cerchi e le iniziali sono nascosti', () => {
    const { container } = show({ done: WEEK, today: 3 });
    expect(screen.getByText('Allenato lunedì e mercoledì. Oggi è giovedì.')).toBeTruthy();
    expect(container.querySelectorAll('[data-day][aria-hidden="true"]').length).toBe(7);
    expect(screen.queryAllByRole('img').length).toBe(0);
  });

  it('con tre giorni fatti li elenca con la virgola e la «e»', () => {
    show({ done: [true, false, true, true, false, false, false], today: 4 });
    expect(screen.getByText('Allenato lunedì, mercoledì e giovedì. Oggi è venerdì.')).toBeTruthy();
  });

  it('nessun giorno fatto: lo dice', () => {
    show({ done: new Array(7).fill(false), today: 0 });
    expect(screen.getByText('Nessun allenamento finora. Oggi è lunedì.')).toBeTruthy();
  });

  it('senza giorno di oggi (data non valida) non dice quale è oggi', () => {
    show({ done: WEEK, today: -1 });
    expect(screen.getByText('Allenato lunedì e mercoledì.')).toBeTruthy();
  });

  it('i giorni fatti hanno la spunta, oggi è marcato, gli altri hanno solo il bordo: non solo il colore', () => {
    const { container } = show({ done: WEEK, today: 3 });
    const c = circles(container);
    expect(c.map((el) => el.dataset.done)).toEqual(['true', 'false', 'true', 'false', 'false', 'false', 'false']);
    expect(c.map((el) => el.querySelector('svg') !== null)).toEqual([true, false, true, false, false, false, false]);
    expect(c.map((el) => el.dataset.today)).toEqual(['false', 'false', 'false', 'true', 'false', 'false', 'false']);
    expect(getComputedStyle(c[3]).borderWidth).toBe('3px');
    expect(getComputedStyle(c[4]).borderWidth).toBe('2px');
    // iniziale di oggi in grassetto
    expect(getComputedStyle(container.querySelectorAll('[data-day]')[3].lastChild).fontWeight).toBe('700');
    expect(getComputedStyle(container.querySelectorAll('[data-day]')[4].lastChild).fontWeight).not.toBe('700');
  });

  it('oggi già fatto: spunta e bordo marcato insieme', () => {
    const { container } = show({ done: [false, false, false, true, false, false, false], today: 3 });
    const c = circles(container)[3];
    expect(c.querySelector('svg')).not.toBeNull();
    expect(getComputedStyle(c).borderWidth).toBe('3px');
  });

  it('sul rosso: pieno bianco con spunta rossa per i fatti, bordo bianco pieno per oggi, bordo bianco al 75% per gli altri', () => {
    const { container } = show({ done: WEEK, today: 3, onColor: true });
    const c = circles(container);
    expect(getComputedStyle(c[0]).backgroundColor).toBe('rgb(255, 255, 255)');
    expect(getComputedStyle(c[3]).borderColor).toBe('rgb(255, 255, 255)');
    expect(getComputedStyle(c[4]).borderColor).toBe('rgba(255, 255, 255, 0.75)');
  });

  it('sul neutro: i fatti sono verdi, oggi ha il colore del testo, gli altri il bordo dei campi', () => {
    const { container } = show({ done: WEEK, today: 3 });
    const c = circles(container);
    expect(getComputedStyle(c[0]).backgroundColor).toBe('rgb(21, 128, 61)'); // success.main
    expect(getComputedStyle(c[3]).borderColor).toBe('rgb(26, 24, 22)'); // text.primary
    expect(getComputedStyle(c[4]).borderColor).toBe('rgb(140, 136, 133)'); // fieldBorder
  });
});
