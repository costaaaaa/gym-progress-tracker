// Eliminazione con «Annulla»: l'elemento sparisce subito dalla lista, la richiesta al server parte solo allo scadere.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import process from 'node:process';
import useUndoableDelete, { UNDO_DELAY_MS } from './useUndoableDelete';

beforeEach(() => { vi.useFakeTimers(); });
afterEach(() => { vi.useRealTimers(); });

const setup = (commit = vi.fn().mockResolvedValue(undefined), onError = vi.fn()) => {
  const hook = renderHook(() => useUndoableDelete({ commit, onError }));
  return { ...hook, commit, onError };
};

describe('useUndoableDelete', () => {
  it('l\'elemento risulta nascosto subito, ma il server non viene chiamato prima dei 10 secondi', () => {
    const { result, commit } = setup();
    act(() => { result.current.schedule(7); });
    expect(result.current.pendingId).toBe(7);
    act(() => { vi.advanceTimersByTime(UNDO_DELAY_MS - 1); });
    expect(commit).not.toHaveBeenCalled();
    expect(result.current.pendingId).toBe(7);
  });

  it('il ritardo è di 10 secondi', () => {
    expect(UNDO_DELAY_MS).toBe(10000);
  });

  it('allo scadere chiama commit con l\'id e libera lo stato', async () => {
    const { result, commit } = setup();
    act(() => { result.current.schedule(7); });
    await act(async () => { vi.advanceTimersByTime(UNDO_DELAY_MS); });
    expect(commit).toHaveBeenCalledTimes(1);
    expect(commit).toHaveBeenCalledWith(7);
    expect(result.current.pendingId).toBeNull();
  });

  it('«Annulla» prima dello scadere ripristina l\'elemento e il server non viene mai chiamato', async () => {
    const { result, commit } = setup();
    act(() => { result.current.schedule(7); });
    act(() => { result.current.undo(); });
    expect(result.current.pendingId).toBeNull();
    await act(async () => { vi.advanceTimersByTime(UNDO_DELAY_MS * 2); });
    expect(commit).not.toHaveBeenCalled();
  });

  it('se il server risponde con un errore l\'elemento torna e l\'errore viene segnalato', async () => {
    const boom = new Error('no');
    const { result, onError } = setup(vi.fn().mockRejectedValue(boom));
    act(() => { result.current.schedule(7); });
    await act(async () => { vi.advanceTimersByTime(UNDO_DELAY_MS); });
    expect(onError).toHaveBeenCalledWith(boom, 7);
    expect(result.current.pendingId).toBeNull();
    expect(result.current.hiddenIds).toEqual([]);
  });

  it('durante la richiesta l\'elemento resta nascosto, poi lo è per sempre se va a buon fine', async () => {
    let finish;
    const commit = vi.fn(() => new Promise((resolve) => { finish = resolve; }));
    const { result } = setup(commit);
    act(() => { result.current.schedule(7); });
    await act(async () => { vi.advanceTimersByTime(UNDO_DELAY_MS); });
    expect(result.current.hiddenIds).toEqual([7]);
    await act(async () => { finish(); });
    expect(result.current.hiddenIds).toEqual([7]);
  });

  it('un secondo elemento eliminato mentre il primo aspetta: il primo parte subito, «Annulla» vale per il secondo', async () => {
    const { result, commit } = setup();
    act(() => { result.current.schedule(1); });
    act(() => { result.current.schedule(2); });
    expect(commit).toHaveBeenCalledWith(1);
    expect(result.current.pendingId).toBe(2);
    expect(result.current.hiddenIds).toEqual([1, 2]);
    act(() => { result.current.undo(); });
    expect(result.current.hiddenIds).toEqual([1]);
    await act(async () => { vi.advanceTimersByTime(UNDO_DELAY_MS); });
    expect(commit).toHaveBeenCalledTimes(1);
  });

  it('se la pagina si smonta con un\'eliminazione in attesa, la richiesta parte (l\'utente aveva confermato)', () => {
    const { unmount, result, commit } = setup();
    act(() => { result.current.schedule(7); });
    unmount();
    expect(commit).toHaveBeenCalledWith(7);
  });

  it('se la pagina si smonta e la richiesta poi fallisce, non c\'è nessuna segnalazione né eccezione', async () => {
    const onUnhandled = vi.fn();
    process.on('unhandledRejection', onUnhandled);
    const { unmount, result, onError } = setup(vi.fn().mockRejectedValue(new Error('no')));
    act(() => { result.current.schedule(7); });
    unmount();
    await act(async () => { await Promise.resolve(); await Promise.resolve(); });
    process.off('unhandledRejection', onUnhandled);
    expect(onError).not.toHaveBeenCalled();
    expect(onUnhandled).not.toHaveBeenCalled();
  });

  it('usa il commit più recente, anche se cambia fra l\'eliminazione e la scadenza', async () => {
    const vecchio = vi.fn().mockResolvedValue(undefined);
    const nuovo = vi.fn().mockResolvedValue(undefined);
    const hook = renderHook(({ commit }) => useUndoableDelete({ commit }), { initialProps: { commit: vecchio } });
    act(() => { hook.result.current.schedule(7); });
    hook.rerender({ commit: nuovo });
    await act(async () => { vi.advanceTimersByTime(UNDO_DELAY_MS); });
    expect(vecchio).not.toHaveBeenCalled();
    expect(nuovo).toHaveBeenCalledWith(7);
  });
});
