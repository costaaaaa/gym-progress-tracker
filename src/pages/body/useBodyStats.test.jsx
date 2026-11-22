// Le misure corporee: lettura, consenso richiesto, lettura fallita, salvataggio ed eliminazione che rileggono.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import useBodyStats from './useBodyStats';
import { json } from '../../test/dom';

const rows = [{ id: '1', date: '2026-10-15', weight: '80.0' }];

// Un'unica fetch finta: ogni indirizzo ha la sua risposta (una funzione, così può cambiare tra una chiamata e l'altra)
let replies;
const calls = (name) => fetch.mock.calls.filter(([url]) => url.endsWith(`user_stats/${name}.php`));

beforeEach(() => {
  vi.spyOn(console, 'error').mockImplementation(() => {});
  replies = { read: () => json({ records: rows }) };
  vi.stubGlobal('fetch', vi.fn((url) => {
    const name = Object.keys(replies).find((key) => url.endsWith(`user_stats/${key}.php`));
    try { return Promise.resolve(replies[name]()); } catch (error) { return Promise.reject(error); }
  }));
});
afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });

const mount = async () => {
  const hook = renderHook(() => useBodyStats());
  await waitFor(() => expect(hook.result.current.loading).toBe(false));
  return hook;
};

describe('useBodyStats', () => {
  it('parte in caricamento senza righe, poi dà le righe del server', async () => {
    const hook = renderHook(() => useBodyStats());
    expect(hook.result.current.loading).toBe(true);
    expect(hook.result.current.stats).toEqual([]);
    await waitFor(() => expect(hook.result.current.loading).toBe(false));
    expect(hook.result.current.stats).toEqual(rows);
    expect(hook.result.current.loadFailed).toBe(false);
    expect(hook.result.current.consentRequired).toBe(false);
  });

  it('il server risponde con un errore: loadFailed e nessuna riga, diverso dalle misure vuote', async () => {
    replies.read = () => json({ success: false }, 500);
    const { result } = await mount();
    expect(result.current.loadFailed).toBe(true);
    expect(result.current.stats).toEqual([]);
  });

  it('senza il consenso ai dati sulla salute: consentRequired, righe vuote e, se il testo è cambiato, consentUpdated', async () => {
    replies.read = () => json({ records: [], consent_required: true, consent_updated: true });
    const { result } = await mount();
    expect(result.current.consentRequired).toBe(true);
    expect(result.current.consentUpdated).toBe(true);
    expect(result.current.stats).toEqual([]);
    expect(result.current.loadFailed).toBe(false);
  });

  it('lettura fallita: loadFailed, e refresh la rilegge togliendo l\'errore', async () => {
    let up = false;
    replies.read = () => { if (!up) throw new Error('rete'); return json({ records: rows }); };
    const { result } = await mount();
    expect(result.current.loadFailed).toBe(true);
    expect(result.current.stats).toEqual([]);

    up = true;
    act(() => { result.current.refresh(); });
    expect(result.current.loading).toBe(true);
    expect(result.current.loadFailed).toBe(false);
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.stats).toEqual(rows);
  });

  it('save invia la misurazione e, se il server accetta, rilegge', async () => {
    replies.create = () => json({ message: 'ok' }, 201);
    const { result } = await mount();
    const after = [...rows, { id: '2', date: '2026-10-16', weight: '79.5' }];
    replies.read = () => json({ records: after });

    let outcome;
    await act(async () => { outcome = await result.current.save({ date: '2026-10-16', weight: '79.5' }); });
    expect(outcome).toEqual({ ok: true });
    expect(JSON.parse(calls('create')[0][1].body)).toEqual({ date: '2026-10-16', weight: '79.5' });
    await waitFor(() => expect(result.current.stats).toEqual(after));
    expect(calls('read')).toHaveLength(2);
  });

  it('save rifiutato dal server dà il campo, il tetto e il messaggio, senza rileggere', async () => {
    replies.create = () => json({ message: 'Valore fuori scala', field: 'weight', max: 500 }, 400);
    const { result } = await mount();
    let outcome;
    await act(async () => { outcome = await result.current.save({ weight: '900' }); });
    expect(outcome).toEqual({ ok: false, field: 'weight', max: 500, message: 'Valore fuori scala' });
    expect(calls('read')).toHaveLength(1);
  });

  it('save con la rete caduta dà connection, senza rileggere', async () => {
    replies.create = () => { throw new Error('rete'); };
    const { result } = await mount();
    let outcome;
    await act(async () => { outcome = await result.current.save({ weight: '80' }); });
    expect(outcome).toEqual({ ok: false, connection: true });
    expect(calls('read')).toHaveLength(1);
  });

  it('remove elimina la riga e, se il server accetta, rilegge', async () => {
    replies.delete = () => json({ message: 'ok' });
    const { result } = await mount();
    replies.read = () => json({ records: [] });

    let outcome;
    await act(async () => { outcome = await result.current.remove('1'); });
    expect(outcome).toEqual({ ok: true });
    expect(JSON.parse(calls('delete')[0][1].body)).toEqual({ id: '1' });
    await waitFor(() => expect(result.current.stats).toEqual([]));
    expect(calls('read')).toHaveLength(2);
  });

  it('remove rifiutato o con la rete caduta dà ok false, senza rileggere', async () => {
    replies.delete = () => json({ message: 'no' }, 500);
    const { result } = await mount();
    let outcome;
    await act(async () => { outcome = await result.current.remove('1'); });
    expect(outcome).toEqual({ ok: false });

    replies.delete = () => { throw new Error('rete'); };
    await act(async () => { outcome = await result.current.remove('1'); });
    expect(outcome).toEqual({ ok: false });
    expect(calls('read')).toHaveLength(1);
  });
});
