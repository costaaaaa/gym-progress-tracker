// Pagina Progressi vista dall'utente: riepilogo con numeri grandi, una riga per esercizio dentro la card del gruppo.
// Colori del tema chiaro scritti a mano: text.primary #1a1816, text.secondary #6b6663, success #15803d,
// recovery.recovering #b45309, text.disabled rgba(0,0,0,.38).
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, within, fireEvent } from '@testing-library/react';
import Progress from './Progress';
import { ThemeModeProvider } from '../context/ThemeModeContext';
import { textBelow } from '../test/minText';
import { mediaStyle } from '../test/mediaStyle';

const INK = 'rgb(26, 24, 22)';
const GREY = 'rgb(107, 102, 99)';
const GREEN = 'rgb(21, 128, 61)';
const AMBER = 'rgb(180, 83, 9)';
const DISABLED = 'rgba(0, 0, 0, 0.38)';

const json = (data) => ({ ok: true, status: 200, json: async () => data, text: async () => '' });
const daysAgo = (n) => new Date(Date.now() - n * 86400000).toISOString().slice(0, 19).replace('T', ' ');
const session = (id, date, exerciseId, name, weight, reps = 5) => ({
  id, date, exercises: [{ exercise_id: exerciseId, name, sets: [{ weight, reps }] }],
});

const catalog = [
  { id: 1, name: 'Panca piana', muscle_group: 'Petto' },
  { id: 2, name: 'Squat con bilanciere', muscle_group: 'Quadricipiti' },
  { id: 3, name: 'Croci ai cavi', muscle_group: 'Petto' },
  { id: 4, name: 'Military press', muscle_group: 'Spalle' },
  { id: 5, name: 'Stacco da terra', muscle_group: 'Schiena' },
];

// 1 in crescita, 2 in calo, 3 fermo, 4 nuovo, 5 inattivo
const history = [
  session(101, daysAgo(40), 1, 'Panca piana', 80), session(102, daysAgo(2), 1, 'Panca piana', 90),
  session(103, daysAgo(40), 2, 'Squat con bilanciere', 100), session(104, daysAgo(2), 2, 'Squat con bilanciere', 90),
  session(105, daysAgo(40), 3, 'Croci ai cavi', 20), session(106, daysAgo(2), 3, 'Croci ai cavi', 20),
  session(107, daysAgo(1), 4, 'Military press', 50),
  session(108, daysAgo(120), 5, 'Stacco da terra', 120), session(109, daysAgo(100), 5, 'Stacco da terra', 120),
];

const stubFetch = (records) => vi.stubGlobal('fetch', vi.fn((url) => Promise.resolve(
  url.includes('read_all.php') ? json({ records: catalog }) : json({ records }),
)));

beforeEach(() => {
  localStorage.setItem('themeMode', 'light');
  stubFetch(history);
});
afterEach(() => { vi.unstubAllGlobals(); localStorage.clear(); });

const mount = async () => {
  render(<ThemeModeProvider><Progress isEmbedded /></ThemeModeProvider>);
  await screen.findByText('Ultimi 60 giorni');
};
const mountOpen = async () => {
  await mount();
  ['Petto', 'Quadricipiti', 'Spalle', 'Schiena'].forEach(openSection);
};

// Numero e etichetta di una voce del riepilogo
const stat = (label) => {
  const labelEl = screen.getByText(label, { selector: 'p' });
  return { label: labelEl, number: labelEl.parentElement.firstElementChild };
};

describe('riepilogo', () => {
  it('i numeri sono nello stile numero grande: Lexend 700, 22px, cifre tabulari', async () => {
    await mount();
    const { number } = stat('In crescita');
    const style = getComputedStyle(number);
    expect(style.fontFamily).toBe('"Lexend", sans-serif');
    expect(style.fontWeight).toBe('700');
    expect(style.fontSize).toBe('22px');
    expect(style.fontVariantNumeric).toBe('tabular-nums');
  });

  it('colore solo sui valori non zero: crescita verde, calo ambra, fermi e PR in inchiostro', async () => {
    await mount();
    expect(getComputedStyle(stat('In crescita').number).color).toBe(GREEN);
    expect(getComputedStyle(stat('In calo').number).color).toBe(AMBER);
    expect(getComputedStyle(stat('Fermi').number).color).toBe(INK);
    expect(getComputedStyle(stat('Nuovi PR').number).color).toBe(INK);
  });

  it('un valore a zero è grigio, mai colorato', async () => {
    stubFetch([session(1, daysAgo(40), 1, 'Panca piana', 80), session(2, daysAgo(2), 1, 'Panca piana', 80)]);
    await mount();
    expect(stat('In crescita').number.textContent).toBe('0');
    expect(getComputedStyle(stat('In crescita').number).color).toBe(GREY);
    expect(getComputedStyle(stat('In calo').number).color).toBe(GREY);
    expect(getComputedStyle(stat('Nuovi PR').number).color).toBe(GREY);
    expect(getComputedStyle(stat('Fermi').number).color).toBe(INK);
  });

  it('le etichette sono in sentence case da 16px, non maiuscole, e non vanno a capo', async () => {
    await mount();
    for (const name of ['In crescita', 'Fermi', 'In calo', 'Nuovi PR']) {
      const style = getComputedStyle(stat(name).label);
      expect(style.textTransform).not.toBe('uppercase');
      expect(style.fontSize).toBe('16px');
      expect(style.whiteSpace).toBe('nowrap');
    }
  });

  it('le quattro voci stanno su una sola riga, senza ridursi sotto la propria larghezza', async () => {
    await mount();
    const row = stat('In crescita').label.parentElement.parentElement;
    expect(getComputedStyle(row).display).toBe('flex');
    expect(getComputedStyle(row).flexWrap).not.toBe('wrap');
    expect(getComputedStyle(stat('In crescita').label.parentElement).flexShrink).toBe('0');
  });

  it('da md in su le quattro voci stanno a sinistra con un vuoto fisso di 48px; sul telefono restano distribuite', async () => {
    await mount();
    const rowEl = stat('In crescita').label.parentElement.parentElement;
    expect(mediaStyle(rowEl, 0)).toMatchObject({ 'justify-content': 'space-between', gap: '16px' });
    expect(mediaStyle(rowEl, 900)).toMatchObject({ 'justify-content': 'flex-start', gap: '48px' });
  });

  it('i chip dei PR sono neutri: bordo grigio, testo in inchiostro, 13px', async () => {
    const records = [session(1, daysAgo(40), 1, 'Panca piana', 80), session(2, daysAgo(2), 1, 'Panca piana', 90)];
    stubFetch(records);
    await mount();
    const chip = screen.getByText('PR · Panca piana').closest('.MuiChip-root');
    const style = getComputedStyle(chip);
    expect(style.color).toBe(INK);
    expect(style.fontSize).toBe('13px');
  });
});

const section = (title) => screen.getByText(title, { selector: 'p' }).closest('.MuiAccordion-root');
const row = (name) => screen.getByText(name, { selector: 'p' }).closest('[data-exercise-row]');
const openSection = (title) => {
  const header = within(section(title)).getByRole('button', { name: new RegExp(title) });
  if (header.getAttribute('aria-expanded') !== 'true') fireEvent.click(header);
};

describe('testi', () => {
  it('nessun testo della pagina è sotto i 16px, salvo chip dei PR, badge della riga (PR e variazione) e campo di ricerca', async () => {
    await mountOpen();
    // Esenti: chip (PR del riepilogo), badge del dato nella riga, etichetta del campo di ricerca (MUI)
    expect(textBelow(document.body, 16, '.MuiChip-root, [data-row-badge], .MuiFormLabel-root, legend')).toEqual([]);
  });
});

describe('righe degli esercizi', () => {
  it('dentro la card del gruppo ogni esercizio è una riga, non una card', async () => {
    await mountOpen();
    openSection('Petto');
    const petto = section('Petto');
    expect(petto.querySelectorAll('[data-exercise-row]')).toHaveLength(2);
    expect(petto.querySelectorAll('.MuiAccordionDetails-root .MuiCard-root')).toHaveLength(0);
  });

  it('il nome non è troncato (va a capo) e ha una sottoriga con l\'ultima sessione', async () => {
    await mountOpen();
    openSection('Petto');
    const name = screen.getByText('Panca piana', { selector: '[data-exercise-row] p' });
    const style = getComputedStyle(name);
    expect(style.whiteSpace).not.toBe('nowrap');
    expect(style.textOverflow).not.toBe('ellipsis');
    expect(style.fontSize).toBe('16px');
    expect(within(row('Panca piana')).getByText('ultimo 2 gg fa')).toBeTruthy();
  });

  it('da md in su il nome sta in una colonna di larghezza fissa, poi il grafico, poi il valore a destra', async () => {
    await mountOpen();
    const r = row('Panca piana');
    const name = screen.getByText('Panca piana', { selector: '[data-exercise-row] p' }).parentElement;
    const nameMd = mediaStyle(name, 900);
    expect(nameMd['flex']).toMatch(/^0 0 (2[89]\d|3[0-2]\d)px$/);
    const value = within(r).getByText(/kg$/).parentElement;
    expect(mediaStyle(value, 900)['margin-left']).toBe('auto');
    expect(getComputedStyle(value).textAlign).toBe('right');
  });

  it('il valore è nello stile numero grande, con l\'unità', async () => {
    await mountOpen();
    const value = within(row('Panca piana')).getByText(/kg$/);
    expect(getComputedStyle(value).fontFamily).toBe('"Lexend", sans-serif');
    expect(getComputedStyle(value).fontWeight).toBe('700');
  });

  it('variazione: crescita verde, calo ambra, fermo grigio, nuovo grigio, inattivo attenuato', async () => {
    await mountOpen();
    const delta = (name, text) => getComputedStyle(within(row(name)).getByText(text));
    expect(delta('Panca piana', /▲/).color).toBe(GREEN);
    openSection('Quadricipiti');
    expect(delta('Squat con bilanciere', /▼/).color).toBe(AMBER);
    expect(delta('Croci ai cavi', 'Fermo').color).toBe(GREY);
    openSection('Spalle');
    expect(delta('Military press', 'Nuovo').color).toBe(GREY);
    openSection('Schiena');
    expect(delta('Stacco da terra', 'Inattivo').color).toBe(DISABLED);
  });

  it('nessun rosso: il calo non usa error.main', async () => {
    await mountOpen();
    openSection('Quadricipiti');
    const colors = [...document.querySelectorAll('[data-exercise-row] *')].map((el) => getComputedStyle(el).color);
    expect(colors).not.toContain('rgb(213, 0, 0)');
  });

  it('il testo di riga è almeno 16px, salvo il «PR» e la variazione accanto al valore (badge del dato, 13px o più), e la stella è un bersaglio da 44px', async () => {
    await mountOpen();
    const r = row('Panca piana');
    expect(textBelow(r, 16, '[data-row-badge]')).toEqual([]);
    r.querySelectorAll('[data-row-badge]').forEach((b) => expect(parseFloat(getComputedStyle(b).fontSize)).toBeGreaterThanOrEqual(13));
    const star = within(r).getByRole('button', { name: 'Aggiungi ai preferiti' });
    expect(getComputedStyle(star).width).toBe('44px');
    expect(getComputedStyle(star).height).toBe('44px');
  });

  it('toccare la riga apre il dettaglio, la stella segna il preferito senza aprirlo', async () => {
    await mountOpen();
    fireEvent.click(within(row('Panca piana')).getByRole('button', { name: 'Aggiungi ai preferiti' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(await screen.findByText('Preferiti')).toBeTruthy();
    fireEvent.click(screen.getByText('Panca piana'));
    expect(await screen.findByRole('dialog')).toBeTruthy();
  });

  it('i preferiti stanno in una card con bordo e mostrano il muscolo nella sottoriga', async () => {
    localStorage.setItem('liftindex.progress.favorites', JSON.stringify(['1']));
    await mountOpen();
    const favorites = screen.getByText('Preferiti', { selector: 'p' }).closest('.MuiCard-root');
    expect(favorites).not.toBeNull();
    expect(within(favorites).getByText(/Petto/)).toBeTruthy();
  });

  it('il titolo del gruppo è nello stile titolo di card e la sottoriga è da 16px', async () => {
    await mountOpen();
    const title = screen.getByText('Petto', { selector: 'p' });
    expect(parseFloat(getComputedStyle(title).fontSize)).toBeGreaterThanOrEqual(16);
    const sub = within(section('Petto').querySelector('.MuiAccordionSummary-root')).getByText(/ultimo 2 gg fa/);
    expect(getComputedStyle(sub).fontSize).toBe('16px');
  });
});
