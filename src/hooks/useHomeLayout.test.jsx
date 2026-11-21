// Layout della Home in modifica: lo schermo cambia subito, il layout intero va al server una richiesta alla volta
// (se ne parte un'altra mentre una è in volo vale l'ultima), un salvataggio fallito riporta all'ultimo salvato.
import { describe, it, expect, vi, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useState } from 'react';
import { useHomeLayout } from './useHomeLayout';
import { HOME_BLOCKS, moveBlock, setHidden } from '../utils/homeLayout';
import { json } from '../test/dom';

const auth = vi.hoisted(() => ({ value: null }));
vi.mock('../context/AuthContext', () => ({ useAuth: () => auth.value }));

const keys = (layout) => layout.map((entry) => entry.key);

// Un fetch finto con risposte che si sbloccano a mano: `answers[i](reply)` risponde alla richiesta i
const stubSave = () => {
  const answers = [];
  const fake = vi.fn(() => new Promise((resolve) => { answers.push(resolve); }));
  vi.stubGlobal('fetch', fake);
  const bodies = () => fake.mock.calls.map(([, init]) => JSON.parse(init.body).home_layout);
  const ok = (i) => answers[i](json({ success: true, home_layout: bodies()[i] }));
  const fail = (i) => answers[i](json({ success: false }, 500));
  return { fake, bodies, ok, fail };
};

const setup = (homeLayout = null) => {
  const updateUser = vi.fn();
  const hook = renderHook(() => {
    const [user, setUser] = useState({ id: 1, home_layout: homeLayout });
    auth.value = { user, updateUser: (patch) => { updateUser(patch); setUser((u) => ({ ...u, ...patch })); } };
    return useHomeLayout();
  });
  return { ...hook, updateUser };
};

afterEach(() => vi.unstubAllGlobals());

describe('useHomeLayout', () => {
  it('senza modifiche è il layout effettivo dell\'account', () => {
    const { result } = setup([{ key: 'body', hidden: true, large: false }]);
    expect(keys(result.current.layout)).toEqual(['body', 'last', 'levels', 'groups', 'recovery']);
  });

  it('lo schermo cambia subito; il layout intero va al server e l\'account riceve quello confermato', async () => {
    const save = stubSave();
    const { result, updateUser } = setup();
    act(() => { result.current.change((layout) => moveBlock(layout, 'last', 1)); });
    expect(keys(result.current.layout)).toEqual(['levels', 'last', 'groups', 'recovery', 'body']);
    expect(save.bodies()).toEqual([result.current.layout]);
    await act(async () => { save.ok(0); });
    await waitFor(() => expect(updateUser).toHaveBeenCalledWith({ home_layout: result.current.layout }));
    expect(keys(result.current.layout)).toEqual(['levels', 'last', 'groups', 'recovery', 'body']);
    expect(result.current.error).toBe(false);
  });

  it('due mosse rapide: una richiesta alla volta, parte l\'ultima, e la risposta della prima non riporta indietro', async () => {
    const save = stubSave();
    const { result } = setup();
    act(() => { result.current.change((layout) => moveBlock(layout, 'last', 1)); });
    act(() => { result.current.change((layout) => setHidden(layout, 'body', true)); });
    act(() => { result.current.change((layout) => moveBlock(layout, 'last', 1)); });
    expect(save.fake).toHaveBeenCalledTimes(1);
    await act(async () => { save.ok(0); });
    await waitFor(() => expect(save.fake).toHaveBeenCalledTimes(2));
    // La seconda richiesta porta tutte e tre le mosse
    expect(keys(save.bodies()[1])).toEqual(['levels', 'groups', 'last', 'recovery', 'body']);
    expect(save.bodies()[1].find((entry) => entry.key === 'body').hidden).toBe(true);
    expect(keys(result.current.layout)).toEqual(['levels', 'groups', 'last', 'recovery', 'body']);
    await act(async () => { save.ok(1); });
    await waitFor(() => expect(save.fake).toHaveBeenCalledTimes(2));
    expect(keys(result.current.layout)).toEqual(['levels', 'groups', 'last', 'recovery', 'body']);
  });

  it('un salvataggio fallito riporta all\'ultimo layout salvato e segnala l\'errore; un cambio successivo lo toglie', async () => {
    const save = stubSave();
    const { result, updateUser } = setup();
    act(() => { result.current.change((layout) => moveBlock(layout, 'last', 1)); });
    await act(async () => { save.fail(0); });
    await waitFor(() => expect(result.current.error).toBe(true));
    expect(keys(result.current.layout)).toEqual(HOME_BLOCKS);
    expect(updateUser).not.toHaveBeenCalled();
    act(() => { result.current.change((layout) => moveBlock(layout, 'body', -1)); });
    expect(result.current.error).toBe(false);
    expect(keys(result.current.layout)).toEqual(['last', 'levels', 'groups', 'body', 'recovery']);
  });

  it('se fallisce il salvataggio con una mossa già in attesa, anche quella torna indietro', async () => {
    const save = stubSave();
    const { result } = setup();
    act(() => { result.current.change((layout) => moveBlock(layout, 'last', 1)); });
    act(() => { result.current.change((layout) => moveBlock(layout, 'body', -1)); });
    await act(async () => { save.fail(0); });
    await waitFor(() => expect(result.current.error).toBe(true));
    expect(keys(result.current.layout)).toEqual(HOME_BLOCKS);
    expect(save.fake).toHaveBeenCalledTimes(1);
  });
});
