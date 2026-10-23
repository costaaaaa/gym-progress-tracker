// Focus Mode visto dall'utente: pulsanti e campi della pagina, con fetch e localStorage come confini.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import FocusWorkout from './FocusWorkout';
import { ThemeModeProvider } from '../context/ThemeModeContext';

const { mockNavigate, mockTrack } = vi.hoisted(() => ({ mockNavigate: vi.fn(), mockTrack: vi.fn() }));
vi.mock('react-router-dom', async (importOriginal) => ({ ...(await importOriginal()), useNavigate: () => mockNavigate }));
vi.mock('../context/AuthContext', () => ({ useAuth: () => ({ isLoggedIn: true, loading: false }) }));
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
  render(<ThemeModeProvider><FocusWorkout /></ThemeModeProvider>);
  await advance(0);
};
const click = (name) => fireEvent.click(screen.getByRole('button', { name }));
const startDay = async (dayName) => {
  await mount();
  fireEvent.mouseDown(screen.getByRole('combobox'));
  fireEvent.click(screen.getByRole('option', { name: dayName }));
  click('Inizia allenamento');
};
const doSet = (weight = '60', reps = '8') => {
  fireEvent.change(screen.getByLabelText('Peso (kg)'), { target: { value: weight } });
  fireEvent.change(screen.getByLabelText('Ripetizioni'), { target: { value: reps } });
  click('Conferma serie');
};
const draft = () => JSON.parse(localStorage.getItem(DRAFT_KEY));

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
  vi.clearAllMocks();
  localStorage.setItem('themeMode', 'light');
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
    click('Salta timer');

    await advance(30);
    doSet('62.5', '7');
    expect(screen.getByText('Riepilogo')).toBeTruthy();

    await advance(600);
    await act(async () => { click('Salva allenamento'); });
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
    click('Riprendi allenamento');
    expect(screen.getByRole('heading', { name: 'Panca piana' })).toBeTruthy();
    // "Salta serie" c'è solo dalla seconda serie
    expect(screen.getByRole('button', { name: 'Salta serie' })).toBeTruthy();
  });

  it('scartare la bozza la cancella e torna alla scelta del giorno', async () => {
    localStorage.setItem(DRAFT_KEY, JSON.stringify(savedDraft));
    await mount();
    click('Scarta e inizia nuovo');
    expect(localStorage.getItem(DRAFT_KEY)).toBeNull();
    expect(screen.getByRole('button', { name: 'Inizia allenamento' })).toBeTruthy();
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

    await act(async () => { click('Salva allenamento'); });
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
    click('Salta timer');

    click('Salta serie');
    expect(screen.queryByText('Recupero')).toBeNull();
    await advance(0.3);
    expect(screen.getByRole('heading', { name: 'Croci' })).toBeTruthy();

    click('Salta esercizio');
    expect(screen.getByText('Riepilogo')).toBeTruthy();

    await act(async () => { click('Salva allenamento'); });
    await advance(0);
    expect(saveBody().workout_records).toEqual([
      { exercise_id: 3, exercise_name: 'Panca piana', weight: 60, reps: '8', intensity_technique: '', day_id: 2, set_number: 1 },
    ]);
  });

  it('uscire con conferma cancella la bozza e torna alla home', async () => {
    await startDay('Push');
    doSet();
    click('Salta timer');
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
    expect(screen.getByText('Nessun piano attivo trovato. Attiva un piano dalle schede.')).toBeTruthy();
    expect(screen.getByText('Nessun piano attivo')).toBeTruthy();
  });

  it('senza la funzione premium, cambiare esercizio apre il dialog premium', async () => {
    await startDay('Push');
    click('Cambia esercizio');
    expect(screen.getByText('Funzione Premium')).toBeTruthy();
    expect(fetchMock.mock.calls.some(([url]) => url.includes('exercise/read_all.php'))).toBe(false);
  });
});

describe('intestazione della scelta del giorno', () => {
  it('mostra il marchio LiftIndex e non il manubrio', async () => {
    await mount();
    expect(screen.getByTestId('logo-mark')).toBeTruthy();
    expect(screen.queryByRole('img', { name: 'LiftIndex' })).toBeNull();
    expect(screen.queryByTestId('FitnessCenterIcon')).toBeNull();
  });
});

// Colori del tema chiaro scritti a mano: text.primary #1a1816, text.secondary #6b6663, rosso brand #d50000, success #15803d.
const INK = 'rgb(26, 24, 22)';
const GREY = 'rgb(107, 102, 99)';
const RED = 'rgb(213, 0, 0)';
const GREEN = 'rgb(21, 128, 61)';
const noShadow = (el) => ['', 'none'].includes(getComputedStyle(el).boxShadow);

describe('colori di Focus: rosso solo per ciò che è distruttivo', () => {
  it('"Conferma serie" resta verde pieno con la spunta, senza ombra', async () => {
    await startDay('Push');
    fireEvent.change(screen.getByLabelText('Peso (kg)'), { target: { value: '60' } });
    fireEvent.change(screen.getByLabelText('Ripetizioni'), { target: { value: '8' } });
    const button = screen.getByRole('button', { name: 'Conferma serie' });
    expect(getComputedStyle(button).backgroundColor).toBe(GREEN);
    expect(noShadow(button)).toBe(true);
    expect(button.querySelector('[data-testid="CheckIcon"]')).not.toBeNull();
  });

  it('il cerchio della serie attiva ha bordo e numero in inchiostro, non rossi', async () => {
    await startDay('Push');
    const circle = screen.getByText('1');
    expect(getComputedStyle(circle).borderColor).toBe(INK);
    expect(getComputedStyle(circle).color).toBe(INK);
  });

  it('il cerchio di una serie ancora da fare ha il numero in text.secondary', async () => {
    await startDay('Push');
    expect(getComputedStyle(screen.getByText('2')).color).toBe(GREY);
  });

  it('il cronometro e il contatore degli esercizi sono in text.secondary', async () => {
    await startDay('Push');
    expect(getComputedStyle(screen.getByText('00:00')).color).toBe(GREY);
    expect(getComputedStyle(screen.getByText('1/1')).color).toBe(GREY);
  });

  it('il campo con il focus ha il bordo in inchiostro, non rosso', async () => {
    await startDay('Push');
    const fieldset = screen.getByLabelText('Peso (kg)').closest('.MuiOutlinedInput-root').querySelector('fieldset');
    expect(getComputedStyle(fieldset).borderColor).toBe(INK);
  });

  it('la chip "Ultima volta" della serie in corso ha il bordo in inchiostro, le altre restano al divisore', async () => {
    const sets = [{ weight: 60, reps: '8' }, { weight: 55, reps: '10' }];
    responses['workout_history/read.php'] = () => json({ records: [{ id: 1, date: '2026-10-13', exercises: [{ exercise_id: 3, name: 'Panca piana', sets }] }] });
    await startDay('Push');
    const current = screen.getByText('60kg×8').parentElement;
    const other = screen.getByText('55kg×10').parentElement;
    expect(getComputedStyle(current).borderColor).toBe(INK);
    expect(getComputedStyle(other).borderColor).not.toBe(RED);
    expect(getComputedStyle(other).borderColor).not.toBe(INK);
  });

  it('"Prossima: Serie 2 di 2" nel recupero è in text.secondary', async () => {
    await startDay('Push');
    doSet();
    expect(getComputedStyle(screen.getByText('Prossima: Serie 2 di 2')).color).toBe(GREY);
  });

  it('nel dialogo di uscita dall\'allenamento nessun bottone è rosso', async () => {
    await startDay('Push');
    fireEvent.click(screen.getByTestId('CloseIcon').closest('button'));
    expect(getComputedStyle(screen.getByRole('button', { name: 'Esci' })).color).not.toBe(RED);
    expect(getComputedStyle(screen.getByRole('button', { name: 'Continua' })).color).not.toBe(RED);
  });

  it('nel dialogo del riepilogo l\'unico bottone rosso è "Scarta ed esci"', async () => {
    await startDay('Push');
    doSet();
    click('Salta timer');
    doSet();
    click('Annulla');
    const red = screen.getAllByRole('button').filter((b) => getComputedStyle(b).color === RED).map((b) => b.textContent);
    expect(red).toEqual(['Scarta ed esci']);
  });

  it('il dialogo premium ha il bottone "Ho capito" non rosso', async () => {
    await startDay('Push');
    click('Cambia esercizio');
    expect(getComputedStyle(screen.getByRole('button', { name: 'Ho capito' })).color).not.toBe(RED);
  });
});

describe('riepilogo', () => {
  const toSummary = async () => {
    await startDay('Push');
    doSet();
    click('Salta timer');
    doSet();
  };

  it('niente trofeo decorativo sopra il titolo', async () => {
    await toSummary();
    const title = screen.getByText('Allenamento completato!');
    expect(title.parentElement.querySelector('[data-testid="EmojiEventsIcon"]')).toBeNull();
  });

  it('"Dettaglio esercizi" non ha una fascia di sfondo e resta in text.secondary', async () => {
    await toSummary();
    const header = screen.getByText('Dettaglio esercizi');
    expect(getComputedStyle(header).color).toBe(GREY);
    expect(['', 'rgba(0, 0, 0, 0)', 'transparent']).toContain(getComputedStyle(header.parentElement).backgroundColor);
  });
});
