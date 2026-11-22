// I dati dei Progressi per esercizio: lettura di catalogo e storico, analisi, lettura fallita distinta dal vuoto, rilettura.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import useExerciseProgress from './useExerciseProgress';
import { json } from '../../test/dom';

const day = (n) => {
  const d = new Date(Date.now() - n * 86400000);
  return { date: d.toISOString().slice(0, 19).replace('T', ' '), started_at: d.toISOString() };
};
const session = (id, when, weight) => ({ id, ...when, exercises: [{ exercise_id: 1, name: 'Bench', sets: [{ weight, reps: 5 }] }] });
const catalog = [{ id: 1, name: 'Panca piana', muscle_group: 'Petto' }];
const records = [session(1, day(10), 80), session(2, day(2), 90)];

// `exercises` e `history` decidono la risposta delle due letture; ognuna può anche fallire con un errore di rete
const stubFetch = ({ exercises = () => json({ records: catalog }), history = () => json({ records }) } = {}) => {
  vi.stubGlobal('fetch', vi.fn((url) => {
    try { return Promise.resolve(url.includes('read_all.php') ? exercises() : history()); } catch (error) { return Promise.reject(error); }
  }));
};

beforeEach(() => { vi.spyOn(console, 'error').mockImplementation(() => {}); });
afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });

const mount = async () => {
  const hook = renderHook(() => useExerciseProgress());
  await waitFor(() => expect(hook.result.current.loading).toBe(false));
  return hook;
};

describe('useExerciseProgress', () => {
  it('parte in caricamento, poi dà gli esercizi analizzati con il nome e il muscolo del catalogo', async () => {
    stubFetch();
    const hook = renderHook(() => useExerciseProgress());
    expect(hook.result.current.loading).toBe(true);
    expect(hook.result.current.analyzed).toEqual([]);
    await waitFor(() => expect(hook.result.current.loading).toBe(false));
    const { analyzed, catalog: byId, loadFailed } = hook.result.current;
    expect(loadFailed).toBe(false);
    expect(analyzed).toHaveLength(1);
    expect(analyzed[0]).toMatchObject({ id: '1', name: 'Panca piana', muscle: 'petto', mode: 'oneRM' });
    expect(analyzed[0].sessions).toHaveLength(2);
    expect(byId['1'].name).toBe('Panca piana');
  });

  it('nessun allenamento registrato (404) è un elenco vuoto, non un errore', async () => {
    stubFetch({ history: () => json({}, 404) });
    const { result } = await mount();
    expect(result.current.analyzed).toEqual([]);
    expect(result.current.loadFailed).toBe(false);
  });

  it.each([
    ['lo storico risponde con un errore', { history: () => json({}, 500) }],
    ['il catalogo risponde con un errore', { exercises: () => json({}, 500) }],
    ['la rete non risponde', { history: () => { throw new Error('rete'); } }],
  ])('lettura fallita (%s): loadFailed, distinto dal vuoto', async (_, replies) => {
    stubFetch(replies);
    const { result } = await mount();
    expect(result.current.loadFailed).toBe(true);
    expect(result.current.analyzed).toEqual([]);
  });

  it('refresh rilegge: torna in caricamento e, se riesce, toglie l\'errore e dà i dati', async () => {
    let up = false;
    stubFetch({ history: () => { if (!up) throw new Error('rete'); return json({ records }); } });
    const { result } = await mount();
    expect(result.current.loadFailed).toBe(true);

    up = true;
    act(() => { result.current.refresh(); });
    expect(result.current.loading).toBe(true);
    expect(result.current.loadFailed).toBe(false);
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.loadFailed).toBe(false);
    expect(result.current.analyzed).toHaveLength(1);
  });
});
