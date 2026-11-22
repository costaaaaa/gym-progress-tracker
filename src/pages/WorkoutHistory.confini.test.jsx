// Confini della pagina dello Storico: ciò che il dialog di eliminazione e le righe tengono per sé (anteprima alla
// riapertura, menu «Altre azioni» di una riga, attributi del dettaglio che si apre).
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, within, act, waitForElementToBeRemoved } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import WorkoutHistory from './WorkoutHistory';
import { ThemeModeProvider } from '../context/ThemeModeContext';
import { json } from '../test/dom';
import { setBrowserTimeZone } from '../test/timeZone';

const account = vi.hoisted(() => ({ isLoggedIn: true, loading: false, weightUnit: 'kg', user: undefined }));
vi.mock('../context/AuthContext', () => ({ useAuth: () => account }));

const exercise = (id, name) => ({ id, exercise_name: name, muscle_group: 'petto', sets: [{ set_number: 1, weight: 60, reps: 8 }] });
const recente = { id: 7, date: '2026-10-18 02:00:00', duration_seconds: 3600, notes: '', exercises: [exercise(1, 'Panca piana')] };
const precedente = { id: 8, date: '2026-10-10 02:00:00', duration_seconds: 3600, notes: '', health_written: true, exercises: [exercise(2, 'Croci')] };
const plan = { id: 5, name: 'Push Pull', is_active: true, days: [] };
const AVVISO_SALUTE = 'Questo allenamento è anche nell\'app Salute del telefono e lì resta. Per toglierlo anche da lì, eliminalo dall\'app LiftIndex sul telefono.';

const originalMatchMedia = window.matchMedia;
const simulaTelefono = () => {
  window.matchMedia = (query) => ({
    matches: query.includes('max-width'), media: query, onchange: null,
    addEventListener: () => {}, removeEventListener: () => {}, addListener: () => {}, removeListener: () => {}, dispatchEvent: () => false,
  });
};

// `anteprima`: cosa risponde il server alla richiesta di anteprima, per numero di richiesta (undefined = non risponde mai)
const serve = (anteprime = []) => {
  let n = 0;
  const fetchMock = vi.fn((url, init) => {
    if (url.includes('read_plans.php')) return Promise.resolve(json({ records: [plan] }));
    if (url.includes('workout_history/read.php')) return Promise.resolve(json({ records: [recente, precedente] }));
    if (url.includes('workout_history/delete.php') && JSON.parse(init.body).preview) {
      const risposta = anteprime[n++];
      return risposta ? Promise.resolve(json(risposta)) : new Promise(() => {});
    }
    return Promise.resolve(json({ success: true }));
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
};

beforeEach(() => {
  setBrowserTimeZone('Europe/Rome');
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(2026, 9, 20, 12, 0));
  localStorage.setItem('themeMode', 'light');
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  window.matchMedia = originalMatchMedia;
});

const mount = async () => {
  render(
    <ThemeModeProvider>
      <MemoryRouter><WorkoutHistory isEmbedded /></MemoryRouter>
    </ThemeModeProvider>,
  );
  await screen.findAllByText(/^02:00 · 1 esercizio$/);
};

describe('dialog di eliminazione', () => {
  it('l\'anteprima ha l\'id dell\'allenamento e alla riapertura non resta quella di prima', async () => {
    const fetchMock = serve([{ success: true, xp_removed: 30, streak_before: 3, streak_after: 3 }]);
    await mount();
    fireEvent.click(screen.getAllByRole('button', { name: /^Elimina allenamento/ })[0]);
    await screen.findByText('Conferma eliminazione');
    expect(await screen.findByText('Perderai 30 XP.')).toBeTruthy();
    const anteprima = fetchMock.mock.calls.filter(([url, init]) => url.includes('delete.php') && init.body.includes('preview'));
    expect(JSON.parse(anteprima[0][1].body)).toEqual({ id: 7, preview: true });

    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Annulla' }));
    await waitForElementToBeRemoved(() => screen.queryByRole('dialog'));
    fireEvent.click(screen.getAllByRole('button', { name: /^Elimina allenamento/ })[0]);
    await screen.findByText('Conferma eliminazione');
    await act(async () => {});
    expect(screen.queryByText('Perderai 30 XP.')).toBeNull();
  });
});

describe('menu «Altre azioni» su telefono', () => {
  beforeEach(simulaTelefono);

  it('ogni riga ha il suo menu: «Elimina allenamento» della seconda apre la conferma della seconda', async () => {
    serve();
    await mount();
    const bottoni = screen.getAllByRole('button', { name: /^Altre azioni/ });
    expect(bottoni).toHaveLength(2);
    fireEvent.click(bottoni[1]);
    expect(screen.getByRole('menu', { name: 'Altre azioni, sabato 10 ottobre 2026' })).toBeTruthy();
    fireEvent.click(screen.getByRole('menuitem', { name: 'Elimina allenamento' }));
    await screen.findByText('Conferma eliminazione');
    expect(screen.getByText(AVVISO_SALUTE)).toBeTruthy();
  });
});

describe('dettaglio della riga', () => {
  it('aria-expanded è «false» prima del primo clic, «true» aperta, e il pannello ha il suo id', async () => {
    serve();
    await mount();
    const riga = document.querySelector('[data-workout-row="7"]');
    expect(riga.getAttribute('aria-expanded')).toBe('false');
    expect(riga.getAttribute('aria-controls')).toBe('workout-detail-panel-7');
    fireEvent.click(riga);
    expect(riga.getAttribute('aria-expanded')).toBe('true');
    expect(within(document.getElementById('workout-detail-panel-7')).getByText('Panca piana')).toBeTruthy();
    fireEvent.click(riga);
    expect(riga.getAttribute('aria-expanded')).toBe('false');
  });
});
