// Gruppi vista dall'utente (elenco, dettaglio con classifica, invito): il rosso del marchio resta all'azione
// principale e a quella che non si annulla («Elimina il gruppo», con il bottone di conferma pieno rosso), il resto è
// inchiostro, grigio o verde. La fetch è il confine. Colori del tema chiaro scritti a mano:
// text.primary #1a1816, text.secondary #6b6663, success #15803d, primary/error #d50000, action.selected rgba(0,0,0,.08).
import { useState } from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, within, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import Groups from './Groups';
import GroupDetail from './GroupDetail';
import JoinGroup from './JoinGroup';
import { ThemeModeProvider } from '../context/ThemeModeContext';
import { textBelow } from '../test/minText';
import { json, colorOf, expectNoNestedContainer, expectPageTitleBlock, expectTitleRowButton, expectBackArrow } from '../test/dom';

const auth = vi.hoisted(() => ({ value: null }));
vi.mock('../context/AuthContext', () => ({ useAuth: () => auth.value }));
const mario = () => ({ id: 1, username: 'mario88' });
auth.value = { user: mario(), isLoggedIn: true, loading: false };

const INK = 'rgb(26, 24, 22)';
const GREY = 'rgb(107, 102, 99)';
const GREEN = 'rgb(21, 128, 61)';
const RED = 'rgb(213, 0, 0)';
const PINK = 'rgb(251, 235, 235)';
const SELECTED = 'rgba(0, 0, 0, 0.08)';

const group = (over = {}) => ({
  id: 7, name: 'Palestra Rossi', type: 'gym', members_count: 3, max_members: 30, my_role: 'owner',
  invite_code: 'K7M2QX9PHD', invite_enabled: true, name_locked: false, ...over,
});
const week = { from: '2026-10-19', to: '2026-10-25' };
const rows = [
  { rank: 1, username: 'luca', is_me: false, workouts: 3, goal: 3, volume_kg: 5200, adherence: 1 },
  { rank: 2, username: 'mario88', is_me: true, workouts: 2, goal: 3, volume_kg: 4100, adherence: 0.66 },
];
const members = [
  { username: 'luca', role: 'member', is_me: false, ref: 'a1' },
  { username: 'mario88', role: 'owner', is_me: true, ref: null },
];

const stub = ({ myRole = 'owner' } = {}) => vi.stubGlobal('fetch', vi.fn((url) => Promise.resolve(
  url.includes('groups/list.php') ? json({ success: true, groups: [group({ my_role: myRole }), group({ id: 8, name: 'Amici del giovedì', type: 'friends', my_role: 'member' })] })
    : url.includes('groups/read.php') ? json({ success: true, group: group({ my_role: myRole }), week, members, board: rows, board_type: 'week' })
      : url.includes('groups/preview.php') ? json({ success: true, group: group({ already_member: false, is_full: false }) })
        : json({ success: true }),
)));

beforeEach(() => {
  auth.value = { user: mario(), isLoggedIn: true, loading: false };
  localStorage.setItem('themeMode', 'light');
  stub();
});
afterEach(() => {
  vi.unstubAllGlobals();
  localStorage.clear();
});

// Esenti: chip e badge ("tu", tipo del gruppo) e le etichette dei campi, che MUI rimpicciolisce
const small = () => textBelow(document.body, 16, '.MuiChip-root, .MuiFormLabel-root, .MuiFormHelperText-root, legend');

// Bottone di testo a filo del contenuto a sinistra: il margine di quel lato toglie il rientro interno, l'altro è a zero, l'area resta da 44 px
const expectFlushLeft = (style) => {
  expect(parseFloat(style.paddingLeft)).toBeGreaterThan(0);
  expect(style.marginLeft).toBe(`-${style.paddingLeft}`);
  expect(parseFloat(style.marginRight)).toBe(0);
  expect(parseFloat(style.minHeight)).toBeGreaterThanOrEqual(44);
};

describe('elenco dei gruppi', () => {
  const mount = async () => {
    render(<MemoryRouter><ThemeModeProvider><Groups /></ThemeModeProvider></MemoryRouter>);
    await screen.findByText('Palestra Rossi');
  };

  it('nella card del gruppo non c\'è il quadratino rosato con l\'icona rossa', async () => {
    await mount();
    const card = screen.getByText('Palestra Rossi').closest('.MuiCard-root');
    const all = [card, ...card.querySelectorAll('*')];
    expect(all.map((el) => getComputedStyle(el).backgroundColor)).not.toContain(PINK);
    expect(card.querySelector('svg')).toBeNull();
  });

  it('«Entra» con il codice è outlined neutro', async () => {
    await mount();
    fireEvent.change(screen.getByLabelText('Codice invito'), { target: { value: 'ABC' } });
    const style = getComputedStyle(screen.getByRole('button', { name: 'Entra' }));
    expect(style.color).toBe(INK);
    expect(style.borderColor).toBe(GREY);
  });

  it('«Crea gruppo» resta l\'azione principale: pieno rosso', async () => {
    await mount();
    expect(getComputedStyle(screen.getByRole('button', { name: 'Crea gruppo' })).backgroundColor).toBe(RED);
  });

  it('sopra il titolo la pagina non dà spazio (resta quello sotto); il titolo sta in un blocco alto 44 px', async () => {
    await mount();
    const titolo = screen.getByRole('heading', { level: 1, name: 'Gruppi' });
    const pagina = titolo.parentElement.parentElement;
    expect(parseFloat(getComputedStyle(pagina).paddingTop)).toBe(0);
    expect(getComputedStyle(pagina).paddingBottom).toBe('24px');
    expectPageTitleBlock(titolo);
    expectTitleRowButton(titolo, screen.getByRole('button', { name: 'Crea gruppo' }));
  });

  it('la freccia «Home» sta sulla riga del titolo, prima di «Crea gruppo» che resta a destra', async () => {
    await mount();
    const titolo = screen.getByRole('heading', { level: 1, name: 'Gruppi' });
    expectBackArrow(titolo, screen.getByRole('link', { name: 'Home' }), '/');
    const crea = screen.getByRole('button', { name: 'Crea gruppo' });
    expect(titolo.compareDocumentPosition(crea) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('non apre un Container dentro quello del Layout', async () => {
    await mount();
    expectNoNestedContainer();
  });

  it('i testi sono almeno 16px', async () => {
    await mount();
    expect(small()).toEqual([]);
  });
});

describe('dettaglio del gruppo', () => {
  // failing: l'API risponde con un errore e la pagina mostra l'avviso
  const mount = async ({ failing = false } = {}) => {
    if (failing) vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(json({ success: false, message: 'no' }, 404))));
    render(
      <MemoryRouter initialEntries={['/gruppi/7']}>
        <ThemeModeProvider><Routes><Route path="/gruppi/:id" element={<GroupDetail />} /></Routes></ThemeModeProvider>
      </MemoryRouter>,
    );
    if (failing) await screen.findByRole('alert');
    else await screen.findByText('Classifica');
  };

  it('non apre un Container dentro quello del Layout', async () => {
    await mount();
    expectNoNestedContainer();
  });

  it('anche con l\'errore di caricamento non apre un Container', async () => {
    await mount({ failing: true });
    expectNoNestedContainer();
  });

  it('la freccia «I tuoi gruppi» sta sulla riga del titolo, con il tipo e i membri dopo il titolo', async () => {
    await mount();
    const titolo = screen.getByRole('heading', { level: 1, name: 'Palestra Rossi' });
    expectPageTitleBlock(titolo);
    expectBackArrow(titolo, screen.getByRole('link', { name: 'I tuoi gruppi' }), '/gruppi');
    const riga = titolo.parentElement;
    const tipo = within(riga).getByText('Palestra', { selector: '.MuiChip-label' });
    const membri = within(riga).getByText('3 membri');
    [tipo, membri].forEach((el) => expect(titolo.compareDocumentPosition(el) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy());
  });

  it('con l\'errore di caricamento «I tuoi gruppi» resta il pulsante di testo', async () => {
    await mount({ failing: true });
    const link = screen.getByRole('link', { name: 'I tuoi gruppi' });
    expect(link.getAttribute('href')).toBe('/gruppi');
    expect(link.textContent).toBe('I tuoi gruppi');
  });

  it('le tab della classifica non hanno flex-basis 0, che si scontra con il flex-grow di INK_TABS', async () => {
    await mount();
    const tab = screen.getAllByRole('tab')[0];
    expect(getComputedStyle(tab).flexBasis).not.toBe('0px');
  });

  it('l\'interruttore «Inviti aperti» acceso è verde, non rosso del marchio', async () => {
    await mount();
    const base = screen.getByLabelText('Inviti aperti').closest('.MuiSwitch-switchBase');
    expect(colorOf(base)).toBe(GREEN);
    expect(getComputedStyle(base.parentElement.querySelector('.MuiSwitch-track')).backgroundColor).toBe(GREEN);
  });

  it.each(['Nuovo codice', 'Rinomina il gruppo', 'Segnala un contenuto', 'I tuoi gruppi'])(
    '«%s» è un bottone di testo in inchiostro, il rosso non c\'è',
    async (name) => {
      await mount();
      expect(colorOf(screen.queryByRole('button', { name }) ?? screen.getByRole('link', { name }))).toBe(INK);
    },
  );

  it('«Rinomina il gruppo», «Elimina il gruppo» e «Segnala un contenuto» hanno il testo in asse col titolo della card, uno sotto l\'altro, con aree da 44 px', async () => {
    await mount();
    const buttons = ['Rinomina il gruppo', 'Elimina il gruppo', 'Segnala un contenuto'].map((name) => screen.getByRole('button', { name }));
    for (const button of buttons) {
      const style = getComputedStyle(button);
      expectFlushLeft(style);
      expect(style.display).toBe('block');
    }
  });

  it('chi non è proprietario ha «Esci dal gruppo» in asse come «Elimina il gruppo»', async () => {
    stub({ myRole: 'member' });
    await mount();
    const style = getComputedStyle(screen.getByRole('button', { name: 'Esci dal gruppo' }));
    expectFlushLeft(style);
    expect(style.display).toBe('block');
  });

  it('«Elimina il gruppo» è un bottone di testo rosso in grassetto, come nell\'app', async () => {
    await mount();
    const style = getComputedStyle(screen.getByRole('button', { name: 'Elimina il gruppo' }));
    expect(style.color).toBe(RED);
    expect(style.fontWeight).toBe('700');
    expect(style.backgroundColor).not.toBe(RED);
  });

  it('chi non è proprietario vede «Esci dal gruppo» in inchiostro', async () => {
    stub({ myRole: 'member' });
    await mount();
    expect(colorOf(screen.getByRole('button', { name: 'Esci dal gruppo' }))).toBe(INK);
  });

  it('il dialogo di conferma dell\'eliminazione ha il bottone pieno rosso', async () => {
    await mount();
    fireEvent.click(screen.getByRole('button', { name: 'Elimina il gruppo' }));
    await waitFor(() => expect(document.querySelector('.MuiDialog-root .MuiButton-containedError')).not.toBeNull());
    expect(getComputedStyle(document.querySelector('.MuiDialog-root .MuiButton-containedError')).backgroundColor).toBe(RED);
  });

  it('il testo del dialogo di conferma è a 16 px nel colore del testo principale', async () => {
    await mount();
    fireEvent.click(screen.getByRole('button', { name: 'Elimina il gruppo' }));
    const testo = await screen.findByText(/Il gruppo e la classifica spariscono per tutti i membri/);
    expect(colorOf(testo)).toBe(INK);
    expect(getComputedStyle(testo).fontSize).toBe('16px');
    expect(within(screen.getByRole('dialog')).getByRole('button', { name: 'Elimina' }).querySelector('svg')).toBeNull();
  });

  it('nella classifica «tu» è un chip neutro e la riga propria ha il fondo grigio, non rosato', async () => {
    await mount();
    const me = screen.getByText('mario88', { selector: 'ol p' }).closest('li');
    expect(getComputedStyle(me).backgroundColor).toBe(SELECTED);
    const chip = within(me).getByText('tu').closest('.MuiChip-root');
    expect(getComputedStyle(chip).backgroundColor).not.toBe(RED);
    expect(getComputedStyle(chip).color).toBe(INK);
    const other = screen.getByText('luca', { selector: 'ol p' }).closest('li');
    expect(getComputedStyle(other).backgroundColor).not.toBe(SELECTED);
  });

  it('i tab Settimana / Streak / Livello: quello attivo e la sua linea sono in inchiostro (2px), non rossi', async () => {
    await mount();
    const tabs = screen.getAllByRole('tab');
    expect(tabs.map((tab) => tab.textContent)).toEqual(['Settimana', 'Streak', 'Livello']);
    const active = tabs.find((tab) => tab.getAttribute('aria-selected') === 'true');
    expect(getComputedStyle(active).color).toBe(INK);
    expect(getComputedStyle(tabs.find((tab) => tab !== active)).color).toBe(GREY);
    const indicator = document.querySelector('.MuiTabs-indicator');
    expect(getComputedStyle(indicator).backgroundColor).toBe(INK);
    expect(getComputedStyle(indicator).height).toBe('2px');
    expect(parseFloat(getComputedStyle(active).fontSize)).toBeGreaterThanOrEqual(16);
  });

  it('la barra dell\'aderenza resta rossa: è il dato', async () => {
    await mount();
    const bar = screen.getAllByRole('progressbar')[0].querySelector('.MuiLinearProgress-bar');
    expect(getComputedStyle(bar).backgroundColor).toBe(RED);
  });

  it('i testi sono almeno 16px', async () => {
    await mount();
    expect(small()).toEqual([]);
  });
});

describe('invito', () => {
  it('l\'icona dei gruppi non è nel rosso del marchio', async () => {
    render(
      <MemoryRouter initialEntries={['/entra?codice=K7M2QX9PHD']}>
        <ThemeModeProvider><Routes><Route path="/entra" element={<JoinGroup />} /></Routes></ThemeModeProvider>
      </MemoryRouter>,
    );
    await screen.findByText('Palestra Rossi');
    const icon = document.querySelector('[data-testid="GroupsOutlinedIcon"]');
    expect(icon).not.toBeNull();
    expect(colorOf(icon)).toBe(GREY);
  });

  it('senza data di nascita il pulsante porta all\'Account', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(json({ success: false, code: 'birth_date_required', message: 'Serve la data di nascita.' }, 400))));
    render(
      <MemoryRouter initialEntries={['/entra?codice=K7M2QX9PHD']}>
        <ThemeModeProvider><Routes><Route path="/entra" element={<JoinGroup />} /></Routes></ThemeModeProvider>
      </MemoryRouter>,
    );
    expect(await screen.findByText('Serve la data di nascita.')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Vai alle impostazioni' }).getAttribute('href')).toBe('/account/profilo');
  });
});

// Moduli: Gruppi non attivo = la pagina «non attivo» al posto delle tre rotte; Livelli non attivo = solo la classifica della settimana
const ALL = { body: true, recovery: true, levels: true, groups: true, ai: true };
const Switchable = ({ modules, page: Page }) => {
  const [user, setUser] = useState({ ...mario(), modules });
  auth.value = { user, isLoggedIn: true, loading: false, updateUser: (patch) => setUser((u) => ({ ...u, ...patch })) };
  return <Page />;
};
const routes = (initial, modules) => render(
  <MemoryRouter initialEntries={[initial]}>
    <ThemeModeProvider>
      <Routes>
        <Route path="/gruppi" element={<Switchable modules={modules} page={Groups} />} />
        <Route path="/gruppi/:id" element={<Switchable modules={modules} page={GroupDetail} />} />
        <Route path="/entra" element={<Switchable modules={modules} page={JoinGroup} />} />
      </Routes>
    </ThemeModeProvider>
  </MemoryRouter>,
);

describe('Gruppi non attivo', () => {
  const off = { ...ALL, groups: false };
  const fetched = (part) => fetch.mock.calls.some(([url]) => String(url).includes(part));

  it.each([
    ['/gruppi', 'groups/list.php'],
    ['/gruppi/7', 'groups/read.php'],
    ['/entra?codice=K7M2QX9PHD', 'groups/preview.php'],
  ])('%s: «Il modulo Gruppi non è attivo» con «Attiva», senza errore e senza leggere i gruppi', (path, endpoint) => {
    routes(path, off);
    expect(screen.getByRole('heading', { name: 'Il modulo Gruppi non è attivo' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Attiva' })).toBeTruthy();
    expect(screen.queryByRole('alert')).toBeNull();
    expect(fetched(endpoint)).toBe(false);
  });

  it('«Attiva» su un invito salva e l\'invito prosegue da dove era: compare l\'anteprima del gruppo', async () => {
    vi.stubGlobal('fetch', vi.fn((url) => Promise.resolve(
      url.includes('update_settings.php') ? json({ success: true, modules: ALL })
        : url.includes('groups/preview.php') ? json({ success: true, group: group({ already_member: false, is_full: false }) })
          : json({ success: true }),
    )));
    routes('/entra?codice=K7M2QX9PHD', off);
    fireEvent.click(screen.getByRole('button', { name: 'Attiva' }));
    expect(await screen.findByText('Palestra Rossi')).toBeTruthy();
    expect(String(fetch.mock.calls.find(([url]) => url.includes('groups/preview.php'))[0])).toContain('K7M2QX9PHD');
    expect(screen.queryByRole('heading', { name: 'Il modulo Gruppi non è attivo' })).toBeNull();
  });

  it('con Gruppi attivo l\'elenco si vede come sempre', async () => {
    routes('/gruppi', ALL);
    expect(await screen.findByText('Palestra Rossi')).toBeTruthy();
  });
});

describe('Livelli non attivo: classifica del gruppo', () => {
  it('con Livelli attivo le schede sono Settimana · Streak · Livello', async () => {
    routes('/gruppi/7', ALL);
    await screen.findAllByText('luca');
    expect(screen.getAllByRole('tab').map((tab) => tab.textContent)).toEqual(['Settimana', 'Streak', 'Livello']);
  });

  it('con Livelli non attivo non ci sono le schede Streak e Livello: resta la classifica della settimana', async () => {
    routes('/gruppi/7', { ...ALL, levels: false });
    await screen.findAllByText('luca');
    expect(screen.queryByRole('tab', { name: 'Streak' })).toBeNull();
    expect(screen.queryByRole('tab', { name: 'Livello' })).toBeNull();
    expect(fetch.mock.calls.filter(([url]) => String(url).includes('groups/read.php')).every(([url]) => String(url).includes('board=week'))).toBe(true);
  });
});

// Visibilità nei gruppi: la risposta di groups/read.php dice quali dati vede chi guarda (`visibility`)
describe('visibilità nella classifica del gruppo', () => {
  const NO_WORKOUTS = 'Non mostri gli allenamenti della settimana, quindi non vedi la classifica.';
  const vis = (over = {}) => ({ workouts: true, volume: true, streak: true, level: true, ...over });
  const stubRead = (visibility, board = rows) => vi.stubGlobal('fetch', vi.fn((url) => Promise.resolve(
    url.includes('groups/read.php')
      ? json({ success: true, group: group(), week, members, board, board_type: 'week', ...(visibility && { visibility }) })
      : json({ success: true }),
  )));
  const tabs = () => screen.queryAllByRole('tab').map((tab) => tab.textContent);

  it('visibility tutta vera: Settimana · Streak · Livello', async () => {
    stubRead(vis());
    routes('/gruppi/7', ALL);
    await screen.findAllByText('luca');
    expect(tabs()).toEqual(['Settimana', 'Streak', 'Livello']);
  });

  it('streak e level false: restano solo le righe della settimana, senza schede, senza leggere le altre classifiche', async () => {
    stubRead(vis({ streak: false, level: false }));
    routes('/gruppi/7', ALL);
    await screen.findAllByText('luca');
    expect(tabs()).toEqual([]);
    expect(fetch.mock.calls.filter(([url]) => String(url).includes('groups/read.php')).every(([url]) => String(url).includes('board=week'))).toBe(true);
  });

  it('solo streak false: Settimana · Livello', async () => {
    stubRead(vis({ streak: false }));
    routes('/gruppi/7', ALL);
    await screen.findAllByText('luca');
    expect(tabs()).toEqual(['Settimana', 'Livello']);
  });

  it('visibility vince sul modulo del client: modulo Livelli non attivo ma visibility vera = come manda il server', async () => {
    stubRead(vis());
    routes('/gruppi/7', { ...ALL, levels: false });
    await screen.findAllByText('luca');
    expect(tabs()).toEqual(['Settimana', 'Streak', 'Livello']);
  });

  it('workouts false: al posto della classifica c\'è la riga di testo, i membri restano, la scheda Settimana resta', async () => {
    stubRead(vis({ workouts: false, volume: false }), []);
    routes('/gruppi/7', ALL);
    expect(await screen.findByText(NO_WORKOUTS)).toBeTruthy();
    expect(screen.queryByText('Nessun membro in classifica.')).toBeNull();
    expect(screen.getByText('luca')).toBeTruthy(); // elenco dei membri
    expect(tabs()).toContain('Settimana');
    expect(screen.getByText(NO_WORKOUTS).closest('[aria-hidden="true"]')).toBeNull();
    // Sotto il testo, il collegamento al blocco «Cosa mostro» dell'Account
    const link = screen.getByRole('link', { name: 'Cosa mostro' });
    expect(link.getAttribute('href')).toBe('/account/dati#groups-shown');
    expect(parseInt(getComputedStyle(link).minHeight, 10)).toBeGreaterThanOrEqual(44);
  });

  it('senza il collegamento «Cosa mostro» quando mostri gli allenamenti, anche se streak e livello non ci sono perché li hai nascosti', async () => {
    stubRead(vis({ streak: false, level: false }));
    routes('/gruppi/7', ALL);
    await screen.findAllByText('luca');
    expect(screen.queryByRole('link', { name: 'Cosa mostro' })).toBeNull();
  });

  it('risposta senza visibility (server vecchio): tutto come oggi, secondo il modulo Livelli', async () => {
    stubRead(null);
    routes('/gruppi/7', { ...ALL, levels: false });
    await screen.findAllByText('luca');
    expect(tabs()).toEqual([]);
    expect(screen.queryByText(NO_WORKOUTS)).toBeNull();
  });

  it('una riga senza volume mostra gli allenamenti e basta', async () => {
    stubRead(vis(), [{ ...rows[0], volume_kg: null }, rows[1]]);
    routes('/gruppi/7', ALL);
    await screen.findAllByText('luca');
    const row = screen.getAllByText('luca')[0].closest('li');
    expect(row.textContent).toContain('3/3');
    expect(row.textContent).not.toMatch(/kg|undefined|null/);
  });
});
