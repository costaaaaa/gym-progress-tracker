// Home dopo il login: i dati arrivano dalla fetch (confine), l'utente vede link, testi e intestazioni.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Home from './Home';
import { ThemeModeProvider } from '../context/ThemeModeContext';

vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({ user: { username: 'mario88' }, isLoggedIn: true, loading: false }),
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

const renderHome = () => render(<MemoryRouter><ThemeModeProvider><Home /></ThemeModeProvider></MemoryRouter>);

beforeEach(() => {
  vi.stubGlobal('fetch', fakeFetch);
});
afterEach(() => {
  vi.unstubAllGlobals();
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

  it('Piano attivo porta ai piani e mostra il nome', async () => {
    renderHome();
    const link = await screen.findByRole('link', { name: /Piano attivo/ });
    expect(link.getAttribute('href')).toBe('/workouts?tab=plans');
    expect(link.textContent).toContain('Push Pull Legs');
  });

  it('il riepilogo settimanale mostra gli allenamenti fatti sull\'obiettivo', async () => {
    renderHome();
    expect(await screen.findByText('2 / 3')).toBeTruthy();
  });

  it.each(['Riepilogo settimanale', 'Ultimo allenamento', 'Piano attivo', 'I tuoi gruppi'])(
    'la card "%s" ha un\'intestazione',
    async (name) => {
      renderHome();
      expect(await screen.findByRole('heading', { name })).toBeTruthy();
    },
  );
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
