// Percorso vero del collegamento «Cosa mostro»: /account#groups-shown apre l'Account e il fuoco arriva sul blocco
// della card dei gruppi. La fetch è il confine.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Account from './Account';
import { ThemeModeProvider } from '../context/ThemeModeContext';
import i18n from '../i18n';
import { json } from '../test/dom';

vi.mock('react-router-dom', async (importOriginal) => ({ ...(await importOriginal()), useNavigate: () => () => {} }));
const auth = {};
vi.mock('../context/AuthContext', () => ({ useAuth: () => auth }));

const profile = {
  success: true, level: 7, total_xp: 3140, xp_into_level: 340, xp_for_next_level: 600,
  lifetime_volume_kg: 1000, total_sessions: 3, longest_streak: 1, exercises: [], achievements: [],
};

beforeEach(async () => {
  await i18n.changeLanguage('it');
  Object.assign(auth, {
    user: { id: 1 }, isLoggedIn: true, loading: false, logout: () => {}, updateUser: () => {},
    emailState: { verified: true, email: 'mario@example.com', pendingEmail: null, blocked: false, daysLeft: null },
    openEmailDialog: vi.fn(),
    refreshEmailState: vi.fn(() => Promise.resolve()),
  });
  vi.stubGlobal('fetch', vi.fn((url) => {
    const u = String(url);
    if (u.includes('groups/list.php')) return Promise.resolve(json({ success: true, groups: [] }));
    if (u.includes('user/read.php')) {
      return Promise.resolve(json({ success: true, id: 1, username: 'mario', email: 'mario@example.com', created_at: '2025-03-01T10:00:00+01:00', weekly_goal_default: 3 }));
    }
    return Promise.resolve(json({ ...profile, consents: [], id: 1, weekly_goal_default: 3 }));
  }));
  localStorage.setItem('themeMode', 'light');
});
afterEach(() => {
  vi.unstubAllGlobals();
  localStorage.clear();
});

describe('arrivo a /account#groups-shown', () => {
  it('il fuoco è sul blocco «Cosa mostro»', async () => {
    render(
      <ThemeModeProvider>
        <MemoryRouter initialEntries={['/account#groups-shown']}><Account /></MemoryRouter>
      </ThemeModeProvider>,
    );
    await waitFor(() => expect(document.activeElement).toBe(document.getElementById('groups-shown')), { timeout: 10000 });
  });
});
