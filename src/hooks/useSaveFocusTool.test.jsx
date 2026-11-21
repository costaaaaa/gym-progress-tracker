// Salvataggio degli strumenti della serie: un solo punto, l'account riceve solo il valore salvato.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useSaveFocusTool } from './useSaveFocusTool';
import { json } from '../test/dom';

const auth = vi.hoisted(() => ({ value: {} }));
vi.mock('../context/AuthContext', () => ({ useAuth: () => auth.value }));

const TOOLS = { technique: true, suggested_weight: true };
const updateUser = vi.fn();

beforeEach(() => {
  updateUser.mockClear();
  auth.value = { user: { id: 1, focus_tools: TOOLS, rest_timer_enabled: true }, updateUser };
});
afterEach(() => vi.unstubAllGlobals());

const answer = (body, status = 200) => vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(json(body, status))));
const sent = () => JSON.parse(fetch.mock.calls[0][1].body);

describe('useSaveFocusTool', () => {
  it('il timer manda rest_timer_enabled e mette nell\'account solo quel valore', async () => {
    answer({ success: true, rest_timer_enabled: false, focus_tools: TOOLS });
    const { result } = renderHook(() => useSaveFocusTool());
    let res;
    await act(async () => { res = await result.current('rest_timer', false); });
    expect(sent()).toEqual({ rest_timer_enabled: false });
    expect(String(fetch.mock.calls[0][0])).toContain('api/user/update_settings.php');
    expect(res.ok).toBe(true);
    expect(updateUser).toHaveBeenCalledTimes(1);
    expect(updateUser).toHaveBeenCalledWith({ rest_timer_enabled: false });
  });

  it('un altro strumento manda la sola sua chiave in focus_tools e mette nell\'account l\'elenco con quel valore', async () => {
    answer({ success: true, rest_timer_enabled: true, focus_tools: { ...TOOLS, technique: false } });
    const { result } = renderHook(() => useSaveFocusTool());
    await act(async () => { await result.current('technique', false); });
    expect(sent()).toEqual({ focus_tools: { technique: false } });
    expect(updateUser).toHaveBeenCalledWith({ focus_tools: { ...TOOLS, technique: false } });
  });

  it('due salvataggi con le risposte in ordine inverso: ogni risposta aggiorna solo la sua chiave', async () => {
    const finish = [];
    vi.stubGlobal('fetch', vi.fn(() => new Promise((resolve) => { finish.push(resolve); })));
    const { result } = renderHook(() => useSaveFocusTool());
    let first;
    let second;
    act(() => { first = result.current('technique', false); second = result.current('suggested_weight', false); });
    await act(async () => { finish[1](json({ success: true, focus_tools: { technique: false, suggested_weight: false } })); await second; });
    await act(async () => { finish[0](json({ success: true, focus_tools: { technique: false, suggested_weight: true } })); await first; });
    expect(updateUser).toHaveBeenLastCalledWith({ focus_tools: { technique: false, suggested_weight: false } });
  });

  it('un account senza elenco riceve l\'elenco intero del server', async () => {
    auth.value = { user: { id: 1 }, updateUser };
    const full = { technique: true, suggested_weight: false };
    answer({ success: true, focus_tools: full });
    const { result } = renderHook(() => useSaveFocusTool());
    await act(async () => { await result.current('suggested_weight', false); });
    expect(updateUser).toHaveBeenCalledWith({ focus_tools: full });
  });

  it.each([
    ['errore del server', () => Promise.resolve(json({ success: false }, 400))],
    ['rete che cade', () => Promise.reject(new TypeError('rete'))],
    ['risposta senza il valore', () => Promise.resolve(json({ success: true }))],
  ])('%s: ok false e l\'account non cambia', async (_name, reply) => {
    vi.stubGlobal('fetch', vi.fn(reply));
    const { result } = renderHook(() => useSaveFocusTool());
    for (const tool of ['rest_timer', 'technique']) {
      let res;
      await act(async () => { res = await result.current(tool, false); });
      expect(res.ok).toBe(false);
    }
    expect(updateUser).not.toHaveBeenCalled();
  });
});
