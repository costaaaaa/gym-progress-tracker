// Il link di recupero porta il token nell'indirizzo (nel fragment, o nella query dei vecchi link):
// la pagina lo tiene in memoria e lo toglie da barra e cronologia.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import ResetPassword from './ResetPassword';
import i18n from '../i18n';
import { describedBy } from '../test/accessibleNames';

beforeEach(() => {
  window.history.replaceState(null, '', '/reset-password?token=abc123');
  vi.stubGlobal('fetch', vi.fn(() => Promise.resolve({ ok: true, status: 200, json: async () => ({ success: true }) })));
});
afterEach(() => {
  vi.unstubAllGlobals();
  window.history.replaceState(null, '', '/');
});

const NEW_PASSWORD = 'Nuova!Pass2026';

const submitNewPassword = async (container) => {
  fireEvent.change(container.querySelector('#password'), { target: { value: NEW_PASSWORD } });
  fireEvent.change(container.querySelector('#confirm'), { target: { value: NEW_PASSWORD } });
  fireEvent.submit(container.querySelector('form'));
  await waitFor(() => expect(fetch).toHaveBeenCalledTimes(1));
  return JSON.parse(fetch.mock.calls[0][1].body);
};

describe('ResetPassword', () => {
  it.each([
    ['nel fragment', '/reset-password#token=abc123'],
    ['nella query (vecchi link)', '/reset-password?token=abc123'],
  ])('legge il token %s, lo toglie dall\'indirizzo e lo manda al server', async (_name, url) => {
    window.history.replaceState(null, '', url);
    const { container } = render(
      <MemoryRouter initialEntries={[url]}><ResetPassword /></MemoryRouter>,
    );
    expect(window.location.search).toBe('');
    expect(window.location.hash).toBe('');
    expect(window.location.pathname).toBe('/reset-password');

    expect(await submitNewPassword(container)).toEqual({ token: 'abc123', new_password: NEW_PASSWORD });
  });
});

describe('ResetPassword: conferma con riga riservata', () => {
  const renderReset = () => render(<MemoryRouter initialEntries={['/reset-password?token=abc123']}><ResetPassword /></MemoryRouter>);
  const field = () => screen.getByLabelText(/^Ripeti la password/);
  const typeConfirm = (value) => fireEvent.change(field(), { target: { value } });
  const typePassword = (value) => fireEvent.change(screen.getByLabelText(/^Nuova password/), { target: { value } });
  const live = () => screen.getByRole('status').textContent;
  const row = () => describedBy(field());
  const submit = () => fireEvent.click(screen.getByRole('button', { name: 'Salva la password' }));

  it('a campo vuoto c\'è il suggerimento grigio, collegato al campo', () => {
    renderReset();
    typePassword(NEW_PASSWORD);
    expect(row()).toBe('Riscrivi la stessa password');
    expect(field().getAttribute('aria-invalid')).toBe('false');
    expect(live()).toBe('');
  });

  it('mentre si scrive diverso resta il suggerimento; appena uguali compare la spunta e si annuncia', () => {
    renderReset();
    typePassword(NEW_PASSWORD);
    typeConfirm('Nuova!Pass');
    expect(row()).toBe('Riscrivi la stessa password');
    expect(live()).toBe('');
    typeConfirm(NEW_PASSWORD);
    expect(row()).toBe('Le password coincidono');
    expect(live()).toBe('Le password coincidono');
    expect(field().getAttribute('aria-invalid')).toBe('false');
  });

  it('uscendo dal campo con password diverse compare il rosso con il testo di questo modulo, e si annuncia', () => {
    renderReset();
    typePassword(NEW_PASSWORD);
    typeConfirm('Nuova!Pass');
    fireEvent.blur(field());
    expect(row()).toBe('Le password non coincidono');
    expect(field().getAttribute('aria-invalid')).toBe('true');
    expect(live()).toBe('Le password non coincidono');
    typeConfirm('Nuova!Pass2');
    expect(row()).toBe('Riscrivi la stessa password');
    expect(field().getAttribute('aria-invalid')).toBe('false');
  });

  it('l\'occhio è nel primo campo: clic e Tab non sono un\'uscita dal gruppo, e mostra entrambi i campi', () => {
    renderReset();
    typePassword(NEW_PASSWORD);
    typeConfirm('Nuova!Pass');
    const eye = screen.getByRole('button', { name: 'Mostra o nascondi la password' });
    const newPassword = screen.getByLabelText(/^Nuova password/);
    fireEvent.blur(newPassword, { relatedTarget: eye });
    expect(row()).toBe('Riscrivi la stessa password');
    expect(fireEvent.mouseDown(eye)).toBe(false);
    fireEvent.click(eye);
    expect(field().getAttribute('type')).toBe('text');
    expect(row()).toBe('Riscrivi la stessa password');
    fireEvent.blur(eye, { relatedTarget: field() });
    expect(row()).toBe('Le password non coincidono');
  });

  it('cambiando la password: uguali, spunta subito; diverse, suggerimento e poi rosso all\'uscita', () => {
    renderReset();
    typePassword(NEW_PASSWORD);
    typeConfirm('Nuova!Pass2027');
    typePassword('Nuova!Pass2027');
    expect(row()).toBe('Le password coincidono');
    typePassword(NEW_PASSWORD);
    expect(row()).toBe('Riscrivi la stessa password');
    fireEvent.blur(screen.getByLabelText(/^Nuova password/));
    expect(row()).toBe('Le password non coincidono');
  });

  it('l\'invio con conferma diversa: riga rossa, focus sul campo, niente avviso in alto, niente chiamata', () => {
    renderReset();
    typePassword(NEW_PASSWORD);
    typeConfirm('Nuova!Pass');
    submit();
    expect(row()).toBe('Le password non coincidono');
    expect(field().getAttribute('aria-invalid')).toBe('true');
    expect(document.activeElement).toBe(field());
    expect(screen.queryByRole('alert')).toBeNull();
    expect(fetch).not.toHaveBeenCalled();
  });

  it('l\'invio con conferma vuota: errore nella riga come in registrazione, focus sul campo, niente avviso in alto, sparisce al primo tasto', () => {
    renderReset();
    typePassword(NEW_PASSWORD);
    submit();
    expect(row()).toBe('Le password non coincidono');
    expect(field().getAttribute('aria-invalid')).toBe('true');
    expect(document.activeElement).toBe(field());
    expect(screen.queryByRole('alert')).toBeNull();
    expect(live()).toBe('');
    expect(fetch).not.toHaveBeenCalled();
    typeConfirm('N');
    expect(row()).toBe('Riscrivi la stessa password');
    expect(field().getAttribute('aria-invalid')).toBe('false');
  });

  it('una password fuori regola resta nell\'avviso in alto, prima del controllo sulla conferma', () => {
    renderReset();
    typePassword('corta');
    typeConfirm('corta2');
    submit();
    expect(screen.getByRole('alert').textContent).toBe('La password deve contenere almeno 8 caratteri');
    expect(fetch).not.toHaveBeenCalled();
  });

  it('il suggerimento e l\'esito in inglese', async () => {
    await i18n.changeLanguage('en');
    renderReset();
    fireEvent.change(screen.getByLabelText(/^New password/), { target: { value: NEW_PASSWORD } });
    const confirm = screen.getByLabelText(/^Repeat password/);
    expect(describedBy(confirm)).toBe('Type the same password again');
    fireEvent.change(confirm, { target: { value: NEW_PASSWORD } });
    expect(describedBy(confirm)).toBe('Passwords match');
    fireEvent.change(confirm, { target: { value: 'Nuova!Pass' } });
    fireEvent.blur(confirm);
    expect(describedBy(confirm)).toBe("Passwords don't match");
  });
});
