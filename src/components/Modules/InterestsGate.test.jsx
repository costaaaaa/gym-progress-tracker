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

const Harness = ({ initial, waiting = false }) => {
  const [state, setState] = useState(initial);
  auth.set = (patch) => setState((s) => ({ ...s, ...patch }));
  auth.value = {
    ...state,
    updateUser: (patch) => { updateUser(patch); setState((s) => ({ ...s, user: { ...s.user, ...patch } })); },
  };
  return <ThemeModeProvider><InterestsGate waiting={waiting} /><Probe /></ThemeModeProvider>;
};
const baseState = (user = {}, emailState = verified) => ({
  isLoggedIn: true, emailState, user: { id: 1, modules: NONE, modules_chosen: false, ...user },
});
const mount = (state = baseState(), props = {}) => render(<Harness initial={state} {...props} />);
// Clic fuori dalla finestra: sul contenitore, come lo riceve MUI
const clickOutside = () => {
  const container = document.querySelector('.MuiDialog-container');
  fireEvent.mouseDown(container);
  fireEvent.click(container);
};
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
    clickOutside();
    expect(dialog()).toBeTruthy();
    expect(saved()).toEqual([]);
  });
});

describe("un account dopo l'altro nello stesso montaggio", () => {
  const newUser = (id) => ({ user: { id, modules: NONE, modules_chosen: false } });

  it("dopo un salvataggio dell'utente A, l'utente B vede la finestra vuota e con i pulsanti che rispondono", async () => {
    mount();
    fireEvent.click(screen.getByRole('checkbox', { name: 'Peso e misure' }));
    fireEvent.click(screen.getByRole('button', { name: 'Continua' }));
    await waitFor(() => expect(dialog()).toBeNull());
    act(() => auth.set(newUser(2)));
    expect(dialog()).toBeTruthy();
    screen.getAllByRole('checkbox').forEach((b) => expect(b.checked).toBe(false));
    fetch.mockClear();
    fireEvent.click(screen.getByRole('button', { name: 'Salta' }));
    await waitFor(() => expect(dialog()).toBeNull());
    expect(saved()).toEqual([{ modules_chosen: true }]);
  });

  it("con il Focus in corso per A (rimandata), l'utente B senza Focus vede la finestra", () => {
    localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify({ selectedDay: 'A', startTime: Date.now() }));
    mount();
    expect(dialog()).toBeNull();
    localStorage.removeItem(DRAFT_STORAGE_KEY);
    act(() => auth.set(newUser(2)));
    expect(dialog()).toBeTruthy();
  });
});

describe("in fila con l'avviso di esito", () => {
  it("non si apre finché c'è un avviso in corso, poi sì", () => {
    const { rerender } = mount(baseState(), { waiting: true });
    expect(dialog()).toBeNull();
    rerender(<Harness initial={baseState()} waiting={false} />);
    expect(dialog()).toBeTruthy();
  });
});

describe('Focus e avviso di esito', () => {
  it('dovuta durante l\'avviso: se parte un Focus prima che l\'avviso finisca, la finestra non compare', () => {
    const { rerender } = mount(baseState(), { waiting: true });
    localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify({ selectedDay: 'A', startTime: Date.now() }));
    rerender(<Harness initial={baseState()} waiting={false} />);
    expect(dialog()).toBeNull();
  });
});

describe('avviso che arriva a finestra già decisa', () => {
  it('aperta, poi arriva l\'avviso (sparisce), parte un Focus, l\'avviso finisce: non ricompare', async () => {
    const { rerender } = mount(baseState());
    expect(dialog()).toBeTruthy();
    rerender(<Harness initial={baseState()} waiting />);
    await waitFor(() => expect(dialog()).toBeNull()); // l'uscita della finestra ha una transizione
    localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify({ selectedDay: 'A', startTime: Date.now() }));
    rerender(<Harness initial={baseState()} waiting={false} />);
    expect(dialog()).toBeNull();
  });
});

describe('uscita se il salvataggio fallisce', () => {
  const fail = async () => {
    settings = () => json({ success: false }, 500);
    mount();
    fireEvent.click(screen.getByRole('button', { name: 'Continua' }));
    await screen.findByRole('alert');
  };

  it("senza errore non c'è «Più tardi» e Esc non chiude", () => {
    mount();
    expect(screen.queryByRole('button', { name: 'Più tardi' })).toBeNull();
    fireEvent.keyDown(dialog(), { key: 'Escape', code: 'Escape' });
    expect(dialog()).toBeTruthy();
  });

  it('dopo un errore «Più tardi» chiude e non parte nessuna chiamata', async () => {
    await fail();
    fetch.mockClear();
    fireEvent.click(screen.getByRole('button', { name: 'Più tardi' }));
    await waitFor(() => expect(dialog()).toBeNull());
    expect(saved()).toEqual([]);
  });

  it('dopo un errore anche Esc chiude', async () => {
    await fail();
    fireEvent.keyDown(dialog(), { key: 'Escape', code: 'Escape' });
    await waitFor(() => expect(dialog()).toBeNull());
  });

  it('dopo un errore il clic fuori non chiude', async () => {
    await fail();
    clickOutside();
    expect(dialog()).toBeTruthy();
  });
});
