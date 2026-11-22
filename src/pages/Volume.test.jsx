// Tab Volume dei Progressi vista dall'utente: la card «Questa settimana» (volume e serie, sempre) e, con il modulo Recupero
// attivo, la card «Per muscolo» (serie, variazione, barra e stato di recupero di ogni muscolo).
// Colori del tema chiaro scritti a mano: text.secondary #6b6663, text.primary #1a1816, recovery.ready #15803d.
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, within, fireEvent, waitFor } from '@testing-library/react';
import Volume from './Volume';
import { ThemeModeProvider } from '../context/ThemeModeContext';
import { json } from '../test/dom';
import { textBelow } from '../test/minText';
import { mediaStyle } from '../test/mediaStyle';
import i18n from '../i18n';

const account = vi.hoisted(() => ({ weightUnit: 'kg', modules: { recovery: true } }));
vi.mock('../context/AuthContext', () => ({ useAuth: () => ({ weightUnit: account.weightUnit, user: { modules: account.modules } }) }));

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

// 53 serie, 48 la settimana scorsa a quest'ora (▲5), 61 la settimana scorsa intera; 4.820,5 kg sollevati.
const dashboardStats = {
  success: true,
  detail: 'full',
  weekly_volume: { total_weight: 4820.5, total_reps: 118 },
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

// Settimana senza allenamenti: il server manda tutto a zero
const ZERO_MUSCLES = Object.fromEntries(Object.keys(dashboardStats.weekly_sets.week).map((m) => [m, 0]));
const emptyWeek = {
  success: true,
  detail: 'full',
  weekly_volume: { total_weight: 0, total_reps: 0 },
  weekly_sets: { week: ZERO_MUSCLES, previous_to_date: ZERO_MUSCLES, previous_total: 0 },
  recovery: {},
};

const stubFetch = (body) => vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(json(body))));

beforeEach(() => {
  account.weightUnit = 'kg';
  account.modules = { recovery: true };
  localStorage.setItem('themeMode', 'light');
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(2026, 9, 29, 18, 30));
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  localStorage.clear();
});

const renderVolume = () => render(<ThemeModeProvider><Volume /></ThemeModeProvider>);
// Aspetta la card della settimana: da lì in poi i dati sono arrivati
const mount = async (body = dashboardStats) => {
  stubFetch(body);
  const view = renderVolume();
  await screen.findByRole('heading', { level: 2, name: 'Questa settimana' });
  return view;
};

const weekCard = () => screen.getByRole('region', { name: 'Questa settimana' });
const muscleCard = () => screen.getByRole('region', { name: 'Per muscolo' });
// Il numero grande sta sopra la sua etichetta
const stat = (label) => within(weekCard()).getByText(label).previousElementSibling;
const row = (label) => screen.getByText(label).closest('li');

describe('card «Questa settimana»', () => {
  it('ha un titolo h2 e due numeri affiancati: volume (kg) e serie, in questo ordine', async () => {
    await mount();
    expect(within(weekCard()).getByRole('heading', { level: 2 }).textContent).toBe('Questa settimana');
    expect(stat('Volume').textContent).toBe('4.820,5 kg');
    expect(stat('Serie').textContent).toBe('53');
    expect(stat('Volume').compareDocumentPosition(stat('Serie')) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('in libbre il volume è convertito dal totale e arrotondato all\'intero', async () => {
    account.weightUnit = 'lb';
    await mount();
    expect(stat('Volume').textContent).toBe('10.627 lb');
    expect(stat('Serie').textContent).toBe('53');
  });

  it('in inglese i testi sono in inglese', async () => {
    await i18n.changeLanguage('en');
    stubFetch(dashboardStats);
    renderVolume();
    expect(await screen.findByRole('heading', { level: 2, name: 'This week' })).toBeTruthy();
    expect(within(weekCard()).getByText('Volume')).toBeTruthy();
    expect(within(weekCard()).getByText('Sets')).toBeTruthy();
    expect(screen.getByRole('heading', { level: 2, name: 'By muscle' })).toBeTruthy();
  });

  it('sotto le serie c\'è il confronto con la settimana scorsa allo stesso punto, e il totale intero', async () => {
    await mount();
    const line = within(weekCard()).getByText('▲ 5').parentElement;
    expect(line.textContent).toBe('Settimana scorsa a quest\'ora 48 ▲ 5 · intera 61');
  });

  it('per il volume non c\'è nessun confronto: il server non lo manda e il client non lo calcola', async () => {
    await mount();
    expect(within(weekCard()).getAllByText(/Settimana scorsa/)).toHaveLength(1);
    expect(stat('Volume').parentElement.textContent).toBe('4.820,5 kgVolume');
  });

  it('con detail "basic" il confronto delle serie non c\'è: solo i due numeri', async () => {
    await mount({ success: true, detail: 'basic', weekly_volume: { total_weight: 4820.5 }, weekly_sets: { total: 53 }, recovery: {} });
    expect(stat('Serie').textContent).toBe('53');
    expect(stat('Volume').textContent).toBe('4.820,5 kg');
    expect(screen.queryByText(/Settimana scorsa/)).toBeNull();
    expect(screen.queryByText(/[▲▼]/)).toBeNull();
  });

  it('settimana senza allenamenti: i due numeri a zero e nessun testo di vuoto', async () => {
    account.modules = { recovery: false };
    await mount(emptyWeek);
    expect(stat('Volume').textContent).toBe('0 kg');
    expect(stat('Serie').textContent).toBe('0');
    expect(screen.queryByRole('alert')).toBeNull();
    expect(screen.queryByText(/nessun/i)).toBeNull();
  });

  it('a 320 px i due numeri stanno su una riga e il testo lungo va a capo dentro la card', async () => {
    await mount();
    const numbers = stat('Volume').parentElement.parentElement;
    expect(mediaStyle(numbers, null).display).toBe('grid');
    expect(mediaStyle(numbers, null)['grid-template-columns']).toBe('repeat(2, minmax(0, auto))');
    expect(getComputedStyle(stat('Volume')).overflowWrap).toBe('anywhere');
    expect(getComputedStyle(stat('Volume').parentElement).minWidth).toBe('0px');
  });
});

describe('card «Per muscolo»', () => {
  it('con il modulo Recupero attivo c\'è, con un titolo h2, sotto la card della settimana', async () => {
    await mount();
    expect(within(muscleCard()).getByRole('heading', { level: 2 }).textContent).toBe('Per muscolo');
    expect(weekCard().compareDocumentPosition(muscleCard()) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('con il modulo Recupero spento non c\'è né la card né un invito ad attivarlo; resta la settimana', async () => {
    account.modules = { recovery: false };
    await mount();
    expect(stat('Serie').textContent).toBe('53');
    expect(screen.queryByRole('heading', { name: 'Per muscolo' })).toBeNull();
    expect(screen.queryByRole('listitem')).toBeNull();
    expect(screen.queryByRole('button')).toBeNull();
    expect(screen.queryByRole('link')).toBeNull();
    expect(screen.queryByText(/modulo/i)).toBeNull();
  });

  it('le 12 righe sono un elenco nell\'ordine del corpo', async () => {
    await mount();
    expect(within(muscleCard()).getByRole('list')).toBeTruthy();
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

  it('un muscolo mai allenato (last_trained null) mostra "nessun dato", non "Pronto"', async () => {
    await mount({
      ...dashboardStats,
      recovery: { petto: { status: 'PRONTO', last_trained: null }, schiena: { status: 'PRONTO', last_trained: '2026-10-20 18:00:00' } },
    });
    expect(within(row('Schiena')).getByText('Pronto')).toBeTruthy();
    expect(within(row('Petto')).getByText('nessun dato')).toBeTruthy();
    expect(within(row('Petto')).queryByText('Pronto')).toBeNull();
  });

  it('"pronto tra N giorni" va a capo, non è troncato con i puntini (1.4.12)', async () => {
    await mount();
    const { whiteSpace, textOverflow } = getComputedStyle(within(row('Quadricipiti')).getByText('pronto tra 2 giorni'));
    expect(whiteSpace).not.toBe('nowrap');
    expect(textOverflow).not.toBe('ellipsis');
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
  it('senza weekly_sets né weekly_volume non va in errore: tutto a zero, il recupero resta leggibile', async () => {
    await mount({ success: true, recovery: dashboardStats.recovery });
    expect(stat('Volume').textContent).toBe('0 kg');
    expect(stat('Serie').textContent).toBe('0');
    expect(screen.getAllByRole('listitem')).toHaveLength(12);
    expect(within(row('Petto')).getByText('0')).toBeTruthy();
    expect(within(row('Petto')).getByText('Pronto')).toBeTruthy();
  });
});

// Piano Gratis (detail "basic"): solo il totale della settimana e due stati, con le righe con lucchetto.
describe('piano Gratis (detail "basic")', () => {
  const basicStats = {
    success: true,
    detail: 'basic',
    weekly_volume: { total_weight: 4820.5, total_reps: 118 },
    weekly_sets: { total: 53 },
    recovery: {
      petto: { status: 'PRONTO', last_trained: '2026-10-20 18:00:00' },
      schiena: { status: 'IN RECUPERO', last_trained: '2026-10-28 18:00:00' },
      spalle: { status: 'PRONTO', last_trained: null },
    },
  };

  it('nella card «Per muscolo»: niente serie, variazione né barre per muscolo', async () => {
    await mount(basicStats);
    expect(stat('Serie').textContent).toBe('53');
    expect(within(muscleCard()).getAllByRole('listitem')).toHaveLength(12);
    expect(screen.queryByRole('progressbar')).toBeNull();
    expect(screen.queryByText(/[▲▼]/)).toBeNull();
    expect(within(row('Petto')).queryByText('0')).toBeNull();
  });

  it('le due righe con lucchetto stanno in cima alla card, con un solo link ai piani', async () => {
    await mount(basicStats);
    const card = within(muscleCard());
    expect(card.getByText('Serie per muscolo e confronto con la settimana scorsa')).toBeTruthy();
    expect(card.getByText('Percentuale di recupero e giorni mancanti')).toBeTruthy();
    const links = screen.getAllByRole('link', { name: 'Confronta i piani' });
    expect(links).toHaveLength(1);
    expect(links[0].getAttribute('href')).toBe('/piani');
    expect(getComputedStyle(links[0]).minHeight).toBe('44px');
    const secondRow = card.getByText('Percentuale di recupero e giorni mancanti');
    expect(secondRow.compareDocumentPosition(links[0]) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    const firstRow = card.getByText('Serie per muscolo e confronto con la settimana scorsa');
    expect(firstRow.compareDocumentPosition(row('Petto')) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('ogni muscolo ha solo "Puoi allenare" o "In recupero" ("nessun dato" se mai allenato)', async () => {
    await mount(basicStats);
    expect(within(row('Petto')).getByText('Puoi allenare')).toBeTruthy();
    expect(within(row('Schiena')).getByText('In recupero')).toBeTruthy();
    expect(within(row('Spalle')).getByText('nessun dato')).toBeTruthy();
    expect(within(row('Abduttori')).getByText('nessun dato')).toBeTruthy();
    expect(screen.queryByText(/pronto (oggi|domani|tra)/)).toBeNull();
  });

  it('con il modulo Recupero spento restano solo i numeri della settimana: nessuna riga con lucchetto', async () => {
    account.modules = { recovery: false };
    await mount(basicStats);
    expect(stat('Serie').textContent).toBe('53');
    expect(screen.queryByText('Percentuale di recupero e giorni mancanti')).toBeNull();
    expect(screen.queryByRole('link', { name: 'Confronta i piani' })).toBeNull();
  });

  it('con detail "full" non c\'è nessuna riga con lucchetto', async () => {
    await mount();
    expect(screen.queryByRole('link', { name: 'Confronta i piani' })).toBeNull();
    expect(screen.queryByText('Percentuale di recupero e giorni mancanti')).toBeNull();
  });

  it('nessun testo sotto i 16 px, nemmeno nelle righe con lucchetto', async () => {
    const { container } = await mount(basicStats);
    expect(textBelow(container, 16)).toEqual([]);
  });
});

describe('caricamento ed errore', () => {
  beforeEach(() => { vi.spyOn(console, 'error').mockImplementation(() => {}); });

  it('mostra un indicatore di caricamento prima che arrivino i dati', () => {
    vi.stubGlobal('fetch', vi.fn(() => new Promise(() => {})));
    renderVolume();
    expect(document.querySelector('.MuiCircularProgress-root')).toBeTruthy();
    expect(screen.queryByRole('heading', { name: 'Questa settimana' })).toBeNull();
  });

  it.each([
    ['il server risponde con un errore', () => Promise.resolve({ ok: false, status: 500, json: async () => ({ success: false }) })],
    ['la rete non risponde', () => Promise.reject(new Error('rete'))],
  ])('se la lettura fallisce (%s) c\'è un errore con «Riprova», non una settimana a zero', async (_, reply) => {
    vi.stubGlobal('fetch', vi.fn(reply));
    renderVolume();
    expect(await screen.findByText('Impossibile caricare i dati della settimana.')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Riprova' })).toBeTruthy();
    expect(screen.queryByRole('heading', { name: 'Questa settimana' })).toBeNull();
    expect(screen.queryByText('0 kg')).toBeNull();
  });

  it('«Riprova» rilegge: se riesce l\'errore sparisce e arrivano i dati', async () => {
    let up = false;
    const fetchMock = vi.fn(() => (up ? Promise.resolve(json(dashboardStats)) : Promise.reject(new Error('rete'))));
    vi.stubGlobal('fetch', fetchMock);
    renderVolume();
    const retry = await screen.findByRole('button', { name: 'Riprova' });
    expect(getComputedStyle(retry).minHeight).toBe('44px');
    expect(getComputedStyle(retry).fontSize).toBe('16px');
    up = true;
    fireEvent.click(retry);
    await screen.findByRole('heading', { level: 2, name: 'Questa settimana' });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(screen.queryByText('Impossibile caricare i dati della settimana.')).toBeNull();
    expect(stat('Serie').textContent).toBe('53');
  });
});

describe('aspetto', () => {
  it('nessun testo sotto i 16 px, con il modulo attivo e spento', async () => {
    const { container, unmount } = await mount();
    expect(textBelow(container, 16)).toEqual([]);
    unmount();
    account.modules = { recovery: false };
    const off = await mount();
    expect(textBelow(off.container, 16)).toEqual([]);
  });
});
