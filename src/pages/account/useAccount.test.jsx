// La lettura dei dati dell'account: caricamento, errore con la notifica, rilettura del solo livello quando cambia lo
// stato dell'email e risposta in ritardo che non scrive. La fetch è il confine; AuthContext è finto.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import useAccount from './useAccount';
import i18n from '../../i18n';
import { json } from '../../test/dom';

const auth = {};
vi.mock('../../context/AuthContext', () => ({ useAuth: () => auth }));

const emailState = (over = {}) => ({ verified: false, email: 'mario@example.com', pendingEmail: null, ...over });
const details = (over = {}) => ({ success: true, id: 1, username: 'mario', created_at: '2025-03-01T10:00:00Z', is_admin: true, tier: 'free', tier_last_day: null, signup_code: null, ...over });

beforeEach(async () => {
  await i18n.changeLanguage('it');
  Object.assign(auth, { user: { id: 1 }, emailState: emailState() });
  vi.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });

const mount = async (notify = vi.fn()) => {
  const hook = renderHook(() => useAccount(notify));
  await waitFor(() => expect(hook.result.current.loading).toBe(false));
  return { ...hook, notify };
};

describe('useAccount: lettura', () => {
  it('parte in caricamento, poi dà la risposta del server e la data di iscrizione', async () => {
    const fetchMock = vi.fn(() => Promise.resolve(json(details({ age: 30 }))));
    vi.stubGlobal('fetch', fetchMock);
    const hook = renderHook(() => useAccount(vi.fn()));
    expect(hook.result.current.loading).toBe(true);
    expect(hook.result.current.account).toBeNull();
    await waitFor(() => expect(hook.result.current.loading).toBe(false));
    expect(hook.result.current.account).toMatchObject({ username: 'mario', age: 30, tier: 'free' });
    expect(hook.result.current.joinDate).toEqual(new Date('2025-03-01T10:00:00Z'));
    expect(fetchMock).toHaveBeenCalledWith('/backend/api/user/read.php', { method: 'GET', credentials: 'include' });
  });

  it('senza created_at la data di iscrizione è oggi; is_admin vale solo se è proprio true', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(json(details({ created_at: undefined, is_admin: 1 })))));
    const { result } = await mount();
    expect(Math.abs(result.current.joinDate.getTime() - Date.now())).toBeLessThan(60000);
    expect(result.current.account.is_admin).toBe(false);
  });

  it('senza utente non legge nulla e non resta in caricamento', async () => {
    auth.user = null;
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const { result } = await mount();
    expect(result.current.account).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it.each([
    ['il server risponde con un errore', () => Promise.resolve(json({}, 500))],
    ['la rete non risponde', () => Promise.reject(new Error('rete'))],
  ])('lettura fallita (%s): nessun dato e la notifica di errore', async (_, reply) => {
    vi.stubGlobal('fetch', vi.fn(reply));
    const { result, notify } = await mount();
    expect(result.current.account).toBeNull();
    expect(notify).toHaveBeenCalledTimes(1);
    expect(notify).toHaveBeenCalledWith(i18n.t('account.load_error'), 'error');
  });
});

describe('useAccount: livello dopo la conferma dell\'email', () => {
  // Una risposta per ogni lettura di read.php; la prima è quella del caricamento
  const stubReads = (...replies) => {
    const fetchMock = vi.fn();
    replies.forEach((reply) => fetchMock.mockReturnValueOnce(reply));
    vi.stubGlobal('fetch', fetchMock);
    return fetchMock;
  };
  const confirm = (hook) => {
    auth.emailState = emailState({ verified: true });
    hook.rerender();
  };

  it('rilegge solo il livello, senza tornare in caricamento né toccare il resto dei dati', async () => {
    const fetchMock = stubReads(
      Promise.resolve(json(details({ age: 30 }))),
      Promise.resolve(json(details({ age: 99, tier: 'plus', tier_last_day: '2027-02-15', signup_code: { status: 'applied' } }))),
    );
    const hook = await mount();
    confirm(hook);
    await waitFor(() => expect(hook.result.current.account.tier).toBe('plus'));
    expect(hook.result.current.account).toMatchObject({ tier_last_day: '2027-02-15', signup_code: { status: 'applied' }, age: 30 });
    expect(hook.result.current.loading).toBe(false);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it.each([
    ['il server risponde success: false', () => Promise.resolve(json({ success: false, tier: 'pro' }))],
    ['il server risponde con un errore', () => Promise.resolve(json({ tier: 'pro' }, 500))],
    ['la rete non risponde', () => Promise.reject(new Error('rete'))],
  ])('rilettura del livello fallita (%s): i dati restano quelli di prima e nessuna notifica', async (_, reply) => {
    // la risposta fallita nasce solo alla seconda lettura: una promessa rifiutata prima non avrebbe chi la gestisce
    const fetchMock = vi.fn().mockReturnValueOnce(Promise.resolve(json(details({ age: 30 })))).mockImplementationOnce(reply);
    vi.stubGlobal('fetch', fetchMock);
    const hook = await mount();
    const before = hook.result.current.account;
    confirm(hook);
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2)); // la rilettura è partita
    await act(async () => { for (let i = 0; i < 5; i++) await Promise.resolve(); }); // e la risposta è stata gestita
    expect(hook.result.current.account).toEqual(before);
    expect(hook.result.current.account.tier).toBe('free');
    expect(hook.result.current.loading).toBe(false);
    expect(hook.notify).not.toHaveBeenCalled();
  });

  it('un cambio dello stato dell\'email che non conferma né cambia indirizzo non rilegge', async () => {
    const fetchMock = stubReads(Promise.resolve(json(details())));
    const hook = await mount();
    auth.emailState = emailState({ pendingEmail: 'altra@example.com' });
    hook.rerender();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('una risposta in ritardo non scrive sopra una lettura più recente', async () => {
    let answerFirst;
    stubReads(
      Promise.resolve(json(details())),
      new Promise((resolve) => { answerFirst = resolve; }),
      Promise.resolve(json(details({ tier: 'pro' }))),
    );
    const hook = await mount();
    confirm(hook); // prima lettura del livello: resta in attesa
    auth.emailState = emailState({ verified: true, email: 'nuova@example.com' });
    hook.rerender(); // seconda lettura: risponde subito
    await waitFor(() => expect(hook.result.current.account.tier).toBe('pro'));
    await act(async () => { answerFirst(json(details({ tier: 'plus' }))); });
    expect(hook.result.current.account.tier).toBe('pro');
  });
});
