// Interruttori degli «Strumenti della serie»: nomi e stati dell'account, salvataggio immediato (la fetch è il confine,
// lo stato dell'account è un finto), esito annunciato, errore con ritorno al valore di prima, secondo cambio ignorato.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { useState } from 'react';
import FocusToolsOptions from './FocusToolsOptions';
import { ThemeModeProvider } from '../../context/ThemeModeContext';
import { json } from '../../test/dom';
import { describedBy } from '../../test/accessibleNames';

const auth = vi.hoisted(() => ({ value: null }));
vi.mock('../../context/AuthContext', () => ({ useAuth: () => auth.value }));

const TOOLS = { technique: true, suggested_weight: true };
const notify = vi.fn();
let settings;

beforeEach(() => {
  notify.mockClear();
  settings = (body) => json({ success: true, rest_timer_enabled: body.rest_timer_enabled ?? true, focus_tools: { ...TOOLS, ...body.focus_tools } });
  localStorage.setItem('themeMode', 'light');
  vi.stubGlobal('fetch', vi.fn((url, init) => Promise.resolve(settings(JSON.parse(init.body)))));
});
afterEach(() => vi.unstubAllGlobals());

const Harness = ({ initial, inline = false }) => {
  const [user, setUser] = useState(initial);
  auth.value = { user, updateUser: (patch) => setUser((u) => ({ ...u, ...patch })) };
  return <ThemeModeProvider><FocusToolsOptions notify={inline ? undefined : notify} idPrefix="test-tools" /></ThemeModeProvider>;
};
const mount = (user = { id: 1 }) => render(<Harness initial={user} />);
const mountInline = (user = { id: 1 }) => render(<Harness initial={user} inline />);
const sw = (name) => screen.getByRole('switch', { name });
const saved = () => fetch.mock.calls.map(([, init]) => JSON.parse(init.body));

describe('stato', () => {
  it('tre interruttori nell\'ordine timer, tecnica, peso suggerito, nello stato dell\'account', () => {
    mount({ id: 1, rest_timer_enabled: false, focus_tools: { technique: true, suggested_weight: false } });
    expect(screen.getAllByRole('switch').map((s) => s.getAttribute('aria-label'))).toEqual(['Timer di recupero', 'Tecnica di intensità', 'Peso suggerito']);
    expect(sw('Timer di recupero').checked).toBe(false);
    expect(sw('Tecnica di intensità').checked).toBe(true);
    expect(sw('Peso suggerito').checked).toBe(false);
  });

  it('account senza i campi: tutto acceso', () => {
    mount();
    screen.getAllByRole('switch').forEach((s) => expect(s.checked).toBe(true));
  });

  it('ogni interruttore ha la sua riga di aiuto (aria-describedby) e una zona di tocco di almeno 44 px', () => {
    mount();
    expect(describedBy(sw('Timer di recupero'))).toBe('Disattiva se usi un timer dedicato o l\'orologio della palestra');
    expect(describedBy(sw('Tecnica di intensità'))).toBe('La riga per segnare drop set, rest pause, myo-reps e negative');
    expect(describedBy(sw('Peso suggerito'))).toBe('Ti propone il peso più alto dell\'ultima volta');
    screen.getAllByRole('switch').forEach((s) => expect(parseInt(getComputedStyle(s.closest('label')).minHeight, 10)).toBeGreaterThanOrEqual(44));
  });
});

describe('salvataggio', () => {
  it.each([
    ['Timer di recupero', { rest_timer_enabled: false }, 'Timer di recupero: spento'],
    ['Tecnica di intensità', { focus_tools: { technique: false } }, 'Tecnica di intensità: spento'],
    ['Peso suggerito', { focus_tools: { suggested_weight: false } }, 'Peso suggerito: spento'],
  ])('%s: salva subito la chiave giusta e lo annuncia', async (name, body, message) => {
    mount();
    fireEvent.click(sw(name));
    await waitFor(() => expect(notify).toHaveBeenCalledWith(message, 'success'));
    expect(saved()).toEqual([body]);
    expect(sw(name).checked).toBe(false);
  });

  it('riaccendendo annuncia «acceso»', async () => {
    mount({ id: 1, focus_tools: { technique: false, suggested_weight: true } });
    fireEvent.click(sw('Tecnica di intensità'));
    await waitFor(() => expect(notify).toHaveBeenCalledWith('Tecnica di intensità: acceso', 'success'));
    expect(saved()).toEqual([{ focus_tools: { technique: true } }]);
  });

  it('errore: l\'interruttore torna com\'era e l\'errore è annunciato', async () => {
    settings = () => json({ success: false }, 500);
    mount();
    fireEvent.click(sw('Peso suggerito'));
    await waitFor(() => expect(notify).toHaveBeenCalledWith('Errore nel salvataggio. Riprova.', 'error'));
    expect(sw('Peso suggerito').checked).toBe(true);
  });

  it('un secondo cambio dello stesso strumento durante il salvataggio è ignorato', async () => {
    let finish;
    settings = () => new Promise((resolve) => { finish = () => resolve(json({ success: true, rest_timer_enabled: true, focus_tools: { ...TOOLS, technique: false } })); });
    mount();
    fireEvent.click(sw('Tecnica di intensità'));
    expect(sw('Tecnica di intensità').checked).toBe(false);
    expect(sw('Tecnica di intensità').getAttribute('aria-busy')).toBe('true');
    fireEvent.click(sw('Tecnica di intensità'));
    expect(saved()).toHaveLength(1);
    finish();
    await waitFor(() => expect(sw('Tecnica di intensità').getAttribute('aria-busy')).not.toBe('true'));
    expect(sw('Tecnica di intensità').checked).toBe(false);
  });
});

// Dentro una finestra la notifica della pagina non si legge (il resto è nascosto ai lettori di schermo): l'esito sta nel componente
describe('senza notify: l\'esito si legge dentro il componente', () => {
  it('le due regioni (esito e errore) ci sono sempre, vuote', () => {
    mountInline();
    expect(screen.getByRole('status').textContent).toBe('');
    expect(screen.getByRole('alert').textContent).toBe('');
  });

  it('un salvataggio riuscito riempie la regione «status» e non chiama notify', async () => {
    mountInline();
    fireEvent.click(sw('Tecnica di intensità'));
    await waitFor(() => expect(screen.getByRole('status').textContent).toBe('Tecnica di intensità: spento'));
    expect(screen.getByRole('alert').textContent).toBe('');
    expect(notify).not.toHaveBeenCalled();
  });

  it('un errore riempie la regione «alert», svuota l\'esito di prima e il valore torna com\'era', async () => {
    mountInline();
    fireEvent.click(sw('Peso suggerito'));
    await waitFor(() => expect(screen.getByRole('status').textContent).toBe('Peso suggerito: spento'));
    settings = () => json({ success: false }, 500);
    fireEvent.click(sw('Tecnica di intensità'));
    await waitFor(() => expect(screen.getByRole('alert').textContent).toBe('Errore nel salvataggio. Riprova.'));
    expect(screen.getByRole('status').textContent).toBe('');
    expect(sw('Tecnica di intensità').checked).toBe(true);
    expect(notify).not.toHaveBeenCalled();
  });
});
