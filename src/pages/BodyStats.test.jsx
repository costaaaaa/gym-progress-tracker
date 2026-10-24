// Misure corporee visto dall'utente: selettore del periodo, variazione del peso, stato vuoto e storico a pagine.
// La fetch è il confine; "oggi" è fissato al 20/10/2026.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import BodyStats from './BodyStats';
import { ThemeModeProvider } from '../context/ThemeModeContext';
import { formatDate } from '../i18n/format';
import { polylineX } from '../test/polyline';
import { textBelow } from '../test/minText';

const row = (date, weight, extra = {}) => ({ id: date, date, weight, ...extra });

let records;
beforeEach(() => {
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
const pill = (name) => screen.getByRole('button', { name });
const tableRows = () => within(screen.getByRole('table')).getAllByRole('row').slice(1);

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
    expect(screen.getByText('80.0 kg')).toBeTruthy();
    expect(screen.getByText(/-2,0 kg negli ultimi 3 mesi/)).toBeTruthy();
  });

  it('cambiando periodo cambiano variazione e testo', async () => {
    await mount();
    fireEvent.click(pill('1M'));
    expect(screen.getByText(/-1,0 kg nell'ultimo mese/)).toBeTruthy();
    fireEvent.click(pill('6M'));
    expect(screen.getByText(/-5,0 kg negli ultimi 6 mesi/)).toBeTruthy();
    fireEvent.click(pill('1A'));
    expect(screen.getByText(/-10,0 kg nell'ultimo anno/)).toBeTruthy();
    fireEvent.click(pill('Tutto'));
    expect(screen.getByText(/-10,0 kg dalla prima rilevazione/)).toBeTruthy();
  });

  it('un solo peso nel periodo: nessuna variazione, ma il valore c\'è', async () => {
    records = [row('2026-05-01', '85.0'), row('2026-10-15', '80.0')];
    await mount();
    expect(screen.getByText('80.0 kg')).toBeTruthy();
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
    expect(screen.getByText('84.0 kg')).toBeTruthy();
  });

  it('l\'ultima rilevazione porta il suo peso quando ce l\'ha', async () => {
    records = [row('2026-05-19', '83.5')];
    await mount();
    expect(screen.getByText(`Ultima rilevazione il ${formatDate('2026-05-19')}: 83.5 kg`)).toBeTruthy();
  });

  it('con l\'API in ordine inverso la riga più recente resta la più recente', async () => {
    records = [row('2026-05-19', '83.5'), row('2026-01-10', '90.0')];
    await mount();
    expect(screen.getByText(`Ultima rilevazione il ${formatDate('2026-05-19')}: 83.5 kg`)).toBeTruthy();
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
// primary #d50000, divider #ececea, background.paper #ffffff.
const INK = 'rgb(26, 24, 22)';
const GREY = 'rgb(107, 102, 99)';
const RED = 'rgb(213, 0, 0)';
const DIVIDER = 'rgb(236, 236, 234)';
const WHITE = 'rgb(255, 255, 255)';
const style = (el) => getComputedStyle(el);
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
    expect(style(pill('6M')).borderColor).toBe(DIVIDER);
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
    ['Andamento peso (kg)', 'Composizione corporea', 'Circonferenze'].forEach((title) => {
      const s = style(screen.getByText(title));
      expect(s.textTransform).not.toBe('uppercase');
      expect(s.fontFamily).toBe('"Lexend", sans-serif');
      expect(s.fontWeight).toBe('700');
      expect(s.fontSize).toBe('17px');
    });
  });

  it('il peso attuale è nello stile numero grande', async () => {
    await mount(themed);
    const s = style(screen.getByText('80.0 kg'));
    expect(s.fontFamily).toBe('"Lexend", sans-serif');
    expect(s.fontWeight).toBe('700');
    expect(s.fontSize).toBe('22px');
    expect(s.fontVariantNumeric).toBe('tabular-nums');
  });

  it.each([
    ['calo', ['85.0', '80.0'], /-5,0 kg negli ultimi 3 mesi/],
    ['aumento', ['80.0', '85.0'], /\+5,0 kg negli ultimi 3 mesi/],
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
    expect(style(within(fat).getByText('18.5%')).fontSize).toBe('16px');
    expect(within(measureRow('Muscolo')).getByText('41.0%')).toBeTruthy();
    expect(within(measureRow('Torace')).getByText('102 cm')).toBeTruthy();
    expect(within(measureRow('Vita')).getByText('83 cm')).toBeTruthy();
  });

  it('le righe stanno nella card giusta, senza i dati nel titolo', async () => {
    await mount(themed);
    const composition = screen.getByText('Composizione corporea').closest('.MuiCard-root');
    const circumferences = screen.getByText('Circonferenze').closest('.MuiCard-root');
    expect(composition.querySelectorAll('[data-measure-row]')).toHaveLength(2);
    expect(circumferences.querySelectorAll('[data-measure-row]')).toHaveLength(4);
    expect(within(composition).getByText('Grasso')).toBeTruthy();
    expect(within(circumferences).getByText('Vita')).toBeTruthy();
  });

  it('niente legenda a pallini: nome e valore non sono in un testo solo', async () => {
    await mount(themed);
    expect(screen.queryByText(/Grasso:/)).toBeNull();
  });

  it('ogni misura ha il suo grafico con la propria scala e tutti hanno lo stesso colore', async () => {
    await mount(themed);
    // Grasso scende da 20 a 18,5 e Muscolo sale da 40 a 41: scale diverse, ma entrambi occupano tutta l'altezza (4 e 32 su 36)
    for (const name of ['Grasso', 'Muscolo', 'Torace', 'Vita']) {
      const r = measureRow(name);
      expect([...polylineY(r)].sort((a, b) => a - b)).toEqual([4, 32]);
      expect(style(r.querySelector('svg').parentElement).color).toBe(GREY);
    }
  });

  it('una misura mai rilevata mostra "—" e nessun grafico; con un solo punto il valore c\'è e il grafico no', async () => {
    records = [row('2026-10-15', '80.0', { body_fat_percentage: '18.5' })];
    await mount(themed);
    expect(within(measureRow('Gamba')).getByText('—')).toBeTruthy();
    expect(measureRow('Gamba').querySelector('polyline')).toBeNull();
    expect(within(measureRow('Grasso')).getByText('18.5%')).toBeTruthy();
    expect(measureRow('Grasso').querySelector('polyline')).toBeNull();
  });

  it('il valore è l\'ultimo disponibile nel periodo, anche se l\'ultima rilevazione non lo ha', async () => {
    records = [...measured(), row('2026-10-18', '79.5')];
    await mount(themed);
    expect(within(measureRow('Grasso')).getByText('18.5%')).toBeTruthy();
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

  // Esenti: le pillole del periodo, che sono chip (13px)
  it.each([['da tablet', () => {}], ['sul telefono', phone]])('nessun testo %s è sotto i 16px, salvo le pillole del periodo', async (_, setup) => {
    setup();
    await mount(themed);
    expect(textBelow(document.body, 16, '.MuiChip-root')).toEqual([]);
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
    const headers = within(screen.getByRole('table')).getAllByRole('columnheader');
    expect(headers.map((h) => h.textContent)).toEqual(['Data', 'Peso', 'Grasso %', 'Muscolo %', 'Torace', 'Braccio', 'Vita', 'Gamba', 'Azioni']);
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
    expect(screen.queryByRole('table')).toBeNull();
    const items = screen.getAllByRole('listitem');
    expect(items).toHaveLength(2);
    const first = items[0];
    expect(within(first).getByText(formatDate('2026-10-15'))).toBeTruthy();
    expect(style(within(first).getByText('80.0 kg')).fontWeight).toBe('700');
    const detail = within(first).getByText(/Grasso 18\.5%/);
    expect(detail.textContent).toBe('Grasso 18.5% · Muscolo 41.0% · Torace 102 cm · Vita 83 cm');
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
