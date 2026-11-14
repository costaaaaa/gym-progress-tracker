// Barra in alto vista dall'utente: il link alla home porta il marchio LiftIndex, il nome accessibile è uno solo.
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Navbar from './Navbar';
import { ThemeModeProvider } from '../../context/ThemeModeContext';

const auth = vi.hoisted(() => ({ value: { user: null, isLoggedIn: false, loading: false } }));
vi.mock('../../context/AuthContext', () => ({
  useAuth: () => auth.value,
}));

describe('barra in alto', () => {
  it('il link alla home mostra il marchio LiftIndex, non il manubrio', () => {
    render(<MemoryRouter><ThemeModeProvider><Navbar /></ThemeModeProvider></MemoryRouter>);
    const homeLink = screen.getByRole('link', { name: 'LiftIndex' });
    expect(homeLink.getAttribute('href')).toBe('/');
    expect(within(homeLink).getByTestId('logo-mark')).toBeTruthy();
    expect(within(homeLink).queryByTestId('FitnessCenterIcon')).toBeNull();
  });
});

// Voce attiva della navigazione desktop: il rosso è un testo, in scuro dev'essere quello chiaro (4.5 : 1 su #141416)
describe('barra in alto: voce attiva', () => {
  afterEach(() => {
    auth.value = { user: null, isLoggedIn: false, loading: false };
  });
  const activeColor = (mode) => {
    localStorage.setItem('themeMode', mode);
    auth.value = { user: { username: 'atleta_demo' }, isLoggedIn: true, loading: false };
    render(<MemoryRouter initialEntries={['/']}><ThemeModeProvider><Navbar /></ThemeModeProvider></MemoryRouter>);
    return getComputedStyle(screen.getByRole('link', { name: 'Home' })).color;
  };

  it('in chiaro è il rosso del marchio', () => {
    expect(activeColor('light')).toBe('rgb(213, 0, 0)');
  });

  it('in scuro è il rosso chiaro', () => {
    expect(activeColor('dark')).toBe('rgb(255, 82, 82)');
  });
});
