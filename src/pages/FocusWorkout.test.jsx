// Focus Mode visto dall'utente: pulsanti e campi della pagina, con fetch e localStorage come confini.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act, cleanup, within } from '@testing-library/react';
import FocusWorkout from './FocusWorkout';
import { ThemeModeProvider } from '../context/ThemeModeContext';
import { json } from '../test/dom';
import { currentTimeZone } from '../utils/workoutTime';
import { setBrowserTimeZone } from '../test/timeZone';
import { DROP, plannedSets, times } from '../test/plannedSets';
import { unnamedControls } from '../test/accessibleNames';
import i18n from '../i18n';

const { mockNavigate, mockTrack, mockLocation } = vi.hoisted(() => ({ mockNavigate: vi.fn(), mockTrack: vi.fn(), mockLocation: { state: null } }));
vi.mock('react-router-dom', async (importOriginal) => ({
  ...(await importOriginal()), useNavigate: () => mockNavigate, useLocation: () => ({ pathname: '/focus', search: '', hash: '', state: mockLocation.state }),
}));
// Unità di peso dell'utente: kg salvo i test che la cambiano
const account = vi.hoisted(() => ({ isLoggedIn: true, loading: false, weightUnit: 'kg', user: undefined, updateUser: undefined }));
vi.mock('../context/AuthContext', () => ({ useAuth: () => account }));
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

const bench = { id: 9, exercise_id: 3, exercise_name: 'Panca piana', planned_sets: plannedSets(0, times(2, { min: 8, max: 10 })), rest: 90, muscle_group: 'petto' };
const fly = { id: 10, exercise_id: 4, exercise_name: 'Croci', planned_sets: plannedSets(0, times(2, { min: 12, max: 12 })), rest: 60, muscle_group: 'petto' };
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
// Le azioni sotto «⋯»: si apre il menu e si sceglie la voce. «Cambia» e «Aggiungi» aprono la loro finestra a menu chiuso
const openMenu = () => fireEvent.click(screen.getByRole('button', { name: 'Altre azioni' }));
const menuItem = (name) => screen.getByRole('menuitem', { name });
const chooseAction = async (name) => {
  openMenu();
  fireEvent.click(menuItem(name));
  await advance(500);
};
const startDay = async (dayName) => {
  await mount();
  fireEvent.click(screen.getByRole('radio', { name: dayName }));
  click('Inizia allenamento');
};
// Giorno scelto prima dell'allenamento: l'etichetta con aria-checked, '' se nessuna
const dayChoice = () => screen.queryByRole('radio', { checked: true })?.textContent ?? '';
const doSet = (weight = '60', reps = '8') => {
  fireEvent.change(screen.getByLabelText('Peso (kg)'), { target: { value: weight } });
  fireEvent.change(screen.getByLabelText('Ripetizioni'), { target: { value: reps } });
  click('Conferma serie');
};
// Risposta di read_plans.php trattenuta finché il test non chiama arrivano()
const pianiInRitardo = (day) => {
  let arrivano;
  const plansResponse = new Promise((resolve) => { arrivano = () => resolve(json({ records: [{ id: 5, name: 'Push Pull', is_active: true, days: [day] }] })); });
  responses['read_plans.php'] = () => plansResponse;
  return { arrivano };
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
  plannedSetsFormat: true,
  phase: 'workout',
};

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
  vi.clearAllMocks();
  currentTimeZone.mockReturnValue(BROWSER_ZONE);
  localStorage.setItem('themeMode', 'light');
  vi.stubGlobal('fetch', fetchMock);
  account.updateUser = (patch) => { account.user = { ...account.user, ...patch }; };
  responses = {
    'read_plans.php': () => json({ records: [{ id: 5, name: 'Push Pull', is_active: true, days: [pushDay, fullDay] }] }),
    'user/read.php': () => json({ email_verified: true, email_verification: null, pending_email: null, tier: 'free', tier_until: null, tier_last_day: null, signup_code: null, rest_timer_enabled: true, features: [] }),
    'workout_history/read.php': () => json({ records: [] }),
    'record_workout.php': () => json({ success: true, id: 77 }),
    'exercise/read_all.php': () => json({ records: CATALOG }),
  };
});
afterEach(() => {
  mockLocation.state = null;
  account.weightUnit = 'kg';
  account.user = undefined;
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

  it('dopo il salvataggio «Vai allo storico» porta a /storico e chiede di rileggere l\'elenco', async () => {
    await startDay('Push');
    doSet();
    click('Salta timer');
    doSet('62.5', '7');
    await act(async () => { click('Salva allenamento'); });
    await advance(0);

    click('Vai allo storico');
    expect(mockNavigate).toHaveBeenCalledWith('/storico', { state: { refreshHistory: expect.any(Number) } });
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
    openMenu();
    expect(menuItem('Salta serie')).toBeTruthy();
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
    await chooseAction('Salta esercizio');
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
    await chooseAction('Salta esercizio');
    await act(async () => { click('Salva allenamento'); });
    await advance(0);

    expect(saveBody().workout_records.map((r) => [r.set_number, r.seconds_from_start])).toEqual([[1, null], [2, 1200]]);
  });

  it('scartare la bozza con un giorno solo lo lascia già scelto', async () => {
    responses['read_plans.php'] = () => json({ records: [{ id: 5, name: 'Push Pull', is_active: true, days: [fullDay] }] });
    localStorage.setItem(DRAFT_KEY, JSON.stringify(savedDraft));
    await mount();
    click('Scarta e inizia nuovo');
    expect(dayChoice()).toBe('Push completo');
    expect(screen.getByRole('button', { name: 'Inizia allenamento' }).disabled).toBe(false);
  });

  it('scartare la bozza prima che arrivino le schede: quando arrivano il giorno unico è già scelto', async () => {
    const { arrivano } = pianiInRitardo(fullDay);
    localStorage.setItem(DRAFT_KEY, JSON.stringify(savedDraft));
    await mount();
    click('Scarta e inizia nuovo');
    await act(async () => { arrivano(); });
    await advance(0);
    expect(dayChoice()).toBe('Push completo');
  });

  it('riprendere la bozza prima che arrivino le schede: il giorno unico della scheda non sostituisce quello della bozza', async () => {
    const { arrivano } = pianiInRitardo(pushDay);
    const draftDay = { id: 2, name: 'Push completo', exercises: [fly] };
    localStorage.setItem(DRAFT_KEY, JSON.stringify({
      ...savedDraft,
      activePlan: { id: 5, name: 'Push Pull', days: [draftDay] },
      selectedDay: draftDay,
      completedSets: {},
      currentSetIndex: 0,
    }));
    await mount();
    click('Riprendi allenamento');
    await act(async () => { arrivano(); });
    await advance(0);
    expect(screen.getByRole('heading', { name: 'Croci' })).toBeTruthy();
    expect(screen.queryByRole('heading', { name: 'Panca piana' })).toBeNull();
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
    responses['user/read.php'] = () => json({ email_verified: true, email_verification: null, pending_email: null, tier: 'pro', tier_until: null, tier_last_day: null, signup_code: null, rest_timer_enabled: true, features: ['focus_session_edit'] });
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

  it('il picker in aggiunta accetta "8" e "8-10" e rifiuta Ripetizioni o Serie non valide', async () => {
    await reachSummaryAt19();
    click('Aggiungi esercizio');
    await advance(0);
    fireEvent.click(screen.getByText('Croci ai cavi'));
    const dialog = within(screen.getByRole('dialog'));
    const addButton = () => dialog.getByRole('button', { name: 'Aggiungi' });
    const setField = (label, value) => fireEvent.change(dialog.getByLabelText(label), { target: { value } });

    // Parte dalla forma dell'esercizio corrente (Panca: 2 × 8-10)
    expect(dialog.getByLabelText('Serie').value).toBe('2');
    expect(dialog.getByLabelText('Ripetizioni').value).toBe('8-10');
    expect(addButton().disabled).toBe(false);

    ['abc', '', '10-8', '8-10-12', '0'].forEach((reps) => {
      setField('Ripetizioni', reps);
      expect(addButton().disabled, `Ripetizioni "${reps}"`).toBe(true);
    });
    setField('Ripetizioni', '8-10');
    expect(addButton().disabled).toBe(false);
    ['0', '', '99'].forEach((sets) => {
      setField('Serie', sets);
      expect(addButton().disabled, `Serie "${sets}"`).toBe(true);
    });
    setField('Serie', '2');
    expect(addButton().disabled).toBe(false);
  });

  it('l\'esercizio aggiunto ha l\'obiettivo scritto nel picker su ogni serie', async () => {
    await reachSummaryAt19();
    click('Aggiungi esercizio');
    await advance(0);
    fireEvent.click(screen.getByText('Croci ai cavi'));
    const dialog = within(screen.getByRole('dialog'));
    fireEvent.change(dialog.getByLabelText('Ripetizioni'), { target: { value: '8-10' } });
    fireEvent.change(dialog.getByLabelText('Serie'), { target: { value: '2' } });
    click('Aggiungi');
    await advance(0.5);

    expect(screen.getByText('Serie 1 di 2')).toBeTruthy();
    expect(screen.getByLabelText('Ripetizioni').getAttribute('placeholder')).toBe('8-10');
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

    await chooseAction('Salta serie');
    expect(screen.queryByText('Recupero')).toBeNull();
    await advance(0.3);
    expect(screen.getByRole('heading', { name: 'Croci' })).toBeTruthy();

    await chooseAction('Salta esercizio');
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

describe('errori e funzioni bloccate', () => {
  it('un errore nel caricamento delle schede si vede nello snackbar', async () => {
    responses['read_plans.php'] = () => ({ ok: false, status: 500, json: async () => { throw new Error('non json'); }, text: async () => '' });
    vi.spyOn(console, 'error').mockImplementation(() => {});
    await mount();
    expect(screen.getByText('Errore nel caricamento dei dati: Errore caricamento schede (500)')).toBeTruthy();
  });

  it('senza scheda attiva avvisa e mostra la schermata senza scheda', async () => {
    responses['read_plans.php'] = () => json({ records: [{ id: 5, name: 'Push Pull', is_active: false, days: [pushDay] }] });
    await mount();
    expect(screen.getByText('Nessuna scheda attiva trovata. Attivane una dalle schede.')).toBeTruthy();
    expect(screen.getByText('Nessuna scheda attiva')).toBeTruthy();
  });

  it('senza la funzione Plus i bottoni in allenamento hanno l\'etichetta "Plus" e il nome accessibile "… (Plus)"', async () => {
    await startDay('Push');
    openMenu();
    expect(menuItem('Cambia esercizio (Plus)')).toBeTruthy();
    expect(menuItem('Aggiungi esercizio (Plus)')).toBeTruthy();
  });

  it('l\'etichetta "Plus" sta fuori dal bottone sbiadito e resta piena, anche dopo una serie fatta', async () => {
    await startDay('Push');
    doSet();
    click('Salta timer');
    openMenu();
    await advance(500);
    const swap = within(menuItem('Cambia esercizio (Plus)')).getByText('Cambia esercizio');
    expect(getComputedStyle(swap).opacity).toBe('0.45');
    const labels = screen.getAllByText('Plus');
    expect(labels).toHaveLength(2);
    labels.forEach((label) => {
      expect(swap.contains(label)).toBe(false);
      for (let el = label; el && el !== document.body; el = el.parentElement) {
        expect(getComputedStyle(el).opacity).toBe('1');
      }
    });
  });

  it('l\'etichetta è solo testo, senza lucchetto', async () => {
    await startDay('Push');
    expect(screen.queryByTestId('LockIcon')).toBeNull();
  });

  it('con la funzione Plus non c\'è nessuna etichetta "Plus"', async () => {
    responses['user/read.php'] = () => json({ email_verified: true, email_verification: null, pending_email: null, tier: 'pro', tier_until: null, tier_last_day: null, signup_code: null, rest_timer_enabled: true, features: ['focus_session_edit'] });
    await startDay('Push');
    expect(screen.queryByText('Plus')).toBeNull();
    openMenu();
    expect(menuItem('Cambia esercizio')).toBeTruthy();
  });

  it('senza la funzione Plus anche "Aggiungi esercizio" del riepilogo mostra "Plus"', async () => {
    localStorage.setItem(DRAFT_KEY, JSON.stringify({ ...savedDraft, selectedDay: pushDay, selectedDayId: 1, phase: 'summary' }));
    await mount();
    click('Riprendi allenamento');
    expect(screen.getByRole('button', { name: 'Aggiungi esercizio (Plus)' })).toBeTruthy();
  });

  it('senza la funzione Plus, cambiare esercizio apre il dialog Plus con il link ai piani', async () => {
    await startDay('Push');
    await chooseAction('Cambia esercizio (Plus)');
    expect(screen.getByText('Funzione Plus')).toBeTruthy();
    expect(screen.getByText("Con Plus o Pro puoi cambiare o aggiungere esercizi durante l'allenamento.")).toBeTruthy();
    expect(screen.queryByText(/dalla sezione schede/)).toBeNull();
    expect(screen.getByRole('link', { name: 'Confronta i piani' }).getAttribute('href')).toBe('/piani');
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

  it.each([
    ['light', GREEN, 'rgb(255, 255, 255)'],
    ['dark', 'rgb(34, 197, 94)', 'rgb(10, 10, 11)'],
  ])('"Conferma serie" in %s: verde del tema con testo a 4,5:1 (bianco su verde scuro, quasi nero su verde chiaro)', async (mode, bg, fg) => {
    localStorage.setItem('themeMode', mode);
    await startDay('Push');
    fireEvent.change(screen.getByLabelText('Peso (kg)'), { target: { value: '60' } });
    fireEvent.change(screen.getByLabelText('Ripetizioni'), { target: { value: '8' } });
    const button = getComputedStyle(screen.getByRole('button', { name: 'Conferma serie' }));
    expect([button.backgroundColor, button.color]).toEqual([bg, fg]);
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
    expect(getComputedStyle(screen.getByText('Esercizio 1 di 1')).color).toBe(GREY);
  });

  it('il campo con il focus ha il bordo in inchiostro, non rosso', async () => {
    await startDay('Push');
    // All'ingresso il focus va sul titolo della fase: il campo lo prende con un Tab
    act(() => { screen.getByLabelText('Peso (kg)').focus(); });
    const fieldset = screen.getByLabelText('Peso (kg)').closest('.MuiOutlinedInput-root').querySelector('fieldset');
    expect(getComputedStyle(fieldset).borderColor).toBe(INK);
  });

  it('la chip "Ultima volta" della serie in corso ha il bordo in inchiostro, le altre restano al divisore', async () => {
    const sets = [{ weight: 60, reps: '8' }, { weight: 55, reps: '10' }];
    responses['workout_history/read.php'] = () => json({ records: [{ id: 1, date: '2026-10-13', exercises: [{ exercise_id: 3, name: 'Panca piana', sets }] }] });
    await startDay('Push');
    const current = screen.getByText('60 kg × 8').parentElement;
    const other = screen.getByText('55 kg × 10').parentElement;
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

  it('il dialogo Plus ha il bottone "Ho capito" non rosso', async () => {
    await startDay('Push');
    await chooseAction('Cambia esercizio (Plus)');
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

  it('il nuovo record di streak con 1 settimana dice "1 settimana consecutiva" (singolare)', async () => {
    responses['record_workout.php'] = () => json({ success: true, id: 77, new_longest: true, current_streak_weeks: 1 });
    localStorage.setItem(DRAFT_KEY, JSON.stringify({ ...savedDraft, selectedDay: pushDay, selectedDayId: 1, phase: 'summary' }));
    await mount();
    click('Riprendi allenamento');
    await act(async () => { click('Salva allenamento'); });
    await advance(0);
    expect(screen.getByText('Nuovo record! 🏆 1 settimana consecutiva')).toBeTruthy();
  });

  describe('modulo Livelli non attivo', () => {
    const saveWith = async (result) => {
      responses['record_workout.php'] = () => json({ success: true, id: 77, ...result });
      localStorage.setItem(DRAFT_KEY, JSON.stringify({ ...savedDraft, selectedDay: pushDay, selectedDayId: 1, phase: 'summary' }));
      await mount();
      click('Riprendi allenamento');
      await act(async () => { click('Salva allenamento'); });
      await advance(0);
    };
    const award = { new_longest: true, current_streak_weeks: 3, leveled_up: true, new_level: 4, unlocked_achievements: [], xp_session_awarded: false, xp_session_reason: 'too_short' };

    it('attivo: banner della streak, riga della streak e motivo dei punti non assegnati', async () => {
      await saveWith(award);
      expect(screen.getByText('Nuovo record! 🏆 3 settimane consecutive')).toBeTruthy();
      expect(screen.getByText(/Nessun XP di sessione/)).toBeTruthy();
      expect(screen.getByText(/Livello 4/)).toBeTruthy();
    });

    it('non attivo: né banner, né riga della streak, né motivo dei punti, né avviso di livello; il salvataggio riesce', async () => {
      account.user = { modules: { body: true, recovery: true, levels: false, groups: true, ai: true } };
      await saveWith(award);
      expect(screen.queryByText(/Nuovo record! 🏆/)).toBeNull();
      expect(screen.queryByText(/settimane consecutive/)).toBeNull();
      expect(screen.queryByText(/Nessun XP di sessione/)).toBeNull();
      expect(screen.queryByText(/Livello 4/)).toBeNull();
      expect(screen.getByText('Riepilogo sessione')).toBeTruthy();
    });
  });

  it('con la funzione Plus "Aggiungi esercizio" del riepilogo non ha l\'etichetta "Plus" e il nome è semplice', async () => {
    responses['user/read.php'] = () => json({ email_verified: true, email_verification: null, pending_email: null, tier: 'pro', tier_until: null, tier_last_day: null, signup_code: null, rest_timer_enabled: true, features: ['focus_session_edit'] });
    await toSummary();
    expect(screen.getByRole('button', { name: 'Aggiungi esercizio' })).toBeTruthy();
    expect(screen.queryByText('Plus')).toBeNull();
  });
});

// Riga della tecnica: un gruppo di quattro bottoni con aria-pressed. Nome della cella scelta, '' se nessuna.
const techniqueRow = () => screen.queryByRole('group', { name: 'Tecnica di intensità' });
const techniqueCells = () => within(techniqueRow()).getAllByRole('button');
const shownTechnique = () => techniqueCells().find((c) => c.getAttribute('aria-pressed') === 'true')?.getAttribute('aria-label') ?? '';

describe('riga della tecnica (quattro celle)', () => {
  const FOUR = ['Drop set (stripping)', 'Rest pause', 'Myo-reps', 'Negative'];
  const pressed = () => techniqueCells().map((c) => c.getAttribute('aria-pressed'));
  const cell = (name) => within(techniqueRow()).getByRole('button', { name });
  const withBench = (plannedRows) => {
    const press = { id: 12, exercise_id: 6, exercise_name: 'Pressa', rest: 60, muscle_group: 'gambe', planned_sets: plannedSets(0, plannedRows) };
    responses['read_plans.php'] = () => json({ records: [{ id: 6, name: 'Pressa', is_active: true, days: [{ id: 4, name: 'Pressa', exercises: [press] }] }] });
  };
  const saveAll = async () => {
    await act(async () => { click('Salva allenamento'); });
    await advance(0);
    return saveBody().workout_records.map((r) => r.intensity_technique);
  };

  it('sono quattro celle e basta, nell\'ordine, con l\'etichetta corta e il nome intero', async () => {
    await startDay('Push');
    expect(techniqueCells().map((c) => c.getAttribute('aria-label'))).toEqual(FOUR);
    expect(techniqueCells().map((c) => c.textContent)).toEqual(['Drop set', 'Rest pause', 'Myo-reps', 'Negative']);
    expect(screen.queryByRole('combobox')).toBeNull();
  });

  it('senza scelta nessuna cella è premuta', async () => {
    await startDay('Push');
    expect(pressed()).toEqual(['false', 'false', 'false', 'false']);
  });

  it('un tocco sceglie, un altro tocco sulla stessa toglie', async () => {
    await startDay('Push');
    fireEvent.click(cell('Myo-reps'));
    expect(shownTechnique()).toBe('Myo-reps');
    fireEvent.click(cell('Myo-reps'));
    expect(shownTechnique()).toBe('');
    expect(pressed()).toEqual(['false', 'false', 'false', 'false']);
  });

  it('una sola alla volta: sceglierne un\'altra sposta la scelta', async () => {
    await startDay('Push');
    fireEvent.click(cell('Negative'));
    fireEvent.click(cell('Rest pause'));
    expect(pressed()).toEqual(['false', 'true', 'false', 'false']);
  });

  it('parte preselezionata se la scheda la prevede per quella serie', async () => {
    withBench([{ min: 8, max: 8 }, { min: 6, max: 6, technique: 'Rest Pause' }]);
    await startDay('Pressa');
    expect(shownTechnique()).toBe('');
    doSet('50', '8');
    click('Salta timer');
    expect(shownTechnique()).toBe('Rest pause');
  });

  it('una tecnica tolta in scheda non si preseleziona: la serie parte senza e si salva senza', async () => {
    withBench([{ min: 8, max: 8, technique: 'Super Set' }, { min: 6, max: 6 }]);
    await startDay('Pressa');
    expect(shownTechnique()).toBe('');
    expect(pressed()).toEqual(['false', 'false', 'false', 'false']);
    doSet('50', '8');
    click('Salta timer');
    doSet('50', '6');
    expect(await saveAll()).toEqual(['', '']);
  });

  // Una tecnica tolta non ha una cella: a schermo non si vedrebbe comunque, la prova è la serie salvata
  it('una tecnica tolta sulla serie dopo: la serie si salva senza tecnica', async () => {
    withBench([{ min: 8, max: 8 }, { min: 6, max: 6, technique: 'Super Set' }]);
    await startDay('Pressa');
    doSet('50', '8');
    click('Salta timer');
    expect(screen.getByText('Serie 2 di 2')).toBeTruthy();
    doSet('50', '6');
    expect(await saveAll()).toEqual(['', '']);
  });

  it('riprendendo la bozza su una serie con una tecnica tolta, la serie si salva senza tecnica', async () => {
    const press = { id: 12, exercise_id: 6, exercise_name: 'Pressa', rest: 60, muscle_group: 'gambe', planned_sets: plannedSets(0, [{ min: 8, max: 8 }, { min: 6, max: 6, technique: 'Super Set' }]) };
    const day = { id: 4, name: 'Pressa', exercises: [press] };
    responses['read_plans.php'] = () => json({ records: [{ id: 5, name: 'Push Pull', is_active: true, days: [day] }] });
    localStorage.setItem(DRAFT_KEY, JSON.stringify({
      ...savedDraft, activePlan: { id: 5, name: 'Push Pull', days: [day] }, selectedDay: day, selectedDayId: 4,
      completedSets: { 12: [{ setNumber: 1, weight: 50, reps: '8', intensity_technique: '' }] }, currentSetIndex: 1,
    }));
    await mount();
    click('Riprendi allenamento');
    expect(screen.getByText('Serie 2 di 2')).toBeTruthy();
    doSet('50', '6');
    expect(await saveAll()).toEqual(['', '']);
  });

  it('il valore scelto finisce nella serie salvata; senza scelta resta vuoto come prima', async () => {
    await startDay('Push completo');
    doSet('60', '8');
    click('Salta timer');
    fireEvent.click(cell('Negative'));
    doSet('62.5', '7');
    await advance(0.3);
    doSet('20', '12');
    click('Salta timer');
    doSet('20', '12');
    expect(await saveAll()).toEqual(['', 'Negative', '', '']);
  });

  it('la scelta non passa alla serie dopo', async () => {
    await startDay('Push');
    fireEvent.click(cell('Drop set (stripping)'));
    doSet('60', '8');
    click('Salta timer');
    expect(shownTechnique()).toBe('');
  });

  it('le celle sono in Lexend 500, quella scelta in 700 con il bordo ispessito da un\'ombra interna: la larghezza del bordo non cambia', async () => {
    await startDay('Push');
    const style = (c) => getComputedStyle(c);
    techniqueCells().forEach((c) => expect([style(c).fontFamily, style(c).fontWeight]).toEqual(['"Lexend", sans-serif', '500']));
    expect(style(cell('Rest pause')).borderTopWidth).toBe('1px');
    fireEvent.click(cell('Rest pause'));
    expect([style(cell('Rest pause')).fontFamily, style(cell('Rest pause')).fontWeight]).toEqual(['"Lexend", sans-serif', '700']);
    expect(style(cell('Rest pause')).borderTopWidth).toBe('1px');
    expect(style(cell('Rest pause')).boxShadow).toContain('inset');
  });

  it('le celle hanno una zona di tocco di almeno 44 px di altezza', async () => {
    await startDay('Push');
    techniqueCells().forEach((c) => expect(getComputedStyle(c).minHeight).toBe('44px'));
  });
});

describe('serie di riscaldamento della scheda (#67)', () => {
  // 2 riscaldamenti + 2 serie da 5, la seconda con Rest pause
  const squat = {
    id: 11, exercise_id: 5, exercise_name: 'Squat', rest: 60, muscle_group: 'gambe', equipment: 'bilanciere',
    planned_sets: plannedSets(2, [{ min: 5, max: 5 }, { min: 5, max: 5, technique: 'Rest Pause' }]),
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
    expect(screen.getByRole('button', { name: /^Serie fatte/ }).textContent).toBe('R1R212');
  });

  it('in riscaldamento: sottotitolo dedicato, peso vuoto, nessun obiettivo ripetizioni, niente tecnica né chip evidenziata', async () => {
    await startDay('Gambe');
    expect(screen.getByText('Riscaldamento 1 di 2')).toBeTruthy();
    expect(screen.queryByText(/^Serie 1 di/)).toBeNull();
    expect(screen.getByLabelText('Peso (kg)').value).toBe('');
    expect(screen.getByLabelText('Ripetizioni').getAttribute('placeholder')).toBe('');
    expect(techniqueRow()).toBeNull();
    // Le chip sono le sole serie allenanti dell'ultima volta e nessuna è quella in corso
    expect(screen.queryAllByRole('listitem', { current: true })).toHaveLength(0);
    expect(screen.queryByText('40 kg × 8')).toBeNull();
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
    expect(techniqueRow()).toBeTruthy();
    // La tecnica è della seconda serie allenante, non della prima
    expect(shownTechnique()).toBe('');
    expect(screen.getByRole('listitem', { current: true }).textContent).toBe('100\u00a0kg\u00a0×\u00a05');
    // Saltare la prima serie allenante equivale a saltare l'esercizio; "Salta riscaldamento" non c'è più
    expect(screen.queryByRole('button', { name: 'Salta serie' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Salta riscaldamento' })).toBeNull();
  });

  it('"Salta riscaldamento" salta le serie rimaste senza recupero e porta alla prima serie allenante', async () => {
    await startDay('Gambe');
    expect(screen.queryByRole('button', { name: 'Salta serie' })).toBeNull();
    await chooseAction('Salta riscaldamento');
    expect(screen.queryByText('Recupero')).toBeNull();
    expect(screen.getByText('Serie 1 di 2')).toBeTruthy();
    expect(screen.getByLabelText('Peso (kg)').value).toBe('100');
    expect(screen.getByRole('button', { name: /^Serie fatte/ }).getAttribute('aria-label')).toBe('Serie fatte: 0 di 4, 2 saltate');
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
      [3, 100, '5', false, ''],
      [4, 100, '4', false, 'Rest Pause'],
    ]);
  });

  it('con un riscaldamento saltato i numeri restano consecutivi', async () => {
    await startDay('Gambe');
    doSet('20', '10');
    click('Salta timer');
    await chooseAction('Salta riscaldamento');
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
    }));
    await mount();
    click('Riprendi allenamento');
    expect(screen.getByText('Riscaldamento 2 di 2')).toBeTruthy();
    expect(techniqueRow()).toBeNull();
  });

  it('una bozza di prima delle serie pianificate viene scartata: nessun invito a riprendere', async () => {
    const old = { ...savedDraft };
    delete old.plannedSetsFormat;
    localStorage.setItem(DRAFT_KEY, JSON.stringify({
      ...old,
      activePlan: { id: 5, name: 'Gambe', days: [{ ...legDay, exercises: [{ id: 11, exercise_id: 5, exercise_name: 'Squat', sets: 2, warmup_sets: 2, reps: '5' }] }] },
      selectedDay: legDay,
      selectedDayId: 3,
      currentSetIndex: 1,
    }));
    await mount();
    expect(screen.queryByText('Riprendi allenamento')).toBeNull();
    expect(localStorage.getItem(DRAFT_KEY)).toBeNull();
    expect(screen.getAllByText('Gambe').length).toBeGreaterThan(0);
  });

  it('serie per serie: obiettivo in grigio della serie in corso e tecnica solo sulla serie che la prevede (12 / 10 / a cedimento min. 6 + Drop set)', async () => {
    const press = {
      id: 12, exercise_id: 6, exercise_name: 'Pressa', rest: 60, muscle_group: 'gambe',
      planned_sets: plannedSets(0, [{ min: 12, max: 12 }, { min: 10, max: 10 }, { min: 6, failure: true, technique: DROP }]),
    };
    const day = { id: 4, name: 'Pressa', exercises: [press] };
    responses['read_plans.php'] = () => json({ records: [{ id: 6, name: 'Pressa', is_active: true, days: [day] }] });
    await startDay('Pressa');

    expect(screen.getByText('Serie 1 di 3')).toBeTruthy();
    expect(screen.getByLabelText('Ripetizioni').getAttribute('placeholder')).toBe('12');
    expect(shownTechnique()).toBe('');
    doSet('50', '12');
    click('Salta timer');

    expect(screen.getByLabelText('Ripetizioni').getAttribute('placeholder')).toBe('10');
    expect(shownTechnique()).toBe('');
    doSet('50', '10');
    click('Salta timer');

    expect(screen.getByText('Serie 3 di 3')).toBeTruthy();
    expect(screen.getByLabelText('Ripetizioni').getAttribute('placeholder')).toBe('a cedimento (min. 6)');
    expect(shownTechnique()).toBe('Drop set (stripping)');
  });

  it('riepilogo: il riscaldamento ha il badge "Risc." e non entra nel conteggio delle serie', async () => {
    await startDay('Gambe');
    await chooseAction('Salta riscaldamento');
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
    await chooseAction('Salta riscaldamento');
    doSet('100', '5');
    click('Salta timer');
    doSet('100', '4');
    expect(within(screen.getByText('20 kg × 10')).getByText('Risc.')).toBeTruthy();
    expect(within(screen.getByRole('group', { name: 'Serie' })).getByText('2')).toBeTruthy();
  });

  it('nella finestra "Serie fatte" la prima serie allenante è "Serie 1", i riscaldamenti "Riscaldamento 1" e "Riscaldamento 2"', async () => {
    await startDay('Gambe');
    doSet('20', '10');
    click('Salta timer');
    doSet('60', '5');
    click('Salta timer');
    doSet('100', '5');
    click('Salta timer');
    fireEvent.click(screen.getByRole('button', { name: /^Serie fatte/ }));
    await advance(500);
    const dialog = within(screen.getByRole('dialog', { name: 'Serie fatte' }));
    expect(dialog.getByText('Riscaldamento 1')).toBeTruthy();
    expect(dialog.getByText('Riscaldamento 2')).toBeTruthy();
    expect(dialog.getByText('Serie 1')).toBeTruthy();
    expect(dialog.queryByText('Serie 3')).toBeNull();
  });

  describe('cambio esercizio', () => {
    beforeEach(() => {
      responses['user/read.php'] = () => json({ email_verified: true, email_verification: null, pending_email: null, tier: 'pro', tier_until: null, tier_last_day: null, signup_code: null, rest_timer_enabled: true, features: ['focus_session_edit'] });
    });
    const swapToCroci = async () => {
      await chooseAction('Cambia esercizio');
      await advance(0);
      // Il catalogo è in cache di modulo e parte dal gruppo muscolare dell'esercizio: si cerca per nome
      fireEvent.change(screen.getByPlaceholderText(/^Cerca/), { target: { value: 'Croci' } });
      fireEvent.click(screen.getByText('Croci ai cavi'));
    };

    it('dopo "Salta riscaldamento", senza serie fatte, si può cambiare e si riparte dal riscaldamento della scheda', async () => {
      await startDay('Gambe');
      await chooseAction('Salta riscaldamento');
      await swapToCroci();
      expect(screen.queryByText('Puoi cambiare l\'esercizio solo prima di aver fatto una serie')).toBeNull();
      expect(screen.getByText('Ora: Croci ai cavi')).toBeTruthy();
      expect(screen.getByText('Riscaldamento 1 di 2')).toBeTruthy();
    });

    it('con una serie di riscaldamento già fatta il cambio è rifiutato', async () => {
      await startDay('Gambe');
      doSet('20', '10');
      click('Salta timer');
      await chooseAction('Cambia esercizio');
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
    await chooseAction('Salta riscaldamento');
    expect(screen.getByLabelText('Peso (kg)').value).toBe('');
  });

  it('un esercizio saltato dopo soli riscaldamenti non conta tra gli esercizi del riepilogo', async () => {
    responses['read_plans.php'] = () => json({ records: [{ id: 5, name: 'Gambe', is_active: true, days: [{ id: 3, name: 'Gambe', exercises: [squat, { ...fly, id: 12 }] }] }] });
    await startDay('Gambe');
    doSet('20', '10');
    click('Salta timer');
    await chooseAction('Salta esercizio');
    await advance(0.3);
    doSet('30', '12');
    click('Salta timer');
    doSet('30', '12');
    expect(screen.getByText('Riepilogo')).toBeTruthy();
    expect(within(screen.getByRole('group', { name: 'Esercizi' })).getByText('1')).toBeTruthy();
  });

  it('il bottone dei pallini dice le serie fatte e quelle saltate', async () => {
    await startDay('Gambe');
    const name = () => screen.getByRole('button', { name: /^Serie fatte/ }).getAttribute('aria-label');
    expect(name()).toBe('Serie fatte: 0 di 4');
    doSet('20', '10');
    click('Salta timer');
    expect(name()).toBe('Serie fatte: 1 di 4');
    await chooseAction('Salta riscaldamento');
    expect(name()).toBe('Serie fatte: 1 di 4, 1 saltata');
  });
});

describe('ordine reale e orario delle serie (#26)', () => {
  // Scheda riordinata: la riga con id 20 viene prima di quella con id 10
  const benchFirst = { ...bench, id: 20, planned_sets: plannedSets(0, [{ min: 8, max: 10 }]) };
  const flySecond = { ...fly, id: 10, planned_sets: plannedSets(0, [{ min: 12, max: 12 }]) };
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
    await chooseAction('Salta serie');
    await advance(0.3);
    await act(async () => { click('Salva allenamento'); });
    await advance(0);

    expect(saveBody().workout_records.map((r) => [r.exercise_id, r.seconds_from_start])).toEqual([[4, 400], [3, null]]);
  });

  it('un gruppo il cui inizio manca (prima serie senza orario) va in fondo anche se le sue serie dopo hanno l\'orario', async () => {
    localStorage.setItem(DRAFT_KEY, JSON.stringify({
      ...savedDraft,
      completedSets: {
        9: [
          { setNumber: 1, weight: 60, reps: '8', intensity_technique: '' },
          { setNumber: 2, weight: 60, reps: '8', intensity_technique: '', seconds_from_start: 900 },
        ],
        10: [{ setNumber: 1, weight: 20, reps: '12', intensity_technique: '', seconds_from_start: 1200 }],
      },
      currentExerciseIndex: 1,
      currentSetIndex: 1,
    }));
    await mount();
    click('Riprendi allenamento');
    await chooseAction('Salta serie');
    await advance(0.3);
    await act(async () => { click('Salva allenamento'); });
    await advance(0);

    expect(saveBody().workout_records.map((r) => [r.exercise_id, r.seconds_from_start])).toEqual([[4, 1200], [3, null], [3, 900]]);
  });
});

// «Inizia» della Home porta qui il giorno proposto nello stato della navigazione: è solo già scelto, non parte nulla
describe('giorno proposto dalla Home', () => {
  const startButton = () => screen.getByRole('button', { name: 'Inizia allenamento' });

  it('un giorno della scheda attiva è già scelto nella scelta del giorno, e l\'allenamento non parte da solo', async () => {
    mockLocation.state = { suggestedDayId: 2 };
    await mount();
    expect(dayChoice()).toBe('Push completo');
    expect(startButton().disabled).toBe(false);
    expect(screen.queryByText(/^Serie 1 di/)).toBeNull();
    expect(saveBody()).toBeNull();
  });

  it('vale una volta: letto, si toglie dallo stato della navigazione (ricarica e indietro non lo ripropongono)', async () => {
    mockLocation.state = { suggestedDayId: 2 };
    await mount();
    expect(mockNavigate).toHaveBeenCalledWith({ pathname: '/focus', search: '' }, { replace: true, state: null });
  });

  it('senza giorno proposto non si tocca la cronologia', async () => {
    await mount();
    expect(mockNavigate).not.toHaveBeenCalledWith(expect.anything(), { replace: true, state: null });
  });

  it('l\'utente può cambiarlo', async () => {
    mockLocation.state = { suggestedDayId: 2 };
    await mount();
    fireEvent.click(screen.getByRole('radio', { name: 'Push' }));
    expect(dayChoice()).toBe('Push');
  });

  it('un giorno che non è della scheda attiva si ignora in silenzio', async () => {
    mockLocation.state = { suggestedDayId: 99 };
    await mount();
    expect(dayChoice()).toBe('');
    expect(startButton().disabled).toBe(true);
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('senza stato di navigazione la scelta resta vuota (con più giorni)', async () => {
    await mount();
    expect(dayChoice()).toBe('');
  });

  it('con una bozza da riprendere non si sceglie nulla: nemmeno dopo averla scartata', async () => {
    mockLocation.state = { suggestedDayId: 1 };
    localStorage.setItem(DRAFT_KEY, JSON.stringify(savedDraft));
    await mount();
    click('Scarta e inizia nuovo');
    expect(dayChoice()).toBe('');
  });
});

describe('scelta del giorno con le etichette', () => {
  const radios = () => screen.getAllByRole('radio');

  it('al posto della tendina: un\'etichetta per giorno, nessuna scelta, «Inizia» spento', async () => {
    await mount();
    expect(screen.queryByRole('combobox')).toBeNull();
    expect(radios().map((r) => [r.textContent, r.getAttribute('aria-checked')])).toEqual([['Push', 'false'], ['Push completo', 'false']]);
    expect(screen.getByRole('button', { name: 'Inizia allenamento' }).disabled).toBe(true);
    expect(screen.queryByText(/^Esercizi \(/)).toBeNull();
  });

  it('scegliere un giorno mostra i suoi esercizi e accende «Inizia»; sceglierne un altro sposta la scelta', async () => {
    await mount();
    fireEvent.click(screen.getByRole('radio', { name: 'Push' }));
    expect(dayChoice()).toBe('Push');
    expect(screen.getByText('Panca piana')).toBeTruthy();
    expect(screen.queryByText('Croci')).toBeNull();
    expect(screen.getByRole('button', { name: 'Inizia allenamento' }).disabled).toBe(false);
    fireEvent.click(screen.getByRole('radio', { name: 'Push completo' }));
    expect(radios().map((r) => r.getAttribute('aria-checked'))).toEqual(['false', 'true']);
    expect(screen.getByText('Croci')).toBeTruthy();
  });

  it('una sola etichetta è nell\'ordine di Tab: senza scelta la prima, con una scelta quella scelta', async () => {
    await mount();
    expect(radios().map((r) => r.tabIndex)).toEqual([0, -1]);
    fireEvent.click(screen.getByRole('radio', { name: 'Push completo' }));
    expect(radios().map((r) => r.tabIndex)).toEqual([-1, 0]);
  });

  it('tastiera: le frecce spostano il fuoco e la scelta, con giro dalla fine all\'inizio e viceversa', async () => {
    await mount();
    screen.getByRole('radio', { name: 'Push' }).focus();
    fireEvent.keyDown(document.activeElement, { key: 'ArrowRight' });
    expect(dayChoice()).toBe('Push completo');
    expect(document.activeElement).toBe(screen.getByRole('radio', { name: 'Push completo' }));
    fireEvent.keyDown(document.activeElement, { key: 'ArrowDown' });
    expect(dayChoice()).toBe('Push');
    fireEvent.keyDown(document.activeElement, { key: 'ArrowLeft' });
    expect(dayChoice()).toBe('Push completo');
    fireEvent.keyDown(document.activeElement, { key: 'ArrowUp' });
    expect(dayChoice()).toBe('Push');
  });

  it('le etichette sono in Lexend 500, quella scelta in 700 con il bordo ispessito da un\'ombra interna: la larghezza del bordo non cambia', async () => {
    await mount();
    const style = (r) => getComputedStyle(r);
    radios().forEach((r) => expect([style(r).fontFamily, style(r).fontWeight]).toEqual(['"Lexend", sans-serif', '500']));
    expect(style(radios()[0]).borderTopWidth).toBe('1px');
    fireEvent.click(radios()[0]);
    expect([style(radios()[0]).fontFamily, style(radios()[0]).fontWeight]).toEqual(['"Lexend", sans-serif', '700']);
    expect(style(radios()[0]).borderTopWidth).toBe('1px');
    expect(style(radios()[0]).boxShadow).toContain('inset');
  });

  it('la zona di tocco è di almeno 44 px di altezza', async () => {
    await mount();
    radios().forEach((r) => expect(getComputedStyle(r).minHeight).toBe('44px'));
  });

  it('il titolo della pagina viene dalle traduzioni', async () => {
    await mount();
    expect(screen.getByRole('heading', { level: 1, name: 'Focus mode' })).toBeTruthy();
  });
});

describe('scelta del giorno con una scheda appena creata', () => {
  const emptyDay = { id: 3, name: 'Giorno 1', exercises: [] };
  const withDays = (days) => {
    responses['read_plans.php'] = () => json({ records: [{ id: 5, name: 'Push Pull', is_active: true, days }] });
  };

  it('con un solo giorno è già scelto e si può iniziare subito', async () => {
    withDays([pushDay]);
    await mount();
    expect(dayChoice()).toBe('Push');
    expect(screen.getByRole('button', { name: 'Inizia allenamento' }).disabled).toBe(false);
  });

  it('con più giorni nessuno è scelto, come prima', async () => {
    await mount();
    expect(dayChoice()).toBe('');
    expect(screen.getByRole('button', { name: 'Inizia allenamento' }).disabled).toBe(true);
  });

  it('un giorno senza esercizi lascia il bottone spento e dice dove aggiungerli', async () => {
    withDays([emptyDay]);
    await mount();
    expect(screen.getByRole('button', { name: 'Inizia allenamento' }).disabled).toBe(true);
    expect(screen.getByText(/Questo giorno non ha esercizi\./)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Schede' }));
    expect(mockNavigate).toHaveBeenCalledWith('/schede');
  });

  it('il messaggio non compare finché non c\'è un giorno scelto né quando ha esercizi', async () => {
    await mount();
    expect(screen.queryByText(/Questo giorno non ha esercizi/)).toBeNull();
    fireEvent.click(screen.getByRole('radio', { name: 'Push' }));
    expect(screen.queryByText(/Questo giorno non ha esercizi/)).toBeNull();
  });
});

describe('nomi accessibili', () => {
  it('scelta del giorno: il tasto indietro e il gruppo dei giorni hanno un nome, e ogni giorno è un\'opzione col suo nome', async () => {
    await mount();
    expect(screen.getByRole('button', { name: 'Indietro' })).toBeTruthy();
    const group = screen.getByRole('radiogroup', { name: 'Seleziona giorno' });
    expect(within(group).getAllByRole('radio').map((r) => r.getAttribute('aria-label') ?? r.textContent)).toEqual(['Push', 'Push completo']);
    expect(unnamedControls()).toEqual([]);
  });

  it('allenamento: uscita, avanzamento e riga della tecnica hanno un nome', async () => {
    await startDay('Push');
    expect(screen.getByRole('button', { name: 'Esci dall\'allenamento' })).toBeTruthy();
    expect(screen.getByRole('progressbar', { name: 'Avanzamento dell\'allenamento' })).toBeTruthy();
    expect(screen.getByRole('group', { name: 'Tecnica di intensità' })).toBeTruthy();
    expect(unnamedControls()).toEqual([]);
  });

  it('recupero: il cerchio che si svuota dice che cosa misura, quello di sfondo non è esposto', async () => {
    await startDay('Push');
    doSet();
    expect(screen.getByRole('progressbar', { name: 'Avanzamento del recupero' })).toBeTruthy();
    expect(screen.getAllByRole('progressbar')).toHaveLength(1);
    expect(unnamedControls()).toEqual([]);
  });

  it('riepilogo: il tasto per uscire ha un nome', async () => {
    await startDay('Push');
    doSet();
    click('Salta timer');
    doSet();
    expect(screen.getByRole('button', { name: 'Esci dall\'allenamento' })).toBeTruthy();
    expect(unnamedControls()).toEqual([]);
  });

  it('il picker degli esercizi: il tasto di chiusura ha un nome e non finisce in quello del dialogo', async () => {
    responses['user/read.php'] = () => json({ email_verified: true, email_verification: null, pending_email: null, tier: 'pro', tier_until: null, tier_last_day: null, signup_code: null, rest_timer_enabled: true, features: ['focus_session_edit'] });
    await startDay('Push');
    await chooseAction('Cambia esercizio');
    await advance(0);
    expect(screen.getByRole('dialog', { name: 'Cambia esercizio' })).toBeTruthy();
    expect(within(screen.getByRole('dialog')).getByRole('button', { name: 'Chiudi' })).toBeTruthy();
    expect(unnamedControls()).toEqual([]);
  });
});

describe('Focus: struttura della pagina e annunci (WCAG 1.3.1, 2.4.6, 4.1.3)', () => {
  // Livelli dei titoli nell'ordine del documento: il primo è 1 e non si salta mai un livello scendendo
  const headingLevels = () => screen.getAllByRole('heading').map((h) => Number(h.tagName[1]));
  const expectOrderedOutline = () => {
    const levels = headingLevels();
    expect(levels[0]).toBe(1);
    levels.forEach((level, i) => { if (i > 0) expect(level - levels[i - 1]).toBeLessThanOrEqual(1); });
  };
  const toRest = async () => { await startDay('Push'); doSet(); };
  const toSummary = async () => { await toRest(); click('Salta timer'); doSet(); };
  const live = () => screen.getByRole('status');

  it.each([
    ['scelta del giorno', async () => { await mount(); }, 'Focus mode'],
    ['allenamento', async () => { await startDay('Push'); }, 'Panca piana'],
    ['recupero', toRest, 'Recupero'],
    ['riepilogo', toSummary, 'Riepilogo'],
  ])('%s: un solo <main>, un solo h1 con il nome della fase e livelli in ordine', async (_, go, title) => {
    await go();
    expect(screen.getAllByRole('main')).toHaveLength(1);
    const h1s = screen.getAllByRole('heading', { level: 1 });
    expect(h1s.map((h) => h.textContent)).toEqual([title]);
    expect(h1s[0].getAttribute('tabindex')).toBe('-1');
    expectOrderedOutline();
  });

  it('riepilogo dopo il salvataggio: ancora un solo h1 e livelli in ordine', async () => {
    await toSummary();
    await act(async () => { click('Salva allenamento'); });
    await advance(0);
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
    expectOrderedOutline();
  });

  it('invito a riprendere la bozza: un h1 e livelli in ordine', async () => {
    localStorage.setItem(DRAFT_KEY, JSON.stringify(savedDraft));
    await mount();
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
    expectOrderedOutline();
  });

  it('la prima apertura non sposta il focus', async () => {
    await mount();
    expect(document.activeElement).toBe(document.body);
  });

  it('al cambio di fase il focus va sul titolo della nuova fase se si perde; se un campo lo prende da solo (autoFocus) resta lì', async () => {
    await startDay('Push');
    expect(document.activeElement).toBe(screen.getByLabelText('Peso (kg)'));
    doSet();
    expect(document.activeElement).toBe(screen.getByRole('heading', { level: 1, name: 'Recupero' }));
    click('Salta timer');
    expect(document.activeElement).toBe(screen.getByLabelText('Peso (kg)'));
    doSet();
    expect(document.activeElement).toBe(screen.getByRole('heading', { level: 1, name: 'Riepilogo' }));
  });

  it('dopo il salvataggio il pulsante sparisce: il focus va sul titolo, non su body', async () => {
    await toSummary();
    act(() => screen.getByRole('button', { name: 'Salva allenamento' }).focus());
    await act(async () => { click('Salva allenamento'); });
    await advance(0);
    expect(document.activeElement).toBe(screen.getByRole('heading', { level: 1, name: 'Riepilogo' }));
  });

  it('la regione live c\'è già alla prima schermata ed è vuota', async () => {
    await mount();
    expect(live()).toBeTruthy();
    expect(live().textContent).toBe('');
  });

  it('a fine recupero la stessa regione live annuncia la fine, una volta sola; prima resta vuota', async () => {
    await toRest();
    const region = live();
    expect(region.textContent).toBe('');
    await advance(89);
    expect(region.textContent).toBe('');
    await advance(1);
    expect(region.textContent).toBe('Recupero finito: puoi fare la serie successiva');
    expect(live()).toBe(region);
    click('Salta timer');
    expect(live().textContent).toBe('');
  });
});

describe('peso in kg: il testo del campo resta com\'è scritto', () => {
  it('serie saltata: il peso scritto come "20.0" torna uguale alla serie dopo', async () => {
    const threeSets = { ...bench, planned_sets: plannedSets(0, times(3, { min: 8, max: 10 })) };
    responses['read_plans.php'] = () => json({ records: [{ id: 5, name: 'Push Pull', is_active: true, days: [{ id: 1, name: 'Push', exercises: [threeSets] }] }] });
    await startDay('Push');
    doSet('60', '8');
    click('Salta timer');
    fireEvent.change(screen.getByLabelText('Peso (kg)'), { target: { value: '20.0' } });
    await chooseAction('Salta serie');
    expect(screen.getByLabelText('Peso (kg)').value).toBe('20.0');
  });

  it('corpo libero: la zavorra scritta come "5.0" resta "5.0" nella serie dopo', async () => {
    const pullups = { ...bench, equipment: 'corpo_libero', planned_sets: plannedSets(0, times(2, { min: 8, max: 10 })) };
    responses['read_plans.php'] = () => json({ records: [{ id: 5, name: 'Push Pull', is_active: true, days: [{ id: 1, name: 'Push', exercises: [pullups] }] }] });
    await startDay('Push');
    expect(screen.getByLabelText('Peso (kg)').value).toBe('0');
    doSet('5.0', '8');
    click('Salta timer');
    expect(screen.getByLabelText('Peso (kg)').value).toBe('5.0');
  });

  it('la serie precedente suggerita parte com\'è nella sessione scorsa, senza riscrivere il numero', async () => {
    responses['workout_history/read.php'] = () => json({ records: [{ id: 1, date: '2026-10-13', exercises: [{ exercise_id: 3, name: 'Panca piana', sets: [{ weight: 82.5, reps: '8' }] }] }] });
    await startDay('Push');
    expect(screen.getByLabelText('Peso (kg)').value).toBe('82.5');
  });
});

describe('peso in libbre: dati sempre in kg', () => {
  const lastTime = (sets) => { responses['workout_history/read.php'] = () => json({ records: [{ id: 1, date: '2026-10-13', exercises: [{ exercise_id: 3, name: 'Panca piana', sets }] }] }); };
  const saveNow = async () => {
    await act(async () => { click('Salva allenamento'); });
    await advance(0);
    return saveBody().workout_records.map((r) => r.weight);
  };
  beforeEach(() => { account.weightUnit = 'lb'; });

  it('il campo si chiama in lb, con limite 2204,5 e passo 2,5', async () => {
    await startDay('Push');
    const field = screen.getByLabelText('Peso (lb)');
    expect(screen.queryByLabelText('Peso (kg)')).toBeNull();
    expect(field.getAttribute('max')).toBe('2204.5');
    expect(field.getAttribute('step')).toBe('2.5');
  });

  it('ultima volta e campo precompilato sono in lb; confermare senza toccare salva i kg originali (100, non 100,02)', async () => {
    lastTime([{ weight: 100, reps: '8' }, { weight: 90, reps: '8' }]);
    await startDay('Push');
    screen.getByText('220,5 lb × 8');
    expect(screen.getByLabelText('Peso (lb)').value).toBe('220.5');
    fireEvent.change(screen.getByLabelText('Ripetizioni'), { target: { value: '8' } });
    click('Conferma serie');
    click('Salta timer');
    // la serie dopo parte vuota: scritta dall'utente in lb
    fireEvent.change(screen.getByLabelText('Peso (lb)'), { target: { value: '200' } });
    fireEvent.change(screen.getByLabelText('Ripetizioni'), { target: { value: '8' } });
    click('Conferma serie');
    screen.getByText('220,5 lb × 8');
    expect(await saveNow()).toEqual([100, 90.72]);
  });

  it('la serie saltata riporta alla successiva il peso scritto, in kg giusti', async () => {
    const threeSets = { ...bench, planned_sets: plannedSets(0, times(3, { min: 8, max: 10 })) };
    responses['read_plans.php'] = () => json({ records: [{ id: 5, name: 'Push Pull', is_active: true, days: [{ id: 1, name: 'Push', exercises: [threeSets] }] }] });
    await startDay('Push');
    doSetLb('220', '8');
    click('Salta timer');
    fireEvent.change(screen.getByLabelText('Peso (lb)'), { target: { value: '200' } });
    await chooseAction('Salta serie');
    expect(screen.getByLabelText('Peso (lb)').value).toBe('200');
    fireEvent.change(screen.getByLabelText('Ripetizioni'), { target: { value: '8' } });
    click('Conferma serie');
    expect(await saveNow()).toEqual([99.79, 90.72]);
  });

  it('un peso oltre il limite in lb non si conferma', async () => {
    await startDay('Push');
    fireEvent.change(screen.getByLabelText('Peso (lb)'), { target: { value: '2204.75' } });
    fireEvent.change(screen.getByLabelText('Ripetizioni'), { target: { value: '8' } });
    expect(screen.getByRole('button', { name: 'Conferma serie' }).disabled).toBe(true);
  });

  it('la bozza resta in kg: scritto in lb, nella bozza ci sono i kg', async () => {
    await startDay('Push');
    doSetLb('220', '8');
    expect(draft().completedSets[9][0].weight).toBe(99.79);
    expect(JSON.stringify(draft())).not.toMatch(/220/);
  });

  it('una bozza in kg ripresa da un utente in lb mostra le libbre e non cambia i kg', async () => {
    localStorage.setItem(DRAFT_KEY, JSON.stringify(savedDraft));
    await mount();
    click('Riprendi allenamento');
    fireEvent.click(screen.getByRole('button', { name: /^Serie fatte/ }));
    await advance(500);
    screen.getByText('132,25 lb × 8');
    expect(draft().completedSets[9][0].weight).toBe(60);
  });

  it('il riepilogo scrive le serie in lb', async () => {
    await startDay('Push');
    doSetLb('220', '8');
    click('Salta timer');
    doSetLb('225', '7');
    // Siamo nel riepilogo, non più nell'elenco delle serie fatte della fase di allenamento
    screen.getByRole('heading', { level: 1, name: 'Riepilogo' });
    expect(screen.queryByText('Serie completate')).toBeNull();
    screen.getByText('220 lb × 8');
    screen.getByText('225 lb × 7');
    expect(await saveNow()).toEqual([99.79, 102.06]);
  });
});

const doSetLb = (weight, reps) => {
  fireEvent.change(screen.getByLabelText('Peso (lb)'), { target: { value: weight } });
  fireEvent.change(screen.getByLabelText('Ripetizioni'), { target: { value: reps } });
  click('Conferma serie');
};

// Strumenti della serie: tre valori dell'account (timer di recupero, tecnica, peso suggerito), acceso se l'account non dice il contrario
describe('strumenti della serie', () => {
  const press = (plannedRows, equipment = 'bilanciere') => ({
    id: 12, exercise_id: 6, exercise_name: 'Pressa', rest: 60, muscle_group: 'gambe', equipment, planned_sets: plannedSets(0, plannedRows),
  });
  const pressDay = (exercise) => ({ id: 4, name: 'Pressa', exercises: [exercise] });
  const withDay = (day) => { responses['read_plans.php'] = () => json({ records: [{ id: 6, name: 'Pressa', is_active: true, days: [day] }] }); };
  const lastTimePress = (sets) => { responses['workout_history/read.php'] = () => json({ records: [{ id: 1, date: '2026-10-13', exercises: [{ exercise_id: 6, name: 'Pressa', sets }] }] }); };
  const saveAll = async () => {
    await act(async () => { click('Salva allenamento'); });
    await advance(0);
    return saveBody().workout_records.map((r) => r.intensity_technique);
  };
  const weightField = () => screen.getByLabelText('Peso (kg)');
  const suggestedButton = () => screen.queryByRole('button', { name: /^Suggerito:/ });
  const answerSettings = (body) => { responses['update_settings.php'] = () => json(body); };
  const settingsBody = () => {
    const call = fetchMock.mock.calls.find(([url]) => url.includes('update_settings.php'));
    return call ? JSON.parse(call[1].body) : null;
  };

  describe('timer di recupero', () => {
    it('acceso (di partenza): dopo la serie parte il recupero', async () => {
      await startDay('Push');
      doSet();
      expect(screen.getByText('Recupero')).toBeTruthy();
    });

    it('spento nell\'account: dopo la serie il recupero non parte', async () => {
      account.user = { rest_timer_enabled: false };
      await startDay('Push');
      doSet();
      expect(screen.queryByText('Recupero')).toBeNull();
      expect(screen.getByText('Serie 2 di 2')).toBeTruthy();
    });
  });

  describe('tecnica spenta', () => {
    const rows = [{ min: 8, max: 8 }, { min: 6, max: 6, technique: 'Rest Pause' }];

    it('con la tecnica accesa la scheda la preseleziona sulla serie che la prevede (controllo)', async () => {
      withDay(pressDay(press(rows)));
      await startDay('Pressa');
      doSet('50', '8');
      click('Salta timer');
      expect(shownTechnique()).toBe('Rest pause');
    });

    it('la riga non compare e le serie si salvano senza tecnica, anche se la scheda ne prevede una', async () => {
      account.user = { focus_tools: { technique: false } };
      withDay(pressDay(press(rows)));
      await startDay('Pressa');
      expect(techniqueRow()).toBeNull();
      doSet('50', '8');
      click('Salta timer');
      expect(techniqueRow()).toBeNull();
      doSet('50', '6');
      expect(await saveAll()).toEqual(['', '']);
    });

    it('ripresa della bozza: nessuna riga e la serie dopo si salva senza tecnica', async () => {
      account.user = { focus_tools: { technique: false } };
      const day = pressDay(press(rows));
      localStorage.setItem(DRAFT_KEY, JSON.stringify({
        ...savedDraft, activePlan: { id: 6, name: 'Pressa', days: [day] }, selectedDay: day, selectedDayId: 4,
        completedSets: { 12: [{ setNumber: 1, weight: 50, reps: '8', intensity_technique: '' }] }, currentSetIndex: 1,
      }));
      await mount();
      click('Riprendi allenamento');
      expect(techniqueRow()).toBeNull();
      doSet('50', '6');
      expect(await saveAll()).toEqual(['', '']);
    });

    it('cambio di esercizio: la riga non compare nemmeno sul nuovo esercizio', async () => {
      account.user = { focus_tools: { technique: false } };
      withDay({ id: 4, name: 'Pressa', exercises: [press([{ min: 8, max: 8, technique: 'Rest Pause' }]), { ...fly, planned_sets: plannedSets(0, [{ min: 8, max: 8, technique: 'Myo-Reps' }]) }] });
      await startDay('Pressa');
      doSet('50', '8');
      await advance(1);
      expect(screen.getByRole('heading', { level: 1, name: 'Croci' })).toBeTruthy();
      expect(techniqueRow()).toBeNull();
      doSet('20', '8');
      expect(await saveAll()).toEqual(['', '']);
    });

    it('«Ultima volta» e serie fatte mostrano ancora le tecniche già registrate', async () => {
      account.user = { focus_tools: { technique: false } };
      withDay(pressDay(press(rows)));
      lastTimePress([{ weight: 50, reps: '8', intensity_technique: 'Rest Pause' }]);
      await startDay('Pressa');
      expect(within(screen.getByRole('list')).getByText('Rest pause')).toBeTruthy();
    });
  });

  describe('peso suggerito acceso', () => {
    const rows = [{ min: 8, max: 8 }, { min: 8, max: 8 }];
    const haveLastTime = () => { withDay(pressDay(press(rows))); lastTimePress([{ weight: 60, reps: '8' }, { weight: 62.5, reps: '8' }]); };

    it('un bottone «Suggerito: 62,5 kg» nel riquadro «Ultima volta», col campo già precompilato', async () => {
      haveLastTime();
      await startDay('Pressa');
      expect(suggestedButton().textContent).toBe('Suggerito: 62,5\u00a0kg');
      expect(weightField().value).toBe('62.5');
      expect(parseInt(getComputedStyle(suggestedButton()).minHeight, 10)).toBeGreaterThanOrEqual(44);
    });

    it('il bottone ha il carattere dei chip, come le etichette vicine', async () => {
      haveLastTime();
      await startDay('Pressa');
      expect(getComputedStyle(suggestedButton()).fontFamily).toBe(getComputedStyle(screen.getByRole('button', { name: 'Drop set (stripping)' })).fontFamily);
    });

    it('in libbre il peso è nell\'unità dell\'account', async () => {
      account.weightUnit = 'lb';
      withDay(pressDay(press(rows)));
      lastTimePress([{ weight: 100, reps: '8' }]);
      await startDay('Pressa');
      expect(suggestedButton().textContent).toBe('Suggerito: 220,5\u00a0lb');
    });

    it('senza storico non c\'è', async () => {
      withDay(pressDay(press(rows)));
      await startDay('Pressa');
      expect(suggestedButton()).toBeNull();
    });

    it('corpo libero senza zavorra nell\'ultima volta: non c\'è', async () => {
      withDay(pressDay(press(rows, 'corpo_libero')));
      lastTimePress([{ weight: 0, reps: '12' }, { weight: 0, reps: '10' }]);
      await startDay('Pressa');
      expect(suggestedButton()).toBeNull();
    });

    it('in riscaldamento non c\'è e compare alla prima serie allenante', async () => {
      const squat = { ...press([{ min: 5, max: 5 }]), planned_sets: plannedSets(1, [{ min: 5, max: 5 }]) };
      withDay(pressDay(squat));
      lastTimePress([{ weight: 40, reps: '8', is_warmup: true }, { weight: 100, reps: '5' }]);
      await startDay('Pressa');
      expect(screen.getByText('Riscaldamento 1 di 1')).toBeTruthy();
      expect(suggestedButton()).toBeNull();
      doSet('40', '8');
      click('Salta timer');
      expect(suggestedButton().textContent).toBe('Suggerito: 100\u00a0kg');
    });

    it('il tocco apre la spiegazione; «Ok» la chiude e lo strumento resta acceso', async () => {
      haveLastTime();
      await startDay('Pressa');
      suggestedButton().focus();
      fireEvent.click(suggestedButton());
      await advance(300);
      const dialog = screen.getByRole('dialog', { name: 'Peso suggerito' });
      expect(within(dialog).getByText('È il peso più alto che hai usato l\'ultima volta in questo esercizio.')).toBeTruthy();
      fireEvent.click(within(dialog).getByRole('button', { name: 'Ok' }));
      await act(async () => { await vi.advanceTimersByTimeAsync(500); });
      expect(screen.queryByRole('dialog')).toBeNull();
      expect(settingsBody()).toBeNull();
      expect(suggestedButton()).toBeTruthy();
    });

    it('«Non suggerire più» spegne lo strumento: chiamata giusta, bottone sparito, avviso con dove riaccenderlo, campo in corso intatto', async () => {
      haveLastTime();
      answerSettings({ success: true, rest_timer_enabled: true, focus_tools: { technique: true, suggested_weight: false } });
      await startDay('Pressa');
      fireEvent.change(weightField(), { target: { value: '70' } });
      fireEvent.click(suggestedButton());
      await advance(300);
      const dialog = screen.getByRole('dialog', { name: 'Peso suggerito' });
      await act(async () => { fireEvent.click(within(dialog).getByRole('button', { name: 'Non suggerire più' })); });
      // L'avviso della pagina arriva solo dopo l'uscita della finestra: prima la pagina è nascosta ai lettori di schermo
      expect(screen.queryByText('Peso suggerito spento. Si riaccende da Strumenti della serie.')).toBeNull();
      await advance(500);
      expect(settingsBody()).toEqual({ focus_tools: { suggested_weight: false } });
      expect(screen.queryByRole('dialog', { name: 'Peso suggerito' })).toBeNull();
      expect(suggestedButton()).toBeNull();
      expect(screen.getByText('Peso suggerito spento. Si riaccende da Strumenti della serie.')).toBeTruthy();
      expect(weightField().value).toBe('70');
      expect(document.activeElement).toBe(weightField());
    });

    it('l\'esercizio dopo parte con il campo vuoto', async () => {
      withDay({ id: 4, name: 'Pressa', exercises: [press([{ min: 8, max: 8 }]), { ...fly, equipment: 'manubri' }] });
      responses['workout_history/read.php'] = () => json({ records: [{ id: 1, date: '2026-10-13', exercises: [
        { exercise_id: 6, name: 'Pressa', sets: [{ weight: 60, reps: '8' }] }, { exercise_id: 4, name: 'Croci', sets: [{ weight: 20, reps: '12' }] },
      ] }] });
      answerSettings({ success: true, rest_timer_enabled: true, focus_tools: { technique: true, suggested_weight: false } });
      await startDay('Pressa');
      fireEvent.click(suggestedButton());
      await advance(300);
      const dialog = screen.getByRole('dialog', { name: 'Peso suggerito' });
      await act(async () => { fireEvent.click(within(dialog).getByRole('button', { name: 'Non suggerire più' })); });
      await advance(500);
      doSet('60', '8');
      await advance(1);
      expect(screen.getByRole('heading', { level: 1, name: 'Croci' })).toBeTruthy();
      expect(weightField().value).toBe('');
      expect(suggestedButton()).toBeNull();
    });

    it('salvataggio fallito: lo strumento resta acceso, il bottone c\'è e l\'errore si dice', async () => {
      haveLastTime();
      responses['update_settings.php'] = () => json({ success: false }, 500);
      await startDay('Pressa');
      fireEvent.click(suggestedButton());
      await advance(300);
      const dialog = screen.getByRole('dialog', { name: 'Peso suggerito' });
      await act(async () => { fireEvent.click(within(dialog).getByRole('button', { name: 'Non suggerire più' })); });
      await advance(500);
      // L'errore si legge dentro la finestra (role alert), non nella notifica della pagina
      expect(within(screen.getByRole('dialog', { name: 'Peso suggerito' })).getByRole('alert').textContent).toBe('Errore nel salvataggio. Riprova.');
      expect(screen.getAllByText('Errore nel salvataggio. Riprova.')).toHaveLength(1);
      expect(account.user?.focus_tools?.suggested_weight).not.toBe(false);
      // La spiegazione resta aperta (si può riprovare) e il bottone dietro c'è ancora
      expect(screen.getByRole('dialog', { name: 'Peso suggerito' })).toBeTruthy();
      expect(screen.getByRole('button', { name: /^Suggerito:/, hidden: true })).toBeTruthy();
      // Dopo l'errore la finestra si chiude di nuovo
      expect(within(dialog).getByRole('button', { name: 'Ok' }).disabled).toBe(false);
      fireEvent.keyDown(dialog, { key: 'Escape' });
      await advance(500);
      expect(screen.queryByRole('dialog', { name: 'Peso suggerito' })).toBeNull();
    });
  });

  describe('«Non suggerire più» in volo', () => {
    it('la finestra non si chiude (Esc, «Ok») e il bottone è occupato; a salvataggio finito si chiude', async () => {
      withDay(pressDay(press([{ min: 8, max: 8 }])));
      lastTimePress([{ weight: 60, reps: '8' }]);
      let finish;
      responses['update_settings.php'] = () => new Promise((resolve) => { finish = () => resolve(json({ success: true, rest_timer_enabled: true, focus_tools: { technique: true, suggested_weight: false } })); });
      await startDay('Pressa');
      fireEvent.click(suggestedButton());
      await advance(300);
      const dialog = screen.getByRole('dialog', { name: 'Peso suggerito' });
      await act(async () => { fireEvent.click(within(dialog).getByRole('button', { name: 'Non suggerire più' })); });
      const disable = within(dialog).getByRole('button', { name: 'Non suggerire più' });
      // Occupato ma non disabilitato: il fuoco resta sul bottone; un secondo tocco non salva due volte
      expect(disable.disabled).toBe(false);
      expect(disable.getAttribute('aria-disabled')).toBe('true');
      expect(disable.getAttribute('aria-busy')).toBe('true');
      const sent = fetch.mock.calls.length;
      await act(async () => { fireEvent.click(disable); });
      expect(fetch.mock.calls.length).toBe(sent);
      expect(within(dialog).getByRole('button', { name: 'Ok' }).disabled).toBe(true);
      fireEvent.keyDown(dialog, { key: 'Escape' });
      await advance(500);
      expect(screen.getByRole('dialog', { name: 'Peso suggerito' })).toBeTruthy();
      await act(async () => { finish(); });
      await advance(500);
      expect(screen.queryByRole('dialog', { name: 'Peso suggerito' })).toBeNull();
      expect(suggestedButton()).toBeNull();
    });
  });

  describe('peso suggerito spento', () => {
    beforeEach(() => { account.user = { focus_tools: { suggested_weight: false } }; });

    it('il bottone non compare e il campo parte vuoto alla prima serie allenante', async () => {
      withDay(pressDay(press([{ min: 8, max: 8 }])));
      lastTimePress([{ weight: 60, reps: '8' }]);
      await startDay('Pressa');
      expect(suggestedButton()).toBeNull();
      expect(weightField().value).toBe('');
      // «Ultima volta» resta
      expect(screen.getByText('60 kg × 8')).toBeTruthy();
    });

    it('corpo libero: parte da 0, come senza storico', async () => {
      withDay(pressDay(press([{ min: 8, max: 8 }], 'corpo_libero')));
      lastTimePress([{ weight: 10, reps: '8' }]);
      await startDay('Pressa');
      expect(weightField().value).toBe('0');
    });
  });
});

describe('barra in alto e menu «⋯» (F3)', () => {
  const squat = {
    id: 11, exercise_id: 5, exercise_name: 'Squat', rest: 60, muscle_group: 'gambe', equipment: 'bilanciere',
    planned_sets: plannedSets(1, times(3, { min: 5, max: 5 })),
  };
  const legDay = { id: 3, name: 'Gambe', exercises: [squat, fly] };
  const withLegs = () => { responses['read_plans.php'] = () => json({ records: [{ id: 5, name: 'Gambe', is_active: true, days: [legDay] }] }); };
  const itemNames = () => screen.getAllByRole('menuitem').map((el) => el.getAttribute('aria-label') ?? el.textContent);
  const pro = () => { responses['user/read.php'] = () => json({ email_verified: true, email_verification: null, pending_email: null, tier: 'pro', tier_until: null, tier_last_day: null, signup_code: null, rest_timer_enabled: true, features: ['focus_session_edit'] }); };

  it('la barra dice «Esercizio 1 di 2» in parole', async () => {
    withLegs();
    await startDay('Gambe');
    expect(screen.getByText('Esercizio 1 di 2')).toBeTruthy();
    expect(screen.queryByText('1/2')).toBeNull();
  });

  it('«⋯»: nome accessibile, menu, 44 px, aria-expanded e aria-controls solo da aperto', async () => {
    withLegs();
    await startDay('Gambe');
    const more = screen.getByRole('button', { name: 'Altre azioni' });
    expect(more.getAttribute('aria-haspopup')).toBe('menu');
    expect(more.getAttribute('aria-expanded')).toBe('false');
    expect(more.getAttribute('aria-controls')).toBeNull();
    expect(getComputedStyle(more).width).toBe('44px');
    expect(getComputedStyle(more).height).toBe('44px');
    fireEvent.click(more);
    expect(more.getAttribute('aria-expanded')).toBe('true');
    const menu = screen.getByRole('menu');
    expect(more.getAttribute('aria-controls')).toBe(menu.id);
    screen.getAllByRole('menuitem').forEach((item) => expect(parseInt(getComputedStyle(item).minHeight, 10)).toBeGreaterThanOrEqual(44));
  });

  it('i tre «Salta» e «Cambia / Aggiungi» non stanno più sotto «Conferma serie»', async () => {
    withLegs();
    await startDay('Gambe');
    ['Salta riscaldamento', 'Salta serie', 'Salta esercizio', 'Cambia esercizio (Plus)', 'Aggiungi esercizio (Plus)'].forEach((name) => {
      expect(screen.queryByRole('button', { name })).toBeNull();
    });
  });

  it('in riscaldamento: «Salta riscaldamento», «Salta esercizio», «Cambia», «Aggiungi» (senza «Salta serie»)', async () => {
    withLegs();
    await startDay('Gambe');
    openMenu();
    expect(itemNames()).toEqual(['Salta riscaldamento', 'Salta esercizio', 'Cambia esercizio (Plus)', 'Aggiungi esercizio (Plus)']);
  });

  it('alla prima serie allenante: niente «Salta serie» né «Salta riscaldamento»', async () => {
    withLegs();
    await startDay('Gambe');
    await chooseAction('Salta riscaldamento');
    openMenu();
    expect(itemNames()).toEqual(['Salta esercizio', 'Cambia esercizio (Plus)', 'Aggiungi esercizio (Plus)']);
  });

  it('dalla seconda serie allenante c\'è «Salta serie» e fa quello che faceva il bottone', async () => {
    withLegs();
    await startDay('Gambe');
    await chooseAction('Salta riscaldamento');
    doSet();
    click('Salta timer');
    openMenu();
    expect(itemNames()).toEqual(['Salta serie', 'Salta esercizio', 'Cambia esercizio (Plus)', 'Aggiungi esercizio (Plus)']);
    fireEvent.click(menuItem('Salta serie'));
    expect(screen.queryByRole('menu')).toBeNull();
    expect(screen.getByText('Serie 3 di 3')).toBeTruthy();
  });

  it('«Salta esercizio» porta all\'esercizio dopo e il menu si chiude', async () => {
    withLegs();
    await startDay('Gambe');
    await chooseAction('Salta esercizio');
    await advance(500);
    expect(screen.getByRole('heading', { name: 'Croci' })).toBeTruthy();
    expect(screen.queryByRole('menu')).toBeNull();
  });

  it('senza Plus: «Cambia» e «Aggiungi» hanno l\'etichetta «Plus» e aprono la finestra Plus, con il fuoco che torna a «⋯»', async () => {
    withLegs();
    await startDay('Gambe');
    openMenu();
    expect(screen.getAllByText('Plus')).toHaveLength(2);
    fireEvent.click(menuItem('Cambia esercizio (Plus)'));
    await advance(500);
    expect(screen.getByText('Funzione Plus')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Ho capito' }));
    await advance(500);
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Altre azioni' }));
  });

  it('con Plus le voci non hanno l\'etichetta e «Aggiungi esercizio» apre la scelta dell\'esercizio', async () => {
    withLegs();
    pro();
    await startDay('Gambe');
    openMenu();
    expect(screen.queryByText('Plus')).toBeNull();
    fireEvent.click(menuItem('Aggiungi esercizio'));
    await advance(500);
    expect(screen.getByRole('dialog')).toBeTruthy();
    expect(screen.getByText('Croci ai cavi')).toBeTruthy();
  });

  it('dopo una serie fatta «Cambia» resta nel menu, sbiadito, e avvisa come prima', async () => {
    withLegs();
    pro();
    await startDay('Gambe');
    doSet();
    click('Salta timer');
    openMenu();
    const swap = menuItem('Cambia esercizio');
    expect(getComputedStyle(within(swap).getByText('Cambia esercizio')).opacity).toBe('0.45');
    fireEvent.click(swap);
    await advance(500);
    expect(screen.getByText('Puoi cambiare l\'esercizio solo prima di aver fatto una serie')).toBeTruthy();
  });

  it('Esc chiude il menu e il fuoco torna a «⋯»', async () => {
    withLegs();
    await startDay('Gambe');
    openMenu();
    fireEvent.keyDown(screen.getByRole('menu'), { key: 'Escape' });
    await advance(500);
    expect(screen.queryByRole('menu')).toBeNull();
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Altre azioni' }));
  });
});

describe('pallini e «Serie fatte» (F3)', () => {
  const squat = {
    id: 11, exercise_id: 5, exercise_name: 'Squat', rest: 60, muscle_group: 'gambe', equipment: 'bilanciere',
    planned_sets: plannedSets(1, times(3, { min: 5, max: 5 })),
  };
  const legDay = { id: 3, name: 'Gambe', exercises: [squat] };
  const withLegs = () => { responses['read_plans.php'] = () => json({ records: [{ id: 5, name: 'Gambe', is_active: true, days: [legDay] }] }); };
  const doneButton = () => screen.getByRole('button', { name: /^(Serie fatte|Sets done)/ });
  const doneDialog = () => screen.getByRole('dialog', { name: 'Serie fatte' });
  const openDone = async () => { fireEvent.click(doneButton()); await advance(500); return within(doneDialog()); };
  const closeDone = async () => { fireEvent.click(within(doneDialog()).getByRole('button', { name: 'Chiudi' })); await advance(500); };
  const row = (dialog, name) => dialog.getByRole('button', { name: new RegExp(`^${name}`) });

  describe('il bottone dei pallini', () => {
    it('è uno solo, sempre presente, con il nome che dice le serie fatte', async () => {
      await startDay('Push');
      expect(screen.getAllByRole('button', { name: /^Serie fatte/ })).toHaveLength(1);
      expect(doneButton().getAttribute('aria-label')).toBe('Serie fatte: 0 di 2');
      expect(doneButton().getAttribute('aria-haspopup')).toBe('dialog');
      expect(parseInt(getComputedStyle(doneButton()).minHeight, 10)).toBeGreaterThanOrEqual(44);
      doSet();
      click('Salta timer');
      expect(doneButton().getAttribute('aria-label')).toBe('Serie fatte: 1 di 2');
    });

    it('con serie saltate le dice a parte, al singolare e al plurale', async () => {
      withLegs();
      await startDay('Gambe');
      await chooseAction('Salta riscaldamento');
      expect(doneButton().getAttribute('aria-label')).toBe('Serie fatte: 0 di 4, 1 saltata');
    });

    it('in inglese il nome è in inglese', async () => {
      await startDay('Push');
      await act(async () => { await i18n.changeLanguage('en'); });
      expect(doneButton().getAttribute('aria-label')).toBe('Sets done: 0 of 2');
    });

    it('i pallini dentro sono solo disegno, non più letti uno per uno', async () => {
      withLegs();
      await startDay('Gambe');
      expect(screen.queryAllByRole('img').filter((d) => d.getAttribute('aria-label')?.includes(', '))).toEqual([]);
      expect(screen.queryByLabelText('Riscaldamento 1, in corso')).toBeNull();
      expect(doneButton().querySelectorAll('[aria-hidden="true"]').length).toBeGreaterThanOrEqual(3);
      expect(screen.getByText('R1')).toBeTruthy();
    });

    it('la scheda «Serie fatte» in fondo alla pagina non c\'è più', async () => {
      await startDay('Push');
      doSet();
      expect(screen.queryByText('Serie completate')).toBeNull();
      expect(screen.queryByRole('heading', { name: 'Serie fatte' })).toBeNull();
      expect(screen.queryByRole('dialog')).toBeNull();
    });
  });

  describe('la finestra', () => {
    it('senza serie fatte dice che non ce ne sono, e chiusa riporta il fuoco al bottone', async () => {
      await startDay('Push');
      const dialog = await openDone();
      expect(dialog.getByText('Ancora nessuna serie fatta in questo esercizio.')).toBeTruthy();
      expect(dialog.queryAllByRole('button').map((b) => b.textContent)).toEqual(['Chiudi']);
      await closeDone();
      expect(screen.queryByRole('dialog')).toBeNull();
      expect(document.activeElement).toBe(doneButton());
    });

    it('elenca le serie fatte in ordine, con nome, valori e tecnica, senza le saltate', async () => {
      withLegs();
      await startDay('Gambe');
      doSet('20', '10');
      click('Salta timer');
      fireEvent.click(screen.getByRole('button', { name: 'Rest pause' }));
      doSet('60', '5');
      click('Salta timer');
      await chooseAction('Salta serie');
      const dialog = await openDone();
      const rows = dialog.getAllByRole('button').filter((b) => b.textContent !== 'Chiudi');
      expect(rows.map((b) => b.textContent.replace(/\s/g, ' '))).toEqual(['Riscaldamento 120 kg × 10', 'Serie 160 kg × 5Rest pause']);
      expect(dialog.queryByText('Serie 2')).toBeNull();
      rows.forEach((b) => expect(parseInt(getComputedStyle(b).minHeight, 10)).toBeGreaterThanOrEqual(44));
      expect(dialog.getByText('Tocca una serie per correggerla.')).toBeTruthy();
    });

    it('i valori sono nell\'unità dell\'utente', async () => {
      account.weightUnit = 'lb';
      await startDay('Push');
      doSetLb('220', '8');
      click('Salta timer');
      const dialog = await openDone();
      expect(dialog.getByText('Serie 1')).toBeTruthy();
      expect(dialog.getByText('220 lb × 8')).toBeTruthy();
    });

    it('Esc chiude la finestra e il fuoco torna ai pallini', async () => {
      await startDay('Push');
      await openDone();
      fireEvent.keyDown(doneDialog(), { key: 'Escape' });
      await advance(500);
      expect(screen.queryByRole('dialog')).toBeNull();
      expect(document.activeElement).toBe(doneButton());
    });
  });

  describe('correggere una serie fatta', () => {
    const squatDraft = (sets, extra = {}) => ({
      ...savedDraft, activePlan: { id: 5, name: 'Gambe', days: [legDay] }, selectedDay: legDay, selectedDayId: 3,
      completedSets: { 11: sets }, currentSetIndex: 3, ...extra,
    });
    const benchSets = [{ setNumber: 1, weight: 62.5, reps: '8', intensity_technique: '', is_warmup: false, seconds_from_start: 300 }];
    const inDialog = () => within(doneDialog());
    const field = (label) => inDialog().getByLabelText(label);
    const save = () => fireEvent.click(inDialog().getByRole('button', { name: 'Salva' }));
    const cancel = () => fireEvent.click(inDialog().getByRole('button', { name: 'Annulla' }));
    const resume = async (draftValue) => {
      localStorage.setItem(DRAFT_KEY, JSON.stringify(draftValue));
      await mount();
      click('Riprendi allenamento');
    };
    // Una serie di Panca piana (id 9) in corso nella seconda: la prima è fatta con `weight`
    const afterFirstSet = async (weight = '60', reps = '8') => {
      await startDay('Push');
      await advance(60);
      doSet(weight, reps);
      click('Salta timer');
    };
    const finishAndSave = async () => {
      doSet('70', '6');
      await act(async () => { click('Salva allenamento'); });
      await advance(0);
      return saveBody().workout_records;
    };

    it('toccare una serie la apre in modifica: gruppo col suo nome, campi con etichetta, fuoco sul peso', async () => {
      await afterFirstSet();
      const dialog = await openDone();
      fireEvent.click(row(dialog, 'Serie 1'));
      const group = inDialog().getByRole('group', { name: 'Correggi Serie 1' });
      expect(within(group).getByLabelText('Peso (kg)').value).toBe('60');
      expect(within(group).getByLabelText('Ripetizioni').value).toBe('8');
      expect(within(group).getByRole('button', { name: 'Rest pause' })).toBeTruthy();
      expect(document.activeElement).toBe(field('Peso (kg)'));
      const weight = field('Peso (kg)');
      expect(weight.getAttribute('inputmode')).toBe('decimal');
      expect([weight.getAttribute('step'), weight.getAttribute('min'), weight.getAttribute('max')]).toEqual(['0.5', '0', '999.99']);
    });

    it('peso, ripetizioni e tecnica cambiati arrivano al salvataggio, con gli stessi set_number e seconds_from_start', async () => {
      await afterFirstSet();
      const dialog = await openDone();
      fireEvent.click(row(dialog, 'Serie 1'));
      fireEvent.change(field('Peso (kg)'), { target: { value: '65' } });
      fireEvent.change(field('Ripetizioni'), { target: { value: '9' } });
      fireEvent.click(inDialog().getByRole('button', { name: 'Drop set (stripping)' }));
      save();
      await closeDone();
      expect(draft().completedSets[9][0]).toMatchObject({ weight: 65, reps: '9', intensity_technique: 'Drop Set (Stripping)', setNumber: 1, seconds_from_start: 60 });
      const records = await finishAndSave();
      expect(records.map((r) => [r.weight, r.reps, r.intensity_technique, r.set_number])).toEqual([
        [65, '9', 'Drop Set (Stripping)', 1], [70, '6', '', 2],
      ]);
      expect(records[0].seconds_from_start).toBe(60);
    });

    it('«Annulla» non cambia nulla e riporta il fuoco alla riga', async () => {
      await afterFirstSet();
      const dialog = await openDone();
      fireEvent.click(row(dialog, 'Serie 1'));
      fireEvent.change(field('Peso (kg)'), { target: { value: '99' } });
      cancel();
      expect(inDialog().queryByRole('group')).toBeNull();
      expect(document.activeElement).toBe(row(inDialog(), 'Serie 1'));
      expect(inDialog().getByText('60 kg × 8')).toBeTruthy();
      expect(draft().completedSets[9][0].weight).toBe(60);
      expect(inDialog().getByRole('status').textContent).toBe('');
    });

    it('«Salva» torna alla riga e annuncia «Serie corretta.» dentro la finestra; alla seconda correzione lo riannuncia', async () => {
      await afterFirstSet();
      const dialog = await openDone();
      expect(inDialog().getByRole('status').textContent).toBe('');
      fireEvent.click(row(dialog, 'Serie 1'));
      fireEvent.change(field('Ripetizioni'), { target: { value: '9' } });
      save();
      expect(document.activeElement).toBe(row(inDialog(), 'Serie 1'));
      expect(inDialog().getByRole('status').textContent).toBe('Serie corretta.');
      expect(inDialog().getByText('60 kg × 9')).toBeTruthy();
      // La regione si svuota quando parte una nuova modifica: lo stesso testo viene riletto
      fireEvent.click(row(inDialog(), 'Serie 1'));
      expect(inDialog().getByRole('status').textContent).toBe('');
      save();
      expect(inDialog().getByRole('status').textContent).toBe('Serie corretta.');
    });

    it('valori non validi disabilitano «Salva»', async () => {
      await afterFirstSet();
      const dialog = await openDone();
      fireEvent.click(row(dialog, 'Serie 1'));
      const saveButton = () => inDialog().getByRole('button', { name: 'Salva' });
      expect(saveButton().disabled).toBe(false);
      fireEvent.change(field('Peso (kg)'), { target: { value: '' } });
      expect(saveButton().disabled).toBe(true);
      fireEvent.change(field('Peso (kg)'), { target: { value: '1000' } });
      expect(saveButton().disabled).toBe(true);
      fireEvent.change(field('Peso (kg)'), { target: { value: '60' } });
      fireEvent.change(field('Ripetizioni'), { target: { value: '0' } });
      expect(saveButton().disabled).toBe(true);
      fireEvent.change(field('Ripetizioni'), { target: { value: '251' } });
      expect(saveButton().disabled).toBe(true);
      fireEvent.change(field('Ripetizioni'), { target: { value: '8' } });
      expect(saveButton().disabled).toBe(false);
    });

    it('oltre 30 ripetizioni e oltre la scheda chiede conferma, come per la serie', async () => {
      await afterFirstSet();
      const dialog = await openDone();
      fireEvent.click(row(dialog, 'Serie 1'));
      fireEvent.change(field('Ripetizioni'), { target: { value: '45' } });
      save();
      expect(screen.getByText('Confermi 45 ripetizioni?')).toBeTruthy();
      expect(draft().completedSets[9][0].reps).toBe('8');
      fireEvent.click(screen.getByRole('button', { name: 'Correggi' }));
      await advance(500);
      expect(inDialog().getByRole('group', { name: 'Correggi Serie 1' })).toBeTruthy();
      save();
      fireEvent.click(screen.getByRole('button', { name: 'Sì, confermo' }));
      await advance(500);
      expect(draft().completedSets[9][0].reps).toBe('45');
      expect(inDialog().getByRole('status').textContent).toBe('Serie corretta.');
    });

    it('una riga sola alla volta in modifica', async () => {
      withLegs();
      await startDay('Gambe');
      doSet('20', '10');
      click('Salta timer');
      doSet('60', '5');
      click('Salta timer');
      const dialog = await openDone();
      fireEvent.click(row(dialog, 'Riscaldamento 1'));
      expect(inDialog().getAllByRole('group', { name: /^Correggi/ })).toHaveLength(1);
      fireEvent.click(row(inDialog(), 'Serie 1'));
      expect(inDialog().getAllByRole('group').map((g) => g.getAttribute('aria-label')).filter((n) => n.startsWith('Correggi'))).toEqual(['Correggi Serie 1']);
    });

    it('un riscaldamento non ha la riga della tecnica e resta senza', async () => {
      withLegs();
      await startDay('Gambe');
      doSet('20', '10');
      click('Salta timer');
      const dialog = await openDone();
      fireEvent.click(row(dialog, 'Riscaldamento 1'));
      expect(inDialog().queryByRole('group', { name: 'Tecnica di intensità' })).toBeNull();
      fireEvent.change(field('Peso (kg)'), { target: { value: '25' } });
      save();
      expect(draft().completedSets[11][0]).toMatchObject({ weight: 25, intensity_technique: '', is_warmup: true });
    });

    it('con lo strumento «Tecnica» spento la riga non c\'è e la tecnica salvata resta', async () => {
      account.user = { focus_tools: { technique: false } };
      withLegs();
      await resume(squatDraft([{ setNumber: 2, weight: 60, reps: '5', intensity_technique: 'Rest Pause', is_warmup: false, seconds_from_start: 100 }], { currentSetIndex: 3 }));
      const dialog = await openDone();
      fireEvent.click(row(dialog, 'Serie 1'));
      expect(inDialog().queryByRole('group', { name: 'Tecnica di intensità' })).toBeNull();
      fireEvent.change(field('Peso (kg)'), { target: { value: '65' } });
      save();
      expect(draft().completedSets[11][0]).toMatchObject({ weight: 65, intensity_technique: 'Rest Pause' });
    });

    it('una tecnica salvata che non è tra le quattro resta finché non se ne sceglie un\'altra', async () => {
      withLegs();
      await resume(squatDraft([{ setNumber: 2, weight: 60, reps: '5', intensity_technique: 'Cluster Set', is_warmup: false, seconds_from_start: 100 }]));
      const dialog = await openDone();
      fireEvent.click(row(dialog, 'Serie 1'));
      inDialog().getAllByRole('button').filter((b) => b.hasAttribute('aria-pressed')).forEach((b) => expect(b.getAttribute('aria-pressed')).toBe('false'));
      fireEvent.change(field('Ripetizioni'), { target: { value: '6' } });
      save();
      expect(draft().completedSets[11][0]).toMatchObject({ reps: '6', intensity_technique: 'Cluster Set' });
      fireEvent.click(row(inDialog(), 'Serie 1'));
      fireEvent.click(inDialog().getByRole('button', { name: 'Negative' }));
      save();
      expect(draft().completedSets[11][0].intensity_technique).toBe('Negative');
    });

    describe('il peso non toccato non cambia di un centesimo', () => {
      it('in lb: 62,5 kg resta 62,5 anche dopo una correzione delle ripetizioni', async () => {
        account.weightUnit = 'lb';
        await resume({ ...savedDraft, completedSets: { 9: benchSets } });
        const dialog = await openDone();
        fireEvent.click(row(dialog, 'Serie 1'));
        expect(field('Peso (lb)').value).toBe('137.75');
        fireEvent.change(field('Ripetizioni'), { target: { value: '9' } });
        save();
        expect(draft().completedSets[9][0]).toMatchObject({ weight: 62.5, reps: '9' });
      });

      it('in lb, se il peso si tocca, i kg vengono dalle libbre scritte', async () => {
        account.weightUnit = 'lb';
        await resume({ ...savedDraft, completedSets: { 9: benchSets } });
        const dialog = await openDone();
        fireEvent.click(row(dialog, 'Serie 1'));
        fireEvent.change(field('Peso (lb)'), { target: { value: '140' } });
        save();
        expect(draft().completedSets[9][0].weight).toBe(63.5);
      });
    });

    describe('effetti sul resto della schermata', () => {
      it('i pallini, «Ultima volta» e il peso già scritto nel campo della serie in corso non cambiano', async () => {
        responses['workout_history/read.php'] = () => json({ records: [{ id: 1, date: '2026-10-13', exercises: [{ exercise_id: 3, name: 'Panca piana', sets: [{ weight: 50, reps: '10' }, { weight: 55, reps: '8' }] }] }] });
        await startDay('Push');
        doSet('60', '8');
        click('Salta timer');
        fireEvent.change(screen.getByLabelText('Peso (kg)'), { target: { value: '70' } });
        const name = doneButton().getAttribute('aria-label');
        const last = screen.getByText('Ultima volta').parentElement.textContent;
        const dialog = await openDone();
        fireEvent.click(row(dialog, 'Serie 1'));
        fireEvent.change(field('Peso (kg)'), { target: { value: '80' } });
        save();
        await closeDone();
        expect(screen.getByLabelText('Peso (kg)').value).toBe('70');
        expect(doneButton().getAttribute('aria-label')).toBe(name);
        expect(screen.getByText('Ultima volta').parentElement.textContent).toBe(last);
        expect(screen.getByText(/^Serie 2 di 2$/)).toBeTruthy();
      });
    });
  });

  describe('dal riepilogo', () => {
    const history = [{ id: 1, date: '2026-10-13', exercises: [{ exercise_id: 3, name: 'Panca piana', sets: [{ weight: 60, reps: '8' }] }] }];
    const summaryDraft = (weight = 70) => ({
      ...savedDraft, phase: 'summary', completedSets: { 9: [
        { setNumber: 1, weight, reps: '8', intensity_technique: '', is_warmup: false, seconds_from_start: 300 },
        { setNumber: 2, weight: 50, reps: '8', intensity_technique: 'Rest Pause', is_warmup: false, seconds_from_start: 400 },
      ] },
    });
    const goSummary = async (draftValue) => {
      localStorage.setItem(DRAFT_KEY, JSON.stringify(draftValue));
      await mount();
      click('Riprendi allenamento');
    };
    // Il nome porta gli spazi stretti di formatSetText: si confronta con spazi normali
    const chip = (name) => screen.getAllByRole('button').find((b) => b.getAttribute('aria-label')?.replace(/\s/g, ' ') === name);

    it('prima del salvataggio ogni serie è un bottone con esercizio, serie e valori; dopo non lo è più', async () => {
      await goSummary(summaryDraft());
      const first = chip('Correggi Panca piana, Serie 1: 70 kg × 8');
      expect(first).toBeTruthy();
      expect(parseInt(getComputedStyle(first).minHeight, 10)).toBeGreaterThanOrEqual(44);
      expect(chip('Correggi Panca piana, Serie 2: 50 kg × 8, Rest pause')).toBeTruthy();
      await act(async () => { click('Salva allenamento'); });
      await advance(0);
      expect(screen.queryAllByRole('button', { name: /^Correggi Panca/ })).toEqual([]);
      expect(screen.getByText('70 kg × 8')).toBeTruthy();
    });

    it('il tocco apre la finestra di quell\'esercizio con la serie già in modifica', async () => {
      await goSummary(summaryDraft());
      fireEvent.click(chip('Correggi Panca piana, Serie 2: 50 kg × 8, Rest pause'));
      await advance(500);
      expect(screen.getByRole('group', { name: 'Correggi Serie 2' })).toBeTruthy();
      expect(document.activeElement).toBe(within(doneDialog()).getByLabelText('Peso (kg)'));
      expect(within(doneDialog()).getByLabelText('Peso (kg)').value).toBe('50');
    });

    it('dopo la correzione i record si aggiornano e il salvataggio porta i valori corretti', async () => {
      responses['workout_history/read.php'] = () => json({ records: history });
      await goSummary(summaryDraft(70));
      expect(screen.getByText(/^Nuovo record/)).toBeTruthy();
      fireEvent.click(chip('Correggi Panca piana, Serie 1: 70 kg × 8'));
      await advance(500);
      fireEvent.change(within(doneDialog()).getByLabelText('Peso (kg)'), { target: { value: '55' } });
      fireEvent.click(within(doneDialog()).getByRole('button', { name: 'Salva' }));
      await closeDone();
      expect(screen.queryByText(/^Nuovo record/)).toBeNull();
      expect(document.activeElement).toBe(chip('Correggi Panca piana, Serie 1: 55 kg × 8'));
      await act(async () => { click('Salva allenamento'); });
      await advance(0);
      expect(saveBody().workout_records.map((r) => [r.weight, r.reps, r.intensity_technique, r.set_number, r.seconds_from_start])).toEqual([
        [55, '8', '', 1, 300], [50, '8', 'Rest Pause', 2, 400],
      ]);
    });
  });
});
