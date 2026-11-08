// Chi apre una pagina dei gruppi senza accesso va al login e poi torna lì, con parametri e ancora.
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom';
import RequireLogin from './RequireLogin';

vi.mock('../../context/AuthContext', () => {
  const auth = { isLoggedIn: false, loading: false };
  return { useAuth: () => auth };
});

const LoginProbe = () => <p data-testid="login">{useLocation().search}</p>;

describe('RequireLogin senza accesso', () => {
  it('va al login con next = pagina, parametri e ancora', async () => {
    render(
      <MemoryRouter initialEntries={['/entra?codice=AB12#invito']}>
        <Routes>
          <Route path="/entra" element={<RequireLogin><p>gruppo</p></RequireLogin>} />
          <Route path="/login" element={<LoginProbe />} />
        </Routes>
      </MemoryRouter>,
    );
    expect((await screen.findByTestId('login')).textContent).toBe('?next=%2Fentra%3Fcodice%3DAB12%23invito');
    expect(screen.queryByText('gruppo')).toBeNull();
  });
});
