// Riepilogo del Profilo vista dall'utente: livello, statistiche e traguardi in neutro, rosso solo come accento.
// Colori del tema chiaro scritti a mano: text.primary #1a1816, text.secondary #6b6663, success #15803d, primary #d50000.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import ProfileSummary from './ProfileSummary';
import { ThemeModeProvider } from '../context/ThemeModeContext';
import i18n from '../i18n';
import { textBelow } from '../test/minText';

const INK = 'rgb(26, 24, 22)';
const GREY = 'rgb(107, 102, 99)';
const GREEN = 'rgb(21, 128, 61)';
const RED = 'rgb(213, 0, 0)';

const a = (key, category, label, threshold, unlocked_at = null) => ({ key, category, label, threshold, unlocked_at, locked: unlocked_at === null });

const profile = {
  success: true, level: 7, total_xp: 3140, xp_into_level: 340, xp_for_next_level: 600,
  lifetime_volume_kg: 184250, total_sessions: 58, longest_streak: 5,
  exercises: [
    { exercise_id: 3, name: 'Panca piana', level: 6, xp: 820 },
    { exercise_id: 6, name: 'Rematore con bilanciere', level: 5, xp: 610 },
  ],
  achievements: [
    a('s10', 'sessions', 'Prime 10 sessioni', 10, '2026-03-07 18:00:00'),
    a('s50', 'sessions', '50 sessioni', 50, '2026-10-02 18:00:00'),
    a('s100', 'sessions', 'Centurione', 100),
    a('s250', 'sessions', '250 sessioni', 250),
    a('t1500', 'tonnage', '1,5 t — automobile', 1500, '2026-02-05 18:00:00'),
    a('t420000', 'tonnage', '420 t — Stazione Spaziale', 420000),
    a('t2000000', 'tonnage', '2.000 t — Space Shuttle', 2000000),
    a('st4', 'streak', '4 settimane consecutive', 4, '2026-07-20 18:00:00'),
    a('st8', 'streak', '8 settimane consecutive', 8),
  ],
};

beforeEach(() => {
  localStorage.setItem('themeMode', 'light');
  vi.stubGlobal('fetch', vi.fn(() => Promise.resolve({ ok: true, status: 200, json: async () => profile })));
});
afterEach(() => vi.unstubAllGlobals());

const mount = async () => {
  render(<ThemeModeProvider><ProfileSummary /></ThemeModeProvider>);
  await screen.findByText('Livello 7');
};
const style = (el) => getComputedStyle(el);

describe('livello', () => {
  it('niente stella rossa decorativa accanto al livello', async () => {
    await mount();
    expect(document.querySelector('[data-testid="StarIcon"]')).toBeNull();
  });

  it('le barre di avanzamento sono rosso pieno, senza sfumatura', async () => {
    await mount();
    // Prime tre barre in ordine di pagina: livello e due esercizi; le altre sono i "Prossimo" dei traguardi
    const bars = [...document.querySelectorAll('.MuiLinearProgress-bar')].slice(0, 3);
    expect(bars).toHaveLength(3);
    bars.forEach((bar) => {
      expect(style(bar).backgroundColor).toBe(RED);
      expect(style(bar).backgroundImage).not.toContain('gradient');
    });
  });

  it('le etichette sotto la barra sono da 16px', async () => {
    await mount();
    expect(style(screen.getByText('340 XP')).fontSize).toBe('16px');
    expect(style(screen.getByText('600 XP per il livello 8')).fontSize).toBe('16px');
    expect(style(screen.getByText('3140 XP totali')).fontSize).toBe('16px');
  });
});

describe('statistiche', () => {
  it('sessioni, kg sollevati e settimane record: tre colonne su una riga, in numero grande', async () => {
    await mount();
    const row = screen.getByText('sessioni').parentElement.parentElement;
    expect(style(row).display).toBe('grid');
    expect(style(row).gridTemplateColumns).toBe('repeat(3, auto)');
    expect([...row.children].map((c) => c.textContent)).toEqual(['58sessioni', '184.250kg sollevati', '5settimane record']);
    const value = screen.getByText('184.250');
    expect(style(value).fontFamily).toBe('"Lexend", sans-serif');
    expect(style(value).fontWeight).toBe('700');
    expect(style(value).fontSize).toBe('22px');
    expect(style(value).fontVariantNumeric).toBe('tabular-nums');
  });

  it('le etichette sono grigie da 16px e non vanno a capo', async () => {
    await mount();
    ['sessioni', 'kg sollevati', 'settimane record'].forEach((label) => {
      const s = style(screen.getByText(label));
      expect(s.fontSize).toBe('16px');
      expect(s.color).toBe(GREY);
      expect(s.whiteSpace).toBe('nowrap');
    });
  });
});

describe('livelli per esercizio', () => {
  it('titolo in sentence case, nome da 16px, chip del livello neutro, barra rosso pieno', async () => {
    await mount();
    expect(screen.getByText('Livelli per esercizio')).toBeTruthy();
    expect(style(screen.getByText('Panca piana')).fontSize).toBe('16px');
    const chip = screen.getByText('Lv 6');
    expect(style(chip).color).toBe(INK);
    expect(style(chip).backgroundColor).not.toBe(RED);
    expect(style(chip).fontSize).toBe('13px');
    expect(style(screen.getByText('820 XP')).fontSize).toBe('16px');
  });
});

describe('traguardi', () => {
  const cat = (title) => screen.getByText(title, { selector: 'p' }).parentElement.parentElement;
  const card = (label) => screen.getByText(label, { selector: 'p' }).closest('.MuiCard-root');

  it('titolo "Traguardi" e categorie in sentence case, con "n di m" ottenuti', async () => {
    await mount();
    expect(screen.getByText('Traguardi', { selector: 'p' })).toBeTruthy();
    expect(screen.queryByText(/Achievement/)).toBeNull();
    const sessions = screen.getByText('Sessioni', { selector: 'p' });
    expect(style(sessions).textTransform).not.toBe('uppercase');
    expect(style(sessions).fontFamily).toBe('"Lexend", sans-serif');
    expect(style(sessions).fontWeight).toBe('700');
    expect(style(sessions).fontSize).toBe('16px');
    expect(within(cat('Sessioni')).getByText('2 di 4')).toBeTruthy();
    expect(within(cat('Tonnellaggio')).getByText('1 di 3')).toBeTruthy();
    expect(within(cat('Costanza')).getByText('1 di 2')).toBeTruthy();
  });

  it('ottenuto: segno di spunta verde e data, nessuna stella, nessun bordo rosso', async () => {
    await mount();
    const c = card('Prime 10 sessioni');
    expect(style(within(c).getByTestId('CheckIcon')).color).toBe(GREEN);
    expect(within(c).getByText('7 mar 2026')).toBeTruthy();
    expect(within(c).queryByTestId('StarIcon')).toBeNull();
    expect(style(c).borderColor).not.toBe(RED);
    expect(style(c).opacity).not.toBe('0.5');
  });

  it('il primo bloccato di ogni categoria è "Prossimo": bordo in inchiostro, barra in inchiostro e avanzamento', async () => {
    await mount();
    const c = card('Centurione');
    expect(within(c).getByText('Prossimo')).toBeTruthy();
    expect(style(c).borderColor).toBe(INK);
    expect(within(c).getByText('58 di 100')).toBeTruthy();
    const bar = c.querySelector('.MuiLinearProgress-bar');
    expect(style(bar).backgroundColor).toBe(INK);
    expect(c.querySelector('[role="progressbar"]').getAttribute('aria-valuenow')).toBe('58');
  });

  it('tonnellaggio e costanza: avanzamento in tonnellate e in settimane', async () => {
    await mount();
    expect(within(card('420 t — Stazione Spaziale')).getByText('184,3 t di 420 t')).toBeTruthy();
    expect(within(card('8 settimane consecutive')).getByText('5 di 8')).toBeTruthy();
  });

  it('gli altri bloccati hanno il lucchetto e l\'etichetta grigia, senza "Prossimo" né barra', async () => {
    await mount();
    const c = card('250 sessioni');
    expect(within(c).getByTestId('LockOutlinedIcon')).toBeTruthy();
    expect(style(within(c).getByText('250 sessioni')).color).toBe(GREY);
    expect(within(c).queryByText('Prossimo')).toBeNull();
    expect(c.querySelector('.MuiLinearProgress-root')).toBeNull();
    expect(style(c).borderColor).not.toBe(INK);
  });

  it('due card per riga sul telefono, quattro da sm', async () => {
    await mount();
    const item = card('Centurione').parentElement;
    expect(item.classList.contains('MuiGrid-grid-xs-6')).toBe(true);
    expect(item.classList.contains('MuiGrid-grid-sm-3')).toBe(true);
  });

  it('i testi dei traguardi sono tutti da 16px: nome, data, «Prossimo» e «n di m»', async () => {
    await mount();
    ['Prime 10 sessioni', 'Centurione', '250 sessioni'].forEach((label) => {
      expect(style(screen.getByText(label, { selector: 'p' })).fontSize).toBe('16px');
    });
    ['7 mar 2026', '58 di 100'].forEach((text) => expect(style(screen.getByText(text)).fontSize).toBe('16px'));
    screen.getAllByText('Prossimo').forEach((el) => expect(style(el).fontSize).toBe('16px'));
  });
});

describe('testi', () => {
  it('nessun testo del riepilogo è sotto i 16px, salvo il chip del livello per esercizio (13px)', async () => {
    await mount();
    expect(textBelow(document.body, 16, '.MuiChip-root, [data-level-chip]')).toEqual([]);
  });
});

describe('in inglese', () => {
  it('i testi vengono dal file di lingua, non dal codice', async () => {
    await i18n.changeLanguage('en');
    render(<ThemeModeProvider><ProfileSummary /></ThemeModeProvider>);
    await screen.findByText('Level 7');
    ['Levels by exercise', 'Achievements', 'Consistency', 'Next', '58 of 100', 'kg lifted', 'record weeks'].forEach((text) => {
      expect(screen.getAllByText(text).length).toBeGreaterThan(0);
    });
    expect(screen.queryByText('Livelli per esercizio')).toBeNull();
  });
});
