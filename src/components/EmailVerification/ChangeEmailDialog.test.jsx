// «Cambia indirizzo»: nuovo indirizzo e password; errori sul campo giusto.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import ChangeEmailDialog from './ChangeEmailDialog';

const auth = { emailState: null, refreshEmailState: vi.fn(() => Promise.resolve()) };
vi.mock('../../context/AuthContext', () => ({ useAuth: () => auth }));

const reply = (status, body) => ({ ok: status < 400, status, headers: {}, json: async () => body });
let fetchMock;
const answers = (...list) => {
  fetchMock = vi.fn();
  list.forEach((r) => fetchMock.mockResolvedValueOnce(r));
  vi.stubGlobal('fetch', fetchMock);
};
const mount = () => {
  const onChanged = vi.fn();
  const onClose = vi.fn();
  render(<ChangeEmailDialog open onClose={onClose} onChanged={onChanged} />);
  return { onChanged, onClose };
};
const emailField = () => screen.getByLabelText(/^Nuovo indirizzo email/);
const passwordField = () => screen.getByLabelText(/^Password/);
const fill = (email = 'nuovo@example.com', password = 'Segreta!2026') => {
  fireEvent.change(emailField(), { target: { value: email } });
  fireEvent.change(passwordField(), { target: { value: password } });
};
const submit = () => fireEvent.click(screen.getByRole('button', { name: 'Cambia indirizzo' }));
const describedByText = (el) => el.getAttribute('aria-describedby').split(' ').map((id) => document.getElementById(id)?.textContent).join(' ');

beforeEach(() => {
  auth.emailState = { verified: false, email: 'mario@example.com', pendingEmail: null, blocked: false };
  auth.refreshEmailState.mockClear();
});
afterEach(() => vi.unstubAllGlobals());

describe('Cambia indirizzo', () => {
  it('spiega che per un account non confermato l\'indirizzo cambia subito', () => {
    mount();
    expect(screen.getByText(/cambia subito/)).toBeTruthy();
  });

  it('per un account confermato spiega che resta il vecchio finché non si scrive il codice', () => {
    auth.emailState = { ...auth.emailState, verified: true };
    mount();
    expect(screen.getByText(/resta con l'indirizzo di adesso/)).toBeTruthy();
  });

  it('manda indirizzo e password, rilegge lo stato, chiude e dice com\'è andata', async () => {
    answers(reply(200, { success: true, mode: 'immediate', email: 'nuovo@example.com', pending_email: null }));
    const { onChanged, onClose } = mount();
    fill('  Nuovo@Example.com ');
    submit();
    await waitFor(() => expect(onChanged).toHaveBeenCalledWith({ mode: 'immediate', email: 'nuovo@example.com', pendingEmail: null }));
    expect(onClose).toHaveBeenCalled();
    expect(auth.refreshEmailState).toHaveBeenCalled();
    expect(String(fetchMock.mock.calls[0][0])).toContain('api/user/change_email.php');
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ email: 'Nuovo@Example.com', password: 'Segreta!2026' });
  });

  it('account confermato: il server risponde pending e lo si passa a chi ha aperto la finestra', async () => {
    answers(reply(200, { success: true, mode: 'pending', email: null, pending_email: 'nuovo@example.com' }));
    const { onChanged } = mount();
    fill();
    submit();
    await waitFor(() => expect(onChanged).toHaveBeenCalledWith({ mode: 'pending', email: null, pendingEmail: 'nuovo@example.com' }));
  });

  it('indirizzo non valido: errore sul campo indirizzo, senza chiamare il server', () => {
    answers();
    mount();
    fill('non-un-indirizzo');
    submit();
    expect(fetchMock).not.toHaveBeenCalled();
    expect(emailField().getAttribute('aria-invalid')).toBe('true');
    expect(describedByText(emailField())).toMatch(/indirizzo email valido/);
    expect(document.activeElement).toBe(emailField());
  });

  it('senza password: errore sul campo password', () => {
    answers();
    mount();
    fireEvent.change(emailField(), { target: { value: 'nuovo@example.com' } });
    submit();
    expect(fetchMock).not.toHaveBeenCalled();
    expect(describedByText(passwordField())).toMatch(/Scrivi la tua password/);
    expect(document.activeElement).toBe(passwordField());
  });

  it('indirizzo già in uso: errore sul campo indirizzo, senza suggerimenti di recupero', async () => {
    answers(reply(409, { success: false, code: 'email_taken', field: 'email' }));
    const { onClose } = mount();
    fill();
    submit();
    await waitFor(() => expect(emailField().getAttribute('aria-invalid')).toBe('true'));
    expect(describedByText(emailField())).toContain('Questa email è già usata da un altro account.');
    expect(describedByText(emailField())).not.toContain('password');
    expect(onClose).not.toHaveBeenCalled();
    expect(document.activeElement).toBe(emailField());
  });

  it('stesso indirizzo di adesso: errore sul campo indirizzo', async () => {
    answers(reply(400, { success: false, code: 'email_same' }));
    mount();
    fill('mario@example.com');
    submit();
    await waitFor(() => expect(emailField().getAttribute('aria-invalid')).toBe('true'));
    expect(describedByText(emailField())).toMatch(/già l'indirizzo email del tuo account/);
  });

  it('password sbagliata: errore sul campo password, il campo indirizzo resta com\'è', async () => {
    answers(reply(400, { success: false, code: 'wrong_password' }));
    mount();
    fill();
    submit();
    await waitFor(() => expect(passwordField().getAttribute('aria-invalid')).toBe('true'));
    expect(describedByText(passwordField())).toMatch(/Password non corretta/);
    expect(emailField().getAttribute('aria-invalid')).not.toBe('true');
    expect(document.activeElement).toBe(passwordField());
  });

  it('troppo presto per un nuovo invio: lo dice con il tempo che manca', async () => {
    answers(reply(429, { success: false, code: 'email_resend_wait', retry_after: 75 }));
    mount();
    fill();
    submit();
    await waitFor(() => expect(emailField().getAttribute('aria-invalid')).toBe('true'));
    expect(describedByText(emailField())).toMatch(/riprova tra 1:15/);
  });

  it('un errore non previsto mostra il messaggio del server in un avviso', async () => {
    answers(reply(500, { success: false, message: 'Si è verificato un errore. Riprova.' }));
    mount();
    fill();
    submit();
    expect((await screen.findByRole('alert')).textContent).toBe('Si è verificato un errore. Riprova.');
  });

  it('riaperta riparte da campi vuoti e senza errori', async () => {
    answers(reply(400, { success: false, code: 'wrong_password' }));
    const view = render(<ChangeEmailDialog open onClose={() => {}} onChanged={() => {}} />);
    fill();
    submit();
    await waitFor(() => expect(passwordField().getAttribute('aria-invalid')).toBe('true'));
    view.rerender(<ChangeEmailDialog open={false} onClose={() => {}} onChanged={() => {}} />);
    view.rerender(<ChangeEmailDialog open onClose={() => {}} onChanged={() => {}} />);
    await waitFor(() => expect(passwordField().value).toBe(''));
    expect(passwordField().getAttribute('aria-invalid')).not.toBe('true');
  });
});
