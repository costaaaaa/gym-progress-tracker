// Schermata di blocco dal giorno 8: codice, reinvio, correzione dell'indirizzo, esporta, elimina, esci.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import EmailBlockedScreen from './EmailBlockedScreen';
import { textBelow } from '../../test/minText';

const auth = {};
vi.mock('../../context/AuthContext', () => ({ useAuth: () => auth }));

const mount = () => render(<MemoryRouter><EmailBlockedScreen /></MemoryRouter>);
const reply = (status, body) => ({ ok: status < 400, status, headers: {}, json: async () => body });

beforeEach(() => {
  Object.assign(auth, {
    user: { id: 7, username: 'mario' },
    emailState: { verified: false, email: 'mario@example.com', pendingEmail: null, blocked: true, daysLeft: 0 },
    logout: vi.fn(),
    refreshEmailState: vi.fn(() => Promise.resolve()),
  });
});
afterEach(() => vi.unstubAllGlobals());

describe('schermata di blocco', () => {
  it('spiega cosa succede e ha il campo del codice, il reinvio e l\'indirizzo a cui è stato mandato', () => {
    mount();
    expect(screen.getByRole('heading', { level: 1, name: 'Conferma la tua email per continuare' })).toBeTruthy();
    expect(screen.getByText(/7 giorni per confermare l'email sono finiti/)).toBeTruthy();
    expect(screen.getByLabelText(/^Codice di 6 cifre/)).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Conferma' })).toBeTruthy();
    expect(screen.getByRole('button', { name: /nuovo codice/i })).toBeTruthy();
    expect(screen.getByText(/mario@example\.com/)).toBeTruthy();
  });

  it('offre solo le cose che il server ancora accetta: correggi indirizzo, esporta, elimina, esci', () => {
    mount();
    expect(screen.getAllByRole('button').map((b) => b.textContent)).toEqual([
      'Conferma', 'Invia un nuovo codice', 'Cambia indirizzo', 'Esporta i miei dati', 'Elimina account', 'Esci',
    ]);
    // nessun link verso pagine dell'app che darebbero 403
    expect(screen.queryAllByRole('link')).toEqual([]);
    expect(screen.queryByRole('navigation')).toBeNull();
  });

  it('nessun testo della schermata è sotto i 16px e «Cambia indirizzo» ha un bersaglio di almeno 44px', () => {
    const { container } = mount();
    expect(textBelow(container, 16, '.MuiFormLabel-root, legend')).toEqual([]);
    const change = screen.getByRole('button', { name: 'Cambia indirizzo' });
    expect(getComputedStyle(change).minHeight).toBe('44px');
  });

  it('non è una finestra: il codice sta nella pagina', () => {
    mount();
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('«Cambia indirizzo» apre la correzione dell\'indirizzo', () => {
    mount();
    fireEvent.click(screen.getByRole('button', { name: 'Cambia indirizzo' }));
    expect(screen.getByRole('dialog', { name: 'Cambia indirizzo email' })).toBeTruthy();
  });

  it('«Esporta i miei dati» scarica l\'esportazione dal server', async () => {
    const fetchMock = vi.fn(() => Promise.resolve(reply(200, { success: true, user: { username: 'mario' } })));
    vi.stubGlobal('fetch', fetchMock);
    URL.createObjectURL = vi.fn(() => 'blob:x');
    URL.revokeObjectURL = vi.fn();
    mount();
    fireEvent.click(screen.getByRole('button', { name: 'Esporta i miei dati' }));
    await waitFor(() => expect(URL.createObjectURL).toHaveBeenCalled());
    expect(String(fetchMock.mock.calls[0][0])).toContain('api/user/export.php');
    expect(await screen.findByText('Download completato con successo')).toBeTruthy();
  });

  it('«Elimina account» apre la stessa finestra con password e conferma di Account', () => {
    mount();
    fireEvent.click(screen.getByRole('button', { name: 'Elimina account' }));
    const dialog = screen.getByRole('dialog');
    expect(dialog.textContent).toMatch(/Confermo di essere consapevole/);
    expect(screen.getByLabelText(/^Password/)).toBeTruthy();
  });

  it('eliminazione riuscita: lo dice ed esce', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(reply(200, { success: true }))));
    mount();
    fireEvent.click(screen.getByRole('button', { name: 'Elimina account' }));
    fireEvent.change(screen.getByLabelText(/^Password/), { target: { value: 'Segreta!2026' } });
    fireEvent.click(screen.getByRole('checkbox'));
    fireEvent.click(screen.getAllByRole('button', { name: 'Elimina account' }).at(-1));
    expect(await screen.findByText('Account eliminato con successo')).toBeTruthy();
    await vi.advanceTimersByTimeAsync(2100);
    expect(auth.logout).toHaveBeenCalled();
    vi.useRealTimers();
  });

  it('«Esci» chiude la sessione', () => {
    mount();
    fireEvent.click(screen.getByRole('button', { name: 'Esci' }));
    expect(auth.logout).toHaveBeenCalledTimes(1);
  });
});
