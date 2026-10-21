// Account: l'obiettivo settimanale ha il font dei chip, come nell'app (lì è una riga di chip).
// La fetch è il confine. Le impostazioni sono chiuse in un Collapse, che le tiene comunque montate.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Account from './Account';
import { ThemeModeProvider } from '../context/ThemeModeContext';

vi.mock('react-router-dom', async (importOriginal) => ({ ...(await importOriginal()), useNavigate: () => () => {} }));
vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({ user: { id: 1 }, isLoggedIn: true, loading: false, logout: () => {}, updateUser: () => {} }),
}));

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn(() => Promise.resolve({ ok: true, json: async () => ({ success: true, consents: [], id: 1, weekly_goal_default: 3 }) })));
});
afterEach(() => {
  vi.unstubAllGlobals();
});

describe('obiettivo settimanale', () => {
  it('i pulsanti sono in Lexend 500, come i chip che si premono', async () => {
    render(<MemoryRouter><ThemeModeProvider><Account /></ThemeModeProvider></MemoryRouter>);
    const group = await screen.findByLabelText('Obiettivo settimanale');
    for (const button of group.querySelectorAll('button')) {
      const { fontFamily, fontWeight } = getComputedStyle(button);
      expect({ label: button.textContent, fontFamily, fontWeight })
        .toEqual({ label: button.textContent, fontFamily: '"Lexend", sans-serif', fontWeight: '500' });
    }
  });
});
