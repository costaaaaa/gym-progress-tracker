// Home dopo il login: i dati arrivano dalla fetch (confine), l'utente vede testi, bottoni, link e la barra in alto.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, within, fireEvent, act, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom';
import { renderToString } from 'react-dom/server';
import Home from './Home';
import Layout from '../components/Layout/Layout';
import { ThemeModeProvider } from '../context/ThemeModeContext';
import { pinLocalClock } from '../test/timeZone';
import { textBelow } from '../test/minText';
import { mediaStyle } from '../test/mediaStyle';
import { HOME_BLOCKS } from '../utils/homeLayout';

vi.mock('./landing/Landing', () => ({ default: () => <p>Landing per gli ospiti</p> }));

const auth = vi.hoisted(() => ({ isLoggedIn: true, weightUnit: 'kg', modules: undefined, homeLayout: undefined }));
vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({ user: { username: 'mario88', modules: auth.modules, home_layout: auth.homeLayout }, isLoggedIn: auth.isLoggedIn, loading: false, weightUnit: auth.weightUnit }),
}));

const DRAFT_KEY = 'gym_focus_workout_draft';
const NEXT_DAY = { id: 7, name: 'Giorno B · Pull', exercises: 6 };
const WORKOUT = {
  id: 1, date: '2026-11-18 18:30:00', day_id: 4, day_name: 'Giorno A · Push', duration_seconds: 3480,
  exercises: [{ name: 'Panca piana', sets: [{ weight: 100, reps: 10 }] }, { name: 'Squat', sets: [{ weight: 80, reps: 5 }] }],
};

const responses = {
  'workout_history/read.php': { success: true, records: [WORKOUT] },
  'workout/read_plans.php': { success: true, records: [{ id: 1, name: 'Push Pull Legs', description: 'Tre giorni', is_active: true }] },
  'workout_stats/dashboard.php': {
    success: true,
    today: '2026-11-19', // giovedì
    trained_today: false,
    week_days: [true, false, true, false, false, false, false],
    next_day: NEXT_DAY,
    weekly_workouts: 2,
    weekly_goal: 4,
    weekly_volume: { total_weight: 4200, total_reps: 96 },
    weekly_sets: { week: { petto: 5 }, previous_to_date: {}, previous_total: 10 },
    recovery: {},
  },
  'gamification/streak.php': { success: true, current_streak_weeks: 4, longest_streak_weeks: 6, this_week: { count: 2, goal: 3, completed: false } },
  'gamification/profile.php': { success: true, level: 5, xp_into_level: 120, xp_for_next_level: 300, total_xp: 1500 },
  'groups/list.php': { success: true, groups: [{ id: 1, name: 'Palestra Roma', members_count: 3 }] },
  'groups/read.php': {
    success: true, visibility: { workouts: true },
    board: [{ rank: 1, username: 'marta', is_me: false, workouts: 3, goal: 4, volume_kg: 900, adherence: 0.75 }, { rank: 2, username: 'mario88', is_me: true, workouts: 2, goal: 4, volume_kg: 500, adherence: 0.5 }],
  },
  'user_stats/read.php': {
    consent_required: false,
    records: [{ id: 1, date: '2026-10-25', weight: '79.00' }, { id: 2, date: '2026-11-18', weight: '78.40' }],
  },
};
const original = JSON.parse(JSON.stringify(responses));

const reply = (key, body) => Promise.resolve({
  ok: Boolean(key), status: key ? 200 : 404, json: async () => body, text: async () => JSON.stringify(body),
});
const fakeFetch = vi.fn((url) => {
  const key = Object.keys(responses).find((k) => String(url).includes(k));
  return reply(key, key ? responses[key] : { success: false });
});
const failing = (part) => vi.fn((url) => (
  String(url).includes(part) ? Promise.resolve({ ok: false, status: 500, json: async () => ({}), text: async () => '{}' }) : fakeFetch(url)
));
const setDashboard = (patch) => { responses['workout_stats/dashboard.php'] = { ...responses['workout_stats/dashboard.php'], ...patch }; };

const Where = () => {
  const { pathname, state } = useLocation();
  return <p data-testid="where">{pathname}{state ? JSON.stringify(state) : ''}</p>;
};
// Con il Layout vero: la barra in alto e il contesto dell'Outlet sono quelli dell'app
const homeTree = () => (
  <MemoryRouter>
    <ThemeModeProvider>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<Home />} />
          <Route path="*" element={<Where />} />
        </Route>
      </Routes>
    </ThemeModeProvider>
  </MemoryRouter>
);
const renderHome = () => render(homeTree());
const bar = () => document.querySelector('header');
const barColor = () => getComputedStyle(bar()).backgroundColor;
const RED = 'rgb(213, 0, 0)';
const realMatchMedia = window.matchMedia;
const phone = () => {
  window.matchMedia = (query) => ({ matches: query.includes('max-width'), media: query, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} });
};

beforeEach(() => {
  vi.stubGlobal('fetch', fakeFetch);
});
afterEach(() => {
  auth.isLoggedIn = true;
  auth.weightUnit = 'kg';
  auth.modules = undefined;
  auth.homeLayout = undefined;
  window.matchMedia = realMatchMedia;
  localStorage.removeItem(DRAFT_KEY);
  vi.useRealTimers();
  vi.unstubAllGlobals();
  Object.keys(responses).forEach((k) => { responses[k] = JSON.parse(JSON.stringify(original[k])); });
});

const newUser = () => {
  responses['workout_history/read.php'] = { success: true, records: [] };
  responses['workout/read_plans.php'] = { success: true, records: [] };
};
// I titoli dei blocchi sotto l'apertura, nell'ordine in cui compaiono
const blockTitles = () => within(document.querySelector('main')).queryAllByRole('heading', { level: 2 }).map((h) => h.textContent);
const blocksLoaded = () => screen.findByText('Livello 5 · streak di 4 settimane');
const opened = () => screen.findByRole('link', { name: /^(Inizia|Riprendi|Vedi allenamento)$/ });

describe('landing', () => {
  it('chi non è loggato vede la landing e non si chiama il server', async () => {
    auth.isLoggedIn = false;
    fakeFetch.mockClear();
    renderHome();
    expect(await screen.findByText('Landing per gli ospiti')).toBeTruthy();
    expect(fakeFetch).not.toHaveBeenCalled();
  });
});

describe('primo accesso', () => {
  it('senza allenamenti né schede: saluto e card «Inizia da qui» con il link, nient\'altro', async () => {
    newUser();
    renderHome();
    await screen.findByText('Inizia da qui');
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Ciao, mario88');
    expect(screen.getByRole('link', { name: 'Crea la tua prima scheda' }).getAttribute('href')).toBe('/schede');
    expect(screen.queryByText('Settimana')).toBeNull();
    expect(screen.queryByRole('link', { name: 'Inizia' })).toBeNull();
    expect(screen.queryByText('Ultimo allenamento')).toBeNull();
    expect(blockTitles()).toEqual(['Inizia da qui']);
  });

  it('niente apertura rossa: la barra resta neutra anche sul telefono', async () => {
    phone();
    newUser();
    renderHome();
    await screen.findByText('Inizia da qui');
    expect(barColor()).toBe('rgb(255, 255, 255)');
  });

  it('«Inizia da qui» non c\'è se esistono schede, anche tutte inattive, e nessun allenamento', async () => {
    responses['workout_history/read.php'] = { success: true, records: [] };
    responses['workout/read_plans.php'] = { success: true, records: [{ id: 2, name: 'Vecchia', is_active: false }] };
    renderHome();
    await opened();
    expect(screen.queryByText('Inizia da qui')).toBeNull();
  });

  it('con le schede ma senza allenamenti c\'è l\'apertura, non «Inizia da qui»', async () => {
    responses['workout_history/read.php'] = { success: true, records: [] };
    renderHome();
    await opened();
    expect(screen.queryByText('Inizia da qui')).toBeNull();
    expect(screen.queryByText('Ultimo allenamento')).toBeNull();
  });

  it('con la cronologia e nessuna scheda attiva non è nuovo', async () => {
    responses['workout/read_plans.php'] = { success: true, records: [] };
    renderHome();
    await opened();
    expect(screen.queryByText('Inizia da qui')).toBeNull();
  });

  it.each([
    ['la cronologia fallisce e le schede non ci sono', 'workout_history/read.php', 'workout/read_plans.php'],
    ['la cronologia è vuota e le schede falliscono', 'workout/read_plans.php', 'workout_history/read.php'],
  ])('se %s non si passa per nuovi', async (_nome, failingPart, emptied) => {
    responses[emptied] = { success: true, records: [] };
    vi.stubGlobal('fetch', failing(failingPart));
    renderHome();
    await opened();
    expect(screen.queryByText('Inizia da qui')).toBeNull();
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Ciao, mario88');
  });

  it('finché non arrivano le schede non compare né «Inizia da qui» né l\'apertura', async () => {
    newUser();
    let plansArrive;
    const plans = new Promise((resolve) => { plansArrive = resolve; });
    vi.stubGlobal('fetch', vi.fn((url) => (String(url).includes('workout/read_plans.php') ? plans.then(() => fakeFetch(url)) : fakeFetch(url))));
    renderHome();
    await act(async () => {});
    expect(screen.queryByText('Inizia da qui')).toBeNull();
    expect(screen.queryByRole('link', { name: 'Inizia' })).toBeNull();
    expect(screen.getByTestId('home-loading').getAttribute('aria-busy')).toBe('true');
    plansArrive();
    expect(await screen.findByText('Inizia da qui')).toBeTruthy();
  });
});

describe('caricamento ed errori della dashboard', () => {
  it('mentre i dati arrivano: saluto e segnaposto, aria-busy, niente rotella a tutta pagina, niente rosso', async () => {
    phone();
    vi.stubGlobal('fetch', vi.fn(() => new Promise(() => {})));
    renderHome();
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Ciao, mario88');
    expect(screen.getByTestId('home-loading').getAttribute('aria-busy')).toBe('true');
    expect(screen.queryByRole('progressbar')).toBeNull();
    expect(screen.queryByRole('link', { name: 'Inizia' })).toBeNull();
    expect(screen.queryByText('Settimana')).toBeNull();
    expect(barColor()).toBe('rgb(255, 255, 255)');
  });

  it('al primo render già in caricamento: il segnaposto, mai l\'apertura', () => {
    const html = renderToString(<MemoryRouter><ThemeModeProvider><Home /></ThemeModeProvider></MemoryRouter>);
    expect(html).toContain('aria-busy="true"');
    expect(html).not.toContain('Oggi tocca');
    expect(html).not.toContain('Settimana');
  });

  it('arrivati i dati l\'aria-busy sparisce', async () => {
    renderHome();
    await opened();
    // Anche i blocchi, che caricano per conto loro, a un certo punto hanno finito
    await waitFor(() => expect(document.querySelector('[aria-busy="true"]')).toBeNull());
  });

  it('dashboard in errore: saluto e «Inizia» verso il Focus, niente settimana; il resto della pagina funziona', async () => {
    phone();
    vi.stubGlobal('fetch', failing('workout_stats/dashboard.php'));
    renderHome();
    const link = await screen.findByRole('link', { name: 'Inizia' });
    expect(link.getAttribute('href')).toBe('/focus');
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Ciao, mario88');
    expect(screen.queryByText('Settimana')).toBeNull();
    expect(screen.queryByText(/allenamenti su/)).toBeNull();
    expect(await screen.findByText('Livello 5 · streak di 4 settimane')).toBeTruthy();
    // La dashboard è in errore: il blocco che ne vive lo dice, gli altri no
    expect(screen.getByRole('heading', { level: 2, name: 'Recupero' }).closest('a').textContent).toContain('Dati non disponibili al momento.');
    expect(screen.getByText('Ultimo allenamento')).toBeTruthy();
    expect(barColor()).toBe('rgb(255, 255, 255)');
  });

  it('la dashboard con success false conta come errore', async () => {
    responses['workout_stats/dashboard.php'] = { success: false };
    renderHome();
    expect((await screen.findByRole('link', { name: 'Inizia' })).getAttribute('href')).toBe('/focus');
    expect(screen.queryByText('Settimana')).toBeNull();
  });

  it('un errore di rete arrivato dopo il logout non viene più gestito', async () => {
    let fail;
    const dashboard = new Promise((_, reject) => { fail = reject; });
    vi.stubGlobal('fetch', vi.fn((url) => (String(url).includes('workout_stats/dashboard.php') ? dashboard : fakeFetch(url))));
    const logged = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      const view = renderHome();
      await act(async () => {});
      auth.isLoggedIn = false;
      view.rerender(homeTree());
      expect(await screen.findByText('Landing per gli ospiti')).toBeTruthy();
      await act(async () => { fail(new Error('rete')); });
      expect(logged.mock.calls.some((call) => String(call[0]).includes('Errore nel caricamento'))).toBe(false);
    } finally {
      logged.mockRestore();
    }
  });
});

describe('stato «todo»', () => {
  it('saluto, frase, giorno proposto, «Inizia» verso il Focus con il giorno nello stato', async () => {
    renderHome();
    expect((await screen.findByRole('heading', { level: 1 })).textContent).toBe('Ciao, mario88');
    expect(await screen.findByText('Oggi tocca a Giorno B · Pull. Questa settimana sei a 2 allenamenti su 4.')).toBeTruthy();
    expect(screen.getByText('6 esercizi')).toBeTruthy();
    expect(screen.getByText('2 di 4 allenamenti')).toBeTruthy();
    fireEvent.click(screen.getByRole('link', { name: 'Inizia' }));
    expect(screen.getByTestId('where').textContent).toBe('/focus{"suggestedDayId":7}');
  });

  it('senza giorno proposto (nessuna scheda attiva o senza giorni) resta la frase della settimana e il bottone', async () => {
    setDashboard({ next_day: null });
    renderHome();
    expect(await screen.findByText('Questa settimana sei a 2 allenamenti su 4.')).toBeTruthy();
    expect(screen.queryByText(/Oggi tocca a/)).toBeNull();
    fireEvent.click(screen.getByRole('link', { name: 'Inizia' }));
    expect(screen.getByTestId('where').textContent).toBe('/focus');
  });

  it.each([[0, 'allenamenti'], [1, 'allenamento'], [2, 'allenamenti']])('plurali con %i allenamenti', async (count, word) => {
    setDashboard({ weekly_workouts: count, week_days: new Array(7).fill(false), next_day: null });
    renderHome();
    expect(await screen.findByText(`Questa settimana sei a ${count} ${word} su 4.`)).toBeTruthy();
  });

  it('i giorni della settimana vengono dal server: testo per il lettore di schermo e cerchi pieni', async () => {
    renderHome();
    expect(await screen.findByText('Allenato lunedì e mercoledì. Oggi è giovedì.')).toBeTruthy();
    expect(document.querySelectorAll('[data-circle][data-done="true"]').length).toBe(2);
  });
});

describe('stato «resume»', () => {
  it('con una bozza del Focus l\'apertura resta rossa: giorno della bozza e «Riprendi» verso /focus', async () => {
    localStorage.setItem(DRAFT_KEY, JSON.stringify({ selectedDay: { id: 1, name: 'Giorno A · Push' }, startTime: new Date().toISOString() }));
    renderHome();
    expect(await screen.findByText('Hai un allenamento a metà: Giorno A · Push.')).toBeTruthy();
    expect(screen.queryByRole('link', { name: 'Inizia' })).toBeNull();
    fireEvent.click(screen.getByRole('link', { name: 'Riprendi' }));
    expect(screen.getByTestId('where').textContent).toBe('/focus');
  });

  it('la bozza vince anche su «fatto oggi» e su «obiettivo raggiunto»', async () => {
    localStorage.setItem(DRAFT_KEY, JSON.stringify({ selectedDay: { id: 1, name: 'Giorno A' }, startTime: 1000 }));
    setDashboard({ trained_today: true, weekly_workouts: 5 });
    renderHome();
    expect(await screen.findByRole('link', { name: 'Riprendi' })).toBeTruthy();
  });
});

describe('stato «done»', () => {
  const TODAY_WORKOUT = { ...WORKOUT, id: 2, date: '2026-11-19 08:10:00', day_name: 'Giorno B · Pull' };
  const withTodayWorkout = () => { responses['workout_history/read.php'] = { success: true, records: [TODAY_WORKOUT, WORKOUT] }; };
  beforeEach(() => {
    withTodayWorkout();
    setDashboard({ trained_today: true, weekly_workouts: 3, week_days: [true, false, true, true, false, false, false], next_day: { id: 8, name: 'Giorno C · Legs', exercises: 5 } });
  });

  it('«Fatto per oggi.» e la card con l\'allenamento di oggi', async () => {
    renderHome();
    expect(await screen.findByText('Fatto per oggi. Questa settimana sei a 3 allenamenti su 4.')).toBeTruthy();
    expect(screen.getByText('Completato')).toBeTruthy();
    expect(screen.getByText('Giorno B · Pull', { selector: 'p' })).toBeTruthy();
    expect(screen.getByText('58 min · 1.400 kg di volume')).toBeTruthy();
    expect(screen.getByText('Prossima seduta: Giorno C · Legs')).toBeTruthy();
  });

  it('«Vedi allenamento» porta allo Storico', async () => {
    renderHome();
    fireEvent.click(await screen.findByRole('link', { name: 'Vedi allenamento' }));
    expect(screen.getByTestId('where').textContent).toBe('/storico');
  });

  it('il blocco «Ultimo allenamento» non compare: l\'allenamento è già nell\'apertura', async () => {
    renderHome();
    await screen.findByText('Completato');
    expect(screen.queryByRole('heading', { name: 'Ultimo allenamento' })).toBeNull();
  });

  it('l\'allenamento di oggi è il primo con la data di today, non il primo dell\'elenco', async () => {
    responses['workout_history/read.php'] = { success: true, records: [{ ...WORKOUT, id: 3, date: '2026-11-20 07:00:00', day_name: 'Giorno C · Legs' }, TODAY_WORKOUT, WORKOUT] };
    renderHome();
    await screen.findByText('Completato');
    expect(screen.getByText('Giorno B · Pull', { selector: 'p' })).toBeTruthy();
    expect(screen.queryByText('Giorno C · Legs', { selector: 'p' })).toBeNull();
  });

  it('senza un allenamento con la data di today (fusi): «Allenamento di oggi», senza durata e volume, e l\'ultimo allenamento si vede', async () => {
    responses['workout_history/read.php'] = { success: true, records: [WORKOUT] };
    renderHome();
    await screen.findByText('Completato');
    expect(screen.getByText('Allenamento di oggi')).toBeTruthy();
    expect(document.querySelector('[data-card]').textContent).not.toMatch(/kg di volume/);
    expect(screen.getByRole('heading', { level: 2, name: 'Ultimo allenamento' })).toBeTruthy();
  });

  it('il volume è nell\'unità dell\'account (lb)', async () => {
    auth.weightUnit = 'lb';
    renderHome();
    expect(await screen.findByText('58 min · 3.086 lb di volume')).toBeTruthy(); // 1400 kg = 3086 lb
  });
});

describe('stato «goal»', () => {
  beforeEach(() => setDashboard({ weekly_workouts: 4, week_days: [true, true, true, true, false, false, false], today: '2026-11-20' }));

  it('frase dell\'obiettivo raggiunto e card «Prossima seduta» con «Inizia»', async () => {
    renderHome();
    expect(await screen.findByText('Obiettivo della settimana raggiunto: 4 allenamenti su 4.')).toBeTruthy();
    expect(screen.getByText('Prossima seduta')).toBeTruthy();
    fireEvent.click(screen.getByRole('link', { name: 'Inizia' }));
    expect(screen.getByTestId('where').textContent).toBe('/focus{"suggestedDayId":7}');
  });

  it('con più allenamenti dell\'obiettivo: «5 allenamenti su 4»', async () => {
    setDashboard({ weekly_workouts: 5 });
    renderHome();
    expect(await screen.findByText('Obiettivo della settimana raggiunto: 5 allenamenti su 4.')).toBeTruthy();
  });

  it('senza giorno proposto solo il bottone «Inizia»', async () => {
    setDashboard({ next_day: null });
    renderHome();
    await screen.findByText(/Obiettivo della settimana raggiunto/);
    expect(screen.queryByText('Prossima seduta')).toBeNull();
    expect(screen.getByRole('link', { name: 'Inizia' })).toBeTruthy();
  });

  it('l\'ultimo allenamento compare sotto l\'apertura', async () => {
    renderHome();
    await screen.findByText(/Obiettivo della settimana raggiunto/);
    expect(screen.getByRole('heading', { level: 2, name: 'Ultimo allenamento' })).toBeTruthy();
  });
});

describe('sotto l\'apertura', () => {
  it('«Ultimo allenamento»: giorno, data lunga, durata e volume; tutto il blocco porta allo Storico', async () => {
    renderHome();
    const link = (await screen.findByRole('heading', { level: 2, name: 'Ultimo allenamento' })).closest('a');
    expect(link.getAttribute('href')).toBe('/storico');
    expect(link.textContent).toContain('Giorno A · Push');
    expect(link.textContent).toContain('Mercoledì 18 novembre');
    expect(link.textContent).not.toContain('2026');
    expect(link.textContent).toContain('58 min · 1.400 kg di volume');
  });

  it('senza allenamenti il blocco non c\'è', async () => {
    responses['workout_history/read.php'] = { success: true, records: [] };
    renderHome();
    await opened();
    expect(screen.queryByText('Ultimo allenamento')).toBeNull();
  });

  it('le card uscite non ci sono più', async () => {
    renderHome();
    await opened();
    await blocksLoaded();
    // Dentro la pagina: la barra in basso e il ventaglio hanno le loro voci
    const page = within(document.querySelector('main'));
    ['Azioni rapide', 'Scheda attiva', 'Riepilogo settimanale', 'Allenamenti effettuati', 'Serie allenanti', 'Volume totale', 'Inizia allenamento'].forEach((text) => {
      expect(page.queryByText(text)).toBeNull();
    });
    expect(page.queryByText(/Bentornato|Benvenuto/)).toBeNull();
    expect(page.queryByRole('link', { name: 'Misure' })).toBeNull();
    expect(page.queryByRole('link', { name: 'Storico' })).toBeNull();
  });

  it('un solo h1', async () => {
    renderHome();
    await opened();
    await blocksLoaded();
    expect(screen.getAllByRole('heading', { level: 1 }).length).toBe(1);
  });

  it('nessun testo sotto i 12 px', async () => {
    renderHome();
    await opened();
    expect(textBelow(document.querySelector('main'), 12)).toEqual([]);
  });
});

describe('la barra in alto', () => {
  it('sul telefono, negli stati rossi, è rossa', async () => {
    phone();
    renderHome();
    await opened();
    expect(barColor()).toBe(RED);
  });

  it('con una bozza (resume) è rossa', async () => {
    phone();
    localStorage.setItem(DRAFT_KEY, JSON.stringify({ selectedDay: { id: 1, name: 'Giorno A' }, startTime: 1000 }));
    renderHome();
    await screen.findByRole('link', { name: 'Riprendi' });
    expect(barColor()).toBe(RED);
  });

  it('da md in su resta neutra anche con l\'apertura rossa', async () => {
    renderHome();
    await opened();
    expect(document.querySelector('[data-red-field]')).not.toBeNull();
    expect(barColor()).toBe('rgb(255, 255, 255)');
  });

  it.each([
    ['done', { trained_today: true }],
    ['goal', { weekly_workouts: 4 }],
  ])('negli stati neutri (%s) è neutra anche sul telefono', async (_nome, patch) => {
    phone();
    setDashboard(patch);
    renderHome();
    await opened();
    expect(document.querySelector('[data-red-field]')).toBeNull();
    expect(barColor()).toBe('rgb(255, 255, 255)');
  });

  it('al logout, restando sulla Home, torna neutra', async () => {
    phone();
    const view = renderHome();
    await opened();
    expect(barColor()).toBe(RED);
    auth.isLoggedIn = false;
    view.rerender(homeTree());
    expect(await screen.findByText('Landing per gli ospiti')).toBeTruthy();
    expect(document.querySelector('[data-red-field]')).toBeNull();
    expect(barColor()).toBe('rgb(255, 255, 255)');
  });

  it('uscendo dalla Home torna neutra', async () => {
    phone();
    renderHome();
    await opened();
    expect(barColor()).toBe(RED);
    fireEvent.click(screen.getByRole('link', { name: 'Inizia' }));
    expect(screen.getByTestId('where').textContent).toContain('/focus');
    expect(barColor()).toBe('rgb(255, 255, 255)');
  });
});

describe('«oggi» lo decide il server, non l\'orologio del dispositivo', () => {
  it.each(['UTC', 'Europe/Rome', 'America/Los_Angeles', 'Asia/Tokyo'])('con il dispositivo a domenica sera (%s) il giorno resta quello di today', async (zone) => {
    pinLocalClock(zone, 2026, 10, 22, 23, 50);
    renderHome();
    expect(await screen.findByText('Allenato lunedì e mercoledì. Oggi è giovedì.')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Inizia' })).toBeTruthy();
    vi.useRealTimers();
  });

  it('«fatto oggi» è quello del server: con trained_today falso uno storico con la data del dispositivo non cambia lo stato', async () => {
    pinLocalClock('Asia/Tokyo', 2026, 10, 25, 0, 5);
    responses['workout_history/read.php'] = { success: true, records: [{ ...WORKOUT, date: '2026-11-25 00:01:00' }] };
    setDashboard({ trained_today: false });
    renderHome();
    expect(await screen.findByRole('link', { name: 'Inizia' })).toBeTruthy();
    expect(screen.queryByRole('link', { name: 'Vedi allenamento' })).toBeNull();
    vi.useRealTimers();
  });
});

// Moduli: ciò che non è attivo sparisce dalla Home, senza buchi; il resto resta
describe('moduli non attivi', () => {
  const ALL = { body: true, recovery: true, levels: true, groups: true, ai: true };
  const fetched = (part) => fakeFetch.mock.calls.some(([url]) => String(url).includes(part));
  const mountWith = async (off) => {
    fakeFetch.mockClear();
    auth.modules = { ...ALL, ...Object.fromEntries(off.map((key) => [key, false])) };
    renderHome();
    await opened();
  };

  it('Livelli non attivo: nessun blocco dei livelli e il server dei livelli non si chiama', async () => {
    await mountWith(['levels']);
    expect(await screen.findByText('Peso')).toBeTruthy();
    expect(screen.queryByRole('heading', { name: 'Livello e streak' })).toBeNull();
    expect(fetched('gamification/')).toBe(false);
    expect(screen.getByRole('heading', { name: 'Recupero' })).toBeTruthy();
  });

  it('Recupero non attivo: nessun blocco del recupero', async () => {
    await mountWith(['recovery']);
    expect(screen.queryByRole('heading', { name: 'Recupero' })).toBeNull();
    expect(await blocksLoaded()).toBeTruthy();
  });

  it('Gruppi non attivo: nessun blocco dei gruppi e l\'elenco non si legge', async () => {
    await mountWith(['groups']);
    expect(screen.queryByRole('heading', { name: 'Gruppi' })).toBeNull();
    expect(fetched('groups/list.php')).toBe(false);
    expect(screen.getByText('Ultimo allenamento')).toBeTruthy();
  });

  it('Misure non attivo: nessun blocco del peso e le misure non si leggono', async () => {
    await mountWith(['body']);
    expect(await blocksLoaded()).toBeTruthy();
    expect(screen.queryByRole('heading', { name: 'Peso' })).toBeNull();
    expect(fetched('user_stats/read.php')).toBe(false);
  });

  it('tutti non attivi: restano saluto, apertura e ultimo allenamento, e nessuna lettura dei blocchi', async () => {
    await mountWith(['body', 'recovery', 'levels', 'groups']);
    expect(blockTitles()).toEqual(['Ultimo allenamento']);
    ['gamification/', 'groups/', 'user_stats/'].forEach((part) => expect(fetched(part)).toBe(false));
    expect(within(document.querySelector('main')).getByRole('link', { name: 'Inizia' })).toBeTruthy();
  });
});

// Blocchi dei moduli: li disegna il layout salvato sull'account
describe('blocchi dei moduli', () => {
  const fetched = (part) => fakeFetch.mock.calls.some(([url]) => String(url).includes(part));
  const ALL_TITLES = ['Ultimo allenamento', 'Livello e streak', 'Gruppi', 'Recupero', 'Peso'];

  it('senza layout salvato: ultimo allenamento e i quattro blocchi, nell\'ordine predefinito, tutti piccoli', async () => {
    renderHome();
    await opened();
    await blocksLoaded();
    await screen.findByText('Palestra Roma · sei 2° questa settimana');
    expect(blockTitles()).toEqual(ALL_TITLES);
    expect(screen.queryByText('settimane di fila')).toBeNull();
    expect(screen.getByText('78,4 kg · -0,6 kg nell\'ultimo mese')).toBeTruthy();
    expect(screen.getByText('Nessun dato ancora')).toBeTruthy();
  });

  it('ordine e blocco nascosto dal layout salvato; quelli che mancano vanno in coda', async () => {
    auth.homeLayout = [{ key: 'body', hidden: false, large: false }, { key: 'groups', hidden: true, large: false }, { key: 'last', hidden: false, large: false }];
    renderHome();
    await opened();
    await blocksLoaded();
    expect(blockTitles()).toEqual(['Peso', 'Ultimo allenamento', 'Livello e streak', 'Recupero']);
    expect(fetched('groups/')).toBe(false);
  });

  it('un blocco nascosto non chiama il server', async () => {
    auth.homeLayout = [{ key: 'levels', hidden: true, large: false }, { key: 'body', hidden: true, large: false }];
    renderHome();
    await opened();
    await screen.findByText('Palestra Roma · sei 2° questa settimana');
    expect(fetched('gamification/')).toBe(false);
    expect(fetched('user_stats/')).toBe(false);
    expect(blockTitles()).toEqual(['Ultimo allenamento', 'Gruppi', 'Recupero']);
  });

  it('un layout non valido non rompe la Home: vale il predefinito', async () => {
    auth.homeLayout = 'rovinato';
    renderHome();
    await opened();
    await blocksLoaded();
    expect(blockTitles()).toEqual(ALL_TITLES);
  });

  it('un blocco grande mostra il contenuto pieno; gli altri restano righe', async () => {
    auth.homeLayout = [{ key: 'levels', hidden: false, large: true }, { key: 'recovery', hidden: false, large: true }];
    setDashboard({ recovery: { petto: { status: 'PRONTO', percent: 100, last_trained: '2026-11-10', ready_at: null } } });
    renderHome();
    await opened();
    expect(await screen.findByText('settimane di fila')).toBeTruthy();
    expect(screen.getByRole('progressbar', { name: 'Petto' })).toBeTruthy();
  });

  it('un blocco grande occupa tutta la riga da md in su', async () => {
    auth.homeLayout = [{ key: 'levels', hidden: false, large: true }];
    renderHome();
    await opened();
    await screen.findByText('settimane di fila');
    const cell = (title) => screen.getByRole('heading', { level: 2, name: title }).closest('[data-testid="home-block"]').parentElement;
    expect(mediaStyle(cell('Livello e streak'), 900)['grid-column']).toBe('1/-1');
    expect(mediaStyle(cell('Gruppi'), 900)['grid-column']).toBeUndefined();
    expect(mediaStyle(cell('Gruppi').parentElement, 900)['grid-template-columns']).toBe('1fr 1fr');
  });

  it('«Ultimo allenamento» non è mai grande, anche se il layout lo dice', async () => {
    auth.homeLayout = [{ key: 'last', hidden: false, large: true }];
    renderHome();
    await opened();
    expect(screen.getByRole('heading', { level: 2, name: 'Ultimo allenamento' }).closest('a').getAttribute('href')).toBe('/storico');
  });

  it('«Ultimo allenamento» nascosto dal layout: non c\'è', async () => {
    auth.homeLayout = [{ key: 'last', hidden: true, large: false }];
    renderHome();
    await opened();
    await blocksLoaded();
    expect(blockTitles()).not.toContain('Ultimo allenamento');
  });

  it('la Home non aspetta i blocchi: apertura e ultimo allenamento ci sono mentre i dati dei blocchi non sono arrivati', async () => {
    vi.stubGlobal('fetch', vi.fn((url) => (/gamification|groups|user_stats/.test(String(url)) ? new Promise(() => {}) : fakeFetch(url))));
    renderHome();
    expect(await opened()).toBeTruthy();
    expect(screen.getByText('Ultimo allenamento')).toBeTruthy();
    expect(screen.getAllByTestId('block-skeleton').length).toBe(3);
    expect(blockTitles()).toEqual(ALL_TITLES);
  });

  it('un blocco in errore non ferma gli altri', async () => {
    vi.stubGlobal('fetch', failing('user_stats/read.php'));
    renderHome();
    await opened();
    await blocksLoaded();
    expect(screen.getByRole('heading', { level: 2, name: 'Peso' }).closest('a').textContent).toContain('Dati non disponibili al momento.');
    expect(await screen.findByText('Palestra Roma · sei 2° questa settimana')).toBeTruthy();
  });

  it('il peso usa la data di oggi del server, con il dispositivo a un\'altra data', async () => {
    pinLocalClock('Asia/Tokyo', 2026, 11, 20, 0, 30);
    renderHome();
    await opened();
    expect(await screen.findByText('78,4 kg · -0,6 kg nell\'ultimo mese')).toBeTruthy();
  });

  it('il peso nell\'unità dell\'account (lb)', async () => {
    auth.weightUnit = 'lb';
    renderHome();
    await opened();
    expect(await screen.findByText('172,8 lb · -1,3 lb nell\'ultimo mese')).toBeTruthy();
  });

  it('un solo h1 e nessun testo sotto i 12 px, con i blocchi grandi', async () => {
    auth.homeLayout = HOME_BLOCKS.map((key) => ({ key, hidden: false, large: true }));
    renderHome();
    await opened();
    await screen.findByText('settimane di fila');
    expect(screen.getAllByRole('heading', { level: 1 }).length).toBe(1);
    expect(textBelow(document.querySelector('main'), 12)).toEqual([]);
  });
});
