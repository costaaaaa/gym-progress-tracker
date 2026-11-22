// Pagina «Moduli» (/account/moduli): la card dei moduli con i suoi interruttori; il cambio si salva subito e si
// annuncia nella notifica della cornice. La fetch è il confine. I casi della card da sola stanno in
// src/components/Account/ModulesCard.test.jsx.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import { json } from '../../test/dom';
import { renderAccount } from '../../test/accountRoutes';

vi.mock('react-router-dom', async (importOriginal) => ({ ...(await importOriginal()), useNavigate: () => () => {} }));
const { updateUser } = vi.hoisted(() => ({ updateUser: vi.fn() }));
vi.mock('../../context/AuthContext', () => {
  const auth = {
    user: { id: 1 }, isLoggedIn: true, loading: false, logout: () => {}, updateUser,
    emailState: { verified: true, email: 'mario@example.com', pendingEmail: null, blocked: false, daysLeft: null },
    openEmailDialog: () => {}, refreshEmailState: () => Promise.resolve(),
  };
  return { useAuth: () => auth };
});

const ALL = { body: true, recovery: true, levels: true, groups: true, ai: true };

const stubFetch = ({ settings } = {}) => vi.stubGlobal('fetch', vi.fn((url) => Promise.resolve(
  settings && url.includes('update_settings.php') ? settings()
    : url.includes('groups/list.php') ? json({ success: true, groups: [] })
      : url.includes('user/read.php') ? json({ id: 1, username: 'mario', email: 'mario@example.com', created_at: '2025-03-01T10:00:00+01:00', weekly_goal_default: 3 })
        : json({ success: true, consents: [], id: 1, weekly_goal_default: 3 }),
)));

beforeEach(() => {
  updateUser.mockClear();
  localStorage.setItem('themeMode', 'light');
  stubFetch();
});
afterEach(() => {
  vi.unstubAllGlobals();
  localStorage.clear();
});

const mount = async () => {
  renderAccount('/account/moduli');
  await screen.findByRole('heading', { level: 1, name: 'Moduli' });
};

describe('Moduli', () => {
  it('la card «Moduli» c\'è con i suoi quattro interruttori e il titolo «Moduli» è uno solo, quello della pagina', async () => {
    await mount();
    expect(screen.getAllByRole('heading', { name: 'Moduli' })).toHaveLength(1);
    expect(screen.getAllByRole('switch', { name: /^(Misure|Recupero e serie per muscolo|Livelli e traguardi|Gruppi)$/ })).toHaveLength(4);
  });

  it('cambiare un modulo salva subito, aggiorna il contesto e lo annuncia nella notifica della pagina', async () => {
    stubFetch({ settings: () => json({ success: true, modules: { ...ALL, body: false } }) });
    await mount();
    fireEvent.click(screen.getByRole('switch', { name: 'Misure' }));
    await waitFor(() => expect(updateUser).toHaveBeenCalledWith({ modules: { ...ALL, body: false } }));
    expect(fetch.mock.calls.filter(([url]) => url.includes('update_settings.php')).map(([, init]) => JSON.parse(init.body)))
      .toEqual([{ modules: { body: false } }]);
    expect(await screen.findByRole('alert')).toBeTruthy();
    expect(screen.getByText('Misure: non attivo')).toBeTruthy();
  });

  it('se il salvataggio fallisce l\'errore si vede nella notifica e l\'interruttore resta com\'era', async () => {
    stubFetch({ settings: () => json({ success: false }, 500) });
    await mount();
    fireEvent.click(screen.getByRole('switch', { name: 'Gruppi' }));
    await screen.findByText('Errore nel salvataggio dei moduli');
    expect(screen.getByRole('switch', { name: 'Gruppi' }).checked).toBe(true);
  });
});
