// Misure corporee visto dall'utente: selettore del periodo, variazione del peso, stato vuoto e storico a pagine.
// La fetch è il confine; "oggi" è fissato al 20/10/2026.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, within, act, waitFor } from '@testing-library/react';
import BodyStats from './BodyStats';
import { ThemeModeProvider } from '../context/ThemeModeContext';
import { formatDate } from '../i18n/format';
import { polylineX } from '../test/polyline';
import { setBrowserTimeZone } from '../test/timeZone';
import { textBelow } from '../test/minText';
import { describedBy } from '../test/accessibleNames';
import { mockPointer } from '../test/pointer';
import { expectNoNestedContainer, expectDestructiveConfirm, expectChipOn, expectChipOff } from '../test/dom';

const account = vi.hoisted(() => ({ weightUnit: 'kg' }));
vi.mock('../context/AuthContext', () => ({ useAuth: () => ({ weightUnit: account.weightUnit }) }));

const row = (date, weight, extra = {}) => ({ id: date, date, weight, ...extra });

let records;
beforeEach(() => {
  account.weightUnit = 'kg';
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(2026, 9, 20, 12, 0));
  records = [];
  vi.stubGlobal('fetch', vi.fn(() => Promise.resolve({ ok: true, json: async () => ({ records }) })));
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

// Con wrap si monta dentro un provider (es. il tema dell'app)
const mount = async (wrap = (page) => page) => {
  render(wrap(<BodyStats />));
  await screen.findByRole('group', { name: 'Periodo' });
};
// Il peso grande della scheda (la tabella nascosta del grafico ha lo stesso testo)
const bigValue = (text) => screen.getAllByText(text).find((el) => !el.closest('table'));
const pill = (name) => screen.getByRole('button', { name });
const history = () => screen.getByRole('table', { name: 'Storico delle misure' });
const tableRows = () => within(history()).getAllByRole('row').slice(1);

describe('contenitore', () => {
  it('non incorporata, la pagina non apre un Container dentro quello del Layout', async () => {
    records = [row('2026-10-15', '80.0')];
    await mount();
    expectNoNestedContainer();
  });
});

describe('periodo e variazione del peso', () => {
  beforeEach(() => {
    records = [
      row('2025-12-01', '90.0'),
      row('2026-05-10', '85.0'),
      row('2026-08-10', '82.0'),
      row('2026-09-25', '81.0'),
      row('2026-10-15', '80.0'),
    ];
  });

  it('parte da 3 mesi: peso e variazione contano solo il periodo', async () => {
    await mount();
    expect(pill('3M').getAttribute('aria-pressed')).toBe('true');
    expect(bigValue('80 kg')).toBeTruthy();
    expect(screen.getByText(/-2 kg negli ultimi 3 mesi/)).toBeTruthy();
  });

  it('cambiando periodo cambiano variazione e testo', async () => {
    await mount();
    fireEvent.click(pill('1M'));
    expect(screen.getByText(/-1 kg nell'ultimo mese/)).toBeTruthy();
    fireEvent.click(pill('6M'));
    expect(screen.getByText(/-5 kg negli ultimi 6 mesi/)).toBeTruthy();
    fireEvent.click(pill('1A'));
    expect(screen.getByText(/-10 kg nell'ultimo anno/)).toBeTruthy();
    fireEvent.click(pill('Tutto'));
    expect(screen.getByText(/-10 kg dalla prima rilevazione/)).toBeTruthy();
  });

  it('un solo peso nel periodo: nessuna variazione, ma il valore c\'è', async () => {
    records = [row('2026-05-01', '85.0'), row('2026-10-15', '80.0')];
    await mount();
    expect(bigValue('80 kg')).toBeTruthy();
    expect(screen.queryByText(/kg negli ultimi 3 mesi/)).toBeNull();
  });

  it('una variazione che arrotondata è 0 si legge "Stabile", senza freccia', async () => {
    records = [row('2026-08-10', '80.0'), row('2026-10-15', '80.04')];
    await mount();
    expect(screen.getByText('Stabile negli ultimi 3 mesi')).toBeTruthy();
    expect(screen.queryByText(/0,0 kg|▲|▼/)).toBeNull();
  });
});

describe('grafico del peso', () => {
  const weightLineX = () => polylineX(screen.getByText('Andamento peso (kg)').closest('.MuiCard-root').querySelector('polyline'));

  it('i punti stanno alla loro data, tra l\'inizio del periodo e oggi', async () => {
    // 3M: dal 20/07 al 20/10, 92 giorni. Il 10/08 è al giorno 21, il 15/10 al giorno 87.
    records = [row('2026-05-10', '85.0'), row('2026-08-10', '82.0'), row('2026-10-15', '80.0')];
    await mount();
    expect(weightLineX()).toEqual([50.2, 208.0]);
  });
});

describe('periodo senza misure', () => {
  it('mostra l\'ultima rilevazione, senza peso se quella riga non ne ha, e Tutto riporta i grafici', async () => {
    records = [row('2026-01-10', '84.0'), row('2026-05-19', null, { chest_size: '100' })];
    await mount();
    expect(screen.getByText('Nessuna misura nel periodo')).toBeTruthy();
    expect(screen.getByText(`Ultima rilevazione il ${formatDate('2026-05-19')}: —`)).toBeTruthy();

    fireEvent.click(pill('Tutto'));
    expect(screen.queryByText('Nessuna misura nel periodo')).toBeNull();
    expect(bigValue('84 kg')).toBeTruthy();
  });

  it('l\'ultima rilevazione porta il suo peso quando ce l\'ha', async () => {
    records = [row('2026-05-19', '83.5')];
    await mount();
    expect(screen.getByText(`Ultima rilevazione il ${formatDate('2026-05-19')}: 83,5 kg`)).toBeTruthy();
  });

  it('con l\'API in ordine inverso la riga più recente resta la più recente', async () => {
    records = [row('2026-05-19', '83.5'), row('2026-01-10', '90.0')];
    await mount();
    expect(screen.getByText(`Ultima rilevazione il ${formatDate('2026-05-19')}: 83,5 kg`)).toBeTruthy();
  });
});

describe('storico a pagine', () => {
  beforeEach(() => {
    // 25 misure, una ogni 10 giorni all'indietro da oggi: la maggior parte fuori da 1M
    records = Array.from({ length: 25 }, (_, i) => {
      const d = new Date(2026, 9, 20 - 10 * (24 - i));
      return row(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`, '80.0');
    });
  });

  it('10 righe alla volta, dalla più recente, con "1–10 di 25"', async () => {
    await mount();
    expect(tableRows()).toHaveLength(10);
    expect(within(tableRows()[0]).getByText(formatDate('2026-10-20'))).toBeTruthy();
    expect(screen.getByText('1–10 di 25')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Pagina precedente' }).disabled).toBe(true);
  });

  it('successive, ultima pagina e prima pagina', async () => {
    await mount();
    fireEvent.click(screen.getByRole('button', { name: 'Pagina successiva' }));
    expect(screen.getByText('11–20 di 25')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Ultima pagina' }));
    expect(screen.getByText('21–25 di 25')).toBeTruthy();
    expect(tableRows()).toHaveLength(5);
    expect(screen.getByRole('button', { name: 'Pagina successiva' }).disabled).toBe(true);

    fireEvent.click(screen.getByRole('button', { name: 'Prima pagina' }));
    expect(screen.getByText('1–10 di 25')).toBeTruthy();
  });

  it('lo storico non segue il periodo scelto', async () => {
    await mount();
    fireEvent.click(pill('1M'));
    expect(screen.getByText('1–10 di 25')).toBeTruthy();
  });
});

describe('font delle pillole', () => {
  it('col tema dell\'app sono in Lexend 500, come gli altri chip che si premono', async () => {
    records = [row('2026-10-01', '80.0')];
    await mount((page) => <ThemeModeProvider>{page}</ThemeModeProvider>);
    const { fontFamily, fontWeight } = getComputedStyle(pill('3M'));
    expect({ fontFamily, fontWeight }).toEqual({ fontFamily: '"Lexend", sans-serif', fontWeight: '500' });
  });
});

describe('titolo della pagina', () => {
  it('"Statistiche fisiche" è l\'h1 della pagina, in Lexend 800 a 28px', async () => {
    records = [row('2026-10-01', '80.0')];
    await mount((page) => <ThemeModeProvider>{page}</ThemeModeProvider>);
    const { fontFamily, fontWeight, fontSize } = getComputedStyle(
      screen.getByRole('heading', { level: 1, name: 'Statistiche fisiche' }),
    );
    expect({ fontFamily, fontWeight, fontSize }).toEqual({ fontFamily: '"Lexend", sans-serif', fontWeight: '800', fontSize: '28px' });
  });
});

// Aspetto, sul tema chiaro. Colori scritti per esteso: text.primary #1a1816, text.secondary #6b6663,
// primary #d50000, background.paper #ffffff.
const INK = 'rgb(26, 24, 22)';
const GREY = 'rgb(107, 102, 99)';
const RED = 'rgb(213, 0, 0)';
const WHITE = 'rgb(255, 255, 255)';
const style = (el) => getComputedStyle(el);
// Colori del chip in chiaro e in scuro: text.primary, text.secondary e background.paper
const CHIP_COLORS = {
  light: { ink: 'rgb(26, 24, 22)', grey: 'rgb(107, 102, 99)', paper: 'rgb(255, 255, 255)' },
  dark: { ink: 'rgb(255, 255, 255)', grey: 'rgb(160, 160, 162)', paper: 'rgb(20, 20, 22)' },
};
const themed = (page) => <ThemeModeProvider>{page}</ThemeModeProvider>;

const measured = () => [
  row('2026-10-01', '82.0', { body_fat_percentage: '20.0', muscle_mass_percentage: '40.0', chest_size: '100', waist_size: '85' }),
  row('2026-10-15', '80.0', { body_fat_percentage: '18.5', muscle_mass_percentage: '41.0', chest_size: '102', waist_size: '83' }),
];
const measureRow = (name) => screen.getByText(name, { selector: 'p' }).closest('[data-measure-row]');
const polylineY = (el) => el.querySelector('polyline').getAttribute('points').split(' ').map((p) => Number(p.split(',')[1]));

describe('pillole del periodo', () => {
  beforeEach(() => { localStorage.setItem('themeMode', 'light'); records = measured(); });

  it('la pillola attiva è piena in inchiostro con testo chiaro, le altre hanno solo il contorno', async () => {
    await mount(themed);
    expect(style(pill('3M')).backgroundColor).toBe(INK);
    expect(style(pill('3M')).color).toBe(WHITE);
    expect(style(pill('6M')).backgroundColor).not.toBe(INK);
    expect(style(pill('6M')).color).toBe(INK);
    expect(style(pill('6M')).borderColor).toBe(GREY);
  });

  it.each(['light', 'dark'])('stesso stile del chip scelto delle altre pagine, in %s', async (mode) => {
    localStorage.setItem('themeMode', mode);
    await mount(themed);
    expectChipOn(pill('3M'), CHIP_COLORS[mode]);
    expectChipOff(pill('6M'), CHIP_COLORS[mode]);
  });

  it('il rosso resta su "Nuova misurazione": nessuna pillola è rossa', async () => {
    await mount(themed);
    ['1M', '3M', '6M', '1A', 'Tutto'].forEach((name) => {
      expect(style(pill(name)).backgroundColor).not.toBe(RED);
      expect(style(pill(name)).borderColor).not.toBe(RED);
    });
    expect(style(screen.getByRole('button', { name: 'Nuova misurazione' })).backgroundColor).toBe(RED);
  });
});

describe('titoli, peso e variazione', () => {
  beforeEach(() => { localStorage.setItem('themeMode', 'light'); records = measured(); });

  it('i titoli delle card sono nello stile titolo di card, non maiuscoli', async () => {
    await mount(themed);
    ['Andamento peso (kg)', 'Composizione corporea (%)', 'Circonferenze (cm)'].forEach((title) => {
      const s = style(screen.getByText(title));
      expect(s.textTransform).not.toBe('uppercase');
      expect(s.fontFamily).toBe('"Lexend", sans-serif');
      expect(s.fontWeight).toBe('700');
      expect(s.fontSize).toBe('17px');
    });
  });

  it('il peso attuale è nello stile numero grande', async () => {
    await mount(themed);
    const s = style(bigValue('80 kg'));
    expect(s.fontFamily).toBe('"Lexend", sans-serif');
    expect(s.fontWeight).toBe('700');
    expect(s.fontSize).toBe('22px');
    expect(s.fontVariantNumeric).toBe('tabular-nums');
  });

  it.each([
    ['calo', ['85.0', '80.0'], /-5 kg negli ultimi 3 mesi/],
    ['aumento', ['80.0', '85.0'], /\+5 kg negli ultimi 3 mesi/],
    ['arrotondato a un decimale', ['80.0', '80.06'], /\+0,1 kg negli ultimi 3 mesi/],
    ['stabile', ['80.0', '80.0'], /Stabile negli ultimi 3 mesi/],
  ])('la variazione del peso è grigia e da 16px: %s', async (_, [first, last], text) => {
    records = [row('2026-10-01', first), row('2026-10-15', last)];
    await mount(themed);
    expect(style(screen.getByText(text)).color).toBe(GREY);
    expect(style(screen.getByText(text)).fontSize).toBe('16px');
  });
});

describe('composizione e circonferenze', () => {
  beforeEach(() => { localStorage.setItem('themeMode', 'light'); records = measured(); });

  it('una riga per misura: nome e ultimo valore da 16px', async () => {
    await mount(themed);
    const fat = measureRow('Grasso');
    expect(style(within(fat).getByText('Grasso')).fontSize).toBe('16px');
    expect(style(within(fat).getByText('18,5%')).fontSize).toBe('16px');
    expect(within(measureRow('Muscolo')).getByText('41%')).toBeTruthy();
    expect(within(measureRow('Torace')).getByText('102 cm')).toBeTruthy();
    expect(within(measureRow('Vita')).getByText('83 cm')).toBeTruthy();
  });

  it('le righe stanno nella card giusta, senza i dati nel titolo', async () => {
    await mount(themed);
    const composition = screen.getByText('Composizione corporea (%)').closest('.MuiCard-root');
    const circumferences = screen.getByText('Circonferenze (cm)').closest('.MuiCard-root');
    expect(composition.querySelectorAll('[data-measure-row]')).toHaveLength(2);
    expect(circumferences.querySelectorAll('[data-measure-row]')).toHaveLength(4);
    expect(within(composition).getByText('Grasso')).toBeTruthy();
    expect(within(circumferences).getByText('Vita')).toBeTruthy();
  });

  it('niente legenda a pallini: nome e valore non sono in un testo solo', async () => {
    await mount(themed);
    expect(screen.queryByText(/Grasso:/)).toBeNull();
  });

  it('ogni misura ha il suo grafico con la propria scala e tutti hanno lo stesso colore, neutro come la linea del peso', async () => {
    await mount(themed);
    // Grasso scende da 20 a 18,5 e Muscolo sale da 40 a 41: scale diverse, ma entrambi occupano tutta l'altezza (4 e 32 su 36)
    for (const name of ['Grasso', 'Muscolo', 'Torace', 'Vita']) {
      const r = measureRow(name);
      expect([...polylineY(r)].sort((a, b) => a - b)).toEqual([4, 32]);
      expect(style(r.querySelector('svg').parentElement).color).toBe(INK);
    }
  });

  it('una misura mai rilevata mostra "—" e nessun grafico; con un solo punto il valore c\'è e il grafico no', async () => {
    records = [row('2026-10-15', '80.0', { body_fat_percentage: '18.5' })];
    await mount(themed);
    expect(within(measureRow('Gamba')).getByText('—')).toBeTruthy();
    expect(measureRow('Gamba').querySelector('polyline')).toBeNull();
    expect(within(measureRow('Grasso')).getByText('18,5%')).toBeTruthy();
    expect(measureRow('Grasso').querySelector('polyline')).toBeNull();
  });

  it('il valore è l\'ultimo disponibile nel periodo, anche se l\'ultima rilevazione non lo ha', async () => {
    records = [...measured(), row('2026-10-18', '79.5')];
    await mount(themed);
    expect(within(measureRow('Grasso')).getByText('18,5%')).toBeTruthy();
  });
});

describe('testi', () => {
  const phone = () => {
    window.matchMedia = (query) => ({
      matches: true, media: query, onchange: null,
      addEventListener: () => {}, removeEventListener: () => {}, addListener: () => {}, removeListener: () => {}, dispatchEvent: () => false,
    });
  };
  const original = window.matchMedia;
  beforeEach(() => { localStorage.setItem('themeMode', 'light'); records = measured(); });
  afterEach(() => { window.matchMedia = original; });

  // Esenti: le pillole del periodo, che sono chip (13px), e la tabella del grafico, nascosta alla vista
  it.each([['da tablet', () => {}], ['sul telefono', phone]])('nessun testo %s è sotto i 16px, salvo le pillole del periodo', async (_, setup) => {
    setup();
    await mount(themed);
    expect(textBelow(document.body, 16, '.MuiChip-root, .MuiCard-root > table')).toEqual([]);
  });
});

describe('storico', () => {
  const phone = () => {
    window.matchMedia = (query) => ({
      matches: true, media: query, onchange: null,
      addEventListener: () => {}, removeEventListener: () => {}, addListener: () => {}, removeListener: () => {}, dispatchEvent: () => false,
    });
  };
  const original = window.matchMedia;
  beforeEach(() => { localStorage.setItem('themeMode', 'light'); records = measured(); });
  afterEach(() => { window.matchMedia = original; });

  it('da tablet è una tabella con intestazioni in sentence case da 16px e celle da 16px', async () => {
    await mount(themed);
    const headers = within(history()).getAllByRole('columnheader');
    expect(headers.map((h) => h.textContent)).toEqual(['Data', 'Peso (kg)', 'Grasso %', 'Muscolo %', 'Torace (cm)', 'Braccio (cm)', 'Vita (cm)', 'Gamba (cm)', 'Azioni']);
    headers.forEach((h) => {
      expect(style(h).textTransform).not.toBe('uppercase');
      expect(style(h).fontSize).toBe('16px');
      expect(style(h).color).toBe(GREY);
    });
    expect(style(within(tableRows()[0]).getAllByRole('cell')[0]).fontSize).toBe('16px');
  });

  it('il cestino non è rosso e ha un nome', async () => {
    await mount(themed);
    const del = within(tableRows()[0]).getByRole('button', { name: 'Elimina' });
    expect(style(del).color).toBe(GREY);
  });

  it('sul telefono non c\'è la tabella: ogni misura è un elemento di lista a due linee', async () => {
    phone();
    await mount(themed);
    expect(screen.queryByRole('table', { name: 'Storico delle misure' })).toBeNull();
    const items = screen.getAllByRole('listitem');
    expect(items).toHaveLength(2);
    const first = items[0];
    expect(within(first).getByText(formatDate('2026-10-15'))).toBeTruthy();
    expect(style(within(first).getByText('80 kg')).fontWeight).toBe('700');
    const detail = within(first).getByText(/Grasso 18,5%/);
    expect(detail.textContent).toBe('Grasso 18,5% · Muscolo 41% · Torace 102 cm · Vita 83 cm');
    expect(style(detail).color).toBe(GREY);
    expect(style(detail).fontSize).toBe('16px');
  });

  it('sul telefono le misure mancanti non compaiono e una riga senza altro non ha la seconda linea', async () => {
    phone();
    records = [row('2026-10-15', '80.0')];
    await mount(themed);
    const item = screen.getByRole('listitem');
    expect(item.textContent).not.toContain('Grasso');
    expect(item.querySelectorAll('p')).toHaveLength(2);
  });

  it('sul telefono il cestino è un bersaglio da 44px e la paginazione resta', async () => {
    phone();
    records = Array.from({ length: 12 }, (_, i) => row(`2026-09-${String(i + 1).padStart(2, '0')}`, '80.0'));
    await mount(themed);
    const del = within(screen.getAllByRole('listitem')[0]).getByRole('button', { name: 'Elimina' });
    expect(style(del).width).toBe('44px');
    expect(style(del).height).toBe('44px');
    expect(screen.getAllByRole('listitem')).toHaveLength(10);
    expect(screen.getByText('1–10 di 12')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Pagina successiva' }));
    expect(screen.getAllByRole('listitem')).toHaveLength(2);
  });

  it('senza misure sul telefono si legge lo stato vuoto', async () => {
    phone();
    records = [];
    render(themed(<BodyStats />));
    expect(await screen.findByText('Nessuna misurazione registrata')).toBeTruthy();
  });
});

describe('giorno della nuova misura', () => {
  const saveAt = async (zone, hour, minute) => {
    setBrowserTimeZone(zone);
    records = [row('2026-10-15', '80.0')];
    vi.setSystemTime(new Date(2026, 9, 20, hour, minute));
    await mount();
    fireEvent.click(screen.getByRole('button', { name: 'Nuova misurazione' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Salva' }));
    const post = fetch.mock.calls.find(([, init]) => init?.method === 'POST');
    return JSON.parse(post[1].body).date;
  };

  it('subito dopo mezzanotte è il giorno locale, non quello UTC del giorno prima', async () => {
    expect(await saveAt('Europe/Rome', 0, 30)).toBe('2026-10-20');
  });
  it('a fine giornata è il giorno locale, non quello UTC del giorno dopo', async () => {
    expect(await saveAt('America/New_York', 23, 30)).toBe('2026-10-20');
  });
});

describe('grafici del corpo: colore', () => {
  beforeEach(() => { records = measured(); });

  it.each([
    ['light', 'rgb(26, 24, 22)'],
    ['dark', 'rgb(255, 255, 255)'],
  ])('le linee del peso e delle altre misure sono neutre (colore del testo) in %s, non rosse', async (mode, ink) => {
    localStorage.setItem('themeMode', mode);
    await mount(themed);
    expect(style(screen.getByRole('img', { name: /Andamento peso/ })).color).toBe(ink);
    ['Grasso', 'Muscolo', 'Torace', 'Vita'].forEach((name) => {
      expect(style(measureRow(name).querySelector('polyline').parentElement.parentElement).color).toBe(ink);
    });
  });
});

describe('misure: separatore decimale della lingua', () => {
  beforeEach(() => { records = [row('2026-10-15', '79.30', { body_fat_percentage: '18.50', muscle_mass_percentage: '41.00', waist_size: '83.25' })]; });

  it('la tabella dello storico scrive pesi e misure con la virgola e senza zeri finali', async () => {
    await mount();
    const cells = within(tableRows()[0]).getAllByRole('cell').map((c) => c.textContent);
    expect(cells.slice(1, 3)).toEqual(['79,3', '18,5']);
    expect(cells).toContain('41');
    expect(cells).toContain('83,25');
    expect(cells.join(' ')).not.toMatch(/\d\.\d/);
  });

  it('le righe delle misure scrivono il valore con la virgola', async () => {
    await mount();
    expect(within(measureRow('Grasso')).getByText('18,5%')).toBeTruthy();
    expect(within(measureRow('Vita')).getByText('83,25 cm')).toBeTruthy();
  });
});

describe('grafico del peso: alternativa testuale', () => {
  beforeEach(() => {
    records = [row('2026-08-10', '82.0'), row('2026-09-25', '81.5'), row('2026-10-15', '80.0')];
  });

  it('il grafico è un\'immagine con un nome che dice titolo e ultimo valore', async () => {
    await mount();
    expect(screen.getByRole('img', { name: /^Grafico: Andamento peso \(kg\)\. Ultimo valore: 80\skg\.$/ })).toBeTruthy();
  });

  it('gli stessi valori sono in una tabella con intestazioni, una riga per misura del periodo', async () => {
    await mount();
    const table = screen.getByRole('table', { name: 'Andamento peso (kg)' });
    expect(within(table).getAllByRole('columnheader').map((h) => h.textContent)).toEqual(['Data', 'Peso']);
    const body = within(table).getAllByRole('row').slice(1).map((r) => within(r).getAllByRole('cell').map((c) => c.textContent));
    expect(body).toEqual([
      [formatDate('2026-08-10'), '82\u00a0kg'],
      [formatDate('2026-09-25'), '81,5\u00a0kg'],
      [formatDate('2026-10-15'), '80\u00a0kg'],
    ]);
  });

  it('la tabella non si vede: è nascosta solo visivamente', async () => {
    await mount();
    const { width, height, overflow } = getComputedStyle(screen.getByRole('table', { name: 'Andamento peso (kg)' }));
    expect({ width, height, overflow }).toEqual({ width: '1px', height: '1px', overflow: 'hidden' });
  });
});

describe('nuova misura: errori dei valori (WCAG 3.3.1, 4.1.3)', () => {
  beforeEach(() => { records = [row('2026-10-15', '80.0')]; });
  const field = (label) => screen.getByRole('spinbutton', { name: label });
  const type = (label, value) => fireEvent.change(field(label), { target: { value } });
  const posts = () => fetch.mock.calls.filter(([, init]) => init?.method === 'POST');
  const open = async () => {
    await mount();
    fireEvent.click(screen.getByRole('button', { name: 'Nuova misurazione' }));
    await screen.findByRole('dialog');
  };
  const save = () => fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Salva' }));

  it('un peso oltre il tetto non parte: l\'errore sta sotto il campo, collegato, e il focus va lì', async () => {
    await open();
    type('Peso (kg)', '600');
    save();
    expect(posts()).toHaveLength(0);
    expect(field('Peso (kg)').getAttribute('aria-invalid')).toBe('true');
    expect(describedBy(field('Peso (kg)'))).toBe('Il valore deve essere tra 0 e 500, estremi inclusi.');
    expect(document.activeElement).toBe(field('Peso (kg)'));
  });

  it('con più campi sbagliati li segna tutti e porta il focus sul primo della scheda', async () => {
    await open();
    type('Gamba (cm)', '999');
    type('Grasso (%)', '-3');
    save();
    expect(describedBy(field('Grasso (%)'))).toBe('Il valore deve essere tra 0 e 100, estremi inclusi.');
    expect(describedBy(field('Gamba (cm)'))).toBe('Il valore deve essere tra 0 e 200, estremi inclusi.');
    expect(field('Peso (kg)').getAttribute('aria-invalid')).not.toBe('true');
    expect(document.activeElement).toBe(field('Grasso (%)'));
  });

  it('correggere un campo toglie il suo errore; salvare un valore buono parte e chiude', async () => {
    await open();
    type('Peso (kg)', '600');
    save();
    type('Peso (kg)', '80');
    expect(field('Peso (kg)').getAttribute('aria-invalid')).not.toBe('true');
    expect(describedBy(field('Peso (kg)'))).toBeUndefined();
    save();
    expect(posts()).toHaveLength(1);
  });

  const rejectWith = (body) => fetch.mockImplementation((url, init) => Promise.resolve(init?.method === 'POST'
    ? { ok: false, status: 400, json: async () => body }
    : { ok: true, json: async () => ({ records }) }));

  it('un errore del server su un campo (con "field" e "max") finisce sotto quel campo, col testo del client e non del server', async () => {
    await open();
    type('Vita (cm)', '90');
    rejectWith({ message: 'Vita: il valore deve essere tra 0 e 80, estremi inclusi.', field: 'waist_size', max: 80 });
    await act(async () => { save(); });
    expect(describedBy(field('Vita (cm)'))).toBe('Il valore deve essere tra 0 e 80, estremi inclusi.');
    expect(document.activeElement).toBe(field('Vita (cm)'));
  });

  it('se la risposta ha "field" ma non "max", sotto il campo c\'è il messaggio del server', async () => {
    await open();
    type('Vita (cm)', '90');
    rejectWith({ message: 'Messaggio del server', field: 'waist_size' });
    await act(async () => { save(); });
    expect(describedBy(field('Vita (cm)'))).toBe('Messaggio del server');
  });

  it('un errore del server senza campo resta un avviso con il suo messaggio', async () => {
    await open();
    type('Vita (cm)', '90');
    rejectWith({ message: 'Qualcosa non va' });
    await act(async () => { save(); });
    expect(screen.getByText('Qualcosa non va')).toBeTruthy();
    expect(field('Vita (cm)').getAttribute('aria-invalid')).not.toBe('true');
  });

  // 2.5.3: su telefono il campo data apre un dialogo; il suo nome contiene l'etichetta visibile
  it('il campo data ha un nome che contiene «Data»', async () => {
    await open();
    expect(within(screen.getByRole('dialog')).getByRole('textbox', { name: /^Data\b/ })).toBeTruthy();
  });

  // Con il puntatore preciso il selettore di date si digita (in jsdom, senza, è di sola lettura)
  describe('data cancellata o incompleta (puntatore preciso)', () => {
    beforeEach(() => mockPointer(true));
    const dateField = () => within(screen.getByRole('dialog')).getByRole('textbox', { name: /^Data/ });

    it.each([['cancellata', ''], ['inesistente', '31/02/2026']])('data %s: non parte nulla, l\'errore sta sotto il campo data e il focus va lì', async (_, typed) => {
      await open();
      type('Peso (kg)', '80');
      fireEvent.change(dateField(), { target: { value: typed } });
      save();
      expect(posts()).toHaveLength(0);
      expect(dateField().getAttribute('aria-invalid')).toBe('true');
      expect(describedBy(dateField())).toBe('Inserisci una data valida.');
      expect(document.activeElement).toBe(dateField());
      expect(screen.queryByText('Errore di connessione')).toBeNull();
    });

    it('con la data sbagliata e un peso sbagliato il focus va prima sulla data; correggere la data toglie il suo errore', async () => {
      await open();
      type('Peso (kg)', '600');
      fireEvent.change(dateField(), { target: { value: '' } });
      save();
      expect(document.activeElement).toBe(dateField());
      expect(describedBy(field('Peso (kg)'))).toBe('Il valore deve essere tra 0 e 500, estremi inclusi.');
      fireEvent.change(dateField(), { target: { value: '15/10/2026' } });
      expect(dateField().getAttribute('aria-invalid')).not.toBe('true');
    });
  });

  it('riaprendo il dialogo gli errori sono spariti', async () => {
    await open();
    type('Peso (kg)', '600');
    save();
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Annulla' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    fireEvent.click(screen.getByRole('button', { name: 'Nuova misurazione' }));
    expect(field('Peso (kg)').getAttribute('aria-invalid')).not.toBe('true');
  });
});

describe('unità di peso dell\'account: lb', () => {
  beforeEach(() => { account.weightUnit = 'lb'; });
  const field = (label) => screen.getByRole('spinbutton', { name: label });
  const type = (label, value) => fireEvent.change(field(label), { target: { value } });
  const posts = () => fetch.mock.calls.filter(([, init]) => init?.method === 'POST');
  const open = async () => {
    await mount();
    fireEvent.click(screen.getByRole('button', { name: 'Nuova misurazione' }));
    await screen.findByRole('dialog');
  };
  const save = () => fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Salva' }));

  it('peso, variazione, titolo e intestazioni sono in libbre con un decimale', async () => {
    records = [row('2026-09-25', '81.0'), row('2026-10-15', '80.0')];
    await mount();
    expect(bigValue('176,4 lb')).toBeTruthy(); // 80 kg
    expect(screen.getByText(/-2,2 lb negli ultimi 3 mesi/)).toBeTruthy(); // -1 kg
    expect(screen.getByText('Andamento peso (lb)')).toBeTruthy();
    expect(within(history()).getAllByRole('columnheader')[1].textContent).toBe('Peso (lb)');
    expect(within(tableRows()[0]).getByText('176,4')).toBeTruthy();
    expect(screen.queryByText(/\bkg\b/)).toBeNull();
  });

  it('un periodo senza misure mostra l\'ultima rilevazione in libbre', async () => {
    records = [row('2026-05-19', '83.5')];
    await mount();
    expect(screen.getByText(`Ultima rilevazione il ${formatDate('2026-05-19')}: 184,1 lb`)).toBeTruthy();
  });

  it('il campo si legge in libbre e parte in kg a 0,01', async () => {
    records = [row('2026-10-15', '80.0')];
    await open();
    type('Peso (lb)', '176.4');
    save();
    expect(posts()).toHaveLength(1);
    expect(JSON.parse(posts()[0][1].body).weight).toBe('80.01');
  });

  it('il tetto è mostrato in libbre, senza punto delle migliaia: 500 kg = 1102,3 lb, e il campo lo accetta ricopiato', async () => {
    records = [row('2026-10-15', '80.0')];
    await open();
    type('Peso (lb)', '1200');
    save();
    expect(posts()).toHaveLength(0);
    expect(describedBy(field('Peso (lb)'))).toBe('Il valore deve essere tra 0 e 1102,3, estremi inclusi.');
    type('Peso (lb)', '1102,3');
    save();
    expect(posts()).toHaveLength(1);
  });

  it('un testo non valido in libbre dà l\'errore sotto il campo e non parte', async () => {
    records = [row('2026-10-15', '80.0')];
    await open();
    type('Peso (lb)', '1e2');
    await act(async () => { save(); });
    expect(describedBy(field('Peso (lb)'))).toBe('Il valore deve essere tra 0 e 1102,3, estremi inclusi.');
    expect(fetch.mock.calls.some(([, init]) => init?.method === 'POST')).toBe(false);
  });

  it('un errore del server sul peso (max in kg) è mostrato in libbre', async () => {
    records = [row('2026-10-15', '80.0')];
    await open();
    type('Peso (lb)', '176');
    fetch.mockImplementation((url, init) => Promise.resolve(init?.method === 'POST'
      ? { ok: false, status: 400, json: async () => ({ message: 'Peso: fuori scala', field: 'weight', max: 500 }) }
      : { ok: true, json: async () => ({ records }) }));
    await act(async () => { save(); });
    expect(describedBy(field('Peso (lb)'))).toBe('Il valore deve essere tra 0 e 1102,3, estremi inclusi.');
  });
});

describe('unità di peso dell\'account: kg, il peso inviato resta come scritto', () => {
  it('un peso in kg parte com\'è', async () => {
    records = [row('2026-10-15', '80.0')];
    await mount();
    fireEvent.click(screen.getByRole('button', { name: 'Nuova misurazione' }));
    await screen.findByRole('dialog');
    fireEvent.change(screen.getByRole('spinbutton', { name: 'Peso (kg)' }), { target: { value: '80.5' } });
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Salva' }));
    const post = fetch.mock.calls.find(([, init]) => init?.method === 'POST');
    expect(JSON.parse(post[1].body).weight).toBe('80.5');
  });
});

describe('circonferenze: utente in lb (pollici)', () => {
  beforeEach(() => { account.weightUnit = 'lb'; records = measured(); });
  const field = (label) => screen.getByRole('spinbutton', { name: label });
  const type = (label, value) => fireEvent.change(field(label), { target: { value } });
  const posts = () => fetch.mock.calls.filter(([, init]) => init?.method === 'POST');
  const open = async () => {
    await mount();
    fireEvent.click(screen.getByRole('button', { name: 'Nuova misurazione' }));
    await screen.findByRole('dialog');
  };
  const save = () => fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Salva' }));
  const lastBody = () => JSON.parse(posts().at(-1)[1].body);

  it('titolo della card e valori delle righe sono in pollici a un decimale', async () => {
    await mount();
    expect(screen.getByText('Circonferenze (in)')).toBeTruthy();
    expect(screen.queryByText('Circonferenze (cm)')).toBeNull();
    expect(within(measureRow('Torace')).getByText('40,2 in')).toBeTruthy(); // 102 cm = 40,16
    expect(within(measureRow('Vita')).getByText('32,7 in')).toBeTruthy(); // 83 cm = 32,68
  });

  it('la tabella dello storico mostra i pollici, le percentuali restano come sono', async () => {
    await mount();
    const cells = within(tableRows()[0]).getAllByRole('cell').map((c) => c.textContent);
    expect(cells.slice(2, 4)).toEqual(['18,5', '41']);
    expect(cells.slice(4, 8)).toEqual(['40,2', '-', '32,7', '-']); // torace, braccio, vita, gamba
  });

  it('le colonne delle circonferenze nello storico dichiarano i pollici', async () => {
    await mount();
    const headers = within(history()).getAllByRole('columnheader');
    expect(headers.slice(4, 8).map((h) => h.textContent)).toEqual(['Torace (in)', 'Braccio (in)', 'Vita (in)', 'Gamba (in)']);
  });

  it('sul telefono la seconda linea dello storico scrive i pollici', async () => {
    const original = window.matchMedia;
    window.matchMedia = (query) => ({
      matches: true, media: query, onchange: null,
      addEventListener: () => {}, removeEventListener: () => {}, addListener: () => {}, removeListener: () => {}, dispatchEvent: () => false,
    });
    await mount();
    const detail = within(screen.getAllByRole('listitem')[0]).getByText(/Grasso 18,5%/);
    expect(detail.textContent).toBe('Grasso 18,5% · Muscolo 41% · Torace 40,2 in · Vita 32,7 in');
    window.matchMedia = original;
  });

  it('nessuna misura salvata cambia: i dati restano in cm (la mini-linea è la stessa della versione in cm)', async () => {
    await mount();
    const lb = polylineY(measureRow('Torace'));
    account.weightUnit = 'kg';
    document.body.innerHTML = '';
    await mount();
    expect(polylineY(measureRow('Torace'))).toEqual(lb);
  });

  it('i campi sono in pollici e il valore parte in cm a 0,01', async () => {
    await open();
    type('Torace (in)', '39.4');
    type('Braccio (in)', '14');
    type('Vita (in)', '32.8');
    type('Gamba (in)', '22.5');
    save();
    expect(posts()).toHaveLength(1);
    expect(lastBody()).toMatchObject({ chest_size: '100.08', arm_size: '35.56', waist_size: '83.31', leg_size: '57.15' });
  });

  it('un campo non compilato parte null', async () => {
    await open();
    type('Torace (in)', '39.4');
    save();
    expect(lastBody()).toMatchObject({ chest_size: '100.08', arm_size: null, waist_size: null, leg_size: null });
  });

  it('il tetto è mostrato in pollici: 300 cm = 118,1 in, 150 cm = 59 in, 200 cm = 78,7 in', async () => {
    await open();
    type('Torace (in)', '119');
    type('Braccio (in)', '60');
    type('Gamba (in)', '79');
    save();
    expect(posts()).toHaveLength(0);
    expect(describedBy(field('Torace (in)'))).toBe('Il valore deve essere tra 0 e 118,1, estremi inclusi.');
    expect(describedBy(field('Braccio (in)'))).toBe('Il valore deve essere tra 0 e 59, estremi inclusi.');
    expect(describedBy(field('Gamba (in)'))).toBe('Il valore deve essere tra 0 e 78,7, estremi inclusi.');
  });

  it('il massimo scritto in pollici è accettato e parte entro il limite in cm', async () => {
    await open();
    type('Torace (in)', '118.1');
    type('Braccio (in)', '59');
    type('Vita (in)', '118.1');
    type('Gamba (in)', '78.7');
    save();
    expect(posts()).toHaveLength(1);
    const body = lastBody();
    expect([body.chest_size, body.arm_size, body.waist_size, body.leg_size]).toEqual(['299.97', '149.86', '299.97', '199.9']);
  });

  it('un testo non valido in pollici dà l\'errore sotto il campo e non parte', async () => {
    await open();
    type('Vita (in)', '1e2');
    await act(async () => { save(); });
    expect(describedBy(field('Vita (in)'))).toBe('Il valore deve essere tra 0 e 118,1, estremi inclusi.');
    expect(posts()).toHaveLength(0);
  });

  it('un errore del server sulla vita (max in cm) è mostrato in pollici', async () => {
    await open();
    type('Vita (in)', '30');
    fetch.mockImplementation((url, init) => Promise.resolve(init?.method === 'POST'
      ? { ok: false, status: 400, json: async () => ({ message: 'Vita: fuori scala', field: 'waist_size', max: 300 }) }
      : { ok: true, json: async () => ({ records }) }));
    await act(async () => { save(); });
    expect(describedBy(field('Vita (in)'))).toBe('Il valore deve essere tra 0 e 118,1, estremi inclusi.');
  });

  it('peso e circonferenze insieme: entrambi convertiti, percentuali com\'erano', async () => {
    await open();
    type('Peso (lb)', '176.4');
    type('Grasso (%)', '18.5');
    type('Torace (in)', '39.4');
    save();
    expect(lastBody()).toMatchObject({ weight: '80.01', body_fat_percentage: '18.5', chest_size: '100.08' });
  });
});

describe('circonferenze: utente in kg, tutto com\'era', () => {
  const field = (label) => screen.getByRole('spinbutton', { name: label });
  it('etichette in cm e valore inviato come scritto', async () => {
    records = measured();
    await mount();
    expect(screen.getByText('Circonferenze (cm)')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Nuova misurazione' }));
    await screen.findByRole('dialog');
    fireEvent.change(field('Torace (cm)'), { target: { value: '102.5' } });
    fireEvent.change(field('Vita (cm)'), { target: { value: '83,25' } });
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Salva' }));
    const post = fetch.mock.calls.find(([, init]) => init?.method === 'POST');
    expect(JSON.parse(post[1].body)).toMatchObject({ chest_size: '102.5', arm_size: null, leg_size: null });
  });
});

describe('lettura fallita', () => {
  beforeEach(() => { vi.spyOn(console, 'error').mockImplementation(() => {}); });
  afterEach(() => { vi.restoreAllMocks(); });

  it('dà un errore nella pagina con «Riprova», diverso dalla pagina vuota, e senza avviso a scomparsa', async () => {
    let up = false;
    fetch.mockImplementation(() => (up ? Promise.resolve({ ok: true, json: async () => ({ records: [row('2026-10-15', '80.0')] }) }) : Promise.reject(new Error('rete'))));
    render(<BodyStats />);
    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toBe('Errore nel caricamento delle statistiche' + 'Riprova');
    expect(screen.getAllByRole('alert')).toHaveLength(1);
    expect(screen.queryByText('Nessuna misurazione registrata')).toBeNull();
    expect(screen.queryByRole('group', { name: 'Periodo' })).toBeNull();

    up = true;
    fireEvent.click(within(alert).getByRole('button', { name: 'Riprova' }));
    await screen.findByRole('group', { name: 'Periodo' });
    expect(screen.queryByRole('alert')).toBeNull();
    expect(within(history()).getByText(formatDate('2026-10-15'))).toBeTruthy();
  });

  it('il server che risponde con un errore (500 con JSON) non è la pagina vuota: errore intero e «Riprova»', async () => {
    fetch.mockImplementation(() => Promise.resolve({ ok: false, status: 500, json: async () => ({ success: false, records: [] }) }));
    render(<BodyStats />);
    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toBe('Errore nel caricamento delle statistiche' + 'Riprova');
    expect(within(alert).getByRole('button', { name: 'Riprova' })).toBeTruthy();
    expect(screen.queryByText('Nessuna misurazione registrata')).toBeNull();
  });

  it('se la rilettura dopo il consenso fallisce, l\'errore vince sulla card del consenso; «Riprova» riuscito mostra i dati', async () => {
    let granted = false;
    let up = false;
    fetch.mockImplementation((url) => {
      if (String(url).endsWith('user/consent.php')) { granted = true; return Promise.resolve({ ok: true, json: async () => ({ success: true }) }); }
      if (!granted) return Promise.resolve({ ok: true, json: async () => ({ records: [], consent_required: true }) });
      return up ? Promise.resolve({ ok: true, json: async () => ({ records: [row('2026-10-15', '80.0')] }) }) : Promise.reject(new Error('rete'));
    });
    render(<BodyStats />);
    fireEvent.click(await screen.findByRole('button', { name: 'Acconsento al trattamento delle misure corporee' }));
    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toBe('Errore nel caricamento delle statistiche' + 'Riprova');
    expect(screen.queryByRole('button', { name: 'Acconsento al trattamento delle misure corporee' })).toBeNull();

    up = true;
    fireEvent.click(within(alert).getByRole('button', { name: 'Riprova' }));
    await screen.findByRole('group', { name: 'Periodo' });
    expect(screen.queryByRole('alert')).toBeNull();
    expect(within(history()).getByText(formatDate('2026-10-15'))).toBeTruthy();
  });

  it('la pagina vuota resta senza errore né «Riprova»', async () => {
    render(<BodyStats />);
    expect(await screen.findByText('Nessuna misurazione registrata')).toBeTruthy();
    expect(screen.queryByRole('alert')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Riprova' })).toBeNull();
  });
});

describe('aree da 44px', () => {
  beforeEach(() => {
    records = Array.from({ length: 12 }, (_, i) => row(`2026-09-${String(i + 1).padStart(2, '0')}`, '80.0'));
  });

  it('i quattro pulsanti della paginazione e il cestino della tabella', async () => {
    await mount();
    ['Prima pagina', 'Pagina precedente', 'Pagina successiva', 'Ultima pagina'].forEach((name) => {
      const button = pill(name);
      expect(style(button).width, name).toBe('44px');
      expect(style(button).height, name).toBe('44px');
    });
    const del = within(tableRows()[0]).getByRole('button', { name: 'Elimina' });
    expect(style(del).width).toBe('44px');
    expect(style(del).height).toBe('44px');
  });
});

describe('eliminare una misurazione', () => {
  const deleteCalls = () => fetch.mock.calls.filter(([url]) => String(url).includes('user_stats/delete.php'));

  beforeEach(() => {
    localStorage.setItem('themeMode', 'light');
    records = measured();
  });

  it('chiede conferma in una finestra del tema, non con quella del browser, ed elimina solo dopo «Elimina»', async () => {
    const browserConfirm = vi.spyOn(window, 'confirm');
    await mount(themed);
    fireEvent.click(within(tableRows()[0]).getByRole('button', { name: 'Elimina' }));
    expect(within(screen.getByRole('dialog')).getByText('Eliminare la misurazione?')).toBeTruthy();
    expectDestructiveConfirm('Sei sicuro di voler eliminare questa misurazione?', 'Elimina', { ink: INK, red: RED });
    expect(deleteCalls()).toHaveLength(0);
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Elimina' }));
    await waitFor(() => expect(deleteCalls()).toHaveLength(1));
    expect(JSON.parse(deleteCalls()[0][1].body)).toEqual({ id: '2026-10-15' });
    expect(await screen.findByText('Misurazione eliminata')).toBeTruthy();
    expect(browserConfirm).not.toHaveBeenCalled();
  });

  it('un secondo tocco su «Elimina» mentre la finestra si chiude non elimina due volte', async () => {
    await mount(themed);
    fireEvent.click(within(tableRows()[0]).getByRole('button', { name: 'Elimina' }));
    const elimina = within(screen.getByRole('dialog')).getByRole('button', { name: 'Elimina' });
    fireEvent.click(elimina);
    fireEvent.click(elimina);
    expect(await screen.findByText('Misurazione eliminata')).toBeTruthy();
    expect(deleteCalls()).toHaveLength(1);
  });

  it('«Annulla» chiude la finestra senza eliminare', async () => {
    await mount(themed);
    fireEvent.click(within(tableRows()[0]).getByRole('button', { name: 'Elimina' }));
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Annulla' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(deleteCalls()).toHaveLength(0);
  });
});
