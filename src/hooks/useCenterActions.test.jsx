// L'elenco delle azioni del pulsante centrale (telefono) e del pulsante diviso (desktop): un solo punto lo costruisce.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import DirectionsRunIcon from '@mui/icons-material/DirectionsRun';
import { useCenterActions, registerCenterAction } from './useCenterActions';
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

describe('azioni aggiunte da fuori', () => {
  const action = (key) => ({ key, label: key, shortLabel: key, Icon: DirectionsRunIcon, onSelect: () => {} });
  // Il registro è uno solo per tutto il file: ogni voce registrata si toglie a fine test, anche se il test fallisce
  const removers = [];
  const register = (item) => {
    const remove = registerCenterAction(item);
    removers.push(remove);
    return remove;
  };
  afterEach(() => { act(() => removers.splice(0).forEach((remove) => remove())); });

  it('una voce registrata segue quelle di base e si toglie con la funzione restituita', () => {
    const { result } = renderHook(() => useCenterActions());
    let remove;
    act(() => { remove = register(action('cardio')); });
    expect(keys(result.current)).toEqual(['start', 'record', 'measure', 'cardio']);
    expect(result.current[3]).toMatchObject({ key: 'cardio', label: 'cardio', shortLabel: 'cardio', Icon: DirectionsRunIcon });
    act(() => remove());
    expect(keys(result.current)).toEqual(['start', 'record', 'measure']);
  });

  it('le voci registrate restano in ordine di registrazione', () => {
    const { result } = renderHook(() => useCenterActions());
    act(() => { register(action('cardio')); register(action('yoga')); });
    expect(keys(result.current).slice(3)).toEqual(['cardio', 'yoga']);
  });

  it('togliere due volte la stessa voce non toglie le altre', () => {
    const { result } = renderHook(() => useCenterActions());
    let removeCardio;
    act(() => { removeCardio = register(action('cardio')); register(action('yoga')); });
    act(() => { removeCardio(); removeCardio(); });
    expect(keys(result.current).slice(3)).toEqual(['yoga']);
  });

  it('l\'elenco non supera mai le 5 voci: le registrate oltre la quinta non si mostrano', () => {
    const { result } = renderHook(() => useCenterActions());
    act(() => { register(action('a')); register(action('b')); register(action('c')); });
    expect(keys(result.current)).toEqual(['start', 'record', 'measure', 'a', 'b']);
  });

  it('una voce registrata non è mai la principale, anche se lo dice', () => {
    const { result } = renderHook(() => useCenterActions());
    act(() => { register({ ...action('cardio'), main: true }); });
    expect(result.current.filter((item) => item.main).map((item) => item.key)).toEqual(['start']);
  });
});
