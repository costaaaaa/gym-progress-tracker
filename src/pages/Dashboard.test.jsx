// Pagina Progressi (indirizzo /progressi) vista dall'utente: titolo unico sopra i tab, tab attivo in inchiostro.
// Colori del tema chiaro scritti a mano: text.primary #1a1816, text.secondary #6b6663.
import { useState } from 'react';
import { describe, it, expect, vi, beforeAll, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { MemoryRouter, Routes, Route, useLocation, useNavigate } from 'react-router-dom';
import Dashboard from './Dashboard';
import { ThemeModeProvider } from '../context/ThemeModeContext';
import { json } from '../test/dom';

const auth = vi.hoisted(() => ({ value: null }));
vi.mock('../context/AuthContext', () => ({ useAuth: () => auth.value }));
auth.value = { isLoggedIn: true, loading: false };

// Registra il valore che arriva alle Tabs a ogni render (un -1 non è un valore valido)
const tabValues = vi.hoisted(() => []);
vi.mock('@mui/material', async (importOriginal) => {
  const mui = await importOriginal();
  const Tabs = (props) => { tabValues.push(props.value); return <mui.Tabs {...props} />; };
  return { ...mui, Tabs };
});

const INK = 'rgb(26, 24, 22)';
const GREY = 'rgb(107, 102, 99)';

// Le tab sono lazy: il primo import di Progressi (con grafici e dialoghi) è lento, lo scaldiamo prima dei test
beforeAll(() => import('./Progress'), 30000);

beforeEach(() => {
  auth.value = { isLoggedIn: true, loading: false };
  localStorage.setItem('themeMode', 'light');
  vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(json({ records: [] }))));
});
afterEach(() => vi.unstubAllGlobals());

const mount = async () => {
  render(
    <ThemeModeProvider>
      <MemoryRouter initialEntries={['/progressi']}><Dashboard /></MemoryRouter>
    </ThemeModeProvider>,
  );
  await screen.findByText(/Nessun dato di allenamento/);
};

describe('shell di Progressi', () => {
  it('un solo h1 "Progressi" nello stile titolo di pagina, sopra i tab', async () => {
    await mount();
    const h1s = screen.getAllByRole('heading', { level: 1 });
    expect(h1s.map((h) => h.textContent)).toEqual(['Progressi']);
    const style = getComputedStyle(h1s[0]);
    expect(style.fontSize).toBe('28px');
    expect(style.fontWeight).toBe('800');
    expect(h1s[0].compareDocumentPosition(screen.getByRole('tablist')) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('la tab attiva è in inchiostro con indicatore da 2px e icona grigia, senza rosso', async () => {
    await mount();
    const tab = screen.getByRole('tab', { name: 'Esercizi' });
    expect(tab.getAttribute('aria-selected')).toBe('true');
    expect(getComputedStyle(tab).color).toBe(INK);
    expect(getComputedStyle(tab).fontWeight).toBe('600');
    expect(getComputedStyle(tab).fontSize).toBe('16px');
    const indicator = document.querySelector('.MuiTabs-indicator');
    expect(getComputedStyle(indicator).backgroundColor).toBe(INK);
    expect(getComputedStyle(indicator).height).toBe('2px');
    expect(getComputedStyle(tab.querySelector('svg')).color).toBe(GREY);
  });

  it('sul telefono le tre tab si dividono la riga e le etichette si leggono intere, senza scroll', async () => {
    await mount();
    // jsdom non valuta le media query: lo stile letto qui è quello da telefono, il primo
    expect(document.querySelector('.MuiTabs-scrollableX')).toBeNull();
    const tabs = screen.getAllByRole('tab');
    expect(tabs).toHaveLength(3);
    tabs.forEach((tab) => {
      const style = getComputedStyle(tab);
      expect(style.flexGrow).toBe('1');
      expect(style.flexShrink).toBe('1');
      expect(style.minWidth).toBe('0px');
      expect(style.whiteSpace).not.toBe('nowrap');
      expect(style.textOverflow).not.toBe('ellipsis');
      expect(getComputedStyle(tab.querySelector('.MuiTab-iconWrapper')).display).toBe('none');
    });
  });

  it('le tre tab hanno etichette corte, uguali su ogni larghezza: Esercizi · Volume · Misure', async () => {
    await mount();
    expect(screen.getAllByRole('tab').map((tab) => tab.textContent)).toEqual(['Esercizi', 'Volume', 'Misure']);
  });
});

describe('tab Volume', () => {
  const dashboardStats = {
    success: true,
    detail: 'full',
    weekly_volume: { total_weight: 1200, total_reps: 30 },
    weekly_sets: {
      week: { petto: 3, schiena: 0, spalle: 0, bicipiti: 0, tricipiti: 0, addome: 0, quadricipiti: 0, femorali: 0, glutei: 0, adduttori: 0, abduttori: 0, polpacci: 0 },
      previous_to_date: { petto: 1, schiena: 0, spalle: 0, bicipiti: 0, tricipiti: 0, addome: 0, quadricipiti: 0, femorali: 0, glutei: 0, adduttori: 0, abduttori: 0, polpacci: 0 },
      previous_total: 2,
    },
    recovery: {},
  };
  const Where = () => { const { pathname, search } = useLocation(); return <p data-testid="where">{pathname + search}</p>; };
  const openAt = (path) => {
    vi.stubGlobal('fetch', vi.fn((url) => Promise.resolve(
      json(String(url).includes('workout_stats/dashboard.php') ? dashboardStats : { records: [] }),
    )));
    render(
      <ThemeModeProvider>
        <MemoryRouter initialEntries={[path]}><Where /><Dashboard /></MemoryRouter>
      </ThemeModeProvider>,
    );
  };

  it('?tab=volume apre la scheda Volume, selezionata e con i suoi dati', async () => {
    openAt('/progressi?tab=volume');
    const tab = await screen.findByRole('tab', { name: 'Volume' });
    expect(tab.getAttribute('aria-selected')).toBe('true');
    expect(await screen.findByRole('heading', { level: 2, name: 'Questa settimana' })).toBeTruthy();
    expect(screen.getByText('Petto').closest('li').textContent).toContain('3');
  });

  it('?tab=muscles (l\'indirizzo di prima) porta a ?tab=volume con replace, senza la pagina «non attivo»', async () => {
    openAt('/progressi?tab=muscles');
    expect(await screen.findByRole('heading', { level: 2, name: 'Questa settimana' })).toBeTruthy();
    expect(screen.getByRole('tab', { name: 'Volume' }).getAttribute('aria-selected')).toBe('true');
    await waitFor(() => expect(screen.getByTestId('where').textContent).toBe('/progressi?tab=volume'));
    expect(screen.queryByText(/non è attivo/)).toBeNull();
  });
});

describe('tab sconosciuta', () => {
  it('?tab=foo apre la prima tab, senza che le Tabs ricevano mai un valore non valido', async () => {
    tabValues.length = 0;
    render(
      <ThemeModeProvider>
        <MemoryRouter initialEntries={['/progressi?tab=foo']}><Dashboard /></MemoryRouter>
      </ThemeModeProvider>,
    );
    const tab = await screen.findByRole('tab', { name: 'Esercizi' });
    expect(tab.getAttribute('aria-selected')).toBe('true');
    expect(tabValues.length).toBeGreaterThan(0);
    expect(tabValues.every((value) => value === 0)).toBe(true);
  });
});

describe('nomi accessibili', () => {
  it('l\'elenco dei tab ha un nome in italiano', async () => {
    await mount();
    expect(screen.getByRole('tablist', { name: 'Sezioni dei progressi' })).toBeTruthy();
  });

  it('il titolo del documento segue il tab: «tab · Progressi | LiftIndex»', async () => {
    await mount();
    expect(document.title).toBe('Esercizi · Progressi | LiftIndex');
    fireEvent.click(screen.getByRole('tab', { name: 'Volume' }));
    await waitFor(() => expect(document.title).toBe('Volume · Progressi | LiftIndex'));
  });
});

// Moduli: Misure non attivo toglie la tab Misure; Esercizi e Volume restano sempre (Recupero spento toglie solo la card «Per muscolo»)
describe('moduli non attivi', () => {
  const ALL = { body: true, recovery: true, levels: true, groups: true, ai: true };
  const Switchable = ({ modules, path }) => {
    const [user, setUser] = useState({ id: 1, modules });
    auth.value = { isLoggedIn: true, loading: false, user, updateUser: (patch) => setUser((u) => ({ ...u, ...patch })) };
    return <MemoryRouter initialEntries={[path]}><Dashboard /></MemoryRouter>;
  };
  const open = (modules, path = '/progressi') => render(<ThemeModeProvider><Switchable modules={modules} path={path} /></ThemeModeProvider>);
  const tabNames = () => screen.getAllByRole('tab').map((tab) => tab.textContent);

  it('con tutto attivo le tab sono Esercizi · Volume · Misure', async () => {
    open(ALL);
    await screen.findByText(/Nessun dato di allenamento/);
    expect(tabNames()).toEqual(['Esercizi', 'Volume', 'Misure']);
  });

  it('Misure non attivo: restano Esercizi e Volume, e la tab Volume si apre', async () => {
    open({ ...ALL, body: false });
    await screen.findByText(/Nessun dato di allenamento/);
    expect(tabNames()).toEqual(['Esercizi', 'Volume']);
    fireEvent.click(screen.getByRole('tab', { name: 'Volume' }));
    await waitFor(() => expect(screen.getByRole('tab', { name: 'Volume' }).getAttribute('aria-selected')).toBe('true'));
  });

  it('Recupero non attivo: la tab Volume c\'è lo stesso, e si apre', async () => {
    open({ ...ALL, recovery: false });
    await screen.findByText(/Nessun dato di allenamento/);
    expect(tabNames()).toEqual(['Esercizi', 'Volume', 'Misure']);
    fireEvent.click(screen.getByRole('tab', { name: 'Volume' }));
    await waitFor(() => expect(screen.getByRole('tab', { name: 'Volume' }).getAttribute('aria-selected')).toBe('true'));
    expect(document.title).toBe('Volume · Progressi | LiftIndex');
  });

  it('Recupero non attivo: la tab Misure si apre', async () => {
    open({ ...ALL, recovery: false });
    await screen.findByText(/Nessun dato di allenamento/);
    fireEvent.click(screen.getByRole('tab', { name: 'Misure' }));
    await waitFor(() => expect(screen.getByRole('tab', { name: 'Misure' }).getAttribute('aria-selected')).toBe('true'));
    expect(document.title).toBe('Misure · Progressi | LiftIndex');
  });

  it('Recupero e Misure non attivi: restano Esercizi e Volume', async () => {
    open({ ...ALL, recovery: false, body: false });
    await screen.findByText(/Nessun dato di allenamento/);
    expect(tabNames()).toEqual(['Esercizi', 'Volume']);
    expect(screen.getByRole('tab', { name: 'Esercizi' }).getAttribute('aria-selected')).toBe('true');
  });

  it('?tab=body con Misure non attivo: «Il modulo Misure non è attivo» con «Attiva», nessuna tab selezionata, nessun errore', async () => {
    open({ ...ALL, body: false }, '/progressi?tab=body');
    expect(await screen.findByRole('heading', { level: 2, name: 'Il modulo Misure non è attivo' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Attiva' })).toBeTruthy();
    expect(tabNames()).toEqual(['Esercizi', 'Volume']);
    screen.getAllByRole('tab').forEach((tab) => expect(tab.getAttribute('aria-selected')).toBe('false'));
    expect(screen.queryByRole('alert')).toBeNull();
    expect(screen.getAllByRole('heading', { level: 1 }).map((h) => h.textContent)).toEqual(['Progressi']);
  });

  it('?tab=muscles con Recupero non attivo apre Volume: nessuna pagina «non attivo» e nessuna card «Per muscolo»', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(json({ success: true, detail: 'full', weekly_volume: { total_weight: 0 }, weekly_sets: {}, recovery: {} }))));
    open({ ...ALL, recovery: false }, '/progressi?tab=muscles');
    expect(await screen.findByRole('heading', { level: 2, name: 'Questa settimana' })).toBeTruthy();
    expect(screen.getByRole('tab', { name: 'Volume' }).getAttribute('aria-selected')).toBe('true');
    expect(screen.queryByRole('heading', { name: 'Il modulo Recupero e serie per muscolo non è attivo' })).toBeNull();
    expect(screen.queryByRole('heading', { name: 'Per muscolo' })).toBeNull();
  });

  it('«Attiva» salva e mostra la tab richiesta, selezionata', async () => {
    vi.stubGlobal('fetch', vi.fn((url) => Promise.resolve(
      String(url).includes('update_settings.php') ? json({ success: true, modules: ALL }) : json({ records: [] }),
    )));
    open({ ...ALL, body: false }, '/progressi?tab=body');
    fireEvent.click(await screen.findByRole('button', { name: 'Attiva' }));
    const tab = await screen.findByRole('tab', { name: 'Misure' });
    expect(tab.getAttribute('aria-selected')).toBe('true');
    expect(screen.queryByRole('heading', { name: 'Il modulo Misure non è attivo' })).toBeNull();
  });
});

// «Nuova misura» dal ventaglio: arriva con lo stato `openMeasure` e la scheda Misure apre la finestra, una volta
describe('«Nuova misura» dal ventaglio', () => {
  const Probe = () => <p data-testid="state">{JSON.stringify(useLocation().state)}</p>;
  const openWith = (state, consentRequired = false) => {
    auth.value = { isLoggedIn: true, loading: false, weightUnit: 'kg', user: { id: 1, modules: { body: true, recovery: true } } };
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(json({ records: [], consent_required: consentRequired }))));
    render(
      <ThemeModeProvider>
        <MemoryRouter initialEntries={[{ pathname: '/progressi', search: '?tab=body', state }]}><Probe /><Dashboard /></MemoryRouter>
      </ThemeModeProvider>,
    );
  };
  const dialogTitle = () => screen.queryByText('Aggiungi misurazioni');

  it('apre la finestra «Aggiungi misurazioni» e consuma lo stato', async () => {
    openWith({ openMeasure: true });
    expect(await screen.findByRole('dialog')).toBeTruthy();
    expect(dialogTitle()).toBeTruthy();
    expect(screen.getByTestId('state').textContent).toBe('null');
  });

  it('giro vero: aperta la finestra, si va in un\'altra pagina e si torna indietro, e la finestra non si riapre', async () => {
    let navigate;
    const Nav = () => { navigate = useNavigate(); return null; };
    auth.value = { isLoggedIn: true, loading: false, weightUnit: 'kg', user: { id: 1, modules: { body: true, recovery: true } } };
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(json({ records: [], consent_required: false }))));
    render(
      <ThemeModeProvider>
        <MemoryRouter initialEntries={[{ pathname: '/progressi', search: '?tab=body', state: { openMeasure: true } }]}>
          <Nav />
          <Routes>
            <Route path="/progressi" element={<Dashboard />} />
            <Route path="/altrove" element={<p>Altra pagina</p>} />
          </Routes>
        </MemoryRouter>
      </ThemeModeProvider>,
    );
    await screen.findByRole('dialog');
    act(() => navigate('/altrove'));
    await screen.findByText('Altra pagina');
    act(() => navigate(-1));
    await screen.findByRole('button', { name: 'Nuova misurazione' });
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('chiusa la finestra non si riapre da sola', async () => {
    openWith({ openMeasure: true });
    await screen.findByRole('dialog');
    fireEvent.click(screen.getByRole('button', { name: 'Annulla' }));
    await waitFor(() => expect(dialogTitle()).toBeNull());
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(dialogTitle()).toBeNull();
  });

  it('senza il consenso ai dati sulla salute si vede la card del consenso e non si apre nulla; lo stato è consumato', async () => {
    openWith({ openMeasure: true }, true);
    await waitFor(() => expect(screen.getByTestId('state').textContent).toBe('null'));
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Nuova misurazione' })).toBeNull();
  });

  it('senza lo stato la finestra non si apre', async () => {
    openWith(null);
    await screen.findByRole('button', { name: 'Nuova misurazione' });
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});
