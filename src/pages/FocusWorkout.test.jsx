// Focus Mode visto dall'utente: pulsanti e campi della pagina, con fetch e localStorage come confini.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act, cleanup } from '@testing-library/react';
import FocusWorkout from './FocusWorkout';
import { ThemeModeProvider } from '../context/ThemeModeContext';
import { json } from '../test/dom';

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

describe('ripresa dal riepilogo: il tempo a pagina chiusa è una pausa', () => {
  const at = (h, m, day = 20) => new Date(2026, 9, day, h, m);
  const CATALOG = [{ id: 20, name: 'Croci ai cavi', muscle_group: 'petto', equipment: 'cavi' }];

  beforeEach(() => {
    responses['user/read.php'] = () => json({ rest_timer_enabled: true, features: ['focus_session_edit'] });
    responses['exercise/read_all.php'] = () => json({ records: CATALOG });
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
    fireEvent.change(screen.getByLabelText('Serie'), { target: { value: String(sets) } });
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
    localStorage.setItem(DRAFT_KEY, JSON.stringify({
      activePlan: { id: 5, name: 'Push Pull', days: [pushDay] },
      selectedDay: pushDay,
      selectedDayId: 1,
      completedSets: { 9: [
        { setNumber: 1, weight: 60, reps: '8', intensity_technique: '' },
        { setNumber: 2, weight: 62.5, reps: '7', intensity_technique: '' },
      ] },
      skippedExercises: [],
      skippedSets: {},
      currentExerciseIndex: 0,
      currentSetIndex: 1,
      workoutNotes: '',
      startTime: at(18, 0).toISOString(),
      idempotencyKey: 'chiave-vecchia',
      lastActivityAt: at(19, 0).toISOString(),
      phase: 'summary',
    }));
    vi.setSystemTime(at(21, 0));
    await mount();
    click('Riprendi allenamento');

    expect((await save()).duration_seconds).toBe(3600);
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
      localStorage.setItem(DRAFT_KEY, JSON.stringify({
        activePlan: { id: 5, name: 'Push Pull', days: [pushDay] },
        selectedDay: pushDay,
        selectedDayId: 1,
        completedSets: { 9: [{ setNumber: 1, weight: 60, reps: '8', intensity_technique: '' }] },
        skippedExercises: [],
        skippedSets: {},
        currentExerciseIndex: 0,
        currentSetIndex: 1,
        workoutNotes: '',
        startTime: at(18, 0).toISOString(),
        idempotencyKey: 'chiave-con-pausa',
        lastActivityAt: at(21, 5).toISOString(),
        pausedMs: 2 * 3600 * 1000,
        summaryEndAt: at(21, 5).toISOString(),
        phase: 'summary',
      }));
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
