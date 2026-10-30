// Focus Mode visto dall'utente: pulsanti e campi della pagina, con fetch e localStorage come confini.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act, cleanup, within } from '@testing-library/react';
import FocusWorkout from './FocusWorkout';
import { ThemeModeProvider } from '../context/ThemeModeContext';
import { json } from '../test/dom';
import { currentTimeZone } from '../utils/workoutTime';
import { setBrowserTimeZone } from '../test/timeZone';

const { mockNavigate, mockTrack } = vi.hoisted(() => ({ mockNavigate: vi.fn(), mockTrack: vi.fn() }));
vi.mock('react-router-dom', async (importOriginal) => ({ ...(await importOriginal()), useNavigate: () => mockNavigate }));
vi.mock('../context/AuthContext', () => ({ useAuth: () => ({ isLoggedIn: true, loading: false }) }));
vi.mock('../utils/celebrate', () => ({
  celebrate: () => {}, celebratePR: () => {}, celebrateStreak: () => {}, celebrateLevelUp: () => {},
}));
vi.mock('../utils/analytics', () => ({ track: mockTrack }));
vi.mock('../components/ShareCardDialog', () => ({
  default: ({ stats }) => (stats ? (
    <div data-testid="share-card">
      {`${stats.date.getFullYear()}-${stats.date.getMonth() + 1}-${stats.date.getDate()} ${stats.date.getHours()}:${stats.date.getMinutes()}`}
    </div>
  ) : null),
}));
vi.mock('../utils/workoutTime', async (importOriginal) => ({ ...(await importOriginal()), currentTimeZone: vi.fn() }));

const DRAFT_KEY = 'gym_focus_workout_draft';
const NOW = new Date(2026, 9, 20, 18, 0);
const BROWSER_ZONE = Intl.DateTimeFormat().resolvedOptions().timeZone;

const bench = { id: 9, exercise_id: 3, exercise_name: 'Panca piana', sets: 2, reps: '8-10', rest: 90, muscle_group: 'petto' };
const fly = { id: 10, exercise_id: 4, exercise_name: 'Croci', sets: 2, reps: '12', rest: 60, muscle_group: 'petto' };
// Catalogo del picker. FocusExercisePicker lo tiene in una cache di modulo che sopravvive ai test del
// file: il mock globale qui sotto è l'unico contenuto possibile, quindi cache o rete danno lo stesso risultato
const CATALOG = [{ id: 20, name: 'Croci ai cavi', muscle_group: 'petto', equipment: 'cavi' }];
const pushDay = { id: 1, name: 'Push', exercises: [bench] };
const fullDay = { id: 2, name: 'Push completo', exercises: [bench, fly] };

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

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
  vi.clearAllMocks();
  currentTimeZone.mockReturnValue(BROWSER_ZONE);
  localStorage.setItem('themeMode', 'light');
  vi.stubGlobal('fetch', fetchMock);
  responses = {
    'read_plans.php': () => json({ records: [{ id: 5, name: 'Push Pull', is_active: true, days: [pushDay, fullDay] }] }),
    'user/read.php': () => json({ rest_timer_enabled: true, features: [] }),
    'workout_history/read.php': () => json({ records: [] }),
    'record_workout.php': () => json({ success: true, id: 77 }),
    'exercise/read_all.php': () => json({ records: CATALOG }),
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
        { exercise_id: 3, exercise_name: 'Panca piana', weight: 60, reps: '8', intensity_technique: '', is_warmup: false, day_id: 1, set_number: 1, seconds_from_start: 60 },
        { exercise_id: 3, exercise_name: 'Panca piana', weight: 62.5, reps: '7', intensity_technique: '', is_warmup: false, day_id: 1, set_number: 2, seconds_from_start: 120 },
      ],
      notes: '',
      idempotency_key: expect.any(String),
      start_time: new Date(2026, 9, 20, 18, 0).toISOString(),
      duration_seconds: 120,
      time_zone: BROWSER_ZONE,
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

  it('riprendendo, la serie già confermata tiene il suo orario e la prossima parte dal vecchio inizio', async () => {
    localStorage.setItem(DRAFT_KEY, JSON.stringify({
      ...savedDraft,
      completedSets: { 9: [{ setNumber: 1, weight: 60, reps: '8', intensity_technique: '', seconds_from_start: 300 }] },
    }));
    await mount();
    click('Riprendi allenamento');
    doSet('62.5', '7'); // 18:00, la sessione è iniziata alle 17:40
    await advance(0.3);
    click('Salta esercizio');
    await act(async () => { click('Salva allenamento'); });
    await advance(0);

    expect(saveBody().workout_records.map((r) => [r.set_number, r.seconds_from_start])).toEqual([[1, 300], [2, 1200]]);
  });

  it('una bozza di prima dell\'orario riprende senza: le sue serie vanno con null, le nuove con i secondi', async () => {
    localStorage.setItem(DRAFT_KEY, JSON.stringify(savedDraft));
    await mount();
    click('Riprendi allenamento');
    doSet('62.5', '7');
    await advance(0.3);
    click('Salta esercizio');
    await act(async () => { click('Salva allenamento'); });
    await advance(0);

    expect(saveBody().workout_records.map((r) => [r.set_number, r.seconds_from_start])).toEqual([[1, null], [2, 1200]]);
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
        { exercise_id: 3, exercise_name: 'Panca piana', weight: 60, reps: '8', intensity_technique: '', is_warmup: false, day_id: 2, set_number: 1, seconds_from_start: null },
      ],
      notes: 'spalla ok',
      idempotency_key: 'chiave-bozza',
      backdated: true,
      start_time: new Date(2026, 9, 18, 17, 40).toISOString(),
      ended_at: new Date(2026, 9, 18, 17, 45).toISOString(),
      time_zone: BROWSER_ZONE,
    });
  });
});

describe('fuso dell\'allenamento', () => {
  it('si legge all\'inizio, sta nella bozza e parte nel salvataggio anche se nel frattempo il dispositivo cambia fuso', async () => {
    currentTimeZone.mockReturnValue('America/New_York');
    await startDay('Push');
    expect(draft().timeZone).toBe('America/New_York');

    currentTimeZone.mockReturnValue('Europe/Rome');
    doSet();
    click('Salta timer');
    doSet();
    await act(async () => { click('Salva allenamento'); });
    await advance(0);

    expect(saveBody().time_zone).toBe('America/New_York');
  });

  it('una bozza senza fuso (salvata da una versione vecchia) usa quello attuale del dispositivo', async () => {
    currentTimeZone.mockReturnValue('Asia/Tokyo');
    localStorage.setItem(DRAFT_KEY, JSON.stringify({ ...savedDraft, selectedDay: pushDay, selectedDayId: 1, phase: 'summary' }));
    await mount();
    click('Riprendi allenamento');
    await act(async () => { click('Salva allenamento'); });
    await advance(0);

    expect(saveBody().time_zone).toBe('Asia/Tokyo');
  });

  it('una bozza con il suo fuso lo conserva alla ripresa, anche salvata in ritardo', async () => {
    localStorage.setItem(DRAFT_KEY, JSON.stringify({
      ...savedDraft,
      timeZone: 'America/New_York',
      startTime: new Date(2026, 9, 17, 17, 40).toISOString(),
      lastActivityAt: new Date(2026, 9, 17, 17, 45).toISOString(),
    }));
    await mount();
    fireEvent.change(screen.getByLabelText('Giorno dell\'allenamento'), { target: { value: '2026-10-18' } });
    click('L\'avevo già finito');
    await act(async () => { click('Salva allenamento'); });
    await advance(0);

    expect(saveBody()).toMatchObject({ backdated: true, time_zone: 'America/New_York' });
  });
});

describe('bozza di un altro fuso ripresa a Roma: il giorno è quello del luogo dell\'allenamento', () => {
  // Iniziata a New York il 17 ottobre alle 22:30 (UTC−4), cioè il 18 alle 04:30 a Roma
  const nyDraft = {
    ...savedDraft,
    timeZone: 'America/New_York',
    startTime: '2026-10-18T02:30:00.000Z',
    lastActivityAt: '2026-10-18T02:45:00.000Z',
  };
  beforeEach(() => {
    setBrowserTimeZone('Europe/Rome');
    currentTimeZone.mockReturnValue('Europe/Rome');
    vi.setSystemTime(new Date('2026-10-20T16:00:00.000Z'));
  });
  const openNyDraft = async () => {
    localStorage.setItem(DRAFT_KEY, JSON.stringify(nyDraft));
    await mount();
  };
  const finishAndSave = async () => {
    click('L\'avevo già finito');
    await act(async () => { click('Salva allenamento'); });
    await advance(0);
    return saveBody();
  };

  it('il giorno proposto è il 17, quello scritto a New York, e salvarlo non sposta nulla', async () => {
    await openNyDraft();
    expect(screen.getByLabelText('Giorno dell\'allenamento').value).toBe('2026-10-17');

    expect(await finishAndSave()).toMatchObject({
      backdated: true,
      time_zone: 'America/New_York',
      start_time: '2026-10-18T02:30:00.000Z',
      ended_at: '2026-10-18T02:45:00.000Z',
    });
  });

  it('un altro giorno si salva con lo stesso orario di New York (22:30), non quello di Roma', async () => {
    await openNyDraft();
    fireEvent.change(screen.getByLabelText('Giorno dell\'allenamento'), { target: { value: '2026-10-18' } });

    expect(await finishAndSave()).toMatchObject({
      start_time: '2026-10-19T02:30:00.000Z',
      ended_at: '2026-10-19T02:45:00.000Z',
    });
  });

  it('i giorni scelti vanno da 7 giorni prima di oggi a oggi, contati a New York', async () => {
    vi.setSystemTime(new Date('2026-10-20T01:00:00.000Z')); // 20 ottobre 03:00 a Roma, ancora il 19 a New York
    await openNyDraft();
    const input = screen.getByLabelText('Giorno dell\'allenamento');

    expect(input.max).toBe('2026-10-19');
    expect(input.min).toBe('2026-10-12');
  });

  it('l\'inizio mostrato è l\'orologio di New York', async () => {
    await openNyDraft();
    expect(screen.getByText(/Iniziato il .*22:30/)).toBeTruthy();
  });

  it('la card di condivisione dal riepilogo mostra l\'orologio di New York (17, 22:30), non quello di Roma', async () => {
    await openNyDraft();
    await finishAndSave();
    click('Condividi');

    expect(screen.getByTestId('share-card').textContent).toBe('2026-10-17 22:30');
  });

  it('con un altro giorno scelto la card mostra il giorno che si salva', async () => {
    await openNyDraft();
    fireEvent.change(screen.getByLabelText('Giorno dell\'allenamento'), { target: { value: '2026-10-18' } });
    await finishAndSave();
    click('Condividi');

    expect(screen.getByTestId('share-card').textContent).toBe('2026-10-18 22:30');
  });

  it('una bozza senza fuso usa quello attuale del dispositivo, come prima', async () => {
    const old = { ...nyDraft };
    delete old.timeZone;
    localStorage.setItem(DRAFT_KEY, JSON.stringify(old));
    await mount();

    expect(screen.getByLabelText('Giorno dell\'allenamento').value).toBe('2026-10-18');
    expect(await finishAndSave()).toMatchObject({ time_zone: 'Europe/Rome', start_time: '2026-10-18T02:30:00.000Z' });
  });
});

describe('ripresa dal riepilogo: il tempo a pagina chiusa è una pausa', () => {
  const at = (h, m, day = 20) => new Date(2026, 9, day, h, m);
  beforeEach(() => {
    responses['user/read.php'] = () => json({ rest_timer_enabled: true, features: ['focus_session_edit'] });
  });

  // Allenamento Push dalle 18:00, riepilogo alle 19:00
  const reachSummaryAt19 = async () => {
    await startDay('Push');
    vi.setSystemTime(at(19, 0));
    doSet();
    click('Salta timer');
    doSet();
    expect(screen.getByText('Riepilogo')).toBeTruthy();
  };
  // Bozza dell'allenamento Push delle 18:00, ferma nel riepilogo alle 19:00; overrides cambia i campi
  const summaryDraft = (overrides = {}) => ({
    ...savedDraft,
    activePlan: { id: 5, name: 'Push Pull', days: [pushDay] },
    selectedDay: pushDay,
    selectedDayId: 1,
    workoutNotes: '',
    startTime: at(18, 0).toISOString(),
    lastActivityAt: at(19, 0).toISOString(),
    phase: 'summary',
    ...overrides,
  });
  const storeDraft = (overrides) => localStorage.setItem(DRAFT_KEY, JSON.stringify(summaryDraft(overrides)));
  const closeApp = () => cleanup();
  const reopen = async (when, { label = 'Riprendi allenamento', finishedOn = null } = {}) => {
    vi.setSystemTime(when);
    await mount();
    if (finishedOn) fireEvent.change(screen.getByLabelText('Giorno dell\'allenamento'), { target: { value: finishedOn } });
    click(label);
  };
  const addExerciseFromSummary = async (sets = 1) => {
    click('Aggiungi esercizio');
    await advance(0);
    fireEvent.click(screen.getByText('Croci ai cavi'));
    fireEvent.change(within(screen.getByRole('dialog')).getByLabelText('Serie'), { target: { value: String(sets) } });
    click('Aggiungi');
    await advance(0.5); // chiusura del dialog
  };
  const save = async () => {
    await act(async () => { click('Salva allenamento'); });
    await advance(0);
    return saveBody();
  };

  it('ripresa alle 21:00, un esercizio, una serie alle 21:05: la durata è 1 h 05, non 3 h 05', async () => {
    await reachSummaryAt19();
    closeApp();
    await reopen(at(21, 0));
    await addExerciseFromSummary();
    vi.setSystemTime(at(21, 5));
    doSet('40', '12');
    expect(screen.getByText('Riepilogo')).toBeTruthy();

    expect((await save()).duration_seconds).toBe(3900);
  });

  it('la serie confermata dopo la ripresa conta i secondi al netto della pausa: 21:05 sono 1 h 05, non 3 h 05', async () => {
    await reachSummaryAt19();
    closeApp();
    await reopen(at(21, 0));
    await addExerciseFromSummary();
    vi.setSystemTime(at(21, 5));
    doSet('40', '12');

    expect((await save()).workout_records.map((r) => r.seconds_from_start)).toEqual([3600, 3600, 3900]);
  });

  it('il cronometro in allenamento riparte da 60:00 e cammina da lì', async () => {
    await reachSummaryAt19();
    closeApp();
    await reopen(at(21, 0));
    await addExerciseFromSummary();

    expect(screen.getByText('60:00')).toBeTruthy();
    await advance(30);
    expect(screen.getByText('60:30')).toBeTruthy();
  });

  it('due chiusure: le pause si sommano nella bozza e la durata resta 1 h 05', async () => {
    await reachSummaryAt19();
    closeApp();
    await reopen(at(21, 0));
    await addExerciseFromSummary();
    vi.setSystemTime(at(21, 5));
    doSet('40', '12');
    closeApp();

    await reopen(at(23, 0), { label: 'Continuo ora' });
    expect((await save()).duration_seconds).toBe(3900);
  });

  it('ripresa nel riepilogo senza aggiungere niente: la durata resta 1 h', async () => {
    await reachSummaryAt19();
    closeApp();
    await reopen(at(21, 0));

    expect((await save()).duration_seconds).toBe(3600);
  });

  it('una bozza vecchia senza la fine del riepilogo conta la pausa dall\'ultima serie', async () => {
    storeDraft({
      completedSets: { 9: [
        { setNumber: 1, weight: 60, reps: '8', intensity_technique: '' },
        { setNumber: 2, weight: 62.5, reps: '7', intensity_technique: '' },
      ] },
      idempotencyKey: 'chiave-vecchia',
    });
    vi.setSystemTime(at(21, 0));
    await mount();
    click('Riprendi allenamento');

    expect((await save()).duration_seconds).toBe(3600);
  });

  it('il riepilogo mostra la durata al netto della pausa', async () => {
    await reachSummaryAt19();
    closeApp();
    await reopen(at(21, 0));

    expect(screen.getByText('60:00')).toBeTruthy();
  });

  it('una bozza ferma in allenamento con una pausa già dentro la conserva, senza aggiungerne altre', async () => {
    storeDraft({ phase: 'workout', pausedMs: 2 * 3600 * 1000, lastActivityAt: at(21, 0).toISOString() });
    vi.setSystemTime(at(21, 30));
    await mount();
    click('Riprendi allenamento');
    expect(screen.getByText('90:00')).toBeTruthy();

    vi.setSystemTime(at(21, 35));
    doSet('62.5', '7');
    expect((await save()).duration_seconds).toBe(5700);
  });

  it('tornare ad allenarsi dal riepilogo e rientrarci senza chiudere la pagina fissa di nuovo la fine', async () => {
    await reachSummaryAt19();
    await addExerciseFromSummary();
    vi.setSystemTime(at(19, 10));
    doSet('40', '12');
    expect(screen.getByText('Riepilogo')).toBeTruthy();
    await advance(600);

    expect(screen.getByText('70:00')).toBeTruthy();
    expect((await save()).duration_seconds).toBe(4200);
  });

  it('una pausa è l\'ultima attività: se si chiude in allenamento senza serie, già finita non va sotto zero', async () => {
    await reachSummaryAt19();
    closeApp();
    await reopen(at(21, 0));
    await addExerciseFromSummary();
    closeApp();

    await reopen(at(10, 0, 21), { label: 'L\'avevo già finito', finishedOn: '2026-10-19' });
    expect(screen.getByText('60:00')).toBeTruthy();
    expect(await save()).toMatchObject({
      start_time: at(18, 0, 19).toISOString(),
      ended_at: at(19, 0, 19).toISOString(),
    });
  });

  describe('già finita il giorno scelto', () => {
    const reopenAsFinished = (when) => reopen(when, { label: 'L\'avevo già finito', finishedOn: '2026-10-19' });

    it('un esercizio e una serie aggiunti dal riepilogo non spostano la fine: 1 h, fine alle 19:00', async () => {
      await reachSummaryAt19();
      closeApp();
      await reopenAsFinished(at(10, 0, 21));
      await addExerciseFromSummary();
      vi.setSystemTime(at(10, 5, 21));
      doSet('40', '12');
      expect(screen.getByText('Riepilogo')).toBeTruthy();

      expect(await save()).toMatchObject({
        backdated: true,
        start_time: at(18, 0, 19).toISOString(),
        ended_at: at(19, 0, 19).toISOString(),
      });
    });

    it('la serie confermata nel salvataggio "già finito" non ha orario; quelle già confermate lo tengono', async () => {
      await reachSummaryAt19();
      closeApp();
      await reopenAsFinished(at(10, 0, 21));
      await addExerciseFromSummary();
      vi.setSystemTime(at(10, 5, 21));
      doSet('40', '12');

      expect((await save()).workout_records.map((r) => r.seconds_from_start)).toEqual([3600, 3600, null]);
    });

    it('senza una fine nota (né fine del riepilogo né ultima serie) ended_at è null e la durata mostrata 0', async () => {
      storeDraft({ lastActivityAt: null });
      await reopenAsFinished(at(10, 0, 21));

      expect(screen.getByText('00:00')).toBeTruthy();
      const body = await save();
      expect(body).toMatchObject({ backdated: true, start_time: at(18, 0, 19).toISOString(), ended_at: null });
    });

    it('il cronometro in allenamento è fermo sulla durata del riepilogo', async () => {
      await reachSummaryAt19();
      closeApp();
      await reopenAsFinished(at(10, 0, 21));
      await addExerciseFromSummary();

      expect(screen.getByText('60:00')).toBeTruthy();
      await advance(30);
      expect(screen.getByText('60:00')).toBeTruthy();
    });

    it('con una pausa già in bozza la fine è al netto della pausa: 1 h 05, fine alle 19:05', async () => {
      storeDraft({
        idempotencyKey: 'chiave-con-pausa',
        lastActivityAt: at(21, 5).toISOString(),
        pausedMs: 2 * 3600 * 1000,
        summaryEndAt: at(21, 5).toISOString(),
      });
      await reopenAsFinished(at(10, 0, 21));
      await addExerciseFromSummary();
      vi.setSystemTime(at(10, 5, 21));
      doSet('40', '12');

      expect(await save()).toMatchObject({
        start_time: at(18, 0, 19).toISOString(),
        ended_at: at(19, 5, 19).toISOString(),
      });
    });

    it('pagina chiusa a metà delle serie aggiunte e riaperta come già finita: la fine è sempre alle 19:00', async () => {
      await reachSummaryAt19();
      closeApp();
      await reopenAsFinished(at(10, 0, 21));
      await addExerciseFromSummary(2);
      vi.setSystemTime(at(10, 5, 21));
      doSet('40', '12');
      expect(screen.getByText('Recupero')).toBeTruthy();
      closeApp();

      await reopenAsFinished(at(10, 10, 21));
      expect(await save()).toMatchObject({
        start_time: at(18, 0, 19).toISOString(),
        ended_at: at(19, 0, 19).toISOString(),
      });
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
      { exercise_id: 3, exercise_name: 'Panca piana', weight: 60, reps: '8', intensity_technique: '', is_warmup: false, day_id: 2, set_number: 1, seconds_from_start: 0 },
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

  it('nel dialogo di interruzione "Esci" è rosso (i dati non salvati si perdono) e "Continua" no', async () => {
    await startDay('Push');
    fireEvent.click(screen.getByTestId('CloseIcon').closest('button'));
    expect(getComputedStyle(screen.getByRole('button', { name: 'Esci' })).color).toBe(RED);
    expect(getComputedStyle(screen.getByRole('button', { name: 'Continua' })).color).toBe(GREY);
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

describe('serie di riscaldamento della scheda (#67)', () => {
  const squat = {
    id: 11, exercise_id: 5, exercise_name: 'Squat', sets: 2, warmup_sets: 2, reps: '5', rest: 60,
    muscle_group: 'gambe', equipment: 'bilanciere', intensity_technique: 'Rest Pause',
  };
  const legDay = { id: 3, name: 'Gambe', exercises: [squat] };
  const lastTime = [{ id: 1, date: '2026-10-13', exercises: [{ exercise_id: 5, name: 'Squat', sets: [
    { weight: 40, reps: '8', is_warmup: true }, { weight: 100, reps: '5' }, { weight: 95, reps: '6' },
  ] }] }];

  beforeEach(() => {
    responses['read_plans.php'] = () => json({ records: [{ id: 5, name: 'Gambe', is_active: true, days: [legDay] }] });
    responses['workout_history/read.php'] = () => json({ records: lastTime });
  });

  it('i pallini del riscaldamento (R1, R2) vengono prima di quelli delle serie', async () => {
    await startDay('Gambe');
    const dots = screen.getAllByRole('img').filter((d) => d.getAttribute('aria-label')?.includes(', '));
    expect(dots.map((d) => [d.textContent, d.getAttribute('aria-label')])).toEqual([
      ['R1', 'Riscaldamento 1, in corso'],
      ['R2', 'Riscaldamento 2, da fare'],
      ['1', 'Serie 1, da fare'],
      ['2', 'Serie 2, da fare'],
    ]);
  });

  it('in riscaldamento: sottotitolo dedicato, peso vuoto, nessun obiettivo ripetizioni, niente tecnica né chip evidenziata', async () => {
    await startDay('Gambe');
    expect(screen.getByText('Riscaldamento 1 di 2')).toBeTruthy();
    expect(screen.queryByText(/^Serie 1 di/)).toBeNull();
    expect(screen.getByLabelText('Peso (kg)').value).toBe('');
    expect(screen.getByLabelText('Ripetizioni').getAttribute('placeholder')).toBe('');
    expect(screen.queryByText('Tecnica di intensità')).toBeNull();
    // Le chip sono le sole serie allenanti dell'ultima volta e nessuna è quella in corso
    expect(screen.queryAllByRole('listitem', { current: true })).toHaveLength(0);
    expect(screen.queryByText('40kg×8')).toBeNull();
  });

  it('dopo una serie di riscaldamento parte il recupero della scheda, saltabile', async () => {
    await startDay('Gambe');
    doSet('20', '10');
    expect(screen.getByText('Recupero')).toBeTruthy();
    expect(screen.getByText('01:00')).toBeTruthy();
    expect(screen.getByText('Prossima: Riscaldamento 2 di 2')).toBeTruthy();
    click('Salta timer');
    expect(screen.getByText('Riscaldamento 2 di 2')).toBeTruthy();
    expect(screen.getByLabelText('Peso (kg)').value).toBe('');
  });

  it('finito il riscaldamento la prima serie allenante ha il peso dell\'ultima volta, l\'obiettivo, la tecnica e la chip evidenziata', async () => {
    await startDay('Gambe');
    doSet('20', '10');
    click('Salta timer');
    doSet('60', '5');
    click('Salta timer');
    expect(screen.getByText('Serie 1 di 2')).toBeTruthy();
    expect(screen.getByLabelText('Peso (kg)').value).toBe('100');
    expect(screen.getByLabelText('Ripetizioni').getAttribute('placeholder')).toBe('5');
    expect(screen.getAllByText('Tecnica di intensità').length).toBeGreaterThan(0);
    expect(screen.getByRole('listitem', { current: true }).textContent).toBe('100kg×5');
    // Saltare la prima serie allenante equivale a saltare l'esercizio; "Salta riscaldamento" non c'è più
    expect(screen.queryByRole('button', { name: 'Salta serie' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Salta riscaldamento' })).toBeNull();
  });

  it('"Salta riscaldamento" salta le serie rimaste senza recupero e porta alla prima serie allenante', async () => {
    await startDay('Gambe');
    expect(screen.queryByRole('button', { name: 'Salta serie' })).toBeNull();
    click('Salta riscaldamento');
    expect(screen.queryByText('Recupero')).toBeNull();
    expect(screen.getByText('Serie 1 di 2')).toBeTruthy();
    expect(screen.getByLabelText('Peso (kg)').value).toBe('100');
    expect(screen.getAllByTitle('Serie saltata')).toHaveLength(2);
    expect(draft()).toMatchObject({ currentSetIndex: 2, skippedSets: { 11: [0, 1] } });
  });

  it('salva is_warmup e set_number di seguito nell\'ordine; il riscaldamento senza tecnica', async () => {
    await startDay('Gambe');
    doSet('20', '10');
    click('Salta timer');
    doSet('60', '5');
    click('Salta timer');
    doSet('100', '5');
    click('Salta timer');
    doSet('100', '4');
    await act(async () => { click('Salva allenamento'); });
    await advance(0);

    expect(saveBody().workout_records.map((r) => [r.set_number, r.weight, r.reps, r.is_warmup, r.intensity_technique])).toEqual([
      [1, 20, '10', true, ''],
      [2, 60, '5', true, ''],
      [3, 100, '5', false, 'Rest Pause'],
      [4, 100, '4', false, 'Rest Pause'],
    ]);
  });

  it('con un riscaldamento saltato i numeri restano consecutivi', async () => {
    await startDay('Gambe');
    doSet('20', '10');
    click('Salta timer');
    click('Salta riscaldamento');
    doSet('100', '5');
    click('Salta timer');
    doSet('100', '4');
    await act(async () => { click('Salva allenamento'); });
    await advance(0);

    expect(saveBody().workout_records.map((r) => [r.set_number, r.is_warmup])).toEqual([[1, true], [2, false], [3, false]]);
  });

  it('la bozza salvata a metà riscaldamento riprende dalla serie giusta', async () => {
    localStorage.setItem(DRAFT_KEY, JSON.stringify({
      ...savedDraft,
      activePlan: { id: 5, name: 'Gambe', days: [legDay] },
      selectedDay: legDay,
      selectedDayId: 3,
      completedSets: { 11: [{ setNumber: 1, weight: 20, reps: '10', intensity_technique: '', is_warmup: true }] },
      currentSetIndex: 1,
      slotsIncludeWarmup: true,
    }));
    await mount();
    click('Riprendi allenamento');
    expect(screen.getByText('Riscaldamento 2 di 2')).toBeTruthy();
    expect(screen.queryByText('Tecnica di intensità')).toBeNull();
  });

  it('una bozza senza il segno delle posizioni riprende senza riscaldamento, anche se la scheda ora lo ha', async () => {
    // Iniziata col solo passo 3: warmup_sets è già nella scheda ma currentSetIndex conta le sole serie
    localStorage.setItem(DRAFT_KEY, JSON.stringify({
      ...savedDraft,
      activePlan: { id: 5, name: 'Gambe', days: [legDay] },
      selectedDay: legDay,
      selectedDayId: 3,
      completedSets: { 11: [{ setNumber: 1, weight: 100, reps: '5', intensity_technique: '', is_warmup: false }] },
      currentSetIndex: 1,
    }));
    await mount();
    click('Riprendi allenamento');
    expect(screen.getByText('Serie 2 di 2')).toBeTruthy();
    expect(screen.queryByText('R1')).toBeNull();
    expect(draft()).toMatchObject({ slotsIncludeWarmup: true, selectedDay: { exercises: [{ warmup_sets: 0 }] } });
  });

  it('una bozza di prima del riscaldamento riprende come sempre', async () => {
    localStorage.setItem(DRAFT_KEY, JSON.stringify(savedDraft));
    await mount();
    click('Riprendi allenamento');
    expect(screen.getByText('Serie 2 di 2')).toBeTruthy();
    expect(screen.queryByText(/^Riscaldamento/)).toBeNull();
  });

  it('riepilogo: il riscaldamento ha il badge "Risc." e non entra nel conteggio delle serie', async () => {
    await startDay('Gambe');
    click('Salta riscaldamento');
    doSet('100', '5');
    click('Salta timer');
    doSet('100', '4');
    expect(screen.getByText('Riepilogo')).toBeTruthy();
    expect(within(screen.getByRole('group', { name: 'Serie' })).getByText('2')).toBeTruthy();
    expect(screen.queryByText('Risc.')).toBeNull();
  });

  it('riepilogo con un riscaldamento fatto: badge sulla serie e conteggio senza riscaldamento', async () => {
    await startDay('Gambe');
    doSet('20', '10');
    click('Salta timer');
    click('Salta riscaldamento');
    doSet('100', '5');
    click('Salta timer');
    doSet('100', '4');
    expect(within(screen.getByText('20kg×10')).getByText('Risc.')).toBeTruthy();
    expect(within(screen.getByRole('group', { name: 'Serie' })).getByText('2')).toBeTruthy();
  });

  it('nell\'elenco "Serie completate" la prima serie allenante è "Serie 1", i riscaldamenti "Riscaldamento 1" e "Riscaldamento 2"', async () => {
    await startDay('Gambe');
    doSet('20', '10');
    click('Salta timer');
    doSet('60', '5');
    click('Salta timer');
    doSet('100', '5');
    click('Salta timer');
    expect(screen.getByText('Riscaldamento 1')).toBeTruthy();
    expect(screen.getByText('Riscaldamento 2')).toBeTruthy();
    expect(screen.getByText('Serie 1')).toBeTruthy();
    expect(screen.queryByText('Serie 3')).toBeNull();
  });

  describe('cambio esercizio', () => {
    beforeEach(() => {
      responses['user/read.php'] = () => json({ rest_timer_enabled: true, features: ['focus_session_edit'] });
    });
    const swapToCroci = async () => {
      click('Cambia esercizio');
      await advance(0);
      // Il catalogo è in cache di modulo e parte dal gruppo muscolare dell'esercizio: si cerca per nome
      fireEvent.change(screen.getByPlaceholderText(/^Cerca/), { target: { value: 'Croci' } });
      fireEvent.click(screen.getByText('Croci ai cavi'));
    };

    it('dopo "Salta riscaldamento", senza serie fatte, si può cambiare e si riparte dal riscaldamento della scheda', async () => {
      await startDay('Gambe');
      click('Salta riscaldamento');
      await swapToCroci();
      expect(screen.queryByText('Puoi cambiare l\'esercizio solo prima di aver fatto una serie')).toBeNull();
      expect(screen.getByText('Ora: Croci ai cavi')).toBeTruthy();
      expect(screen.getByText('Riscaldamento 1 di 2')).toBeTruthy();
    });

    it('con una serie di riscaldamento già fatta il cambio è rifiutato', async () => {
      await startDay('Gambe');
      doSet('20', '10');
      click('Salta timer');
      click('Cambia esercizio');
      await advance(0);
      expect(screen.getByText('Puoi cambiare l\'esercizio solo prima di aver fatto una serie')).toBeTruthy();
      // Il picker non si è aperto (il catalogo può essere già in cache di modulo: non si guarda la rete)
      expect(screen.queryByPlaceholderText(/^Cerca/)).toBeNull();
    });
  });

  it('se nell\'ultima sessione ci sono solo riscaldamenti non suggerisce nessun peso', async () => {
    responses['workout_history/read.php'] = () => json({ records: [{ id: 1, date: '2026-10-13', exercises: [{ exercise_id: 5, name: 'Squat', sets: [
      { weight: 40, reps: '8', is_warmup: true },
    ] }] }] });
    await startDay('Gambe');
    click('Salta riscaldamento');
    expect(screen.getByLabelText('Peso (kg)').value).toBe('');
  });

  it('un esercizio saltato dopo soli riscaldamenti non conta tra gli esercizi del riepilogo', async () => {
    responses['read_plans.php'] = () => json({ records: [{ id: 5, name: 'Gambe', is_active: true, days: [{ id: 3, name: 'Gambe', exercises: [squat, { ...fly, id: 12 }] }] }] });
    await startDay('Gambe');
    doSet('20', '10');
    click('Salta timer');
    click('Salta esercizio');
    await advance(0.3);
    doSet('30', '12');
    click('Salta timer');
    doSet('30', '12');
    expect(screen.getByText('Riepilogo')).toBeTruthy();
    expect(within(screen.getByRole('group', { name: 'Esercizi' })).getByText('1')).toBeTruthy();
  });

  it('ogni pallino ha un testo accessibile con numero e stato', async () => {
    await startDay('Gambe');
    expect(screen.getByLabelText('Riscaldamento 1, in corso')).toBeTruthy();
    expect(screen.getByLabelText('Riscaldamento 2, da fare')).toBeTruthy();
    expect(screen.getByLabelText('Serie 1, da fare')).toBeTruthy();
    doSet('20', '10');
    click('Salta timer');
    expect(screen.getByLabelText('Riscaldamento 1, fatta')).toBeTruthy();
    click('Salta riscaldamento');
    expect(screen.getByLabelText('Riscaldamento 2, saltata')).toBeTruthy();
    expect(screen.getByLabelText('Serie 1, in corso')).toBeTruthy();
  });
});

describe('ordine reale e orario delle serie (#26)', () => {
  // Scheda riordinata: la riga con id 20 viene prima di quella con id 10
  const benchFirst = { ...bench, id: 20, sets: 1 };
  const flySecond = { ...fly, id: 10, sets: 1 };
  const reorderedDay = { id: 3, name: 'Riordinata', exercises: [benchFirst, flySecond] };
  const save = async () => {
    await act(async () => { click('Salva allenamento'); });
    await advance(0);
    return saveBody();
  };

  beforeEach(() => {
    responses['read_plans.php'] = () => json({ records: [{ id: 5, name: 'Push Pull', is_active: true, days: [reorderedDay] }] });
  });

  it('le serie si salvano nell\'ordine in cui sono state fatte, non in quello degli id delle righe', async () => {
    await startDay('Riordinata');
    await advance(30);
    doSet('60', '8');
    await advance(0.3);
    await advance(45);
    doSet('20', '12');
    expect(screen.getByText('Riepilogo')).toBeTruthy();

    const { workout_records: records } = await save();
    expect(records.map((r) => [r.exercise_id, r.seconds_from_start])).toEqual([[3, 30], [4, 75]]);
  });

  it('i gruppi senza orario (bozza vecchia) vanno in fondo, dopo quelli con l\'orario', async () => {
    localStorage.setItem(DRAFT_KEY, JSON.stringify({
      ...savedDraft,
      completedSets: {
        9: [{ setNumber: 1, weight: 60, reps: '8', intensity_technique: '' }],
        10: [{ setNumber: 1, weight: 20, reps: '12', intensity_technique: '', seconds_from_start: 400 }],
      },
      currentExerciseIndex: 1,
      currentSetIndex: 1,
    }));
    await mount();
    click('Riprendi allenamento');
    click('Salta serie');
    await advance(0.3);
    await act(async () => { click('Salva allenamento'); });
    await advance(0);

    expect(saveBody().workout_records.map((r) => [r.exercise_id, r.seconds_from_start])).toEqual([[4, 400], [3, null]]);
  });
});
