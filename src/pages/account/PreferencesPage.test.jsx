// Pagina «Preferenze» (/account/preferenze): lingua, obiettivo settimanale e strumenti della serie, in una card e
// separati da una linea. L'obiettivo settimanale ha il font dei chip, come nell'app (lì è una riga di chip); la scelta
// è neutra, non rossa. Colore scritto a mano: primary/error #d50000. La fetch è il confine.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { screen, within, fireEvent, waitFor } from '@testing-library/react';
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

const RED = 'rgb(213, 0, 0)';

const stubFetch = ({ settings } = {}) => vi.stubGlobal('fetch', vi.fn((url) => Promise.resolve(
  settings && url.includes('update_settings.php') ? settings()
    : url.includes('groups/list.php') ? json({ success: true, groups: [] })
      : url.includes('user/read.php') ? json({ id: 1, username: 'mario', email: 'mario@example.com', created_at: '2025-03-01T10:00:00+01:00', weekly_goal_default: 3, locale: 'it' })
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
  const view = renderAccount('/account/preferenze');
  await screen.findByLabelText('Obiettivo settimanale');
  return view;
};
const button = (name) => screen.getByRole('button', { name });

describe('Preferenze: la card', () => {
  it('lingua, obiettivo settimanale e strumenti della serie stanno in una card, in quest\'ordine', async () => {
    await mount();
    const language = screen.getByLabelText('Lingua');
    const goal = screen.getByLabelText('Obiettivo settimanale');
    const tools = screen.getByRole('list', { name: 'Strumenti della serie' });
    const card = language.closest('.MuiCard-root');
    expect(card.contains(goal) && card.contains(tools)).toBe(true);
    expect(language.compareDocumentPosition(goal) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(goal.compareDocumentPosition(tools) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('la lingua si salva appena si sceglie', async () => {
    stubFetch({ settings: () => json({ success: true, locale: 'en' }) });
    await mount();
    fireEvent.mouseDown(screen.getByLabelText('Lingua'));
    fireEvent.click(await screen.findByRole('option', { name: 'English', hidden: true }));
    await waitFor(() => expect(updateUser).toHaveBeenCalledWith({ locale: 'en' }));
    expect(fetch.mock.calls.filter(([url]) => url.includes('update_settings.php')).map(([, init]) => JSON.parse(init.body))).toEqual([{ locale: 'en' }]);
  });
});

describe('obiettivo settimanale', () => {
  it('i pulsanti sono in Lexend 500, come i chip che si premono', async () => {
    await mount();
    const group = screen.getByLabelText('Obiettivo settimanale');
    for (const b of group.querySelectorAll('button')) {
      const { fontFamily, fontWeight } = getComputedStyle(b);
      expect({ label: b.textContent, fontFamily, fontWeight })
        .toEqual({ label: b.textContent, fontFamily: '"Lexend", sans-serif', fontWeight: '500' });
    }
  });

  it('l\'obiettivo settimanale scelto è neutro, non rosso', async () => {
    await mount();
    const group = screen.getByLabelText('Obiettivo settimanale');
    const selected = group.querySelector('.Mui-selected');
    expect(selected).not.toBeNull();
    expect(getComputedStyle(selected).color).not.toBe(RED);
  });
});

describe('nomi accessibili', () => {
  it('l\'interruttore del timer di recupero è legato al suo titolo', async () => {
    await mount();
    expect(screen.getByRole('switch', { name: 'Timer di recupero' })).toBeTruthy();
  });
});

describe('strumenti della serie', () => {
  const group = () => screen.getByRole('list', { name: 'Strumenti della serie' });
  const settingsCalls = () => fetch.mock.calls.filter(([url]) => url.includes('update_settings.php')).map(([, init]) => JSON.parse(init.body));

  it('in Preferenze c\'è il gruppo con i tre interruttori, timer di recupero compreso', async () => {
    await mount();
    expect(within(group()).getAllByRole('switch').map((s) => s.getAttribute('aria-label'))).toEqual(['Timer di recupero', 'Tecnica di intensità', 'Peso suggerito']);
  });

  it.each([
    ['Timer di recupero', { rest_timer_enabled: false }],
    ['Tecnica di intensità', { focus_tools: { technique: false } }],
    ['Peso suggerito', { focus_tools: { suggested_weight: false } }],
  ])('%s: il cambio salva subito la chiave giusta', async (name, body) => {
    stubFetch({ settings: () => json({ success: true, rest_timer_enabled: false, focus_tools: { technique: false, suggested_weight: false } }) });
    await mount();
    fireEvent.click(within(group()).getByRole('switch', { name }));
    await waitFor(() => expect(settingsCalls()).toEqual([body]));
    await waitFor(() => expect(updateUser).toHaveBeenCalled());
  });
});

describe('una rilettura dei dati', () => {
  it('non smonta la pagina: l\'obiettivo scelto e il suo esito restano', async () => {
    stubFetch({ settings: () => json({ success: true, weekly_goal: 5, weekly_goal_default: 3, weekly_goal_pending: null }) });
    const { rerenderAccount } = await mount();
    fireEvent.click(within(screen.getByLabelText('Obiettivo settimanale')).getByRole('button', { name: '5' }));
    await screen.findByText('Obiettivo settimanale aggiornato');
    const { useAuth } = await import('../../context/AuthContext');
    useAuth().user = { id: 1 };
    const reads = () => fetch.mock.calls.filter(([url]) => String(url).includes('user/read.php')).length;
    expect(reads()).toBe(1);
    rerenderAccount();
    await waitFor(() => expect(reads()).toBe(2));
    expect(within(screen.getByLabelText('Obiettivo settimanale')).getByRole('button', { name: '5' }).getAttribute('aria-pressed')).toBe('true');
  });
});

// Il pulsante del salvataggio del profilo sta in «Profilo»: qui non c'è
describe('cosa non c\'è', () => {
  it('niente «Modifica» né «Salva profilo»', async () => {
    await mount();
    expect(screen.queryByRole('button', { name: 'Modifica' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Salva profilo' })).toBeNull();
    expect(button('5')).toBeTruthy();
  });
});
