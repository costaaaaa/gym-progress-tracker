// Chi apre la scheda Impostazioni senza aver fatto l'accesso va al login con ?next=, così dopo il login torna
// alla stessa pagina, compresi parametri e ancora (es. un link da un'email). La fetch è il confine.
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom';
import Account from './Account';
import { ThemeModeProvider } from '../context/ThemeModeContext';
import { safeNext } from '../utils/safeNext';

vi.mock('../context/AuthContext', () => {
  const auth = { user: null, isLoggedIn: false, loading: false, logout: () => {}, updateUser: () => {} };
  return { useAuth: () => auth };
});

const LoginProbe = () => {
  const location = useLocation();
  return <p data-testid="login">{location.search}</p>;
};

afterEach(() => vi.unstubAllGlobals());

describe('Account senza accesso', () => {
  it('va al login con next = pagina, parametri e ancora', async () => {
    vi.stubGlobal('fetch', vi.fn(() => new Promise(() => {})));
    render(
      <MemoryRouter initialEntries={['/profilo?tab=settings#assistenti-ai']}>
        <ThemeModeProvider>
          <Routes>
            <Route path="/profilo" element={<Account isEmbedded />} />
            <Route path="/login" element={<LoginProbe />} />
          </Routes>
        </ThemeModeProvider>
      </MemoryRouter>,
    );
    const search = (await screen.findByTestId('login')).textContent;
    expect(search).toBe('?next=%2Fprofilo%3Ftab%3Dsettings%23assistenti-ai');
    expect(safeNext(search)).toBe('/profilo?tab=settings#assistenti-ai');
  });
});
