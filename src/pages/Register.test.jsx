// Registrazione in due passaggi: il primo controlla l'account (anche con check_availability.php),
// il secondo chiede il profilo. La fetch è il confine.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Register from './Register';
import { ThemeModeProvider } from '../context/ThemeModeContext';
import i18n from '../i18n';
import { describedBy } from '../test/accessibleNames';
import { mockPointer } from '../test/pointer';

vi.mock('react-router-dom', async (importOriginal) => ({ ...(await importOriginal()), useNavigate: () => () => {} }));
vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({ user: null, isLoggedIn: false, loading: false, login: () => {} }),
}));

const availability = (body) => vi.fn(() => Promise.resolve({ ok: true, status: 200, json: async () => ({ success: true, ...body }) }));

const renderRegister = () => render(<MemoryRouter><ThemeModeProvider><Register /></ThemeModeProvider></MemoryRouter>);

const fillStep1 = ({ confirm = 'Segreta!2026', confirmLabel = /^Conferma password/ } = {}) => {
  fireEvent.change(screen.getByLabelText(/^Username/), { target: { value: 'mario88' } });
  fireEvent.change(screen.getByLabelText(/^Email/), { target: { value: 'mario@example.com' } });
  fireEvent.change(screen.getByLabelText(/^Password/), { target: { value: 'Segreta!2026' } });
  fireEvent.change(screen.getByLabelText(confirmLabel), { target: { value: confirm } });
};

beforeEach(() => {
  vi.stubGlobal('fetch', availability({ username_taken: false, email_taken: false }));
});
afterEach(() => {
  vi.unstubAllGlobals();
});

describe('informativa e termini', () => {
  const goToStep2 = async () => {
    renderRegister();
    fillStep1();
    fireEvent.click(screen.getByRole('button', { name: 'Avanti' }));
    await screen.findByText('Passo 2 di 2');
  };

  it('in italiano i link portano alle pagine italiane', async () => {
    await goToStep2();
    expect(screen.getByRole('link', { name: 'termini d\'uso' }).getAttribute('href')).toBe('/termini.html');
    expect(screen.getByRole('link', { name: 'informativa privacy' }).getAttribute('href')).toBe('/privacy.html');
  });

  it('in inglese i link portano alle pagine inglesi', async () => {
    await i18n.changeLanguage('en');
    renderRegister();
    fillStep1({ confirmLabel: /^Confirm password/ });
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    await screen.findByText(/Step 2 of 2/);
    expect(screen.getByRole('link', { name: 'terms of use' }).getAttribute('href')).toBe('/en/terms.html');
    expect(screen.getByRole('link', { name: 'privacy policy' }).getAttribute('href')).toBe('/en/privacy.html');
  });
});

describe('registrazione in due passaggi', () => {
  it('le password diverse fermano il primo passo, senza chiamare il server', async () => {
    renderRegister();
    fillStep1({ confirm: 'Diversa!2026' });
    fireEvent.click(screen.getByRole('button', { name: 'Avanti' }));
    expect(await screen.findByText('Le password non corrispondono')).toBeTruthy();
    expect(fetch).not.toHaveBeenCalled();
    expect(screen.getByText('Passo 1 di 2')).toBeTruthy();
  });

  it('con dati validi e liberi passa al profilo', async () => {
    renderRegister();
    fillStep1();
    fireEvent.click(screen.getByRole('button', { name: 'Avanti' }));
    expect(await screen.findByText('Il tuo profilo')).toBeTruthy();
    expect(screen.getByText('Passo 2 di 2')).toBeTruthy();
    expect(fetch).toHaveBeenCalledWith(expect.stringContaining('check_availability.php'), expect.anything());
  });

  it('username già preso: resta al primo passo con l\'errore sul campo', async () => {
    vi.stubGlobal('fetch', availability({ username_taken: true, email_taken: false }));
    renderRegister();
    fillStep1();
    fireEvent.click(screen.getByRole('button', { name: 'Avanti' }));
    expect(await screen.findByText('Questo username è già preso')).toBeTruthy();
    expect(screen.getByText('Passo 1 di 2')).toBeTruthy();
  });

  it('email già registrata: propone accesso e recupero password', async () => {
    vi.stubGlobal('fetch', availability({ username_taken: false, email_taken: true }));
    renderRegister();
    fillStep1();
    fireEvent.click(screen.getByRole('button', { name: 'Avanti' }));
    expect(await screen.findByRole('link', { name: 'accedi' })).toBeTruthy();
    expect(screen.getByRole('link', { name: 'recupera la password' })).toBeTruthy();
  });

  it('correggendo la conferma l\'errore sparisce mentre si scrive, non al clic su Avanti', async () => {
    renderRegister();
    fillStep1({ confirm: 'Diversa!2026' });
    fireEvent.blur(screen.getByLabelText(/^Conferma password/));
    expect(await screen.findByText('Le password non corrispondono')).toBeTruthy();
    fireEvent.change(screen.getByLabelText(/^Conferma password/), { target: { value: 'Segreta!2026' } });
    expect(screen.queryByText('Le password non corrispondono')).toBeNull();
  });

  it('tornando indietro i dati del primo passo restano', async () => {
    renderRegister();
    fillStep1();
    fireEvent.click(screen.getByRole('button', { name: 'Avanti' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Indietro' }));
    expect(screen.getByLabelText(/^Username/).value).toBe('mario88');
    expect(screen.getByLabelText(/^Email/).value).toBe('mario@example.com');
  });
});

describe('errori annunciati e focus sul primo campo sbagliato (WCAG 3.3.1, 4.1.3)', () => {
  // Con il puntatore preciso il selettore di date è il campo da digitare (in jsdom, senza, sarebbe di sola lettura)
  beforeEach(() => mockPointer(true));
  const goToStep2 = async () => {
    renderRegister();
    fillStep1();
    fireEvent.click(screen.getByRole('button', { name: 'Avanti' }));
    await screen.findByText('Il tuo profilo');
  };

  it('primo passo: email non valida, errore collegato al campo e focus lì (non su "Avanti")', async () => {
    renderRegister();
    fillStep1();
    fireEvent.change(screen.getByLabelText(/^Email/), { target: { value: 'mario' } });
    fireEvent.click(screen.getByRole('button', { name: 'Avanti' }));
    const email = screen.getByLabelText(/^Email/);
    expect(email.getAttribute('aria-invalid')).toBe('true');
    expect(describedBy(email)).toBe('Inserisci un\'email valida');
    expect(document.activeElement).toBe(email);
  });

  it('primo passo: con più errori il focus va sul primo campo dell\'elenco', async () => {
    renderRegister();
    fillStep1({ confirm: 'Diversa!2026' });
    fireEvent.change(screen.getByLabelText(/^Email/), { target: { value: '' } });
    fireEvent.click(screen.getByRole('button', { name: 'Avanti' }));
    expect(document.activeElement).toBe(screen.getByLabelText(/^Email/));
    expect(screen.getByLabelText(/^Conferma password/).getAttribute('aria-invalid')).toBe('true');
  });

  it('primo passo: email già registrata (risposta del server), focus sul campo', async () => {
    vi.stubGlobal('fetch', availability({ username_taken: false, email_taken: true }));
    renderRegister();
    fillStep1();
    fireEvent.click(screen.getByRole('button', { name: 'Avanti' }));
    await screen.findByRole('link', { name: 'accedi' });
    expect(document.activeElement).toBe(screen.getByLabelText(/^Email/));
  });

  it('secondo passo senza dati: errore sotto data, sesso e termini, focus sulla data, nessun avviso generico', async () => {
    await goToStep2();
    fireEvent.click(screen.getByRole('button', { name: 'Registrati' }));
    const birth = screen.getByLabelText(/^Data di nascita/);
    expect(birth.getAttribute('aria-invalid')).toBe('true');
    expect(describedBy(birth)).toBe('Inserisci la data di nascita');
    const gender = screen.getByRole('combobox', { name: /Sesso/ });
    expect(gender.getAttribute('aria-invalid')).toBe('true');
    expect(describedBy(gender)).toBe('Seleziona il sesso');
    const terms = screen.getByRole('checkbox');
    expect(describedBy(terms)).toBe('Per registrarti devi accettare i termini d\'uso e l\'informativa privacy');
    expect(document.activeElement).toBe(birth);
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('secondo passo: con la data giusta il primo errore è il sesso e il focus va sul suo campo', async () => {
    await goToStep2();
    fireEvent.change(screen.getByLabelText(/^Data di nascita/), { target: { value: '01/01/1990' } });
    fireEvent.click(screen.getByRole('button', { name: 'Registrati' }));
    expect(screen.getByLabelText(/^Data di nascita/).getAttribute('aria-invalid')).not.toBe('true');
    expect(document.activeElement).toBe(screen.getByRole('combobox', { name: /Sesso/ }));
  });

  it('un errore del server resta un avviso generico con role="alert"', async () => {
    await goToStep2();
    fireEvent.change(screen.getByLabelText(/^Data di nascita/), { target: { value: '01/01/1990' } });
    fireEvent.mouseDown(screen.getByRole('combobox', { name: /Sesso/ }));
    fireEvent.click(within(screen.getByRole('listbox')).getByRole('option', { name: /Maschio/ }));
    fireEvent.click(screen.getByRole('checkbox'));
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve({ ok: false, status: 500, json: async () => ({ message: 'Server in manutenzione' }) })));
    fireEvent.click(screen.getByRole('button', { name: 'Registrati' }));
    expect((await screen.findByRole('alert')).textContent).toBe('Server in manutenzione');
  });

  it('correggere un campo del secondo passo toglie il suo errore', async () => {
    await goToStep2();
    fireEvent.click(screen.getByRole('button', { name: 'Registrati' }));
    fireEvent.click(screen.getByRole('checkbox'));
    expect(describedBy(screen.getByRole('checkbox'))).toBeUndefined();
  });
});

// 2.5.3 e 4.1.2: su telefono (puntatore non preciso, e in jsdom di default) il campo data è di sola lettura e apre un
// dialogo; il suo nome accessibile deve contenere l'etichetta visibile, non sostituirla con un testo generico.
describe('campi data su telefono: il nome contiene l\'etichetta visibile', () => {
  it('data di nascita e mese di inizio allenamento', async () => {
    renderRegister();
    fillStep1();
    fireEvent.click(screen.getByRole('button', { name: 'Avanti' }));
    await screen.findByText('Il tuo profilo');
    expect(screen.getByRole('textbox', { name: /^Data di nascita/ })).toBeTruthy();
    expect(screen.getByRole('textbox', { name: /^Mese inizio allenamento/ })).toBeTruthy();
  });
});
