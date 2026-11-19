// Registrazione: il campo «Unità di peso» del secondo passo. Preimpostato kg; la proposta di suggested_unit.php
// (chiesta al caricamento del modulo) lo porta a lb solo se l'utente non l'ha ancora toccato; se manca o fallisce
// resta kg. L'unità scelta parte nel corpo di register.php. La fetch è il confine.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, within, waitFor, act } from '@testing-library/react';
import { format, subYears, startOfToday } from 'date-fns';
import { MemoryRouter } from 'react-router-dom';
import Register from './Register';
import { ThemeModeProvider } from '../context/ThemeModeContext';
import i18n from '../i18n';
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

let suggestion; // la risposta di suggested_unit.php, decisa dal test
const registerBodies = () => fetch.mock.calls.filter(([url]) => String(url).includes('register.php')).map(([, init]) => JSON.parse(init.body));
const suggestionCalls = () => fetch.mock.calls.filter(([url]) => String(url).includes('suggested_unit.php'));

beforeEach(async () => {
  await i18n.changeLanguage('it');
  mockPointer(true);
  navigate.mockClear();
  suggestion = () => Promise.resolve(answer({ success: true, suggested_weight_unit: 'kg' }));
  vi.stubGlobal('fetch', vi.fn((input) => {
    const url = String(input);
    if (url.includes('suggested_unit.php')) return suggestion();
    if (url.includes('check_availability')) return Promise.resolve(answer({ success: true, username_taken: false, email_taken: false }));
    if (url.includes('register.php')) return Promise.resolve(answer({ success: true, message: 'ok' }, 201));
    return Promise.resolve(answer({ success: true, user: { id: 7, username: 'mario88', locale: 'it' } }));
  }));
});
afterEach(() => {
  vi.unstubAllGlobals();
});

const renderAt = (path = '/register') => render(
  <MemoryRouter initialEntries={[path]}><ThemeModeProvider><Register /></ThemeModeProvider></MemoryRouter>,
);
const goToStep2 = async (labels = { confirm: /^Conferma password/, next: 'Avanti', title: 'Il tuo profilo' }) => {
  fireEvent.change(screen.getByLabelText(/^Username/), { target: { value: 'mario88' } });
  fireEvent.change(screen.getByLabelText(/^Email/), { target: { value: 'mario@example.com' } });
  fireEvent.change(screen.getByLabelText(/^Password/), { target: { value: 'Segreta!2026' } });
  fireEvent.change(screen.getByLabelText(labels.confirm), { target: { value: 'Segreta!2026' } });
  fireEvent.click(screen.getByRole('button', { name: labels.next }));
  await screen.findByText(labels.title);
};
const unitField = (name = /^Unità di misura/) => screen.getByRole('combobox', { name });
const pick = (field, option) => {
  fireEvent.mouseDown(field);
  fireEvent.click(within(screen.getByRole('listbox')).getByRole('option', { name: option }));
};
const submit = async ({ gender = /Maschio/, sex = /Sesso/, birth = /^Data di nascita/, birthFormat = 'dd/MM/yyyy', terms = true, register = 'Registrati' } = {}) => {
  fireEvent.change(screen.getByLabelText(birth), { target: { value: format(subYears(startOfToday(), 30), birthFormat) } });
  pick(screen.getByRole('combobox', { name: sex }), gender);
  if (terms) fireEvent.click(screen.getByRole('checkbox'));
  fireEvent.click(screen.getByRole('button', { name: register }));
  await waitFor(() => expect(registerBodies()).toHaveLength(1));
};

describe('unità di peso nel modulo di registrazione', () => {
  it('la proposta si chiede una volta, al caricamento, senza credenziali né altro', async () => {
    renderAt();
    await waitFor(() => expect(suggestionCalls()).toHaveLength(1));
    const [url, init] = suggestionCalls()[0];
    expect(String(url)).toContain('api/user/suggested_unit.php');
    expect(init?.method ?? 'GET').toBe('GET');
    expect(init?.credentials).toBe('omit');
  });

  it('preimpostato kg, e kg parte nel corpo di register.php', async () => {
    renderAt();
    await goToStep2();
    expect(unitField().textContent).toBe('Metriche (kg, cm)');
    await submit();
    expect(registerBodies()[0].weight_unit).toBe('kg');
  });

  it('con la proposta lb il campo diventa lb e lb parte nel corpo', async () => {
    suggestion = () => Promise.resolve(answer({ success: true, suggested_weight_unit: 'lb' }));
    renderAt();
    await goToStep2();
    await waitFor(() => expect(unitField().textContent).toBe('Imperiali (lb, in)'));
    await submit();
    expect(registerBodies()[0].weight_unit).toBe('lb');
  });

  it('la scelta dell\'utente vale: da kg a lb nel corpo', async () => {
    renderAt();
    await goToStep2();
    pick(unitField(), 'Imperiali (lb, in)');
    expect(unitField().textContent).toBe('Imperiali (lb, in)');
    await submit();
    expect(registerBodies()[0].weight_unit).toBe('lb');
  });

  it('una proposta in ritardo dopo un tocco dell\'utente non sovrascrive', async () => {
    let resolveSuggestion;
    suggestion = () => new Promise((resolve) => { resolveSuggestion = resolve; });
    renderAt();
    await goToStep2();
    expect(unitField().textContent).toBe('Metriche (kg, cm)');
    pick(unitField(), 'Metriche (kg, cm)'); // anche riscegliere kg è un tocco
    await act(async () => { resolveSuggestion(answer({ success: true, suggested_weight_unit: 'lb' })); });
    expect(unitField().textContent).toBe('Metriche (kg, cm)');
    await submit();
    expect(registerBodies()[0].weight_unit).toBe('kg');
  });

  it('una proposta che arriva mentre l\'utente ha già scelto lb non lo cambia', async () => {
    let resolveSuggestion;
    suggestion = () => new Promise((resolve) => { resolveSuggestion = resolve; });
    renderAt();
    await goToStep2();
    pick(unitField(), 'Imperiali (lb, in)');
    await act(async () => { resolveSuggestion(answer({ success: true, suggested_weight_unit: 'kg' })); });
    expect(unitField().textContent).toBe('Imperiali (lb, in)');
  });

  it.each([
    ['rete caduta', () => Promise.reject(new Error('offline'))],
    ['429', () => Promise.resolve(answer({ success: false, message: 'Troppe richieste' }, 429))],
    ['risposta senza proposta', () => Promise.resolve(answer({ success: true }))],
    ['proposta non valida', () => Promise.resolve(answer({ success: true, suggested_weight_unit: 'st' }))],
  ])('proposta fallita (%s): resta kg e la registrazione procede', async (_, failing) => {
    suggestion = failing;
    renderAt();
    await goToStep2();
    await waitFor(() => expect(suggestionCalls()).toHaveLength(1)); // la proposta è stata chiesta, poi la risposta si scarta
    await act(async () => {});
    expect(unitField().textContent).toBe('Metriche (kg, cm)');
    await submit();
    expect(registerBodies()[0].weight_unit).toBe('kg');
  });

  it('con /register?code=… il campo c\'è e l\'unità parte nel corpo', async () => {
    suggestion = () => Promise.resolve(answer({ success: true, suggested_weight_unit: 'lb' }));
    renderAt('/register?code=PRIMAVERA-26');
    await goToStep2();
    await waitFor(() => expect(unitField().textContent).toBe('Imperiali (lb, in)'));
    await submit();
    expect(registerBodies()[0]).toMatchObject({ weight_unit: 'lb', signup_code: 'PRIMAVERA-26' });
  });

  it('in inglese (/en/register): etichetta inglese e unità nel corpo', async () => {
    await i18n.changeLanguage('en');
    suggestion = () => Promise.resolve(answer({ success: true, suggested_weight_unit: 'lb' }));
    renderAt('/en/register');
    await goToStep2({ confirm: /^Confirm password/, next: 'Next', title: 'Your profile' });
    await waitFor(() => expect(unitField(/^Units/).textContent).toBe('Imperial (lb, in)'));
    await submit({ gender: /Male/, sex: /Sex/, birth: /^Date of birth/, birthFormat: 'MM/dd/yyyy', register: 'Sign up' });
    expect(registerBodies()[0].weight_unit).toBe('lb');
  });
});
