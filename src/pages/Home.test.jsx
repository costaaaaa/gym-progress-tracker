// Home dopo il login: i dati arrivano dalla fetch (confine), l'utente vede link, testi e intestazioni.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { renderToString } from 'react-dom/server';
import Home from './Home';
import { ThemeModeProvider } from '../context/ThemeModeContext';

const auth = vi.hoisted(() => ({ isLoggedIn: true }));
vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({ user: { username: 'mario88' }, isLoggedIn: auth.isLoggedIn, loading: false }),
}));

const responses = {
  'workout_history/read.php': {
    success: true,
    records: [{ date: '2026-10-20', exercises: [{ name: 'Panca piana' }, { name: 'Squat' }] }],
  },
  'workout/read_plans.php': {
    success: true,
    records: [{ id: 1, name: 'Push Pull Legs', description: 'Tre giorni', is_active: true }],
  },
  'workout_stats/dashboard.php': {
    success: true,
    weekly_workouts: 2,
    weekly_goal: 3,
    weekly_volume: { total_weight: 4200, total_reps: 96 },
    weekly_sets: {
      week: { petto: 5, schiena: 3, spalle: 0, bicipiti: 0, tricipiti: 0, addome: 0, quadricipiti: 0, femorali: 0, glutei: 0, adduttori: 0, abduttori: 0, polpacci: 0 },
      previous_to_date: { petto: 2, schiena: 1, spalle: 0, bicipiti: 0, tricipiti: 0, addome: 0, quadricipiti: 0, femorali: 0, glutei: 0, adduttori: 0, abduttori: 0, polpacci: 0 },
      previous_total: 10,
    },
    recovery: {},
  },
  'gamification/streak.php': {
    success: true,
    current_streak_weeks: 4,
    longest_streak_weeks: 6,
    this_week: { count: 2, goal: 3, completed: false },
  },
  'gamification/profile.php': {
    success: true,
    level: 5,
    xp_into_level: 120,
    xp_for_next_level: 300,
    total_xp: 1500,
  },
  'groups/list.php': { success: true, groups: [{ id: 1, name: 'Palestra Roma', members_count: 3 }] },
};

const fakeFetch = vi.fn((url) => {
  const key = Object.keys(responses).find((k) => String(url).includes(k));
  const body = key ? responses[key] : { success: false };
  return Promise.resolve({
    ok: Boolean(key),
    status: key ? 200 : 404,
    json: async () => body,
    text: async () => JSON.stringify(body),
  });
});

const homeTree = () => <MemoryRouter><ThemeModeProvider><Home /></ThemeModeProvider></MemoryRouter>;
const renderHome = () => render(homeTree());

const original = { ...responses };

beforeEach(() => {
  vi.stubGlobal('fetch', fakeFetch);
});
afterEach(() => {
  auth.isLoggedIn = true;
  vi.unstubAllGlobals();
  Object.assign(responses, original);
});

const newUser = () => {
  responses['workout_history/read.php'] = { success: true, records: [] };
  responses['workout/read_plans.php'] = { success: true, records: [] };
};

describe('primo accesso', () => {
  it('senza allenamenti il titolo è "Benvenuto"', async () => {
    newUser();
    renderHome();
    expect(await screen.findByRole('heading', { level: 1, name: 'Benvenuto, mario88' })).toBeTruthy();
  });

  it('con la cronologia il titolo è "Bentornato"', async () => {
    renderHome();
    expect(await screen.findByRole('heading', { level: 1, name: 'Bentornato, mario88' })).toBeTruthy();
    expect(screen.queryByText('Benvenuto, mario88')).toBeNull();
  });

  it('per un utente nuovo la Home mostra solo titolo, "Inizia da qui" e riepilogo settimanale', async () => {
    newUser();
    renderHome();
    await screen.findByText('Inizia da qui');
    expect(screen.getByText('Riepilogo settimanale')).toBeTruthy();
    expect(screen.queryByRole('link', { name: 'Inizia allenamento' })).toBeNull();
    expect(screen.queryByText('Scheda attiva')).toBeNull();
    expect(screen.queryByText('Ultimo allenamento')).toBeNull();
    expect(screen.queryByText('I tuoi gruppi')).toBeNull();
    expect(screen.queryByText('Nessun allenamento recente. È ora di tornare in palestra!')).toBeNull();
  });

  it('con una scheda attiva e una cronologia la Home mostra tutte le card e il bottone "Inizia allenamento"', async () => {
    renderHome();
    expect(await screen.findByRole('link', { name: 'Inizia allenamento' })).toBeTruthy();
    expect(await screen.findByText('Scheda attiva')).toBeTruthy();
    expect(screen.getByText('Ultimo allenamento')).toBeTruthy();
    expect(await screen.findByText('I tuoi gruppi')).toBeTruthy();
    expect(screen.queryByText('Inizia da qui')).toBeNull();
  });

  it('"Inizia da qui" non c\'è se esistono schede, anche tutte inattive, e nessun allenamento', async () => {
    responses['workout_history/read.php'] = { success: true, records: [] };
    responses['workout/read_plans.php'] = { success: true, records: [{ id: 2, name: 'Vecchia', is_active: false }] };
    renderHome();
    await screen.findByRole('link', { name: 'Inizia allenamento' });
    expect(screen.queryByText('Inizia da qui')).toBeNull();
  });

  it('mentre i dati si caricano non ci sono né saluto, né bottone, né card "Inizia da qui"', async () => {
    vi.stubGlobal('fetch', vi.fn(() => new Promise(() => {})));
    renderHome();
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('');
    expect(screen.queryByText(/Bentornato|Benvenuto/)).toBeNull();
    expect(screen.queryByRole('link', { name: 'Inizia allenamento' })).toBeNull();
    expect(screen.queryByText('Inizia da qui')).toBeNull();
  });

  it('arrivata la cronologia vuota compare "Benvenuto", ma né bottone né card finché non arrivano le schede', async () => {
    newUser();
    let plansArrive;
    const plans = new Promise((resolve) => { plansArrive = resolve; });
    vi.stubGlobal('fetch', vi.fn((url) => (
      String(url).includes('workout/read_plans.php') ? plans.then(() => fakeFetch(url)) : fakeFetch(url)
    )));
    renderHome();
    expect(await screen.findByText('Benvenuto, mario88')).toBeTruthy();
    expect(screen.queryByRole('link', { name: 'Inizia allenamento' })).toBeNull();
    expect(screen.queryByText('Inizia da qui')).toBeNull();
    plansArrive();
    expect(await screen.findByText('Inizia da qui')).toBeTruthy();
    expect(screen.queryByRole('link', { name: 'Inizia allenamento' })).toBeNull();
  });

  it('un utente con la cronologia vede "Bentornato" e il bottone, mai "Benvenuto"', async () => {
    renderHome();
    expect(await screen.findByText('Bentornato, mario88')).toBeTruthy();
    expect(await screen.findByRole('link', { name: 'Inizia allenamento' })).toBeTruthy();
    expect(screen.queryByText(/Benvenuto/)).toBeNull();
  });

  it('al primo render di un utente loggato la Home è già in caricamento: nessuna card dei dati', () => {
    const html = renderToString(homeTree());
    expect(html).toContain('role="progressbar"');
    expect(html).not.toContain('Riepilogo settimanale');
    expect(html).not.toContain('Bentornato');
  });

  it.each([
    ['senza schede', []],
    ['con sole schede inattive', [{ id: 2, name: 'Vecchia', is_active: false }]],
  ])('il riepilogo settimanale %s parla di traguardo, non di scheda', async (_nome, records) => {
    responses['workout/read_plans.php'] = { success: true, records };
    renderHome();
    expect(await screen.findByText('Ti manca 1 sessione per il traguardo settimanale.')).toBeTruthy();
    expect(screen.queryByText(/per completare la scheda/)).toBeNull();
  });

  it('senza scheda e senza allenamenti c\'è "Inizia da qui" con il link a "Crea la tua prima scheda"', async () => {
    newUser();
    renderHome();
    expect(await screen.findByText('Inizia da qui')).toBeTruthy();
    const link = screen.getByRole('link', { name: 'Crea la tua prima scheda' });
    expect(link.getAttribute('href')).toBe('/workouts?tab=plans');
  });

  it('"Inizia da qui" non c\'è se c\'è una scheda attiva', async () => {
    responses['workout_history/read.php'] = { success: true, records: [] };
    renderHome();
    await screen.findByRole('link', { name: /Scheda attiva/ });
    expect(screen.queryByText('Inizia da qui')).toBeNull();
  });

  it('"Inizia da qui" non c\'è se c\'è una cronologia, anche senza scheda attiva', async () => {
    responses['workout/read_plans.php'] = { success: true, records: [] };
    renderHome();
    await screen.findByRole('link', { name: /Ultimo allenamento/ });
    expect(screen.queryByText('Inizia da qui')).toBeNull();
  });

  it.each([
    ['lo storico fallisce e le schede non ci sono', 'workout_history/read.php', 'workout/read_plans.php', { success: true, records: [] }, 'Bentornato, mario88'],
    ['lo storico è vuoto e le schede falliscono', 'workout/read_plans.php', 'workout_history/read.php', { success: true, records: [] }, 'Benvenuto, mario88'],
  ])('se %s la Home è completa, con il bottone e senza "Inizia da qui"', async (_nome, failing, emptied, emptyBody, greeting) => {
    responses[emptied] = emptyBody;
    vi.stubGlobal('fetch', vi.fn((url) => (
      String(url).includes(failing)
        ? Promise.resolve({ ok: false, status: 500, json: async () => ({}), text: async () => '{}' })
        : fakeFetch(url)
    )));
    renderHome();
    expect(await screen.findByRole('link', { name: 'Inizia allenamento' })).toBeTruthy();
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe(greeting);
    expect(screen.queryByText('Inizia da qui')).toBeNull();
  });

  it('l\'intestazione è "occupata" (aria-busy) mentre i dati si caricano e non dopo', async () => {
    renderHome();
    const hero = screen.getByRole('heading', { level: 1 }).parentElement;
    expect(hero.getAttribute('aria-busy')).toBe('true');
    await screen.findByRole('link', { name: 'Inizia allenamento' });
    expect(hero.getAttribute('aria-busy')).toBe('false');
  });

  it('dopo un ricaricamento la sessione si conferma senza rimontare Home: le card dei dati non partono prima di cronologia e schede', () => {
    auth.isLoggedIn = false;
    const fetchSpy = vi.fn(() => new Promise(() => {}));
    vi.stubGlobal('fetch', fetchSpy);
    const { rerender } = renderHome();
    auth.isLoggedIn = true;
    rerender(homeTree());
    const requested = fetchSpy.mock.calls.map(([url]) => String(url));
    expect(requested.some((url) => url.includes('workout_history/read.php'))).toBe(true);
    expect(requested.some((url) => /gamification|groups\//.test(url))).toBe(false);
    expect(screen.queryByText('Riepilogo settimanale')).toBeNull();
  });

  it('"Inizia da qui" non compare se il caricamento dei dati fallisce', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve({ ok: false, status: 500, json: async () => ({}), text: async () => '{}' })));
    renderHome();
    await screen.findByRole('link', { name: 'Inizia allenamento' });
    await waitFor(() => expect(screen.queryByRole('progressbar')).toBeNull());
    expect(screen.queryByText('Inizia da qui')).toBeNull();
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Bentornato, mario88');
  });
});

describe('home dopo il login', () => {
  it('"Inizia allenamento" porta al Focus', async () => {
    renderHome();
    const link = await screen.findByRole('link', { name: 'Inizia allenamento' });
    expect(link.getAttribute('href')).toBe('/focus');
  });

  it('Ultimo allenamento porta alla cronologia e mostra data ed esercizi', async () => {
    renderHome();
    const link = await screen.findByRole('link', { name: /Ultimo allenamento/ });
    expect(link.getAttribute('href')).toBe('/workouts?tab=history');
    expect(link.textContent).toContain('20 ottobre 2026');
    expect(link.textContent).toContain('Panca piana');
    expect(link.textContent).toContain('Squat');
  });

  it('Scheda attiva porta alle schede e mostra il nome', async () => {
    renderHome();
    const link = await screen.findByRole('link', { name: /Scheda attiva/ });
    expect(link.getAttribute('href')).toBe('/workouts?tab=plans');
    expect(link.textContent).toContain('Push Pull Legs');
  });

  it('il riepilogo settimanale mostra gli allenamenti fatti sull\'obiettivo', async () => {
    renderHome();
    expect(await screen.findByText('2 / 3')).toBeTruthy();
  });

  it.each(['Riepilogo settimanale', 'Ultimo allenamento', 'Scheda attiva', 'I tuoi gruppi'])(
    'la card "%s" ha un\'intestazione',
    async (name) => {
      renderHome();
      expect(await screen.findByRole('heading', { name })).toBeTruthy();
    },
  );
});

describe('home: serie allenanti', () => {
  it('il riepilogo settimanale mostra il totale delle serie di questa settimana e porta alla scheda Muscoli', async () => {
    renderHome();
    const label = await screen.findByText('Serie allenanti');
    const link = label.closest('a');
    expect(link.getAttribute('href')).toBe('/dashboard?tab=muscles');
    expect(link.textContent).toContain('8'); // 5 petto + 3 schiena
  });

  it('sotto Stato muscolare c\'è il link alla scheda Muscoli', async () => {
    renderHome();
    const link = await screen.findByRole('link', { name: 'Serie e recupero per muscolo ›' });
    expect(link.getAttribute('href')).toBe('/dashboard?tab=muscles');
  });

  it('senza weekly_sets (server precedente) mostra 0 senza andare in errore', async () => {
    vi.stubGlobal('fetch', vi.fn((url) => {
      const key = Object.keys(responses).find((k) => String(url).includes(k));
      let body = key ? responses[key] : { success: false };
      if (key === 'workout_stats/dashboard.php') {
        body = { ...body };
        delete body.weekly_sets;
      }
      return Promise.resolve({ ok: Boolean(key), status: key ? 200 : 404, json: async () => body, text: async () => JSON.stringify(body) });
    }));
    renderHome();
    const label = await screen.findByText('Serie allenanti');
    const link = label.closest('a');
    expect(link.getAttribute('href')).toBe('/dashboard?tab=muscles');
    expect(link.textContent).toContain('0');
  });
});

// Il font dei titoli di card è un valore atteso scritto per esteso: non importato dal codice.
describe('home: titoli delle card', () => {
  const style = (el) => {
    const { fontFamily, fontWeight, fontSize, lineHeight, letterSpacing } = getComputedStyle(el);
    return { tag: el.tagName, fontFamily, fontWeight, fontSize, lineHeight, letterSpacing };
  };
  const titolo = {
    fontFamily: '"Lexend", sans-serif',
    fontWeight: '700',
    fontSize: '17px',
    lineHeight: '1.5',
    letterSpacing: 'normal',
  };

  it('il titolo di una card (h2) è Lexend 700 a 17px', async () => {
    renderHome();
    const h2 = await screen.findByRole('heading', { name: 'Riepilogo settimanale' });
    expect(style(h2)).toEqual({ tag: 'H2', ...titolo });
  });

  it('il titolo di sezione senza heading resta un <p> con lo stesso stile', async () => {
    renderHome();
    await screen.findByRole('heading', { name: 'Riepilogo settimanale' });
    expect(style(screen.getByText('Azioni rapide'))).toEqual({ tag: 'P', ...titolo });
  });
});
