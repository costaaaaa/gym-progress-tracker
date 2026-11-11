// Casella «Resta collegato per 30 giorni» del login: spenta all'apertura, il suo valore parte nel corpo
// della richiesta come `remember`. La fetch è il confine.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Login from './Login';
import i18n from '../i18n';
import { ThemeModeProvider } from '../context/ThemeModeContext';

vi.mock('react-router-dom', async (importOriginal) => ({ ...(await importOriginal()), useNavigate: () => () => {} }));
vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({ user: null, isLoggedIn: false, loading: false, login: () => {} }),
}));

const renderLogin = () => render(
  <MemoryRouter><ThemeModeProvider><Login /></ThemeModeProvider></MemoryRouter>,
);

const sentBody = (fetchMock) => JSON.parse(fetchMock.mock.calls[0][1].body);

describe('Login: Resta collegato', () => {
  let fetchMock;

  beforeEach(async () => {
    await i18n.changeLanguage('it');
    fetchMock = vi.fn(() => Promise.resolve({ ok: true, json: async () => ({ success: true, user: { id: 1, username: 'mario' } }) }));
    vi.stubGlobal('fetch', fetchMock);
  });
  afterEach(() => vi.unstubAllGlobals());

  const submit = async (username = 'mario', password = 'Segreta!2026') => {
    fireEvent.change(screen.getByLabelText(/^Username/), { target: { value: username } });
    fireEvent.change(screen.getByLabelText(/^Password/), { target: { value: password } });
    fireEvent.click(screen.getByRole('button', { name: 'Accedi' }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
  };

  it('la casella c\'è, ha l\'etichetta cliccabile e non è spuntata', () => {
    renderLogin();
    const box = screen.getByRole('checkbox', { name: 'Resta collegato per 30 giorni' });
    expect(box.checked).toBe(false);
  });

  it('senza spunta invia remember: false', async () => {
    renderLogin();
    await submit();
    expect(sentBody(fetchMock)).toEqual({ username: 'mario', password: 'Segreta!2026', remember: false });
  });

  it('con la spunta invia remember: true (anche cliccando l\'etichetta)', async () => {
    renderLogin();
    fireEvent.click(screen.getByText('Resta collegato per 30 giorni'));
    expect(screen.getByRole('checkbox').checked).toBe(true);
    await submit();
    expect(sentBody(fetchMock).remember).toBe(true);
  });

  it('in inglese l\'etichetta è «Stay signed in for 30 days»', async () => {
    await i18n.changeLanguage('en');
    renderLogin();
    expect(screen.getByRole('checkbox', { name: 'Stay signed in for 30 days' }).checked).toBe(false);
    await i18n.changeLanguage('it');
  });
});
