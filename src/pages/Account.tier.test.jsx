// Account: riga del livello nella card del profilo (Gratis, Plus fino a…, Pro senza scadenza, codice di
// registrazione in attesa o non applicato). La fetch è il confine; le date sono giorni scritti (tier_last_day),
// senza conversione di fuso: stesso testo in ogni fuso del browser.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Account from './Account';
import { ThemeModeProvider } from '../context/ThemeModeContext';
import i18n from '../i18n';
import { json } from '../test/dom';
import { textBelow } from '../test/minText';
import { setBrowserTimeZone } from '../test/timeZone';

vi.mock('react-router-dom', async (importOriginal) => ({ ...(await importOriginal()), useNavigate: () => () => {} }));
const auth = {};
vi.mock('../context/AuthContext', () => ({ useAuth: () => auth }));

let tierFields;
beforeEach(async () => {
  await i18n.changeLanguage('it');
  tierFields = { tier: 'free', tier_until: null, tier_last_day: null, signup_code: null };
  Object.assign(auth, {
    user: { id: 1 }, isLoggedIn: true, loading: false, logout: () => {}, updateUser: () => {},
    emailState: { verified: true, email: 'mario@example.com', pendingEmail: null, blocked: false, daysLeft: null },
    openEmailDialog: vi.fn(),
    refreshEmailState: vi.fn(() => Promise.resolve()),
  });
  vi.stubGlobal('fetch', vi.fn((url) => {
    const u = String(url);
    if (u.includes('groups/list.php')) return Promise.resolve(json({ success: true, groups: [] }));
    if (u.includes('user/consent.php')) return Promise.resolve(json({ success: true, consents: { terms: { granted: true, version: 1 }, health_data: { granted: true, version: 1 } } }));
    if (u.includes('user/read.php')) {
      return Promise.resolve(json({ success: true, id: 1, username: 'mario', email: 'mario@example.com', created_at: '2025-03-01T10:00:00+01:00', weekly_goal_default: 3, ...tierFields }));
    }
    return Promise.resolve(json({ success: true, consents: [], id: 1, weekly_goal_default: 3 }));
  }));
  localStorage.setItem('themeMode', 'light');
});
afterEach(() => {
  vi.unstubAllGlobals();
  localStorage.clear();
});

const mount = async () => {
  render(<MemoryRouter><ThemeModeProvider><Account isEmbedded /></ThemeModeProvider></MemoryRouter>);
  await screen.findByText('mario');
  return within(screen.getByText('mario').closest('.MuiCard-root'));
};
const row = (card) => card.getByTestId('account-tier');

describe('livello nella card del profilo', () => {
  it('Gratis, con il link ai piani', async () => {
    const card = await mount();
    expect(row(card).textContent).toBe('Livello: Gratis');
    expect(card.getByRole('link', { name: 'Vedi i piani' }).getAttribute('href')).toBe('/piani');
  });

  it('Plus con ultimo giorno: «Plus fino al 15 febbraio 2027»', async () => {
    tierFields = { tier: 'plus', tier_until: '2027-02-15T23:00:00Z', tier_last_day: '2027-02-15', signup_code: { status: 'applied', tier: 'plus', duration_days: 90 } };
    const card = await mount();
    expect(row(card).textContent).toBe('Livello: Plus fino al 15 febbraio 2027');
  });

  it('Pro senza scadenza', async () => {
    tierFields = { tier: 'pro', tier_until: null, tier_last_day: null, signup_code: { status: 'applied', tier: 'pro', duration_days: null } };
    const card = await mount();
    expect(row(card).textContent).toBe('Livello: Pro, senza scadenza');
  });

  it('Plus senza scadenza assegnato a mano', async () => {
    tierFields = { tier: 'plus', tier_until: null, tier_last_day: null, signup_code: null };
    const card = await mount();
    expect(row(card).textContent).toBe('Livello: Plus, senza scadenza');
  });

  it('prima della conferma: Gratis, con il livello del codice in attesa', async () => {
    tierFields = { tier: 'free', tier_until: null, tier_last_day: null, signup_code: { status: 'pending', tier: 'plus', duration_days: 90 } };
    auth.emailState = { ...auth.emailState, verified: false, daysLeft: 5 };
    const card = await mount();
    expect(row(card).textContent).toBe('Livello: Gratis. Plus in attesa: conferma l\'email per attivarlo');
  });

  it('in attesa di un Pro: nomina Pro', async () => {
    tierFields = { tier: 'free', tier_until: null, tier_last_day: null, signup_code: { status: 'pending', tier: 'pro', duration_days: null } };
    const card = await mount();
    expect(row(card).textContent).toBe('Livello: Gratis. Pro in attesa: conferma l\'email per attivarlo');
  });

  it('codice non applicato (posti finiti o spento): Gratis e lo dice', async () => {
    tierFields = { tier: 'free', tier_until: null, tier_last_day: null, signup_code: { status: 'missed', tier: 'plus', duration_days: 90 } };
    const card = await mount();
    expect(row(card).textContent).toBe('Livello: Gratis. Il codice di registrazione non è stato applicato.');
  });

  it('codice non applicato ma l\'account ha un livello: mostra il livello, non il messaggio', async () => {
    tierFields = { tier: 'plus', tier_until: '2027-03-01T23:00:00Z', tier_last_day: '2027-03-01', signup_code: { status: 'missed', tier: 'plus', duration_days: 90 } };
    const card = await mount();
    expect(row(card).textContent).toBe('Livello: Plus fino al 1 marzo 2027');
  });

  it('livello finito dopo un codice applicato: Gratis, nessun messaggio', async () => {
    tierFields = { tier: 'free', tier_until: null, tier_last_day: null, signup_code: { status: 'applied', tier: 'plus', duration_days: 90 } };
    const card = await mount();
    expect(row(card).textContent).toBe('Livello: Gratis');
  });

  it('un server senza i campi del livello: la riga non compare', async () => {
    tierFields = {};
    const card = await mount();
    expect(card.queryByTestId('account-tier')).toBeNull();
  });

  it('in inglese: testi, data e link ai piani', async () => {
    await i18n.changeLanguage('en');
    tierFields = { tier: 'plus', tier_until: '2027-02-15T23:00:00Z', tier_last_day: '2027-02-15', signup_code: null };
    const card = await mount();
    expect(row(card).textContent).toBe('Plan: Plus until February 15, 2027');
    expect(card.getByRole('link', { name: 'See plans' }).getAttribute('href')).toBe('/en/plans');
  });

  it('in inglese, in attesa', async () => {
    await i18n.changeLanguage('en');
    tierFields = { tier: 'free', tier_until: null, tier_last_day: null, signup_code: { status: 'pending', tier: 'pro', duration_days: null } };
    const card = await mount();
    expect(row(card).textContent).toBe('Plan: Free. Pro pending: confirm your email to activate it');
  });

  it('testo di almeno 16px', async () => {
    tierFields = { tier: 'free', tier_until: null, tier_last_day: null, signup_code: { status: 'pending', tier: 'plus', duration_days: 90 } };
    const card = await mount();
    expect(textBelow(row(card).parentElement, 16)).toEqual([]);
  });

  it.each(['UTC', 'Europe/Rome', 'America/Los_Angeles', 'Asia/Tokyo'])('la data è il giorno scritto anche con il browser in %s', async (zone) => {
    setBrowserTimeZone(zone);
    tierFields = { tier: 'plus', tier_until: '2027-02-15T23:00:00Z', tier_last_day: '2027-02-15', signup_code: null };
    const card = await mount();
    expect(row(card).textContent).toBe('Livello: Plus fino al 15 febbraio 2027');
  });
});
