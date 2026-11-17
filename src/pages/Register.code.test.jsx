// Registrazione con codice di registrazione: riga «Hai un codice?», link ?code=…, controllo anticipato al
// passaggio al secondo passo, errori del server sul campo, errore tornato da register.php. La fetch è il confine.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, within, waitFor } from '@testing-library/react';
import { format, subYears, startOfToday } from 'date-fns';
import { MemoryRouter } from 'react-router-dom';
import Register from './Register';
import { ThemeModeProvider } from '../context/ThemeModeContext';
import i18n from '../i18n';
import { describedBy } from '../test/accessibleNames';
import { mockPointer } from '../test/pointer';

const { navigate, auth } = vi.hoisted(() => ({
  navigate: vi.fn(),
  auth: { user: null, isLoggedIn: false, loading: false, login: vi.fn(), openEmailDialog: vi.fn() },
}));
vi.mock('react-router-dom', async (importOriginal) => ({ ...(await importOriginal()), useNavigate: () => navigate }));
vi.mock('../context/AuthContext', () => ({ useAuth: () => auth }));
vi.mock('../components/LabeledDatePicker', async (importOriginal) => (
  (await import('../test/birthFieldSpy')).spyOnBirthField(await importOriginal())
));

const answer = (body, status = 200) => ({ ok: status < 400, status, json: async () => body });
const fail = (status, code, message) => answer({ success: false, code, message, field: 'signup_code' }, status);

let responses;
const bodies = (name) => fetch.mock.calls.filter(([url]) => String(url).includes(name)).map(([, init]) => JSON.parse(init.body));

beforeEach(async () => {
  await i18n.changeLanguage('it');
  mockPointer(true);
  navigate.mockClear();
  auth.login.mockClear();
  auth.openEmailDialog.mockClear();
  responses = {
    check: () => answer({ success: true, username_taken: false, email_taken: false }),
    register: () => answer({ success: true, message: 'ok' }, 201),
  };
  vi.stubGlobal('fetch', vi.fn((input) => {
    const url = String(input);
    if (url.includes('check_availability')) return Promise.resolve(responses.check());
    if (url.includes('register.php')) return Promise.resolve(responses.register());
    return Promise.resolve(answer({ success: true, user: { id: 7, username: 'mario88', locale: 'it' } }));
  }));
});
afterEach(() => {
  vi.unstubAllGlobals();
});

const renderAt = (path = '/register') => render(
  <MemoryRouter initialEntries={[path]}><ThemeModeProvider><Register /></ThemeModeProvider></MemoryRouter>,
);

const codeField = () => screen.getByRole('textbox', { name: /Codice di registrazione/ });
const fillStep1 = (confirmLabel = /^Conferma password/) => {
  fireEvent.change(screen.getByLabelText(/^Username/), { target: { value: 'mario88' } });
  fireEvent.change(screen.getByLabelText(/^Email/), { target: { value: 'mario@example.com' } });
  fireEvent.change(screen.getByLabelText(/^Password/), { target: { value: 'Segreta!2026' } });
  fireEvent.change(screen.getByLabelText(confirmLabel), { target: { value: 'Segreta!2026' } });
};
const next = (name = 'Avanti') => fireEvent.click(screen.getByRole('button', { name }));
const registerNow = async () => {
  await screen.findByText('Il tuo profilo');
  fireEvent.change(screen.getByLabelText(/^Data di nascita/), { target: { value: format(subYears(startOfToday(), 30), 'dd/MM/yyyy') } });
  fireEvent.mouseDown(screen.getByRole('combobox', { name: /Sesso/ }));
  fireEvent.click(within(screen.getByRole('listbox')).getByRole('option', { name: /Maschio/ }));
  fireEvent.click(screen.getByRole('checkbox'));
  fireEvent.click(screen.getByRole('button', { name: 'Registrati' }));
};

describe('campo del codice', () => {
  it('chiuso di partenza: c\'è solo la riga «Hai un codice?»', () => {
    renderAt();
    const toggle = screen.getByRole('button', { name: 'Hai un codice?' });
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    expect(screen.queryByRole('textbox', { name: /Codice di registrazione/ })).toBeNull();
  });

  it('aria-controls c\'è solo quando il campo c\'è (aperto), mai verso un elemento assente', () => {
    renderAt();
    const toggle = screen.getByRole('button', { name: 'Hai un codice?' });
    expect(toggle.hasAttribute('aria-controls')).toBe(false);
    fireEvent.click(toggle);
    expect(toggle.getAttribute('aria-controls')).toBe(codeField().id);
    fireEvent.click(toggle);
    expect(toggle.hasAttribute('aria-controls')).toBe(false);
  });

  it('la riga apre il campo e porta il focus lì', () => {
    renderAt();
    fireEvent.click(screen.getByRole('button', { name: 'Hai un codice?' }));
    expect(document.activeElement).toBe(codeField());
    expect(screen.getByRole('button', { name: 'Hai un codice?' }).getAttribute('aria-expanded')).toBe('true');
  });

  it('/register?code=… lo apre già compilato e modificabile', () => {
    renderAt('/register?code=PRIMAVERA-26');
    expect(codeField().value).toBe('PRIMAVERA-26');
    fireEvent.change(codeField(), { target: { value: 'ALTRO' } });
    expect(codeField().value).toBe('ALTRO');
  });

  it('?code=… convive con ?next=…', () => {
    renderAt('/register?next=%2Fgruppi&code=amici');
    expect(codeField().value).toBe('amici');
    expect(screen.getByRole('link', { name: 'Accedi' }).getAttribute('href')).toContain('next=%2Fgruppi');
  });

  it('in inglese: /en/register?code=… con etichetta inglese', async () => {
    await i18n.changeLanguage('en');
    renderAt('/en/register?code=friends');
    const field = screen.getByRole('textbox', { name: /Sign-up code/ });
    expect(field.value).toBe('friends');
    expect(screen.getByRole('button', { name: 'Have a code?' })).toBeTruthy();
  });

  it('un ?code= vuoto non apre il campo', () => {
    renderAt('/register?code=');
    expect(screen.queryByRole('textbox', { name: /Codice di registrazione/ })).toBeNull();
  });
});

describe('senza codice la registrazione non cambia', () => {
  it('campo chiuso: né il controllo né la registrazione portano signup_code', async () => {
    renderAt();
    fillStep1();
    next();
    await registerNow();
    await waitFor(() => expect(navigate).toHaveBeenCalledWith('/'));
    expect(bodies('check_availability')[0]).not.toHaveProperty('signup_code');
    expect(bodies('register.php')[0]).not.toHaveProperty('signup_code');
  });

  it('campo aperto ma vuoto (o solo spazi) vale registrazione normale', async () => {
    renderAt();
    fireEvent.click(screen.getByRole('button', { name: 'Hai un codice?' }));
    fireEvent.change(codeField(), { target: { value: '   ' } });
    fillStep1();
    next();
    await registerNow();
    await waitFor(() => expect(navigate).toHaveBeenCalledWith('/'));
    expect(bodies('check_availability')[0]).not.toHaveProperty('signup_code');
    expect(bodies('register.php')[0]).not.toHaveProperty('signup_code');
  });
});

describe('codice buono', () => {
  it('il controllo anticipato riceve il codice senza spazi ai bordi', async () => {
    responses.check = () => answer({ success: true, username_taken: false, email_taken: false, signup_code: { usable: true, tier: 'plus', duration_days: 90 } });
    renderAt('/register?code=%20Amici-90%20');
    fillStep1();
    next();
    await screen.findByText('Il tuo profilo');
    expect(bodies('check_availability')[0].signup_code).toBe('Amici-90');
  });

  it('Plus a tempo: dice durata e quando parte, al secondo passo e tornando indietro sotto il campo', async () => {
    responses.check = () => answer({ success: true, username_taken: false, email_taken: false, signup_code: { usable: true, tier: 'plus', duration_days: 90 } });
    renderAt('/register?code=amici');
    fillStep1();
    next();
    await screen.findByText('Il tuo profilo');
    expect(screen.getByText('Plus per 90 giorni, parte quando confermi l\'email')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Indietro' }));
    expect(describedBy(codeField())).toBe('Plus per 90 giorni, parte quando confermi l\'email');
  });

  it('Pro per sempre', async () => {
    responses.check = () => answer({ success: true, username_taken: false, email_taken: false, signup_code: { usable: true, tier: 'pro', duration_days: null } });
    renderAt('/register?code=tester');
    fillStep1();
    next();
    await screen.findByText('Il tuo profilo');
    expect(screen.getByText('Pro senza scadenza, parte quando confermi l\'email')).toBeTruthy();
  });

  it('un giorno solo: singolare', async () => {
    responses.check = () => answer({ success: true, username_taken: false, email_taken: false, signup_code: { usable: true, tier: 'plus', duration_days: 1 } });
    renderAt('/register?code=prova');
    fillStep1();
    next();
    await screen.findByText('Il tuo profilo');
    expect(screen.getByText('Plus per 1 giorno, parte quando confermi l\'email')).toBeTruthy();
  });

  it('in inglese', async () => {
    await i18n.changeLanguage('en');
    responses.check = () => answer({ success: true, username_taken: false, email_taken: false, signup_code: { usable: true, tier: 'plus', duration_days: 90 } });
    renderAt('/en/register?code=friends');
    fillStep1(/^Confirm password/);
    next('Next');
    await screen.findByText(/Step 2 of 2/);
    expect(screen.getByText('Plus for 90 days, starts when you confirm your email')).toBeTruthy();
  });

  it('la registrazione manda il codice', async () => {
    responses.check = () => answer({ success: true, username_taken: false, email_taken: false, signup_code: { usable: true, tier: 'plus', duration_days: 90 } });
    responses.register = () => answer({ success: true, message: 'ok', signup_code: { tier: 'plus', duration_days: 90 } }, 201);
    renderAt('/register?code=amici');
    fillStep1();
    next();
    await registerNow();
    await waitFor(() => expect(navigate).toHaveBeenCalledWith('/'));
    expect(bodies('register.php')[0].signup_code).toBe('amici');
    expect(auth.openEmailDialog).toHaveBeenCalledTimes(1);
  });

  it('richiudere il campo dopo un controllo riuscito svuota il codice: non parte e non c\'è nota', async () => {
    responses.check = () => answer({ success: true, username_taken: false, email_taken: false, signup_code: { usable: true, tier: 'plus', duration_days: 90 } });
    renderAt('/register?code=amici');
    fillStep1();
    next();
    await screen.findByText('Il tuo profilo');
    fireEvent.click(screen.getByRole('button', { name: 'Indietro' }));
    fireEvent.click(screen.getByRole('button', { name: 'Hai un codice?' }));
    expect(screen.queryByRole('textbox', { name: /Codice di registrazione/ })).toBeNull();
    next();
    await screen.findByText('Il tuo profilo');
    expect(screen.queryByText(/parte quando confermi l'email/)).toBeNull();
    expect(bodies('check_availability')[1]).not.toHaveProperty('signup_code');
    await registerNow();
    await waitFor(() => expect(bodies('register.php')).toHaveLength(1));
    expect(bodies('register.php')[0]).not.toHaveProperty('signup_code');
  });

  it('riaprendo il campo dopo averlo chiuso è vuoto', () => {
    renderAt('/register?code=amici');
    fireEvent.click(screen.getByRole('button', { name: 'Hai un codice?' }));
    fireEvent.click(screen.getByRole('button', { name: 'Hai un codice?' }));
    expect(codeField().value).toBe('');
  });

  it('modificando il codice la nota sparisce (va ricontrollato)', async () => {
    responses.check = () => answer({ success: true, username_taken: false, email_taken: false, signup_code: { usable: true, tier: 'plus', duration_days: 90 } });
    renderAt('/register?code=amici');
    fillStep1();
    next();
    await screen.findByText('Il tuo profilo');
    fireEvent.click(screen.getByRole('button', { name: 'Indietro' }));
    fireEvent.change(codeField(), { target: { value: 'altro' } });
    expect(screen.queryByText(/parte quando confermi/)).toBeNull();
  });
});

describe('codice non utilizzabile al controllo anticipato', () => {
  it.each([
    [400, 'signup_code_invalid', 'Il codice di registrazione non è valido.'],
    [400, 'signup_code_expired', 'Il codice di registrazione è scaduto.'],
    [409, 'signup_code_exhausted', 'Il codice di registrazione ha esaurito i posti.'],
    [429, 'rate_limited', 'Troppi codici sbagliati. Riprova tra 600 secondi.'],
  ])('%i %s: messaggio del server sul campo, si resta al primo passo', async (status, code, message) => {
    responses.check = () => fail(status, code, message);
    renderAt('/register?code=sbagliato');
    fillStep1();
    next();
    await waitFor(() => expect(describedBy(codeField())).toBe(message));
    expect(codeField().getAttribute('aria-invalid')).toBe('true');
    expect(document.activeElement).toBe(codeField());
    expect(screen.getByText('Passo 1 di 2')).toBeTruthy();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('scrivendo nel campo l\'errore sparisce', async () => {
    responses.check = () => fail(400, 'signup_code_invalid', 'Il codice di registrazione non è valido.');
    renderAt('/register?code=sbagliato');
    fillStep1();
    next();
    await waitFor(() => expect(codeField().getAttribute('aria-invalid')).toBe('true'));
    fireEvent.change(codeField(), { target: { value: 'giusto' } });
    expect(codeField().getAttribute('aria-invalid')).not.toBe('true');
  });

  it('un 429 senza campo (limite del controllo) resta l\'avviso generale con il messaggio del server', async () => {
    responses.check = () => answer({ success: false, message: 'Troppi controlli, riprova.' }, 429);
    renderAt('/register?code=amici');
    fillStep1();
    next();
    expect((await screen.findByRole('alert')).textContent).toBe('Troppi controlli, riprova.');
  });

  it('il codice è controllato prima degli altri: username già preso e codice buono mostrano il solo errore dell\'username', async () => {
    responses.check = () => answer({ success: true, username_taken: true, email_taken: false, signup_code: { usable: true, tier: 'plus', duration_days: 90 } });
    renderAt('/register?code=amici');
    fillStep1();
    next();
    expect(await screen.findByText('Questo username è già preso')).toBeTruthy();
    expect(screen.getByText('Passo 1 di 2')).toBeTruthy();
  });
});

describe('errore del codice senza messaggio dal server', () => {
  it('vale il testo d\'errore generico già esistente', async () => {
    responses.check = () => answer({ success: false, field: 'signup_code' }, 400);
    renderAt('/register?code=amici');
    fillStep1();
    next();
    await waitFor(() => expect(describedBy(codeField())).toBe(i18n.t('register.error.generic')));
  });
});

describe('errore del codice da register.php (posto finito nel frattempo)', () => {
  it('torna al primo passo con il messaggio sul campo e il focus lì', async () => {
    responses.check = () => answer({ success: true, username_taken: false, email_taken: false, signup_code: { usable: true, tier: 'plus', duration_days: 90 } });
    responses.register = () => fail(409, 'signup_code_exhausted', 'Il codice di registrazione ha esaurito i posti.');
    renderAt('/register?code=amici');
    fillStep1();
    next();
    await registerNow();
    await waitFor(() => expect(screen.getByText('Passo 1 di 2')).toBeTruthy());
    expect(describedBy(codeField())).toBe('Il codice di registrazione ha esaurito i posti.');
    expect(document.activeElement).toBe(codeField());
    expect(screen.queryByRole('alert')).toBeNull();
    expect(auth.login).not.toHaveBeenCalled();
  });

  it('codice non valido dalla registrazione: stesso ritorno al primo passo', async () => {
    responses.register = () => fail(400, 'signup_code_invalid', 'Il codice di registrazione non è valido.');
    renderAt('/register?code=amici');
    fillStep1();
    next();
    await registerNow();
    await waitFor(() => expect(screen.getByText('Passo 1 di 2')).toBeTruthy());
    expect(describedBy(codeField())).toBe('Il codice di registrazione non è valido.');
  });

  it('429 dalla registrazione: messaggio del server sul campo', async () => {
    responses.register = () => fail(429, 'rate_limited', 'Troppi codici sbagliati. Riprova tra 600 secondi.');
    renderAt('/register?code=amici');
    fillStep1();
    next();
    await registerNow();
    await waitFor(() => expect(describedBy(codeField())).toBe('Troppi codici sbagliati. Riprova tra 600 secondi.'));
  });
});
