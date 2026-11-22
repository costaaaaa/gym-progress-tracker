// Chi apre l'Account senza aver fatto l'accesso va al login con ?next=, così dopo il login torna
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
  it.each([
    ['/account?x=1#sezione', '?next=%2Faccount%3Fx%3D1%23sezione'],
    ['/account/dati?x=1#groups-shown', '?next=%2Faccount%2Fdati%3Fx%3D1%23groups-shown'],
    ['/account/sicurezza', '?next=%2Faccount%2Fsicurezza'],
  ])('%s va al login con next = pagina, parametri e ancora', async (entry, expected) => {
    vi.stubGlobal('fetch', vi.fn(() => new Promise(() => {})));
    render(
      <MemoryRouter initialEntries={[entry]}>
        <ThemeModeProvider>
          <Routes>
            <Route path="/account" element={<Account />}>
              <Route index element={<p>elenco</p>} />
              <Route path="dati" element={<p>dati</p>} />
              <Route path="sicurezza" element={<p>sicurezza</p>} />
            </Route>
            <Route path="/login" element={<LoginProbe />} />
          </Routes>
        </ThemeModeProvider>
      </MemoryRouter>,
    );
    const search = (await screen.findByTestId('login')).textContent;
    expect(search).toBe(expected);
    expect(safeNext(search)).toBe(entry);
  });
});
