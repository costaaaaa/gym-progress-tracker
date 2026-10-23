// Barra in alto vista dall'utente: il link alla home porta il marchio LiftIndex, il nome accessibile è uno solo.
import { describe, it, expect, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Navbar from './Navbar';
import { ThemeModeProvider } from '../../context/ThemeModeContext';

vi.mock('../../context/AuthContext', () => ({
  useAuth: () => ({ user: null, isLoggedIn: false, loading: false }),
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
