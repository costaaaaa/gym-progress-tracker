// Scheda Muscoli vista dall'utente: totale della settimana, confronto con la settimana scorsa,
// una riga per muscolo (serie, variazione, barra, stato di recupero).
// Colori del tema chiaro scritti a mano: text.secondary #6b6663, text.primary #1a1816,
// success #15803d, recovery.ready #15803d.
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import Muscles from './Muscles';
import { ThemeModeProvider } from '../context/ThemeModeContext';
import { json } from '../test/dom';
import { textBelow } from '../test/minText';

const GREY = 'rgb(107, 102, 99)';
const INK = 'rgb(26, 24, 22)';
const GREEN = 'rgb(21, 128, 61)';

const BODY_ORDER = [
  'Petto', 'Schiena', 'Spalle', 'Bicipiti', 'Tricipiti', 'Addome',
  'Quadricipiti', 'Femorali', 'Glutei', 'Adduttori', 'Abduttori', 'Polpacci',
];

// Oggi: giovedì 29 ottobre 2026. ready_at in giorni da oggi, come in BodyVisualizer.test.jsx.
const inDays = (n) => {
  const d = new Date(2026, 9, 29 + n, 8, 0, 0);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} 08:00:00`;
};

// Stessi numeri dello screenshot del prototipo (place-P2): 53 serie, 48 la settimana scorsa a
// quest'ora (▲5), 61 la settimana scorsa intera.
const dashboardStats = {
  success: true,
  weekly_sets: {
    week: { petto: 12, schiena: 10, spalle: 6, bicipiti: 4, tricipiti: 3, addome: 0, quadricipiti: 8, femorali: 5, glutei: 3, adduttori: 2, abduttori: 0, polpacci: 0 },
    previous_to_date: { petto: 8, schiena: 8, spalle: 4, bicipiti: 4, tricipiti: 3, addome: 3, quadricipiti: 9, femorali: 4, glutei: 3, adduttori: 0, abduttori: 0, polpacci: 2 },
    previous_total: 61,
  },
  recovery: {
    petto: { status: 'PRONTO' },
    schiena: { status: 'IN RECUPERO', ready_at: inDays(1) },
    spalle: { status: 'IN RECUPERO', ready_at: inDays(1) },
    bicipiti: { status: 'PRONTO' },
    tricipiti: { status: 'PRONTO' },
    addome: { status: 'PRONTO' },
    quadricipiti: { status: 'AFFATICATO', ready_at: inDays(2) },
    femorali: { status: 'AFFATICATO', ready_at: inDays(3) },
    glutei: { status: 'PRONTO' },
    adduttori: { status: 'PRONTO' },
    // abduttori: nessuna voce → "nessun dato"
    polpacci: { status: 'PRONTO' },
  },
};

const stubFetch = (body) => vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(json(body))));

beforeEach(() => {
  localStorage.setItem('themeMode', 'light');
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(2026, 9, 29, 18, 30));
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  localStorage.clear();
});

const mount = async (body = dashboardStats) => {
  stubFetch(body);
  render(<ThemeModeProvider><Muscles /></ThemeModeProvider>);
  await screen.findByText('Petto');
};

const row = (label) => screen.getByText(label).closest('li');

describe('intestazione', () => {
  it('mostra il totale della settimana e la variazione sulla settimana scorsa allo stesso punto', async () => {
    await mount();
    expect(screen.getByText('53')).toBeTruthy();
    expect(screen.getByText(/Settimana scorsa a quest'ora 48/)).toBeTruthy();
    expect(screen.getByText('▲ 5')).toBeTruthy();
    expect(screen.getByText(/intera 61/)).toBeTruthy();
  });
});

describe('righe per muscolo', () => {
  it('le 12 righe sono nell\'ordine del corpo', async () => {
    await mount();
    const names = screen.getAllByRole('listitem').map((li) => li.textContent.match(/^[A-Za-zàèéìòù]+/)[0]);
    expect(names).toEqual(BODY_ORDER);
  });

  it('mostra le serie della settimana di ogni muscolo', async () => {
    await mount();
    expect(within(row('Petto')).getByText('12')).toBeTruthy();
    expect(within(row('Quadricipiti')).getByText('8')).toBeTruthy();
    expect(within(row('Abduttori')).getByText('0')).toBeTruthy();
  });

  it('mostra il segno della variazione: ▲ positivo, ▼ negativo, = invariato', async () => {
    await mount();
    expect(within(row('Petto')).getByText('▲ 4')).toBeTruthy(); // 12 - 8
    expect(within(row('Addome')).getByText('▼ 3')).toBeTruthy(); // 0 - 3
    expect(within(row('Bicipiti')).getByText('=')).toBeTruthy(); // 4 - 4
  });

  it('i muscoli a zero serie hanno il nome in secondario, gli altri in inchiostro', async () => {
    await mount();
    expect(getComputedStyle(screen.getByText('Addome')).color).toBe(GREY);
    expect(getComputedStyle(screen.getByText('Abduttori')).color).toBe(GREY);
    expect(getComputedStyle(screen.getByText('Petto')).color).toBe(INK);
  });

  it('la barra è proporzionale al muscolo più allenato della settimana (petto, 12)', async () => {
    await mount();
    const bar = (label) => within(row(label)).getByRole('progressbar').firstElementChild;
    expect(getComputedStyle(bar('Petto')).width).toBe('100%');
    expect(getComputedStyle(bar('Quadricipiti')).width).toBe(`${(8 / 12) * 100}%`);
    expect(getComputedStyle(bar('Addome')).width).toBe('0%');
  });

  it('stato di recupero: Pronto, pronto domani, pronto tra N giorni, nessun dato', async () => {
    await mount();
    expect(within(row('Petto')).getByText('Pronto')).toBeTruthy();
    expect(within(row('Schiena')).getByText('pronto domani')).toBeTruthy();
    expect(within(row('Quadricipiti')).getByText('pronto tra 2 giorni')).toBeTruthy();
    expect(within(row('Femorali')).getByText('pronto tra 3 giorni')).toBeTruthy();
    expect(within(row('Abduttori')).getByText('nessun dato')).toBeTruthy();
  });

  it('"Pronto" è verde e semigrassetto, "nessun dato" è in secondario', async () => {
    await mount();
    const pronto = within(row('Petto')).getByText('Pronto');
    expect(getComputedStyle(pronto).color).toBe(GREEN);
    expect(getComputedStyle(pronto).fontWeight).toBe('600');
    expect(getComputedStyle(within(row('Abduttori')).getByText('nessun dato')).color).toBe(GREY);
  });
});

describe('sicurezza verso un backend precedente', () => {
  it('senza weekly_sets non va in errore: tutto a zero, il recupero resta leggibile', async () => {
    const { recovery } = dashboardStats;
    await mount({ success: true, recovery });
    expect(screen.getAllByRole('listitem')).toHaveLength(12);
    expect(within(row('Petto')).getByText('0')).toBeTruthy();
    expect(within(row('Petto')).getByText('Pronto')).toBeTruthy();
  });
});

describe('caricamento ed errore', () => {
  it('mostra un indicatore di caricamento prima che arrivino i dati', () => {
    vi.stubGlobal('fetch', vi.fn(() => new Promise(() => {})));
    render(<ThemeModeProvider><Muscles /></ThemeModeProvider>);
    expect(document.querySelector('.MuiCircularProgress-root')).toBeTruthy();
  });

  it('se la fetch fallisce mostra un errore', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve({ ok: false, status: 500, json: async () => ({ success: false }) })));
    render(<ThemeModeProvider><Muscles /></ThemeModeProvider>);
    expect(await screen.findByText('Impossibile caricare le serie per muscolo.')).toBeTruthy();
  });
});

it('nessun testo sotto i 13 px', async () => {
  stubFetch(dashboardStats);
  const { container } = render(<ThemeModeProvider><Muscles /></ThemeModeProvider>);
  await screen.findByText('Petto');
  expect(textBelow(container, 13)).toEqual([]);
});
