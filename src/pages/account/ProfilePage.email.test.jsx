// Pagina «Profilo»: stato dell'email nella card del profilo, «Cambia indirizzo», cambio in attesa. La fetch è il confine,
// lo stato dell'email viene dal contesto (qui finto: conta cosa ne fa la pagina).
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { screen, fireEvent, waitFor, within } from '@testing-library/react';
import { json } from '../../test/dom';
import { renderAccount } from '../../test/accountRoutes';

vi.mock('react-router-dom', async (importOriginal) => ({ ...(await importOriginal()), useNavigate: () => () => {} }));
const auth = {};
vi.mock('../../context/AuthContext', () => ({ useAuth: () => auth }));

const state = (extra = {}) => ({ verified: true, email: 'mario@example.com', pendingEmail: null, blocked: false, daysLeft: null, ...extra });
let calls;

beforeEach(() => {
  calls = [];
  Object.assign(auth, {
    user: { id: 1 }, isLoggedIn: true, loading: false, logout: () => {}, updateUser: () => {},
    emailState: state(),
    openEmailDialog: vi.fn(),
    refreshEmailState: vi.fn(() => Promise.resolve()),
  });
  vi.stubGlobal('fetch', vi.fn((url, init) => {
    calls.push({ url: String(url), init });
    const u = String(url);
    if (u.includes('groups/list.php')) return Promise.resolve(json({ success: true, groups: [] }));
    if (u.includes('user/consent.php')) return Promise.resolve(json({ success: true, consents: { terms: { granted: true, version: 1 }, health_data: { granted: true, version: 1 } } }));
    if (u.includes('user/read.php')) return Promise.resolve(json({ id: 1, username: 'mario', email: 'vecchio@example.com', created_at: '2025-03-01T10:00:00+01:00', weekly_goal_default: 3, tier: 'free', tier_until: null, tier_last_day: null, signup_code: null }));
    if (u.includes('change_email.php')) return Promise.resolve(json(auth.changeReply ?? { success: true, mode: 'immediate', email: 'nuovo@example.com', pending_email: null }));
    if (u.includes('cancel_email_change.php')) return Promise.resolve(json({ success: true, cancelled: true }));
    return Promise.resolve(json({ success: true, consents: [], id: 1, weekly_goal_default: 3 }));
  }));
  localStorage.setItem('themeMode', 'light');
});
afterEach(() => {
  vi.unstubAllGlobals();
  delete auth.changeReply;
  localStorage.clear();
});

const mount = async () => {
  renderAccount('/account/profilo');
  await screen.findByText('mario');
};
const profileCard = () => screen.getByText('mario').closest('.MuiCard-root');

describe('stato dell\'email nella card del profilo', () => {
  it('confermata: «Confermata», senza il comando per scrivere il codice, con «Cambia indirizzo»', async () => {
    await mount();
    const card = within(profileCard());
    expect(card.getByText('mario@example.com')).toBeTruthy();
    expect(card.getByText('Confermata')).toBeTruthy();
    expect(card.queryByRole('button', { name: 'Scrivi il codice' })).toBeNull();
    expect(card.getByRole('button', { name: 'Cambia indirizzo' })).toBeTruthy();
  });

  it('l\'indirizzo mostrato è quello dello stato del contesto (cambia dopo una conferma), non quello caricato all\'apertura', async () => {
    await mount();
    expect(screen.queryByText('vecchio@example.com')).toBeNull();
    expect(within(profileCard()).getByText('mario@example.com')).toBeTruthy();
  });

  it('da confermare: «Da confermare» e il comando che apre la finestra del codice', async () => {
    auth.emailState = state({ verified: false, daysLeft: 4 });
    await mount();
    const card = within(profileCard());
    expect(card.getByText('Da confermare')).toBeTruthy();
    expect(card.queryByText('Confermata')).toBeNull();
    fireEvent.click(card.getByRole('button', { name: 'Scrivi il codice' }));
    expect(auth.openEmailDialog).toHaveBeenCalledTimes(1);
  });

  it('cambio in attesa su un account confermato: resta «Confermata» col vecchio indirizzo e compare l\'attesa', async () => {
    auth.emailState = state({ pendingEmail: 'nuovo@example.com' });
    await mount();
    const card = within(profileCard());
    expect(card.getByText('mario@example.com')).toBeTruthy();
    expect(card.getByText('Confermata')).toBeTruthy();
    expect(card.getByText('In attesa di conferma: nuovo@example.com')).toBeTruthy();
    fireEvent.click(card.getByRole('button', { name: 'Scrivi il codice' }));
    expect(auth.openEmailDialog).toHaveBeenCalledTimes(1);
  });

  it('«Annulla» toglie il cambio in attesa, rilegge lo stato e lo annuncia', async () => {
    auth.emailState = state({ pendingEmail: 'nuovo@example.com' });
    await mount();
    fireEvent.click(within(profileCard()).getByRole('button', { name: 'Annulla il cambio di indirizzo' }));
    await waitFor(() => expect(auth.refreshEmailState).toHaveBeenCalled());
    const cancel = calls.find((c) => c.url.includes('cancel_email_change.php'));
    expect(cancel.init.method).toBe('POST');
    expect(await screen.findByText('Cambio di indirizzo annullato.')).toBeTruthy();
  });

  it('i comandi hanno un bersaglio di almeno 44 px di altezza', async () => {
    auth.emailState = state({ verified: false, daysLeft: 4, pendingEmail: null });
    await mount();
    const card = within(profileCard());
    for (const name of ['Scrivi il codice', 'Cambia indirizzo']) {
      expect(getComputedStyle(card.getByRole('button', { name })).minHeight).toBe('44px');
    }
  });

  it('senza stato (non ancora letto) la card non mostra né stato né comandi di conferma', async () => {
    auth.emailState = null;
    await mount();
    const card = within(profileCard());
    expect(card.queryByText('Confermata')).toBeNull();
    expect(card.queryByText('Da confermare')).toBeNull();
    expect(card.queryByRole('button', { name: 'Cambia indirizzo' })).toBeNull();
  });
});

describe('Cambia indirizzo', () => {
  const open = () => fireEvent.click(within(profileCard()).getByRole('button', { name: 'Cambia indirizzo' }));
  const submitChange = () => {
    const dialog = screen.getByRole('dialog', { name: 'Cambia indirizzo email' });
    fireEvent.change(within(dialog).getByLabelText(/^Nuovo indirizzo email/), { target: { value: 'nuovo@example.com' } });
    fireEvent.change(within(dialog).getByLabelText(/^Password/), { target: { value: 'Segreta!2026' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Cambia indirizzo' }));
  };

  it('account non confermato: l\'indirizzo cambia subito e si apre la finestra del codice', async () => {
    auth.emailState = state({ verified: false, daysLeft: 4 });
    await mount();
    open();
    submitChange();
    await waitFor(() => expect(auth.openEmailDialog).toHaveBeenCalledTimes(1));
    expect(auth.refreshEmailState).toHaveBeenCalled();
    expect(JSON.parse(calls.find((c) => c.url.includes('change_email.php')).init.body)).toEqual({ email: 'nuovo@example.com', password: 'Segreta!2026' });
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Cambia indirizzo email' })).toBeNull());
  });

  it('account confermato: il nuovo indirizzo resta in attesa e si apre la finestra per scrivere il suo codice', async () => {
    auth.changeReply = { success: true, mode: 'pending', email: null, pending_email: 'nuovo@example.com' };
    await mount();
    open();
    submitChange();
    await waitFor(() => expect(auth.openEmailDialog).toHaveBeenCalledTimes(1));
    expect(auth.refreshEmailState).toHaveBeenCalled();
  });

  it('indirizzo già in uso: l\'errore sta sul campo dell\'indirizzo e non si apre il codice', async () => {
    auth.changeReply = { success: false, code: 'email_taken', field: 'email' };
    await mount();
    open();
    submitChange();
    const dialog = screen.getByRole('dialog', { name: 'Cambia indirizzo email' });
    await waitFor(() => expect(within(dialog).getByLabelText(/^Nuovo indirizzo email/).getAttribute('aria-invalid')).toBe('true'));
    expect(auth.openEmailDialog).not.toHaveBeenCalled();
  });
});
