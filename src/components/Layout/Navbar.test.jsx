// Barra in alto vista dall'utente: il link alla home porta il marchio LiftIndex.
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
    const homeLink = screen.getAllByRole('link').find((link) => link.getAttribute('href') === '/');
    expect(within(homeLink).getByRole('img', { name: 'LiftIndex' })).toBeTruthy();
    expect(within(homeLink).queryByTestId('FitnessCenterIcon')).toBeNull();
  });
});
