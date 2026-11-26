// Pagina Livelli e traguardi vista dall'utente: livello, statistiche e traguardi in neutro, rosso solo come accento.
// Colori del tema chiaro scritti a mano: text.primary #1a1816, text.secondary #6b6663, success #15803d, primary #d50000.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom';
import Levels from './Levels';
import { ThemeModeProvider } from '../context/ThemeModeContext';
import i18n from '../i18n';
import { textBelow } from '../test/minText';
import { unnamedControls } from '../test/accessibleNames';
import { mediaStyle } from '../test/mediaStyle';
import { expectPageTitleBlock, expectBackArrow } from '../test/dom';

const account = vi.hoisted(() => ({ weightUnit: 'kg', modules: undefined, isLoggedIn: true }));
vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({ weightUnit: account.weightUnit, user: { modules: account.modules }, isLoggedIn: account.isLoggedIn, loading: false, updateUser: () => {} }),
}));

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
    a('s10', 'sessions', 'Prime 10 sessioni', 10, '2026-03-07T12:00:00+00:00'),
    a('s50', 'sessions', '50 sessioni', 50, '2026-10-02T12:00:00+00:00'),
    a('s100', 'sessions', 'Centurione', 100),
    a('s250', 'sessions', '250 sessioni', 250),
    a('t1500', 'tonnage', '1,5 t — automobile', 1500, '2026-02-05T12:00:00+00:00'),
    a('t420000', 'tonnage', '420 t — Stazione Spaziale', 420000),
    a('t2000000', 'tonnage', '2.000 t — Space Shuttle', 2000000),
    a('st4', 'streak', '4 settimane consecutive', 4, '2026-07-20T12:00:00+00:00'),
    a('st8', 'streak', '8 settimane consecutive', 8),
  ],
};

beforeEach(() => {
  account.weightUnit = 'kg';
  account.modules = undefined;
  account.isLoggedIn = true;
  localStorage.setItem('themeMode', 'light');
  vi.stubGlobal('fetch', vi.fn(() => Promise.resolve({ ok: true, status: 200, json: async () => profile })));
});
afterEach(() => vi.unstubAllGlobals());

const mount = async () => {
  render(<ThemeModeProvider><MemoryRouter><Levels /></MemoryRouter></ThemeModeProvider>);
  await screen.findByText('Livello 7');
};
const style = (el) => getComputedStyle(el);

describe('nomi accessibili', () => {
  it('ogni barra di avanzamento dice di cosa è l\'avanzamento', async () => {
    await mount();
    ['Avanzamento verso il livello 8', 'Punti esperienza in Panca piana', 'Punti esperienza in Rematore con bilanciere']
      .forEach((name) => expect(screen.getByRole('progressbar', { name })).toBeTruthy());
    expect(screen.getAllByRole('progressbar', { name: /^Avanzamento verso / }).length).toBeGreaterThan(1);
    expect(unnamedControls(['progressbar'])).toEqual([]);
  });
});

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
    expect(style(screen.getByText('3.140 XP totali')).fontSize).toBe('16px');
  });

  it('gli XP da quattro cifre in su hanno il punto delle migliaia: del livello, per il prossimo, di un esercizio', async () => {
    const big = { ...profile, xp_into_level: 1100, xp_for_next_level: 1700, exercises: [{ exercise_id: 3, name: 'Panca piana', level: 6, xp: 1250 }] };
    fetch.mockImplementation(() => Promise.resolve({ ok: true, status: 200, json: async () => big }));
    await mount();
    expect(screen.getByText('1.100 XP')).toBeTruthy();
    expect(screen.getByText('1.700 XP per il livello 8')).toBeTruthy();
    expect(screen.getByText('1.250 XP')).toBeTruthy();
  });
});

// Reflow a 320 px e spaziatura del testo (1.4.10, 1.4.12): niente riga forzata né troncamento con i puntini
describe('testo che può andare a capo', () => {
  it('le etichette delle statistiche vanno a capo', async () => {
    await mount();
    for (const label of ['sessioni', 'kg sollevati', 'settimane record']) {
      expect(style(screen.getByText(label)).whiteSpace).not.toBe('nowrap');
    }
  });

  it('con la spaziatura del testo aumentata le colonne possono restringersi sotto la parola più lunga', async () => {
    await mount();
    for (const label of ['sessioni', 'kg sollevati', 'settimane record']) {
      const el = screen.getByText(label);
      expect(style(el).overflowWrap).toBe('anywhere');
      expect(style(el.parentElement).minWidth).toBe('0px');
    }
  });

  it('da 390 px il nome dell\'esercizio resta su una riga con i puntini; sotto va a capo', async () => {
    await mount();
    const name = screen.getByText('Rematore con bilanciere');
    expect(style(name)).toMatchObject({ whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' });
    expect(mediaStyle(name, 389.95, 'max')).toMatchObject({ 'white-space': 'normal', 'text-overflow': 'clip', overflow: 'visible' });
  });

  it('sui telefoni il gap tra le colonne delle statistiche è più piccolo, da 600 px come prima', async () => {
    await mount();
    const grid = screen.getByText('sessioni').parentElement.parentElement;
    expect(mediaStyle(grid, 0)['column-gap']).toBe('16px');
    expect(mediaStyle(grid, 600)['column-gap']).toBe('24px');
    expect(mediaStyle(grid, 900)['column-gap']).toBe('40px');
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

  it('le etichette sono grigie da 16px', async () => {
    await mount();
    ['sessioni', 'kg sollevati', 'settimane record'].forEach((label) => {
      const s = style(screen.getByText(label));
      expect(s.fontSize).toBe('16px');
      expect(s.color).toBe(GREY);
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

  it('il primo bloccato di ogni categoria è "Prossimo": bordo in inchiostro, barra rossa come le altre e avanzamento', async () => {
    await mount();
    const c = card('Centurione');
    expect(within(c).getByText('Prossimo')).toBeTruthy();
    expect(style(c).borderColor).toBe(INK);
    expect(within(c).getByText('58 di 100')).toBeTruthy();
    const bar = c.querySelector('.MuiLinearProgress-bar');
    expect(style(bar).backgroundColor).toBe(RED);
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
    render(<ThemeModeProvider><MemoryRouter><Levels /></MemoryRouter></ThemeModeProvider>);
    await screen.findByText('Level 7');
    ['Levels by exercise', 'Achievements', 'Consistency', 'Next', '58 of 100', 'kg lifted', 'record weeks'].forEach((text) => {
      expect(screen.getAllByText(text).length).toBeGreaterThan(0);
    });
    expect(screen.queryByText('Livelli per esercizio')).toBeNull();
  });
});

describe('nomi dei traguardi', () => {
  // Il server risponde nella lingua dell'account (qui italiano), l'app può essere in un'altra
  const withServerLabels = (achievements) => vi.stubGlobal('fetch', vi.fn(() => Promise.resolve({
    ok: true, status: 200, json: async () => ({ ...profile, achievements }),
  })));

  it('seguono la lingua dell\'app, non quella del testo mandato dal server', async () => {
    withServerLabels([a('sessions_100', 'sessions', 'Centurione', 100), a('tonnage_auto', 'tonnage', '1,5 t — automobile', 1500)]);
    await i18n.changeLanguage('en');
    render(<ThemeModeProvider><MemoryRouter><Levels /></MemoryRouter></ThemeModeProvider>);
    await screen.findByText('Level 7');
    screen.getByText('Centurion');
    screen.getByText('1.5 t — a car');
    expect(screen.queryByText('Centurione')).toBeNull();
  });

  it('un traguardo che il client non conosce mostra il testo del server', async () => {
    withServerLabels([a('sessions_9000', 'sessions', 'Nome nuovo', 9000)]);
    await i18n.changeLanguage('en');
    render(<ThemeModeProvider><MemoryRouter><Levels /></MemoryRouter></ThemeModeProvider>);
    await screen.findByText('Level 7');
    screen.getByText('Nome nuovo');
  });
});

describe('unità di peso dell\'account', () => {
  it('in lb il volume totale e l\'avanzamento del tonnellaggio sono in libbre, senza tonnellate', async () => {
    account.weightUnit = 'lb';
    await mount();
    const row = screen.getByText('sessioni').parentElement.parentElement;
    expect([...row.children].map((c) => c.textContent)).toEqual(['58sessioni', '406.202lb sollevati', '5settimane record']); // 184.250 kg
    expect(within(screen.getByText('420 t — Stazione Spaziale', { selector: 'p' }).closest('.MuiCard-root')).getByText('406.202 lb di 925.942 lb')).toBeTruthy();
    expect(screen.queryByText(/184,3 t/)).toBeNull();
  });
});

describe('titolo e titolo del documento', () => {
  it('un solo h1 «Livelli e traguardi» nello stile titolo di pagina, e il titolo del documento lo segue', async () => {
    await mount();
    const h1s = screen.getAllByRole('heading', { level: 1 });
    expect(h1s.map((h) => h.textContent)).toEqual(['Livelli e traguardi']);
    expect(style(h1s[0]).fontSize).toBe('28px');
    expect(style(h1s[0]).fontWeight).toBe('800');
    expectPageTitleBlock(h1s[0]);
    expect(document.title).toBe('Livelli e traguardi | LiftIndex');
  });

  it('la freccia «Home» sta sulla riga del titolo e porta alla Home', async () => {
    await mount();
    expectBackArrow(screen.getByRole('heading', { level: 1 }), screen.getByRole('link', { name: 'Home' }), '/');
  });
});

describe('senza accesso', () => {
  it('va al login con next = pagina', async () => {
    account.isLoggedIn = false;
    const Login = () => <p data-testid="login">{useLocation().search}</p>;
    render(
      <MemoryRouter initialEntries={['/livelli']}>
        <ThemeModeProvider>
          <Routes>
            <Route path="/livelli" element={<Levels />} />
            <Route path="/login" element={<Login />} />
          </Routes>
        </ThemeModeProvider>
      </MemoryRouter>,
    );
    expect((await screen.findByTestId('login')).textContent).toBe('?next=%2Flivelli');
  });
});

describe('modulo Livelli non attivo', () => {
  it('la pagina «non attivo» con «Attiva», senza il contenuto dei livelli e senza leggerli', async () => {
    account.modules = { body: true, recovery: true, levels: false, groups: true, ai: true };
    render(<ThemeModeProvider><MemoryRouter><Levels /></MemoryRouter></ThemeModeProvider>);
    expect(screen.getByRole('heading', { name: 'Il modulo Livelli e traguardi non è attivo' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Attiva' })).toBeTruthy();
    expect(screen.queryByText('sessioni')).toBeNull();
    expect(screen.queryByText('Livello 7')).toBeNull();
    expect(fetch).not.toHaveBeenCalled();
  });
});
