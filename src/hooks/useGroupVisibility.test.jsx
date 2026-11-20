// Salvataggio della visibilità nei gruppi: oggetto parziale, l'account riceve solo le chiavi salvate sopra quelle che ha già.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useSaveGroupVisibility } from './useGroupVisibility';
import { json } from '../test/dom';

const auth = vi.hoisted(() => ({ value: {} }));
vi.mock('../context/AuthContext', () => ({ useAuth: () => auth.value }));

const ALL = { workouts: true, volume: true, streak: true, level: true };
const updateUser = vi.fn();

beforeEach(() => {
  updateUser.mockClear();
  auth.value = { user: { id: 1, group_visibility: ALL }, updateUser };
});
afterEach(() => vi.unstubAllGlobals());

describe('useSaveGroupVisibility', () => {
  it('manda solo le chiavi cambiate e mette nell\'account l\'elenco aggiornato', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(json({ success: true, group_visibility: { ...ALL, volume: false } }))));
    const { result } = renderHook(() => useSaveGroupVisibility());
    let res;
    await act(async () => { res = await result.current({ volume: false }); });
    expect(JSON.parse(fetch.mock.calls[0][1].body)).toEqual({ group_visibility: { volume: false } });
    expect(String(fetch.mock.calls[0][0])).toContain('api/user/update_settings.php');
    expect(res.ok).toBe(true);
    expect(updateUser).toHaveBeenCalledWith({ group_visibility: { ...ALL, volume: false } });
  });

  it('due salvataggi con le risposte in ordine inverso: ogni risposta aggiorna solo la sua chiave', async () => {
    const finish = [];
    vi.stubGlobal('fetch', vi.fn(() => new Promise((resolve) => { finish.push(resolve); })));
    const { result } = renderHook(() => useSaveGroupVisibility());
    let first;
    let second;
    act(() => { first = result.current({ volume: false }); second = result.current({ streak: false }); });
    // Il server li ha applicati in ordine: la seconda risposta li ha entrambi, la prima solo il primo, ma arriva dopo
    await act(async () => { finish[1](json({ success: true, group_visibility: { ...ALL, volume: false, streak: false } })); await second; });
    await act(async () => { finish[0](json({ success: true, group_visibility: { ...ALL, volume: false } })); await first; });
    expect(updateUser).toHaveBeenLastCalledWith({ group_visibility: { ...ALL, volume: false, streak: false } });
  });

  it('un account senza elenco (subito dopo il login) riceve l\'elenco intero del server', async () => {
    auth.value = { user: { id: 1 }, updateUser };
    const full = { ...ALL, level: false };
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(json({ success: true, group_visibility: full }))));
    const { result } = renderHook(() => useSaveGroupVisibility());
    await act(async () => { await result.current({ level: false }); });
    expect(updateUser).toHaveBeenCalledWith({ group_visibility: full });
  });

  it.each([
    ['errore del server', () => Promise.resolve(json({ success: false }, 400))],
    ['rete che cade', () => Promise.reject(new TypeError('rete'))],
    ['risposta senza group_visibility', () => Promise.resolve(json({ success: true }))],
  ])('%s: ok false e l\'account non cambia', async (_name, answer) => {
    vi.stubGlobal('fetch', vi.fn(answer));
    const { result } = renderHook(() => useSaveGroupVisibility());
    let res;
    await act(async () => { res = await result.current({ volume: false }); });
    expect(res.ok).toBe(false);
    expect(updateUser).not.toHaveBeenCalled();
  });
});
