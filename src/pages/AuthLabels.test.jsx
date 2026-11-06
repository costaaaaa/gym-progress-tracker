// Forma B+ delle schermate di accesso (login, registrazione, password dimenticata, reset): i campi
// (regole in test/fieldStyle) e i bottoni del modulo a pillola, alti come i campi.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Login from './Login';
import Register from './Register';
import ForgotPassword from './ForgotPassword';
import ResetPassword from './ResetPassword';
import { ThemeModeProvider } from '../context/ThemeModeContext';
import { expectFieldAboveLabel } from '../test/fieldStyle';

vi.mock('react-router-dom', async (importOriginal) => ({ ...(await importOriginal()), useNavigate: () => () => {} }));
vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({ user: null, isLoggedIn: false, loading: false, login: () => {} }),
}));

const renderPage = (Page, initialEntries = ['/']) => render(
  <MemoryRouter initialEntries={initialEntries}><ThemeModeProvider><Page /></ThemeModeProvider></MemoryRouter>,
);

// Un bottone del modulo: a pillola e alto come i campi
const expectPill = (name) => {
  const style = getComputedStyle(screen.getByRole('button', { name }));
  expect(style.borderRadius).toBe('999px');
  expect(style.height).toBe('44px');
};

describe('Etichette web: login', () => {
  it('Username e Password hanno l\'etichetta sopra, sempre ridotta, senza tacca nel bordo', () => {
    renderPage(Login);
    expectFieldAboveLabel('username', /^Username/);
    expectFieldAboveLabel('password', /^Password/);
  });
});

describe('Etichette web: registrazione, passo 1', () => {
  it('Username, Email, Password e Conferma password rispettano la forma B+', () => {
    renderPage(Register);
    expectFieldAboveLabel('username', /^Username/);
    expectFieldAboveLabel('email', /^Email/);
    expectFieldAboveLabel('password', /^Password/);
    expectFieldAboveLabel('confirmPassword', /^Conferma password/);
  });
});

describe('Etichette web: registrazione, passo 2 (Select e DatePicker)', () => {
  const availability = vi.fn(() => Promise.resolve({ ok: true, status: 200, json: async () => ({ success: true, username_taken: false, email_taken: false }) }));

  beforeEach(() => {
    vi.stubGlobal('fetch', availability);
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  const goToStep2 = async () => {
    renderPage(Register);
    fireEvent.change(screen.getByLabelText(/^Username/), { target: { value: 'mario88' } });
    fireEvent.change(screen.getByLabelText(/^Email/), { target: { value: 'mario@example.com' } });
    fireEvent.change(screen.getByLabelText(/^Password/), { target: { value: 'Segreta!2026' } });
    fireEvent.change(screen.getByLabelText(/^Conferma password/), { target: { value: 'Segreta!2026' } });
    fireEvent.click(screen.getByRole('button', { name: 'Avanti' }));
    await screen.findByText('Il tuo profilo');
  };

  it('Data di nascita (DatePicker) ha l\'etichetta sopra, sempre ridotta, senza tacca', async () => {
    await goToStep2();
    expectFieldAboveLabel('birthDate', /^Data di nascita/);
  });

  it('Mese inizio allenamento (DatePicker, non obbligatorio) rispetta la forma B+', async () => {
    await goToStep2();
    expectFieldAboveLabel('trainingStartDate', 'Mese inizio allenamento');
  });

  it('Sesso (Select) ha l\'etichetta sopra, sempre ridotta, senza tacca nel bordo', async () => {
    await goToStep2();
    expectFieldAboveLabel('gender', /^Sesso/);
  });

  it('Indietro, affiancato a Registrati, è a pillola e alto 44', async () => {
    await goToStep2();
    expectPill('Indietro');
  });

  it('Registrati è a pillola e alto 44', async () => {
    await goToStep2();
    expectPill('Registrati');
  });
});

describe('Etichette web: password dimenticata', () => {
  it('Email rispetta la forma B+', () => {
    renderPage(ForgotPassword);
    expectFieldAboveLabel('email', /^Email/);
  });
});

describe('Etichette web: reset password', () => {
  afterEach(() => {
    window.history.replaceState(null, '', '/');
  });

  it('Nuova password e Ripeti la password rispettano la forma B+', () => {
    renderPage(ResetPassword, ['/reset-password?token=abc123']);
    expectFieldAboveLabel('password', /^Nuova password/);
    expectFieldAboveLabel('confirm', /^Ripeti la password/);
  });
});

describe('Bottoni del modulo', () => {
  it('Accedi è a pillola e alto 44', () => {
    renderPage(Login);
    expectPill('Accedi');
  });

  it('Avanti, il bottone grande della registrazione, è a pillola e alto 44', () => {
    renderPage(Register);
    expectPill('Avanti');
  });
});
