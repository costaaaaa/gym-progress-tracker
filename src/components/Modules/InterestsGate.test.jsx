// Schermata «Cosa ti interessa?»: compare una volta sola dopo la conferma dell'email, a chi non ha ancora scelto i
// moduli. Lo stato di AuthContext è finto (con uno stato vero, perché updateUser deve cambiare ciò che la Home legge);
// la fetch è il confine.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { useState } from 'react';
import InterestsGate from './InterestsGate';
import { useModule } from '../../hooks/useModule';
import { ThemeModeProvider } from '../../context/ThemeModeContext';
import { json } from '../../test/dom';
import { DRAFT_STORAGE_KEY } from '../../utils/focusDraft';

const auth = vi.hoisted(() => ({ value: null, set: null }));
vi.mock('../../context/AuthContext', () => ({ useAuth: () => auth.value }));

const NONE = { body: false, recovery: false, levels: false, groups: false, ai: false };
const verified = { verified: true, blocked: false };
const updateUser = vi.fn();

let settings;
const saved = () => fetch.mock.calls.filter(([url]) => url.includes('update_settings.php')).map(([, init]) => JSON.parse(init.body));

// Ciò che la Home legge: un modulo attivo si vede
const Probe = () => <p>{`misure ${useModule('body') ? 'si' : 'no'}, livelli ${useModule('levels') ? 'si' : 'no'}, gruppi ${useModule('groups') ? 'si' : 'no'}`}</p>;

const Harness = ({ initial }) => {
  const [state, setState] = useState(initial);
  auth.set = (patch) => setState((s) => ({ ...s, ...patch }));
  auth.value = {
    ...state,
    updateUser: (patch) => { updateUser(patch); setState((s) => ({ ...s, user: { ...s.user, ...patch } })); },
  };
  return <ThemeModeProvider><InterestsGate /><Probe /></ThemeModeProvider>;
};
const baseState = (user = {}, emailState = verified) => ({
  isLoggedIn: true, emailState, user: { id: 1, modules: NONE, modules_chosen: false, ...user },
});
const mount = (state = baseState()) => render(<Harness initial={state} />);
const dialog = () => screen.queryByRole('dialog', { name: 'Cosa ti interessa?' });

beforeEach(() => {
  updateUser.mockClear();
  localStorage.clear();
  localStorage.setItem('themeMode', 'light');
  settings = (body) => json({ success: true, modules: { ...NONE, ...body.modules }, modules_chosen: true });
  vi.stubGlobal('fetch', vi.fn((url, init) => Promise.resolve(url.includes('update_settings.php') ? settings(JSON.parse(init.body)) : json({}, 404))));
});
afterEach(() => vi.unstubAllGlobals());

describe('quando compare', () => {
  it('con email confermata e modules_chosen === false: titolo, riga, tre scelte non selezionate, due pulsanti', () => {
    mount();
    const d = dialog();
    expect(d).toBeTruthy();
    expect(screen.getByText("Scegli cosa vedere nell'app. Puoi cambiare idea quando vuoi dalla sezione moduli dell'account.")).toBeTruthy();
    const boxes = screen.getAllByRole('checkbox');
    expect(boxes.map((b) => b.getAttribute('aria-label') ?? b.closest('label')?.textContent ?? '')).toHaveLength(3);
    expect(screen.getByRole('checkbox', { name: 'Peso e misure' }).checked).toBe(false);
    expect(screen.getByRole('checkbox', { name: 'Amici o palestra' }).checked).toBe(false);
    expect(screen.getByRole('checkbox', { name: 'Livelli, traguardi e streak' }).checked).toBe(false);
    expect(screen.getByRole('checkbox', { name: 'Peso e misure' }).getAttribute('aria-describedby')).toBeTruthy();
    expect(screen.getByText('Peso, grasso e circonferenze nel tempo.')).toBeTruthy();
    expect(screen.getByText('Gruppi con classifica della settimana.')).toBeTruthy();
    expect(screen.getByText('Punti, livelli e giorni di fila.')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Continua' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Salta' })).toBeTruthy();
  });

  it('il fuoco entra nella finestra', () => {
    mount();
    expect(dialog().contains(document.activeElement)).toBe(true);
  });

  it.each([
    ['email non confermata', baseState({}, { verified: false, blocked: false })],
    ['app bloccata', baseState({}, { verified: false, blocked: true })],
    ['stato email non ancora letto', baseState({}, null)],
    ['modules_chosen vero', baseState({ modules_chosen: true })],
    ['modules_chosen assente (copia vecchia o server vecchio)', baseState({ modules_chosen: undefined })],
    ['utente non entrato', { ...baseState(), isLoggedIn: false }],
  ])('non compare con %s', (_n, state) => {
    mount(state);
    expect(dialog()).toBeNull();
  });

  it('non compare con un allenamento Focus in corso, nemmeno dopo, finché la pagina non si riapre', () => {
    localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify({ selectedDay: 'A', startTime: Date.now() }));
    mount();
    expect(dialog()).toBeNull();
    localStorage.removeItem(DRAFT_STORAGE_KEY);
    act(() => auth.set({ user: { id: 1, modules: NONE, modules_chosen: false, x: 1 } }));
    expect(dialog()).toBeNull();
  });

  it('compare alla conferma del codice, senza ricaricare', () => {
    mount(baseState({}, { verified: false, blocked: false }));
    expect(dialog()).toBeNull();
    act(() => auth.set({ emailState: verified }));
    expect(dialog()).toBeTruthy();
  });
});

describe('scelta', () => {
  it('«Continua» con due scelte manda esattamente quei moduli e la chiusura, poi la Home li mostra', async () => {
    mount();
    fireEvent.click(screen.getByRole('checkbox', { name: 'Peso e misure' }));
    fireEvent.click(screen.getByRole('checkbox', { name: 'Livelli, traguardi e streak' }));
    expect(screen.getByRole('checkbox', { name: 'Peso e misure' }).checked).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: 'Continua' }));
    await waitFor(() => expect(dialog()).toBeNull());
    expect(saved()).toEqual([{ modules: { body: true, levels: true }, modules_chosen: true }]);
    expect(screen.getByText('misure si, livelli si, gruppi no')).toBeTruthy();
    expect(updateUser).toHaveBeenCalledWith(expect.objectContaining({ modules_chosen: true }));
  });

  it('«Salta» manda solo la chiusura e lascia tutto non attivo', async () => {
    mount();
    fireEvent.click(screen.getByRole('button', { name: 'Salta' }));
    await waitFor(() => expect(dialog()).toBeNull());
    expect(saved()).toEqual([{ modules_chosen: true }]);
    expect(screen.getByText('misure no, livelli no, gruppi no')).toBeTruthy();
  });

  it('«Continua» senza scelte vale come «Salta»', async () => {
    mount();
    fireEvent.click(screen.getByRole('button', { name: 'Continua' }));
    await waitFor(() => expect(dialog()).toBeNull());
    expect(saved()).toEqual([{ modules_chosen: true }]);
  });

  it('errore del server: messaggio dentro la finestra, finestra aperta, si può riprovare', async () => {
    settings = () => json({ success: false }, 500);
    mount();
    fireEvent.click(screen.getByRole('checkbox', { name: 'Amici o palestra' }));
    fireEvent.click(screen.getByRole('button', { name: 'Continua' }));
    expect(await screen.findByRole('alert')).toBeTruthy();
    expect(dialog().contains(screen.getByRole('alert'))).toBe(true);
    expect(updateUser).not.toHaveBeenCalled();
    expect(screen.getByRole('checkbox', { name: 'Amici o palestra' }).checked).toBe(true);
    settings = (body) => json({ success: true, modules: { ...NONE, ...body.modules }, modules_chosen: true });
    fireEvent.click(screen.getByRole('button', { name: 'Continua' }));
    await waitFor(() => expect(dialog()).toBeNull());
    expect(saved()).toHaveLength(2);
  });

  it('doppio clic: una sola chiamata, con aria-busy durante il salvataggio', async () => {
    let release;
    settings = (body) => new Promise((resolve) => { release = () => resolve(json({ success: true, modules: { ...NONE, ...body.modules }, modules_chosen: true })); });
    mount();
    const go = screen.getByRole('button', { name: 'Continua' });
    fireEvent.click(go);
    fireEvent.click(go);
    fireEvent.click(screen.getByRole('button', { name: 'Salta' }));
    expect(saved()).toHaveLength(1);
    expect(screen.getByRole('button', { name: 'Continua' }).getAttribute('aria-busy')).toBe('true');
    await act(async () => release());
    await waitFor(() => expect(dialog()).toBeNull());
  });

  it('Esc e il clic fuori non chiudono la finestra', () => {
    mount();
    fireEvent.keyDown(dialog(), { key: 'Escape', code: 'Escape' });
    fireEvent.click(document.querySelector('.MuiBackdrop-root'));
    expect(dialog()).toBeTruthy();
    expect(saved()).toEqual([]);
  });
});
