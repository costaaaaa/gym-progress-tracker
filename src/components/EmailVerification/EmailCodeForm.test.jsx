// Campo del codice a 6 cifre con conferma e reinvio: lo stesso in finestra e nella schermata di blocco.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import EmailCodeForm from './EmailCodeForm';
import { textBelow } from '../../test/minText';

const auth = { emailState: null, refreshEmailState: vi.fn(() => Promise.resolve()) };
vi.mock('../../context/AuthContext', () => ({ useAuth: () => auth }));

const reply = (status, body, headers = {}) => ({ ok: status < 400, status, headers, json: async () => body });
let fetchMock;
const answers = (...list) => {
  fetchMock = vi.fn();
  list.forEach((r) => fetchMock.mockResolvedValueOnce(r));
  vi.stubGlobal('fetch', fetchMock);
};
const bodyOf = (i) => JSON.parse(fetchMock.mock.calls[i][1].body);
const urlOf = (i) => String(fetchMock.mock.calls[i][0]);

const mount = (props = {}) => {
  const onConfirmed = vi.fn();
  render(<EmailCodeForm onConfirmed={onConfirmed} {...props} />);
  return { onConfirmed };
};
const field = () => screen.getByLabelText(/^Codice di 6 cifre/);
const type = (value) => fireEvent.change(field(), { target: { value } });
const confirm = () => fireEvent.click(screen.getByRole('button', { name: 'Conferma' }));
const resend = () => screen.getByRole('button', { name: /nuovo codice/i });

beforeEach(() => {
  auth.emailState = { verified: false, email: 'mario@example.com', pendingEmail: null, blocked: false, daysLeft: 5 };
  auth.refreshEmailState.mockClear();
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('campo del codice', () => {
  it('dice a quale indirizzo è stato spedito il codice, e per un cambio in attesa è il nuovo', () => {
    mount();
    expect(screen.getByText(/mario@example\.com/)).toBeTruthy();
  });

  it('con un cambio di indirizzo in attesa mostra il nuovo indirizzo', () => {
    auth.emailState = { ...auth.emailState, verified: true, pendingEmail: 'nuovo@example.com' };
    mount();
    expect(screen.getByText(/nuovo@example\.com/)).toBeTruthy();
    expect(screen.queryByText(/mario@example\.com/)).toBeNull();
  });

  it('è un campo numerico che il telefono sa compilare dal codice ricevuto', () => {
    mount();
    expect(field().getAttribute('inputmode')).toBe('numeric');
    expect(field().getAttribute('autocomplete')).toBe('one-time-code');
  });

  it('accetta un codice incollato con spazi o trattini e tiene solo le 6 cifre', () => {
    mount();
    type(' 123 456 ');
    expect(field().value).toBe('123456');
    type('987-654-321');
    expect(field().value).toBe('987654');
    type('ab12');
    expect(field().value).toBe('12');
  });
});

describe('conferma', () => {
  it('codice giusto: lo manda, rilegge lo stato e avvisa chi usa il campo', async () => {
    answers(reply(200, { success: true, email_verified: true, email: 'mario@example.com' }));
    const { onConfirmed } = mount();
    type('123456');
    confirm();
    await waitFor(() => expect(onConfirmed).toHaveBeenCalledTimes(1));
    expect(urlOf(0)).toContain('api/user/confirm_email.php');
    expect(bodyOf(0)).toEqual({ code: '123456' });
    expect(auth.refreshEmailState).toHaveBeenCalled();
    expect(onConfirmed.mock.calls[0][0]).toMatchObject({ email: 'mario@example.com', changed: false });
  });

  it('con un codice di registrazione rilegge lo stato portando il messaggio del server', async () => {
    const message = 'Email confermata. Plus attivo fino al 15 febbraio 2027.';
    answers(reply(200, { success: true, message, email_verified: true, email: 'mario@example.com', signup_code: { status: 'applied', tier: 'plus', tier_last_day: '2027-02-15' } }));
    const { onConfirmed } = mount();
    type('123456');
    confirm();
    await waitFor(() => expect(onConfirmed).toHaveBeenCalledTimes(1));
    expect(auth.refreshEmailState).toHaveBeenCalledWith(message);
  });

  it('codice di registrazione non applicato (posti finiti): anche qui vale il messaggio del server', async () => {
    const message = 'Email confermata. Il codice di registrazione non è più valido e non è stato applicato.';
    answers(reply(200, { success: true, message, email_verified: true, email: 'mario@example.com', signup_code: { status: 'missed', tier: 'plus', tier_last_day: null } }));
    const { onConfirmed } = mount();
    type('123456');
    confirm();
    await waitFor(() => expect(onConfirmed).toHaveBeenCalledTimes(1));
    expect(auth.refreshEmailState).toHaveBeenCalledWith(message);
  });

  it('senza codice di registrazione non c\'è nessun esito speciale', async () => {
    answers(reply(200, { success: true, message: 'Email confermata.', email_verified: true, email: 'mario@example.com' }));
    const { onConfirmed } = mount();
    type('123456');
    confirm();
    await waitFor(() => expect(onConfirmed).toHaveBeenCalledTimes(1));
    expect(auth.refreshEmailState).toHaveBeenCalledWith('');
  });

  it('dopo un cambio di indirizzo in attesa dice che l\'indirizzo è cambiato', async () => {
    auth.emailState = { ...auth.emailState, verified: true, pendingEmail: 'nuovo@example.com' };
    answers(reply(200, { success: true, email_verified: true, email: 'nuovo@example.com' }));
    const { onConfirmed } = mount();
    type('123456');
    confirm();
    await waitFor(() => expect(onConfirmed).toHaveBeenCalled());
    expect(onConfirmed.mock.calls[0][0]).toMatchObject({ email: 'nuovo@example.com', changed: true });
  });

  it('con meno di 6 cifre non chiama il server e lo dice sul campo', () => {
    answers();
    mount();
    type('123');
    confirm();
    expect(fetchMock).not.toHaveBeenCalled();
    expect(screen.getByRole('alert').textContent).toBe('Scrivi le 6 cifre del codice.');
    expect(field().getAttribute('aria-invalid')).toBe('true');
    expect(field().getAttribute('aria-describedby')).toContain(screen.getByRole('alert').id);
  });

  it('codice sbagliato: dice quanti tentativi restano, sul campo e come avviso', async () => {
    answers(reply(400, { success: false, code: 'email_code_wrong', attempts_left: 3, message: 'x' }));
    const { onConfirmed } = mount();
    type('111111');
    confirm();
    expect((await screen.findByRole('alert')).textContent).toBe('Il codice non è corretto. Tentativi rimasti: 3.');
    expect(field().getAttribute('aria-invalid')).toBe('true');
    expect(onConfirmed).not.toHaveBeenCalled();
  });

  it('ultimo tentativo sbagliato: il codice non vale più e invita a chiederne uno nuovo', async () => {
    answers(reply(400, { success: false, code: 'email_code_wrong', attempts_left: 0 }));
    mount();
    type('111111');
    confirm();
    expect((await screen.findByRole('alert')).textContent).toBe('Il codice non è corretto e non vale più. Chiedine uno nuovo.');
  });

  it('codice sbagliato senza il numero dei tentativi: testo semplice, non «non vale più»', async () => {
    answers(reply(400, { success: false, code: 'email_code_wrong' }));
    mount();
    type('111111');
    confirm();
    expect((await screen.findByRole('alert')).textContent).toBe('Il codice non è corretto.');
  });

  it('dopo un errore il focus torna sul campo, che durante l\'invio non è disabilitato', async () => {
    let finish;
    fetchMock = vi.fn(() => new Promise((resolve) => { finish = resolve; }));
    vi.stubGlobal('fetch', fetchMock);
    mount();
    type('111111');
    confirm();
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    expect(field().disabled).toBe(false);
    expect(field().readOnly).toBe(true);
    await act(async () => { finish(reply(400, { success: false, code: 'email_code_wrong', attempts_left: 2 })); });
    await screen.findByRole('alert');
    expect(document.activeElement).toBe(field());
  });

  it('con meno di 6 cifre il focus va sul campo', () => {
    mount();
    type('12');
    confirm();
    expect(document.activeElement).toBe(field());
  });

  it('nessun testo del campo, d\'aiuto o d\'errore, è sotto i 16px', async () => {
    answers(reply(400, { success: false, code: 'email_code_wrong', attempts_left: 3 }));
    const { container } = render(<EmailCodeForm />);
    type('111111');
    confirm();
    await screen.findByRole('alert');
    expect(textBelow(container, 16, '.MuiFormLabel-root, legend')).toEqual([]);
  });

  it('codice scaduto: invita a chiederne uno nuovo', async () => {
    answers(reply(400, { success: false, code: 'email_code_expired' }));
    mount();
    type('111111');
    confirm();
    expect((await screen.findByRole('alert')).textContent).toBe('Il codice è scaduto o non vale più. Chiedine uno nuovo.');
  });

  it('troppi codici sbagliati (429): dice tra quanto riprovare', async () => {
    answers(reply(429, { success: false, code: 'rate_limited', retry_after: 90 }));
    mount();
    type('111111');
    confirm();
    expect((await screen.findByRole('alert')).textContent).toBe('Troppi codici sbagliati. Riprova tra 1:30.');
  });

  it('indirizzo preso nel frattempo: lo dice (il cambio è annullato)', async () => {
    answers(reply(409, { success: false, code: 'email_taken', field: 'email' }));
    mount();
    type('111111');
    confirm();
    expect((await screen.findByRole('alert')).textContent).toMatch(/preso da un altro account/);
  });

  it('già confermata altrove: è un successo, si rilegge lo stato', async () => {
    answers(reply(409, { success: false, code: 'email_already_verified' }));
    const { onConfirmed } = mount();
    type('111111');
    confirm();
    await waitFor(() => expect(onConfirmed).toHaveBeenCalled());
    expect(auth.refreshEmailState).toHaveBeenCalled();
  });

  it('un errore sconosciuto usa il messaggio del server, o uno generico senza rete', async () => {
    answers(reply(500, { success: false, message: 'Si è verificato un errore. Riprova.' }));
    mount();
    type('111111');
    confirm();
    expect((await screen.findByRole('alert')).textContent).toBe('Si è verificato un errore. Riprova.');
  });

  it('scrivere di nuovo toglie l\'errore', async () => {
    answers(reply(400, { success: false, code: 'email_code_expired' }));
    mount();
    type('111111');
    confirm();
    await screen.findByRole('alert');
    type('2');
    expect(screen.queryByRole('alert')).toBeNull();
    expect(field().getAttribute('aria-invalid')).not.toBe('true');
  });
});

describe('nuovo codice', () => {
  it('manda la richiesta, lo annuncia e blocca il bottone con il conto alla rovescia di 2 minuti', async () => {
    answers(reply(200, { success: true, message: 'ok' }));
    mount();
    fireEvent.click(resend());
    expect(await screen.findByText('Ti abbiamo mandato un nuovo codice.')).toBeTruthy();
    expect(urlOf(0)).toContain('api/user/resend_email_code.php');
    expect(fetchMock.mock.calls[0][1].method).toBe('POST');
    expect(resend().disabled).toBe(true);
    expect(resend().textContent).toBe('Nuovo codice tra 2:00');
    expect(screen.getByText('Ti abbiamo mandato un nuovo codice.').closest('[role="status"]')).toBeTruthy();
  });

  it('429: legge retry_after, fa il conto alla rovescia e a zero riabilita il bottone', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    answers(reply(429, { success: false, code: 'email_resend_wait', retry_after: 3 }, { 'Retry-After': '3' }));
    mount();
    fireEvent.click(resend());
    await waitFor(() => expect(resend().textContent).toBe('Nuovo codice tra 0:03'));
    expect(resend().disabled).toBe(true);
    expect(screen.getByRole('alert').textContent).toBe('Hai già chiesto un codice da poco. Riprova tra 0:03.');
    await act(async () => { vi.advanceTimersByTime(1000); });
    expect(resend().textContent).toBe('Nuovo codice tra 0:02');
    await act(async () => { vi.advanceTimersByTime(2500); });
    expect(resend().textContent).toBe('Invia un nuovo codice');
    expect(resend().disabled).toBe(false);
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('già confermata altrove: è un successo', async () => {
    answers(reply(409, { success: false, code: 'email_already_verified' }));
    const { onConfirmed } = mount();
    fireEvent.click(resend());
    await waitFor(() => expect(onConfirmed).toHaveBeenCalled());
  });

  it('senza rete lo dice e non blocca il bottone', async () => {
    fetchMock = vi.fn(() => Promise.reject(new Error('rete')));
    vi.stubGlobal('fetch', fetchMock);
    mount();
    fireEvent.click(resend());
    expect((await screen.findByRole('alert')).textContent).toMatch(/Riprova/);
    expect(resend().disabled).toBe(false);
  });
});
