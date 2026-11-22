// Tab Esercizi dei Progressi vista dall'utente: riepilogo con numeri grandi, gruppi muscolari come card sempre aperte,
// una riga-collegamento per esercizio (la pagina dell'esercizio è /progressi/esercizi/<id>).
// Colori del tema chiaro scritti a mano: text.primary #1a1816, text.secondary #6b6663, success #15803d,
// recovery.recovering #b45309, text.disabled rgba(0,0,0,.38).
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, within, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Progress from './Progress';
import { ThemeModeProvider } from '../context/ThemeModeContext';
import { textBelow } from '../test/minText';
import { mediaStyle } from '../test/mediaStyle';
import { json, expectNoNestedContainer } from '../test/dom';
import { format } from 'date-fns';

const account = vi.hoisted(() => ({ weightUnit: 'kg' }));
vi.mock('../context/AuthContext', () => ({ useAuth: () => ({ weightUnit: account.weightUnit }) }));

const INK = 'rgb(26, 24, 22)';
const GREY = 'rgb(107, 102, 99)';
const GREEN = 'rgb(21, 128, 61)';
const AMBER = 'rgb(180, 83, 9)';
const DISABLED = 'rgba(0, 0, 0, 0.38)';

// `date` è l'orologio del luogo (qui il fuso del browser), `started_at` l'istante: come li manda il server
const daysAgo = (n) => {
  const d = new Date(Date.now() - n * 86400000);
  return { date: format(d, 'yyyy-MM-dd HH:mm:ss'), started_at: d.toISOString() };
};
const session = (id, when, exerciseId, name, weight, reps = 5) => ({
  id, ...when, exercises: [{ exercise_id: exerciseId, name, sets: [{ weight, reps }] }],
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
  account.weightUnit = 'kg';
  localStorage.setItem('themeMode', 'light');
  stubFetch(history);
});
afterEach(() => { vi.unstubAllGlobals(); localStorage.clear(); });

const renderProgress = (props = {}) => render(
  <ThemeModeProvider><MemoryRouter><Progress isEmbedded {...props} /></MemoryRouter></ThemeModeProvider>,
);
const mount = async () => {
  renderProgress();
  await screen.findByText('Ultimi 60 giorni');
};

// Numero e etichetta di una voce del riepilogo
const stat = (label) => {
  const labelEl = screen.getByText(label, { selector: 'p' });
  return { label: labelEl, number: labelEl.parentElement.firstElementChild };
};

describe('contenitore', () => {
  it('non incorporata, la pagina non apre un Container dentro quello del Layout', async () => {
    renderProgress({ isEmbedded: false });
    await screen.findByText('Ultimi 60 giorni');
    expectNoNestedContainer();
  });
});

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

  it('i chip dei PR sono neutri (bordo grigio, testo in inchiostro, 16px, area da 44px) e portano alla pagina dell\'esercizio', async () => {
    stubFetch([session(1, daysAgo(40), 1, 'Panca piana', 80), session(2, daysAgo(2), 1, 'Panca piana', 90)]);
    await mount();
    const link = screen.getByRole('link', { name: 'PR · Panca piana' });
    expect(link.getAttribute('href')).toBe('/progressi/esercizi/1');
    const style = getComputedStyle(link);
    expect(style.color).toBe(INK);
    expect(style.fontSize).toBe('16px');
    expect(style.height).toBe('44px');
  });
});

// Il gruppo muscolare è una card (section) con titolo h2: «Petto · 2 esercizi»
const section = (title) => screen.getByRole('heading', { level: 2, name: new RegExp(`^${title}`) }).closest('section');
const row = (name) => screen.getByText(name, { selector: 'p' }).closest('[data-exercise-row]');
const rowLink = (name) => within(row(name)).getByRole('link');
const star = (name) => within(row(name)).getByRole('button', { name: /preferiti/ });

describe('nessun PR', () => {
  it('con un solo allenamento (tutti "Nuovo") dice che ne serve un secondo, non "Nessun record recente"', async () => {
    stubFetch([session(1, daysAgo(1), 1, 'Panca piana', 80), session(2, daysAgo(1), 4, 'Military press', 50)]);
    await mount();
    expect(screen.getByText('Serve un secondo allenamento per confrontare')).toBeTruthy();
    expect(screen.queryByText('Nessun record recente')).toBeNull();
  });

  it('con più allenamenti ma senza PR resta "Nessun record recente"', async () => {
    stubFetch([session(1, daysAgo(40), 1, 'Panca piana', 80), session(2, daysAgo(2), 1, 'Panca piana', 80)]);
    await mount();
    expect(screen.getByText('Nessun record recente')).toBeTruthy();
    expect(screen.queryByText('Serve un secondo allenamento per confrontare')).toBeNull();
  });

  it('se solo alcuni esercizi sono "Nuovo" resta "Nessun record recente"', async () => {
    stubFetch([
      session(1, daysAgo(40), 1, 'Panca piana', 80), session(2, daysAgo(2), 1, 'Panca piana', 80),
      session(3, daysAgo(1), 4, 'Military press', 50),
    ]);
    await mount();
    expect(screen.getByText('Nessun record recente')).toBeTruthy();
  });
});

describe('testi', () => {
  it('nessun testo della pagina è sotto i 16px: righe, chip, titoli e card (salvo l\'etichetta del campo di ricerca, di MUI)', async () => {
    await mount();
    expect(textBelow(document.body, 16, '.MuiFormLabel-root, legend')).toEqual([]);
  });
});

describe('gruppi muscolari', () => {
  it('ogni gruppo è una card sempre aperta, con titolo h2 (nome e numero di esercizi) e un elenco di righe', async () => {
    await mount();
    const headings = screen.getAllByRole('heading', { level: 2 });
    expect(headings.map((h) => h.textContent)).toEqual(['Spalle · 1 esercizio', 'Petto · 2 esercizi', 'Quadricipiti · 1 esercizio', 'Schiena · 1 esercizio']);
    expect(document.querySelectorAll('.MuiAccordion-root, .MuiAccordionSummary-root')).toHaveLength(0);
    const petto = section('Petto');
    expect(petto.classList.contains('MuiCard-root')).toBe(true);
    const items = within(petto).getAllByRole('listitem');
    expect(items).toHaveLength(2);
    items.forEach((li) => expect(li.hasAttribute('data-exercise-row')).toBe(true));
    expect(within(petto).getByText('Panca piana')).toBeTruthy();
    expect(within(petto).getByText('Croci ai cavi')).toBeTruthy();
  });

  it('il numero di esercizi sta accanto al nome, in grigio', async () => {
    await mount();
    const count = within(screen.getByRole('heading', { level: 2, name: /^Petto/ })).getByText(/2 esercizi/);
    expect(getComputedStyle(count).color).toBe(GREY);
    expect(getComputedStyle(count).fontSize).toBe('16px');
  });

  it('un esercizio senza muscolo nel catalogo sta nel gruppo «Altro»', async () => {
    stubFetch([session(1, daysAgo(1), 99, 'Esercizio nuovo', 40)]);
    await mount();
    expect(screen.getByRole('heading', { level: 2, name: /^Altro/ })).toBeTruthy();
  });
});

describe('righe degli esercizi', () => {
  it('ogni riga è un collegamento alla pagina dell\'esercizio, alto almeno 60px', async () => {
    await mount();
    const link = rowLink('Panca piana');
    expect(link.getAttribute('href')).toBe('/progressi/esercizi/1');
    expect(link.getAttribute('role')).toBeNull();
    expect(getComputedStyle(link).minHeight).toBe('60px');
    expect(rowLink('Squat con bilanciere').getAttribute('href')).toBe('/progressi/esercizi/2');
  });

  it('la stella è un pulsante a sé, fuori dal collegamento, da 44px', async () => {
    await mount();
    const r = row('Panca piana');
    const button = star('Panca piana');
    expect(button.closest('a')).toBeNull();
    expect(within(r).getByRole('link').contains(button)).toBe(false);
    expect(getComputedStyle(button).width).toBe('44px');
    expect(getComputedStyle(button).height).toBe('44px');
  });

  it('il nome non è troncato e ha una sottoriga con l\'ultima sessione, da 16px', async () => {
    await mount();
    const name = screen.getByText('Panca piana', { selector: '[data-exercise-row] p' });
    const style = getComputedStyle(name);
    expect(style.whiteSpace).not.toBe('nowrap');
    expect(style.textOverflow).not.toBe('ellipsis');
    expect(style.fontSize).toBe('16px');
    const sub = within(row('Panca piana')).getByText('ultimo 2 gg fa');
    expect(getComputedStyle(sub).fontSize).toBe('16px');
    expect(getComputedStyle(sub).textOverflow).not.toBe('ellipsis');
  });

  it('da md in su il nome sta in una colonna di larghezza fissa, poi il grafico, poi il valore a destra', async () => {
    await mount();
    const r = row('Panca piana');
    const name = screen.getByText('Panca piana', { selector: '[data-exercise-row] p' }).parentElement;
    expect(mediaStyle(name, 900)['flex']).toMatch(/^0 0 (2[89]\d|3[0-2]\d)px$/);
    const value = within(r).getByText(/kg$/).parentElement;
    expect(mediaStyle(value, 900)['margin-left']).toBe('auto');
    expect(getComputedStyle(value).textAlign).toBe('right');
  });

  it('il valore è nello stile numero grande, con l\'unità', async () => {
    await mount();
    const value = within(row('Panca piana')).getByText(/kg$/);
    expect(getComputedStyle(value).fontFamily).toBe('"Lexend", sans-serif');
    expect(getComputedStyle(value).fontWeight).toBe('700');
  });

  it('variazione: crescita verde, calo ambra, fermo grigio, nuovo grigio, inattivo attenuato', async () => {
    await mount();
    const delta = (name, text) => getComputedStyle(within(row(name)).getByText(text));
    expect(delta('Panca piana', /▲/).color).toBe(GREEN);
    expect(delta('Squat con bilanciere', /▼/).color).toBe(AMBER);
    expect(delta('Croci ai cavi', 'Fermo').color).toBe(GREY);
    expect(delta('Military press', 'Nuovo').color).toBe(GREY);
    expect(delta('Stacco da terra', 'Inattivo').color).toBe(DISABLED);
  });

  it('il mini grafico ha il colore della variazione: verde in crescita, ambra in calo, grigio se fermo, attenuato se inattivo', async () => {
    await mount();
    const spark = (name) => getComputedStyle(row(name).querySelector('svg').parentElement).color;
    expect(spark('Panca piana')).toBe(GREEN);
    expect(spark('Squat con bilanciere')).toBe(AMBER);
    expect(spark('Croci ai cavi')).toBe(GREY);
    expect(spark('Stacco da terra')).toBe(DISABLED);
  });

  it('nessun rosso: il calo non usa error.main', async () => {
    await mount();
    const colors = [...document.querySelectorAll('[data-exercise-row] *')].map((el) => getComputedStyle(el).color);
    expect(colors).not.toContain('rgb(213, 0, 0)');
  });

  it('nessun testo della riga è sotto i 16px, nemmeno il «PR» e la variazione accanto al valore', async () => {
    await mount();
    document.querySelectorAll('[data-exercise-row]').forEach((r) => expect(textBelow(r, 16)).toEqual([]));
  });
});

describe('preferiti', () => {
  const chip = () => screen.queryByRole('button', { name: 'Preferiti' });

  it('senza preferiti il chip «Preferiti» non c\'è', async () => {
    await mount();
    expect(chip()).toBeNull();
  });

  it('con un preferito il chip c\'è sotto la ricerca, spento, da 44px', async () => {
    localStorage.setItem('liftindex.progress.favorites', JSON.stringify(['1']));
    await mount();
    const c = chip();
    expect(c.getAttribute('aria-pressed')).toBe('false');
    expect(getComputedStyle(c).height).toBe('44px');
    expect(getComputedStyle(c).fontSize).toBe('16px');
    const search = screen.getByRole('textbox', { name: 'Cerca esercizio' });
    expect(search.compareDocumentPosition(c) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('acceso mostra solo i preferiti (e i gruppi che li contengono), spento li rimostra tutti', async () => {
    localStorage.setItem('liftindex.progress.favorites', JSON.stringify(['1']));
    await mount();
    fireEvent.click(chip());
    expect(chip().getAttribute('aria-pressed')).toBe('true');
    expect(screen.getAllByRole('listitem')).toHaveLength(1);
    expect(within(section('Petto')).getByText('Panca piana')).toBeTruthy();
    expect(screen.queryByText('Croci ai cavi')).toBeNull();
    expect(screen.queryByRole('heading', { level: 2, name: /^Quadricipiti/ })).toBeNull();
    fireEvent.click(chip());
    expect(chip().getAttribute('aria-pressed')).toBe('false');
    expect(screen.getAllByRole('listitem')).toHaveLength(5);
  });

  it('non c\'è più la card «Preferiti»: il preferito sta una volta sola, nel suo gruppo', async () => {
    localStorage.setItem('liftindex.progress.favorites', JSON.stringify(['1']));
    await mount();
    expect(screen.queryByRole('heading', { name: 'Preferiti' })).toBeNull();
    expect(screen.getAllByText('Panca piana', { selector: 'p' })).toHaveLength(1);
    expect(within(section('Petto')).getByText('Panca piana')).toBeTruthy();
    expect(star('Panca piana').getAttribute('aria-pressed')).toBe('true');
  });

  it('con il chip acceso e nessun risultato dice «Nessun esercizio trovato»', async () => {
    localStorage.setItem('liftindex.progress.favorites', JSON.stringify(['1']));
    await mount();
    fireEvent.click(chip());
    fireEvent.change(screen.getByRole('textbox', { name: 'Cerca esercizio' }), { target: { value: 'squat' } });
    expect(await screen.findByText('Nessun esercizio trovato')).toBeTruthy();
  });

  it('la stella segna il preferito senza aprire la pagina, e il chip compare', async () => {
    await mount();
    expect(chip()).toBeNull();
    fireEvent.click(star('Panca piana'));
    expect(star('Panca piana').getAttribute('aria-pressed')).toBe('true');
    expect(chip()).not.toBeNull();
    expect(JSON.parse(localStorage.getItem('liftindex.progress.favorites'))).toEqual(['1']);
  });

  it('tolto l\'ultimo preferito a chip acceso, il chip sparisce e l\'elenco torna intero', async () => {
    localStorage.setItem('liftindex.progress.favorites', JSON.stringify(['1']));
    await mount();
    fireEvent.click(chip());
    fireEvent.click(star('Panca piana'));
    expect(chip()).toBeNull();
    expect(screen.getAllByRole('listitem')).toHaveLength(5);
  });
});

describe('ricerca', () => {
  it('filtra gli esercizi per nome e dice quando non trova nulla', async () => {
    await mount();
    const input = screen.getByRole('textbox', { name: 'Cerca esercizio' });
    fireEvent.change(input, { target: { value: 'panca' } });
    await waitFor(() => expect(screen.getAllByRole('listitem')).toHaveLength(1));
    expect(within(section('Petto')).getByText('Panca piana')).toBeTruthy();
    fireEvent.change(input, { target: { value: 'xyz' } });
    expect(await screen.findByText('Nessun esercizio trovato')).toBeTruthy();
    expect(screen.queryAllByRole('listitem')).toHaveLength(0);
  });
});

describe('stati', () => {
  it('in caricamento mostra l\'indicatore, non il vuoto', async () => {
    vi.stubGlobal('fetch', vi.fn(() => new Promise(() => {})));
    renderProgress();
    expect(screen.getByRole('progressbar')).toBeTruthy();
    expect(screen.queryByText(/Nessun dato di allenamento/)).toBeNull();
  });

  it('senza allenamenti (elenco vuoto) dice di registrare il primo, senza «Riprova»', async () => {
    stubFetch([]);
    renderProgress();
    expect(await screen.findByText('Nessun dato di allenamento disponibile. Registra il tuo primo allenamento!')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Riprova' })).toBeNull();
    expect(screen.queryByText(/problema di connessione/)).toBeNull();
  });

  it('errore di lettura: messaggio d\'errore con «Riprova», diverso dal vuoto; Riprova rilegge', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    let up = false;
    vi.stubGlobal('fetch', vi.fn((url) => Promise.resolve(
      url.includes('read_all.php') ? json({ records: catalog }) : (up ? json({ records: history }) : json({}, 500)),
    )));
    renderProgress();
    expect(await screen.findByText('Errore nel caricamento della cronologia: problema di connessione')).toBeTruthy();
    expect(screen.getByRole('alert')).toBeTruthy();
    expect(screen.queryByText(/Nessun dato di allenamento/)).toBeNull();
    up = true;
    fireEvent.click(screen.getByRole('button', { name: 'Riprova' }));
    await screen.findByText('Ultimi 60 giorni');
    expect(screen.queryByRole('alert')).toBeNull();
    expect(within(section('Petto')).getByText('Panca piana')).toBeTruthy();
  });
});

describe('unità di peso dell\'account', () => {
  it('in lb il 1RM stimato di una riga è in libbre', async () => {
    account.weightUnit = 'lb';
    await mount();
    expect(within(row('Panca piana')).getByText('231,5 lb')).toBeTruthy(); // 105 kg
    expect(within(row('Panca piana')).queryByText(/kg/)).toBeNull();
  });
});
