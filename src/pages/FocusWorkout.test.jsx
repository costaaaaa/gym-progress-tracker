// Focus Mode visto dall'utente: pulsanti e campi della pagina, con fetch e localStorage come confini.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import FocusWorkout from './FocusWorkout';

const { mockNavigate, mockTrack } = vi.hoisted(() => ({ mockNavigate: vi.fn(), mockTrack: vi.fn() }));
vi.mock('react-router-dom', async (importOriginal) => ({ ...(await importOriginal()), useNavigate: () => mockNavigate }));
vi.mock('../context/AuthContext', () => ({ useAuth: () => ({ isLoggedIn: true, loading: false }) }));
vi.mock('../context/ThemeModeContext', () => ({ useThemeMode: () => ({ mode: 'light' }) }));
vi.mock('../utils/celebrate', () => ({
  celebrate: () => {}, celebratePR: () => {}, celebrateStreak: () => {}, celebrateLevelUp: () => {},
}));
vi.mock('../utils/analytics', () => ({ track: mockTrack }));

const DRAFT_KEY = 'gym_focus_workout_draft';
const NOW = new Date(2026, 9, 20, 18, 0);

const bench = { id: 9, exercise_id: 3, exercise_name: 'Panca piana', sets: 2, reps: '8-10', rest: 90, muscle_group: 'petto' };
const fly = { id: 10, exercise_id: 4, exercise_name: 'Croci', sets: 2, reps: '12', rest: 60, muscle_group: 'petto' };
const pushDay = { id: 1, name: 'Push', exercises: [bench] };
const fullDay = { id: 2, name: 'Push completo', exercises: [bench, fly] };

const json = (data, status = 200) => ({ ok: status < 400, status, json: async () => data, text: async () => '' });
let responses;
const fetchMock = vi.fn((url) => {
  const key = Object.keys(responses).find((k) => url.includes(k));
  return Promise.resolve(key ? responses[key]() : json({}, 404));
});
const saveBody = () => {
  const call = fetchMock.mock.calls.find(([url]) => url.includes('record_workout.php'));
  return call ? JSON.parse(call[1].body) : null;
};

const advance = (seconds) => act(async () => { await vi.advanceTimersByTimeAsync(seconds * 1000); });
const mount = async () => {
  render(<FocusWorkout />);
  await advance(0);
};
const click = (name) => fireEvent.click(screen.getByRole('button', { name }));
const startDay = async (dayName) => {
  await mount();
  fireEvent.mouseDown(screen.getByRole('combobox'));
  fireEvent.click(screen.getByRole('option', { name: dayName }));
  click('Inizia Allenamento');
};
const doSet = (weight = '60', reps = '8') => {
  fireEvent.change(screen.getByLabelText('Peso (kg)'), { target: { value: weight } });
  fireEvent.change(screen.getByLabelText('Ripetizioni'), { target: { value: reps } });
  click('Conferma Serie');
};
const draft = () => JSON.parse(localStorage.getItem(DRAFT_KEY));

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
  vi.clearAllMocks();
  vi.stubGlobal('fetch', fetchMock);
  responses = {
    'read_plans.php': () => json({ records: [{ id: 5, name: 'Push Pull', is_active: true, days: [pushDay, fullDay] }] }),
    'user/read.php': () => json({ rest_timer_enabled: true, features: [] }),
    'workout_history/read.php': () => json({ records: [] }),
    'record_workout.php': () => json({ success: true, id: 77 }),
  };
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('flusso completo e salvataggio', () => {
  it('giorno, serie, recupero, riepilogo: salva le serie con la durata ferma all\'arrivo nel riepilogo', async () => {
    await startDay('Push');
    expect(screen.getByText(/^Serie 1 di \d+$/)).toBeTruthy();

    await advance(60);
    doSet();
    expect(screen.getByText('Recupero')).toBeTruthy();
    expect(screen.getByText('01:30')).toBeTruthy();
    await advance(30);
    expect(screen.getByText('01:00')).toBeTruthy();
    click('Salta Timer');

    await advance(30);
    doSet('62.5', '7');
    expect(screen.getByText('Riepilogo')).toBeTruthy();

    await advance(600);
    await act(async () => { click('Salva Allenamento'); });
    await advance(0);

    expect(saveBody()).toEqual({
      workout_records: [
        { exercise_id: 3, exercise_name: 'Panca piana', weight: 60, reps: '8', intensity_technique: '', day_id: 1, set_number: 1 },
        { exercise_id: 3, exercise_name: 'Panca piana', weight: 62.5, reps: '7', intensity_technique: '', day_id: 1, set_number: 2 },
      ],
      notes: '',
      idempotency_key: expect.any(String),
      start_time: new Date(2026, 9, 20, 18, 0).toISOString(),
      duration_seconds: 120,
    });
    expect(localStorage.getItem(DRAFT_KEY)).toBeNull();
    expect(mockTrack).toHaveBeenCalledWith('workout_saved');
  });

  it('il cronometro dell\'allenamento avanza ogni secondo, senza toccare niente', async () => {
    await startDay('Push');
    expect(screen.getByText('00:00')).toBeTruthy();

    await advance(1);
    expect(screen.getByText('00:01')).toBeTruthy();
    await advance(64);
    expect(screen.getByText('01:05')).toBeTruthy();
  });
});

describe('bozza e ripresa', () => {
  const savedDraft = {
    activePlan: { id: 5, name: 'Push Pull', days: [fullDay] },
    selectedDay: fullDay,
    selectedDayId: 2,
    completedSets: { 9: [{ setNumber: 1, weight: 60, reps: '8', intensity_technique: '' }] },
    skippedExercises: [],
    skippedSets: {},
    currentExerciseIndex: 0,
    currentSetIndex: 1,
    workoutNotes: 'spalla ok',
    startTime: new Date(2026, 9, 20, 17, 40).toISOString(),
    idempotencyKey: 'chiave-bozza',
    lastActivityAt: new Date(2026, 9, 20, 17, 45).toISOString(),
    phase: 'workout',
  };

  it('salva la bozza a ogni serie, come allenamento anche durante il recupero', async () => {
    await startDay('Push');
    doSet();
    expect(screen.getByText('Recupero')).toBeTruthy();
    expect(draft()).toMatchObject({
      phase: 'workout',
      selectedDayId: 1,
      currentSetIndex: 1,
      completedSets: { 9: [{ setNumber: 1, weight: 60, reps: '8', intensity_technique: '' }] },
      startTime: new Date(2026, 9, 20, 18, 0).toISOString(),
    });
  });

  it('con una bozza chiede se riprendere, e riprende dalla serie salvata', async () => {
    localStorage.setItem(DRAFT_KEY, JSON.stringify(savedDraft));
    await mount();
    expect(screen.getByText('Allenamento in sospeso')).toBeTruthy();
    click('Riprendi Allenamento');
    expect(screen.getByRole('heading', { name: 'Panca piana' })).toBeTruthy();
    // "Salta Serie" c'è solo dalla seconda serie
    expect(screen.getByRole('button', { name: 'Salta Serie' })).toBeTruthy();
  });

  it('scartare la bozza la cancella e torna alla scelta del giorno', async () => {
    localStorage.setItem(DRAFT_KEY, JSON.stringify(savedDraft));
    await mount();
    click('Scarta e Inizia Nuovo');
    expect(localStorage.getItem(DRAFT_KEY)).toBeNull();
    expect(screen.getByRole('button', { name: 'Inizia Allenamento' })).toBeTruthy();
  });

  it('una bozza vecchia chiusa come già finita si salva sul giorno scelto, stesso orario', async () => {
    localStorage.setItem(DRAFT_KEY, JSON.stringify({
      ...savedDraft,
      startTime: new Date(2026, 9, 17, 17, 40).toISOString(),
      lastActivityAt: new Date(2026, 9, 17, 17, 45).toISOString(),
    }));
    await mount();
    fireEvent.change(screen.getByLabelText('Giorno dell\'allenamento'), { target: { value: '2026-10-18' } });
    click('L\'avevo già finito');
    expect(screen.getByText('Riepilogo')).toBeTruthy();

    await act(async () => { click('Salva Allenamento'); });
    await advance(0);

    expect(saveBody()).toEqual({
      workout_records: [
        { exercise_id: 3, exercise_name: 'Panca piana', weight: 60, reps: '8', intensity_technique: '', day_id: 2, set_number: 1 },
      ],
      notes: 'spalla ok',
      idempotency_key: 'chiave-bozza',
      backdated: true,
      start_time: new Date(2026, 9, 18, 17, 40).toISOString(),
      ended_at: new Date(2026, 9, 18, 17, 45).toISOString(),
    });
  });
});

describe('salti e uscita', () => {
  it('saltare una serie non avvia il recupero e non la salva; saltare l\'ultimo esercizio porta al riepilogo', async () => {
    await startDay('Push completo');
    doSet();
    click('Salta Timer');

    click('Salta Serie');
    expect(screen.queryByText('Recupero')).toBeNull();
    await advance(0.3);
    expect(screen.getByRole('heading', { name: 'Croci' })).toBeTruthy();

    click('Salta Esercizio');
    expect(screen.getByText('Riepilogo')).toBeTruthy();

    await act(async () => { click('Salva Allenamento'); });
    await advance(0);
    expect(saveBody().workout_records).toEqual([
      { exercise_id: 3, exercise_name: 'Panca piana', weight: 60, reps: '8', intensity_technique: '', day_id: 2, set_number: 1 },
    ]);
  });

  it('uscire con conferma cancella la bozza e torna alla home', async () => {
    await startDay('Push');
    doSet();
    click('Salta Timer');
    expect(localStorage.getItem(DRAFT_KEY)).not.toBeNull();

    fireEvent.click(screen.getByTestId('CloseIcon').closest('button'));
    expect(screen.getByText('Interrompere l\'allenamento?')).toBeTruthy();
    click('Esci');

    expect(localStorage.getItem(DRAFT_KEY)).toBeNull();
    expect(mockNavigate).toHaveBeenCalledWith('/');
  });
});

describe('errori e premium', () => {
  it('un errore nel caricamento dei piani si vede nello snackbar', async () => {
    responses['read_plans.php'] = () => ({ ok: false, status: 500, json: async () => { throw new Error('non json'); }, text: async () => '' });
    vi.spyOn(console, 'error').mockImplementation(() => {});
    await mount();
    expect(screen.getByText('Errore nel caricamento dei dati: Errore caricamento piani (500)')).toBeTruthy();
  });

  it('senza piano attivo avvisa e mostra la schermata senza piano', async () => {
    responses['read_plans.php'] = () => json({ records: [{ id: 5, name: 'Push Pull', is_active: false, days: [pushDay] }] });
    await mount();
    expect(screen.getByText('Nessun piano attivo trovato. Attiva un piano dalle Schede.')).toBeTruthy();
    expect(screen.getByText('Nessun piano attivo')).toBeTruthy();
  });

  it('senza la funzione premium, cambiare esercizio apre il dialog premium', async () => {
    await startDay('Push');
    click('Cambia esercizio');
    expect(screen.getByText('Funzione Premium')).toBeTruthy();
    expect(fetchMock.mock.calls.some(([url]) => url.includes('exercise/read_all.php'))).toBe(false);
  });
});
