// Registrazione in due passaggi: il primo controlla l'account (anche con check_availability.php),
// il secondo chiede il profilo. La fetch è il confine.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Register from './Register';
import { ThemeModeProvider } from '../context/ThemeModeContext';
import i18n from '../i18n';

vi.mock('react-router-dom', async (importOriginal) => ({ ...(await importOriginal()), useNavigate: () => () => {} }));
vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({ user: null, isLoggedIn: false, loading: false, login: () => {} }),
}));

const availability = (body) => vi.fn(() => Promise.resolve({ ok: true, status: 200, json: async () => ({ success: true, ...body }) }));

const renderRegister = () => render(<MemoryRouter><ThemeModeProvider><Register /></ThemeModeProvider></MemoryRouter>);

const fillStep1 = ({ confirm = 'Segreta!2026' } = {}) => {
  fireEvent.change(screen.getByLabelText(/^Username/), { target: { value: 'mario88' } });
  fireEvent.change(screen.getByLabelText(/^Email/), { target: { value: 'mario@example.com' } });
  fireEvent.change(screen.getByLabelText(/^Password/), { target: { value: 'Segreta!2026' } });
  fireEvent.change(screen.getByLabelText(/^Conferma password/), { target: { value: confirm } });
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
    fireEvent.change(screen.getByLabelText(/^Username/), { target: { value: 'mario88' } });
    fireEvent.change(screen.getByLabelText(/^Email/), { target: { value: 'mario@example.com' } });
    fireEvent.change(screen.getByLabelText(/^Password/), { target: { value: 'Segreta!2026' } });
    fireEvent.change(screen.getByLabelText(/^Confirm password/), { target: { value: 'Segreta!2026' } });
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
