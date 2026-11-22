// Spostamento di un esercizio: un solo comando con la direzione; al primo e all'ultimo posto non parte nessuna richiesta.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import usePlans from './usePlans';
import { json } from '../../test/dom';

const day = { id: 11, exercises: [{ id: 101 }, { id: 102 }, { id: 103 }] };
const reorders = () => fetch.mock.calls.filter(([url]) => String(url).includes('reorder_exercise.php'));

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(json({ records: [] }))));
});
afterEach(() => vi.unstubAllGlobals());

const mounted = async () => {
  const hook = renderHook(() => usePlans());
  await waitFor(() => expect(hook.result.current.account.loaded).toBe(true));
  return hook;
};

describe('moveExercise', () => {
  it('su e giù mandano la direzione con il giorno e l\'esercizio', async () => {
    const { result } = await mounted();
    await act(async () => { await result.current.moveExercise(day, day.exercises[1], 'up'); });
    await act(async () => { await result.current.moveExercise(day, day.exercises[1], 'down'); });
    expect(reorders().map(([, init]) => JSON.parse(init.body))).toEqual([
      { day_id: 11, exercise_id: 102, direction: 'up' },
      { day_id: 11, exercise_id: 102, direction: 'down' },
    ]);
  });

  it('il primo non va più su e l\'ultimo non va più giù', async () => {
    const { result } = await mounted();
    await act(async () => { await result.current.moveExercise(day, day.exercises[0], 'up'); });
    await act(async () => { await result.current.moveExercise(day, day.exercises[2], 'down'); });
    expect(reorders()).toHaveLength(0);
  });

  it('il primo può andare giù e l\'ultimo su', async () => {
    const { result } = await mounted();
    await act(async () => { await result.current.moveExercise(day, day.exercises[0], 'down'); });
    await act(async () => { await result.current.moveExercise(day, day.exercises[2], 'up'); });
    expect(reorders()).toHaveLength(2);
  });
});
