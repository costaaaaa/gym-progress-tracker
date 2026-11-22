import { vi } from 'vitest';
import { json } from './dom';

// Dati e fetch finta delle schermate dello Storico (elenco e pagina di un allenamento), nella forma di read.php.
export const exercise = (id, name, sets = [{ set_number: 1, weight: 60, reps: 8 }]) => ({
  exercise_id: id, name, muscle_group: 'petto', sets,
});

// 3 esercizi da 60 kg × 8: 3 serie allenanti, 1440 kg di volume, 1 ora
export const workout = {
  id: 7,
  date: '2026-10-18 02:00:00',
  time_zone: null,
  started_at: '2026-10-18T02:00:00+02:00',
  duration_seconds: 3600,
  notes: '',
  health_written: false,
  day_id: 1,
  day_name: 'Push A',
  exercises: [exercise(1, 'Panca piana'), exercise(2, 'Croci'), exercise(3, 'Dip')],
};

export const plan = { id: 5, name: 'Push Pull', is_active: true, days: [] };

// Un allenamento come `workout` con i campi cambiati
export const made = (over) => ({ ...workout, ...over });

// Le chiamate a delete.php che cancellano davvero (le anteprime hanno `preview`)
export const deletions = () => fetch.mock.calls.filter(([url, init]) => url.includes('workout_history/delete.php') && !JSON.parse(init.body).preview);
export const historyReads = () => fetch.mock.calls.filter(([url]) => url.includes('workout_history/read.php')).length;

// `on`: risposte per chi chiama, per pezzo di indirizzo, che vincono sulle altre (es. { 'delete.php': (init) => json(...) }).
// Senza `on`, l'elenco è `workouts`, le schede sono `plans` e ogni altra chiamata riesce.
export const serve = ({ workouts = [workout], plans = [plan], on = {} } = {}) => {
  const fetchMock = vi.fn((url, init) => {
    const key = Object.keys(on).find((part) => String(url).includes(part));
    if (key) return Promise.resolve(on[key](init));
    if (url.includes('read_plans.php')) return Promise.resolve(json({ records: plans }));
    if (url.includes('workout_history/read.php')) return Promise.resolve(json({ records: workouts }));
    return Promise.resolve(json({ success: true }));
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
};
