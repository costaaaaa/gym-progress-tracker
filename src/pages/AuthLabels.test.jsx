// Forma B+ delle schermate di accesso: l'etichetta sta sopra il campo, in flusso normale (non
// absolute né con la transform che la porta nel bordo), è sempre ridotta (anche a campo vuoto e senza
// focus) e il bordo del campo non ha la tacca per l'etichetta.
//
// "Niente tacca" non si legge dal testo della legend: MUI ci scrive sempre il testo dell'etichetta,
// nascosto, e la tacca è la larghezza di quella legend. Senza tacca resta larga 0.01px; con la tacca
// diventa larga quanto il testo, e MUI la apre da sola quando l'etichetta è ridotta.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Login from './Login';
import Register from './Register';
import ForgotPassword from './ForgotPassword';
import ResetPassword from './ResetPassword';
import { ThemeModeProvider } from '../context/ThemeModeContext';

vi.mock('react-router-dom', async (importOriginal) => ({ ...(await importOriginal()), useNavigate: () => () => {} }));
vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({ user: null, isLoggedIn: false, loading: false, login: () => {} }),
}));

const renderPage = (Page, initialEntries = ['/']) => render(
  <MemoryRouter initialEntries={initialEntries}><ThemeModeProvider><Page /></ThemeModeProvider></MemoryRouter>,
);

// La legend del fieldset è la tacca del bordo: 0.01px vuol dire chiusa
const outlineIsNotched = (fieldset) => getComputedStyle(fieldset.querySelector('legend')).maxWidth !== '0.01px';

// Un campo (TextField, Select o DatePicker outlined): trova il controllo con l'id dato e la sua
// etichetta (per tutti e tre i tipi, MUI usa la stessa convenzione "<id>-label"), poi controlla le tre
// regole della forma B+.
const expectFieldAboveLabel = (id, labelText) => {
  const control = screen.getByLabelText(labelText);
  expect(control).toBeTruthy();

  const label = document.getElementById(`${id}-label`);
  expect(label).toBeTruthy();
  expect(label.getAttribute('data-shrink')).toBe('true');
  const labelStyle = getComputedStyle(label);
  expect(labelStyle.position).not.toBe('absolute');
  expect(labelStyle.transform === 'none' || labelStyle.transform === '').toBe(true);

  const fieldset = control.closest('.MuiOutlinedInput-root')?.querySelector('fieldset');
  expect(fieldset).toBeTruthy();
  expect(outlineIsNotched(fieldset)).toBe(false);
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
