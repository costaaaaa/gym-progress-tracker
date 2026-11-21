// «Questo modulo è attivo?»: un solo punto, e un utente senza `modules` (copia vecchia, risposta non ancora arrivata) li ha tutti attivi.
import { describe, it, expect, vi, afterEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useModule, isModuleActive, useSaveModules } from './useModule';
import { json } from '../test/dom';

const auth = vi.hoisted(() => ({ value: {} }));
vi.mock('../context/AuthContext', () => ({ useAuth: () => auth.value }));

const active = (key) => renderHook(() => useModule(key)).result.current;

describe('useModule', () => {
  it('un utente senza modules ha tutto attivo', () => {
    auth.value = { user: { id: 1 } };
    expect(['body', 'recovery', 'levels', 'groups', 'ai'].map(active)).toEqual([true, true, true, true, true]);
  });

  it('senza utente (non ancora letto o sloggato) è tutto attivo', () => {
    auth.value = { user: null };
    expect(active('groups')).toBe(true);
  });

  it('un modulo a false non è attivo, gli altri restano attivi', () => {
    auth.value = { user: { modules: { body: true, recovery: true, levels: false, groups: true, ai: true } } };
    expect(active('levels')).toBe(false);
    expect(active('groups')).toBe(true);
  });

  it('una chiave assente da modules vale attiva', () => {
    auth.value = { user: { modules: { groups: false } } };
    expect(active('body')).toBe(true);
    expect(active('groups')).toBe(false);
  });

  it('isModuleActive vale anche fuori da un componente', () => {
    expect(isModuleActive({ modules: { body: false } }, 'body')).toBe(false);
    expect(isModuleActive(undefined, 'body')).toBe(true);
  });
});

// Risposta alla proposta di un modulo: stesso punto di salvataggio dei moduli
describe('useSaveModules: risposta alla proposta', () => {
  const MODULES = { body: true, recovery: true, levels: false, groups: false, ai: true };
  const answer = async (offerAnswer, reply) => {
    const updateUser = vi.fn();
    auth.value = { user: { modules: MODULES, module_offer: offerAnswer.key }, updateUser };
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(reply)));
    const { result } = renderHook(() => useSaveModules());
    const res = await result.current({}, { offerAnswer });
    return { res, updateUser, body: JSON.parse(fetch.mock.calls[0][1].body) };
  };
  afterEach(() => vi.unstubAllGlobals());

  it('accettata: manda solo module_offer_answer, il modulo si attiva e la proposta è quella della risposta', async () => {
    const { res, updateUser, body } = await answer({ key: 'levels', accepted: true }, json({ success: true, modules: { ...MODULES, levels: true }, module_offer: 'groups' }));
    expect(body).toEqual({ module_offer_answer: { key: 'levels', accepted: true } });
    expect(res.ok).toBe(true);
    expect(updateUser).toHaveBeenCalledWith({ modules: { ...MODULES, levels: true }, module_offer: 'groups' });
  });

  it('rifiutata: i moduli non cambiano, la proposta è quella della risposta (di norma null)', async () => {
    const { updateUser, body } = await answer({ key: 'levels', accepted: false }, json({ success: true, modules: MODULES, module_offer: null }));
    expect(body).toEqual({ module_offer_answer: { key: 'levels', accepted: false } });
    expect(updateUser).toHaveBeenCalledWith({ module_offer: null });
  });

  it('errore (400): ok falso e l\'account non cambia', async () => {
    const { res, updateUser } = await answer({ key: 'levels', accepted: true }, json({ success: false }, 400));
    expect(res.ok).toBe(false);
    expect(updateUser).not.toHaveBeenCalled();
  });
});
