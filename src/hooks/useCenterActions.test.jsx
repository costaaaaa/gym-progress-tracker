// L'elenco delle azioni del pulsante centrale (telefono) e del pulsante diviso (desktop): un solo punto lo costruisce.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useCenterActions } from './useCenterActions';
import { DRAFT_STORAGE_KEY } from '../utils/focusDraft';

const auth = vi.hoisted(() => ({ user: { username: 'atleta_demo' } }));
vi.mock('../context/AuthContext', () => ({ useAuth: () => ({ user: auth.user }) }));

beforeEach(() => {
  localStorage.clear();
  auth.user = { username: 'atleta_demo' };
});

const keys = (items) => items.map((item) => item.key);

describe('azioni del pulsante centrale', () => {
  it('con il modulo Misure spento sono due: Inizia e Registra', () => {
    auth.user = { username: 'atleta_demo', modules: { body: false } };
    const { result } = renderHook(() => useCenterActions());
    expect(keys(result.current)).toEqual(['start', 'record']);
  });

  it('con il modulo Misure attivo sono tre, Inizia per prima e unica principale', () => {
    const { result } = renderHook(() => useCenterActions());
    expect(keys(result.current)).toEqual(['start', 'record', 'measure']);
    expect(result.current.filter((item) => item.main).map((item) => item.key)).toEqual(['start']);
  });

  it('Inizia porta al Focus; Registra e Misura portano alla pagina e le chiedono di aprire la finestra', () => {
    const { result } = renderHook(() => useCenterActions());
    const [start, record, measure] = result.current;
    expect(start).toMatchObject({ to: '/focus', label: 'Inizia allenamento', shortLabel: 'Inizia' });
    expect(record).toMatchObject({ to: '/storico', state: { openRecord: true }, label: 'Registra allenamento passato', shortLabel: 'Registra' });
    expect(measure).toMatchObject({ to: '/dashboard?tab=body', state: { openMeasure: true }, label: 'Nuova misura', shortLabel: 'Misura' });
    for (const item of result.current) expect(item.Icon).toBeTruthy();
  });

  it('con un allenamento a metà la prima voce diventa Riprendi', () => {
    localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify({ selectedDay: { id: 1 }, startTime: 1 }));
    const { result } = renderHook(() => useCenterActions());
    expect(result.current[0]).toMatchObject({ key: 'start', to: '/focus', label: 'Riprendi allenamento', shortLabel: 'Riprendi' });
  });

  it('la bozza si rilegge a ogni render, non una volta sola', () => {
    const { result, rerender } = renderHook(() => useCenterActions());
    expect(result.current[0].shortLabel).toBe('Inizia');
    localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify({ selectedDay: { id: 1 }, startTime: 1 }));
    rerender();
    expect(result.current[0].shortLabel).toBe('Riprendi');
  });
});
