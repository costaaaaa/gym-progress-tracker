// «Questo modulo è attivo?»: un solo punto, e un utente senza `modules` (copia vecchia, risposta non ancora arrivata) li ha tutti attivi.
import { describe, it, expect, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useModule, isModuleActive } from './useModule';

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
