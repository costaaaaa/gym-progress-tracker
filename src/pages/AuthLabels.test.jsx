// Forma B+ delle schermate di accesso: l'etichetta sta sopra il campo, in flusso normale (non
// absolute/transform come il default MUI), è sempre "ridotta" (anche a campo vuoto e senza focus) e
// il bordo del campo non ha più la tacca per l'etichetta. Su main (prima di authControls.js) questi
// controlli falliscono: l'etichetta MUI di default è absolute, sale nel bordo solo al focus/valore, e
// il fieldset ha la tacca.
//
// Il controllo "niente tacca" non usa il textContent della legend: MUI ci scrive sempre il testo
// dell'etichetta (per il calcolo storico della larghezza del notch), a prescindere da `notched`; quel
// testo è comunque aria-hidden e non intercetta mai l'utente. Verifichiamo invece che la regola CSS
// che nasconde la legend (quella aggiunta in authControls.js) sia davvero applicata, leggendo le
// regole del foglio di stile con lo stesso approccio di `mediaStyle.js` (jsdom non calcola sempre
// `getComputedStyle` per i selettori annidati come `& legend`).
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

// true se, per una qualunque classe del fieldset, il foglio di stile ha una regola
// ".<classe> legend { display: none }" (la regola aggiunta in authControls.js)
const legendIsHidden = (fieldset) => {
  const classes = [...fieldset.classList];
  for (const sheet of document.styleSheets) {
    for (const rule of sheet.cssRules) {
      if (rule.media) continue;
      if (classes.some((c) => rule.selectorText === `.${c} legend`) && rule.style.getPropertyValue('display') === 'none') {
        return true;
      }
    }
  }
  return false;
};

// Un campo (TextField, Select o DatePicker outlined): trova il controllo con l'id dato e la sua
// etichetta (per tutti e tre i tipi, MUI usa la stessa convenzione "<id>-label"), poi controlla le tre
// regole della forma B+.
const expectFieldAboveLabel = (id, labelText) => {
  const control = screen.getByLabelText(labelText);
  expect(control).toBeTruthy();

  const label = document.getElementById(`${id}-label`);
  expect(label).toBeTruthy();
  expect(label.getAttribute('data-shrink')).toBe('true');
  // In flusso normale: non più absolute (il default MUI), niente transform che la fa salire nel bordo
  const labelStyle = getComputedStyle(label);
  expect(labelStyle.position).not.toBe('absolute');
  expect(labelStyle.transform === 'none' || labelStyle.transform === '').toBe(true);

  const fieldset = control.closest('.MuiOutlinedInput-root')?.querySelector('fieldset');
  expect(fieldset).toBeTruthy();
  expect(legendIsHidden(fieldset)).toBe(true);
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
