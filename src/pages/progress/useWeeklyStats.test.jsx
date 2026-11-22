// I dati della settimana nei Progressi: lettura della dashboard, lettura fallita distinta dalla settimana vuota, rilettura.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import useWeeklyStats from './useWeeklyStats';
import { json } from '../../test/dom';

const full = {
  success: true,
  detail: 'full',
  weekly_volume: { total_weight: 4820.5, total_reps: 118 },
  weekly_sets: {
    week: { petto: 12, schiena: 10 },
    previous_to_date: { petto: 8, schiena: 8 },
    previous_total: 61,
  },
  recovery: { petto: { status: 'PRONTO' } },
};

const stubFetch = (reply) => vi.stubGlobal('fetch', vi.fn(() => {
  try { return Promise.resolve(reply()); } catch (error) { return Promise.reject(error); }
}));

beforeEach(() => { vi.spyOn(console, 'error').mockImplementation(() => {}); });
afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });

const mount = async () => {
  const hook = renderHook(() => useWeeklyStats());
  await waitFor(() => expect(hook.result.current.loading).toBe(false));
  return hook;
};

describe('useWeeklyStats', () => {
  it('parte in caricamento senza dati, poi dà volume, serie e confronto della settimana', async () => {
    stubFetch(() => json(full));
    const hook = renderHook(() => useWeeklyStats());
    expect(hook.result.current.loading).toBe(true);
    expect(hook.result.current.stats).toBeNull();
    await waitFor(() => expect(hook.result.current.loading).toBe(false));
    const { stats, loadFailed } = hook.result.current;
    expect(loadFailed).toBe(false);
    expect(stats).toMatchObject({ volumeKg: 4820.5, setsTotal: 22, previousToDate: 16, previousTotal: 61, basic: false });
    expect(stats.sets.week.petto).toBe(12);
    expect(stats.recovery.petto.status).toBe('PRONTO');
  });

  it('piano Gratis (detail basic): il totale delle serie arriva dal server e il confronto non c\'è', async () => {
    stubFetch(() => json({ success: true, detail: 'basic', weekly_volume: { total_weight: 100 }, weekly_sets: { total: 53 }, recovery: {} }));
    const { result } = await mount();
    expect(result.current.stats).toMatchObject({ volumeKg: 100, setsTotal: 53, basic: true });
  });

  it('una settimana senza allenamenti, o un server più vecchio senza i blocchi, vale zero', async () => {
    stubFetch(() => json({ success: true }));
    const { result } = await mount();
    expect(result.current.loadFailed).toBe(false);
    expect(result.current.stats).toMatchObject({ volumeKg: 0, setsTotal: 0, previousToDate: 0, previousTotal: 0, basic: false, recovery: {} });
  });

  it.each([
    ['il server risponde con un errore', () => json({ success: false }, 500)],
    ['il server risponde success false', () => json({ success: false })],
    ['la rete non risponde', () => { throw new Error('rete'); }],
  ])('lettura fallita (%s): loadFailed e nessun dato, distinto dalla settimana a zero', async (_, reply) => {
    stubFetch(reply);
    const { result } = await mount();
    expect(result.current.loadFailed).toBe(true);
    expect(result.current.stats).toBeNull();
  });

  it('refresh rilegge: torna in caricamento e, se riesce, toglie l\'errore e dà i dati', async () => {
    let up = false;
    stubFetch(() => { if (!up) throw new Error('rete'); return json(full); });
    const { result } = await mount();
    expect(result.current.loadFailed).toBe(true);

    up = true;
    act(() => { result.current.refresh(); });
    expect(result.current.loading).toBe(true);
    expect(result.current.loadFailed).toBe(false);
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.loadFailed).toBe(false);
    expect(result.current.stats.setsTotal).toBe(22);
  });
});
