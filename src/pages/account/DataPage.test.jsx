// Pagina «Dati e privacy» (/account/dati): consenso alle misure corporee, gruppi mostrati e visibilità, esportazione.
// Colori scritti a mano: text.primary #1a1816, text.secondary #6b6663, semantico di successo #15803d. La fetch è il confine.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { screen, within, fireEvent, waitFor, act } from '@testing-library/react';
import i18n from '../../i18n';
import { json } from '../../test/dom';
import { pinLocalClock } from '../../test/timeZone';
import { renderAccount } from '../../test/accountRoutes';

vi.mock('react-router-dom', async (importOriginal) => ({ ...(await importOriginal()), useNavigate: () => () => {} }));
const auth = {};
vi.mock('../../context/AuthContext', () => ({ useAuth: () => auth }));

const INK = 'rgb(26, 24, 22)';
const GREY = 'rgb(107, 102, 99)';
const GREEN = 'rgb(21, 128, 61)';
const WHITE = 'rgb(255, 255, 255)';

const groups = [
  { id: 7, name: 'Palestra Rossi', my_role: 'owner' },
  { id: 8, name: 'Amici del giovedì', my_role: 'member' },
];

beforeEach(async () => {
  await i18n.changeLanguage('it');
  Object.assign(auth, {
    user: { id: 1 }, isLoggedIn: true, loading: false, logout: () => {}, updateUser: () => {},
    emailState: { verified: true, email: 'mario@example.com', pendingEmail: null, blocked: false, daysLeft: null },
    openEmailDialog: vi.fn(), refreshEmailState: vi.fn(() => Promise.resolve()),
  });
  vi.stubGlobal('fetch', vi.fn((url) => {
    const u = String(url);
    if (u.includes('groups/list.php')) return Promise.resolve(json({ success: true, groups }));
    if (u.includes('user/consent.php')) return Promise.resolve(json({ success: true, consents: { terms: { granted: true, version: 1 }, health_data: { granted: true, version: 1 } } }));
    if (u.includes('user/read.php')) {
      return Promise.resolve(json({ success: true, id: 1, username: 'atleta_con_un_nome_molto_lungo', email: 'mario@example.com', created_at: '2025-03-01T10:00:00+01:00', weekly_goal_default: 3 }));
    }
    return Promise.resolve(json({ success: true, consents: [], id: 1, weekly_goal_default: 3 }));
  }));
  localStorage.setItem('themeMode', 'light');
});
afterEach(() => {
  vi.unstubAllGlobals();
  localStorage.clear();
});

const mount = async (path = '/account/dati') => {
  const view = renderAccount(path);
  await screen.findByText('Palestra Rossi');
  return view;
};
const groupsCard = () => screen.getByText('Gruppi e visibilità', { selector: 'h2' }).closest('.MuiCard-root');

describe('Dati e privacy: le card', () => {
  it('consenso alle misure, poi gruppi e visibilità, poi esportazione, in quest\'ordine', async () => {
    await mount();
    const consent = screen.getByLabelText('Consenso al trattamento delle misure corporee');
    const groupsHeading = screen.getByText('Gruppi e visibilità', { selector: 'h2' });
    const exportTitle = screen.getByText('Esporta i tuoi dati');
    expect(consent.compareDocumentPosition(groupsHeading) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(groupsHeading.compareDocumentPosition(exportTitle) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('la card del consenso per i dati di salute e quella della visibilità nei gruppi restano sempre', async () => {
    await mount();
    expect(screen.getByText('Gruppi e visibilità')).toBeTruthy();
    expect(screen.getByLabelText('Consenso al trattamento delle misure corporee')).toBeTruthy();
  });
});

describe('arrivo da un collegamento', () => {
  it('/account/dati#groups-shown: il fuoco è sul blocco «Cosa mostro»', async () => {
    await mount('/account/dati#groups-shown');
    await waitFor(() => expect(document.activeElement).toBe(document.getElementById('groups-shown')), { timeout: 10000 });
  });

  it('/account/dati#groups-list: il fuoco è sull\'elenco dei gruppi', async () => {
    await mount('/account/dati#groups-list');
    await waitFor(() => expect(document.activeElement).toBe(document.getElementById('groups-list')), { timeout: 10000 });
  });

  it('/account/dati#altro: la pagina si apre e il fuoco non va su nessuna delle due sezioni dei gruppi', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      await mount('/account/dati#altro');
      await waitFor(() => expect(screen.getByLabelText('Consenso al trattamento delle misure corporee').checked).toBe(true));
      expect(document.activeElement).not.toBe(document.getElementById('groups-shown'));
      expect(document.activeElement).not.toBe(document.getElementById('groups-list'));
      expect(error).not.toHaveBeenCalled();
    } finally {
      error.mockRestore();
    }
  });

  it('senza ancora il fuoco non si sposta', async () => {
    await mount();
    expect(document.activeElement).toBe(document.body);
  });
});

describe('bottoni', () => {
  it('«Esporta» è outlined neutro: testo in inchiostro e bordo grigio visibile', async () => {
    await mount();
    const style = getComputedStyle(screen.getAllByRole('button', { name: 'Esporta' }).find((b) => b.classList.contains('MuiButton-outlined')));
    expect(style.color).toBe(INK);
    expect(style.borderColor).toBe(GREY);
  });

  it('«Gestisci» e «Esci» dei gruppi sono in inchiostro, non rosso del marchio né errore', async () => {
    await mount();
    const card = groupsCard();
    expect(getComputedStyle(within(card).getByRole('link', { name: 'Gestisci' })).color).toBe(INK);
    expect(getComputedStyle(within(card).getByRole('button', { name: 'Esci' })).color).toBe(INK);
  });
});

describe('gruppi', () => {
  it('i nomi dei gruppi sono link in inchiostro senza sottolineatura', async () => {
    await mount();
    const style = getComputedStyle(screen.getByRole('link', { name: 'Palestra Rossi' }));
    expect(style.color).toBe(INK);
    expect(style.textDecoration).not.toContain('underline');
  });
});

describe('informativa e termini', () => {
  it.each([['light', INK], ['dark', WHITE]])('in %s i due link hanno il colore del testo, sottolineati', async (mode, ink) => {
    localStorage.setItem('themeMode', mode);
    await mount();
    for (const [name, href] of [['Informativa privacy', '/privacy.html'], ['Termini d\'uso', '/termini.html']]) {
      const link = screen.getByRole('link', { name });
      expect(link.getAttribute('href')).toBe(href);
      expect(link.getAttribute('target')).toBe('_blank');
      expect(link.getAttribute('rel')).toBe('noopener noreferrer');
      const style = getComputedStyle(link);
      expect(style.color).toBe(ink);
      expect(style.textDecoration).toContain('underline');
    }
  });

  it('in inglese i due link portano alle pagine inglesi', async () => {
    await i18n.changeLanguage('en');
    await mount();
    expect(screen.getByRole('link', { name: 'Privacy notice' }).getAttribute('href')).toBe('/en/privacy.html');
    expect(screen.getByRole('link', { name: 'Terms of use' }).getAttribute('href')).toBe('/en/terms.html');
  });
});

describe('interruttori e scelte', () => {
  it('l\'interruttore acceso non usa il rosso del marchio: verde semantico', async () => {
    await mount();
    const toggle = screen.getByLabelText('Consenso al trattamento delle misure corporee');
    await waitFor(() => expect(toggle.checked).toBe(true));
    const base = toggle.closest('.MuiSwitch-switchBase');
    expect(getComputedStyle(base).color).toBe(GREEN);
    expect(getComputedStyle(base.parentElement.querySelector('.MuiSwitch-track')).backgroundColor).toBe(GREEN);
  });
});

describe('esporta i dati', () => {
  afterEach(() => vi.useRealTimers());

  // 00:30 a Roma è ancora ieri in UTC; 23:30 a New York è già domani in UTC
  it.each([['Europe/Rome', 0, 30], ['America/New_York', 23, 30]])('il file porta il giorno locale (%s, %i:%i), non quello UTC', async (zone, hour, minute) => {
    pinLocalClock(zone, 2026, 9, 20, hour, minute);
    await mount();
    URL.createObjectURL = vi.fn(() => 'blob:x');
    URL.revokeObjectURL = vi.fn();
    const names = [];
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function click() { names.push(this.download); });
    fireEvent.click(screen.getAllByRole('button', { name: 'Esporta' })[0]);
    await waitFor(() => expect(names).toHaveLength(1));
    expect(names[0]).toBe('dati_liftindex_atleta_con_un_nome_molto_lungo_2026-10-20.json');
  });
});

describe('una rilettura dei dati', () => {
  const consentReads = () => fetch.mock.calls.filter(([url]) => String(url).includes('user/consent.php')).length;
  const accountReads = () => fetch.mock.calls.filter(([url]) => String(url).includes('user/read.php')).length;

  // La seconda lettura resta in sospeso finché il test non la lascia andare: la pagina deve restare montata mentre
  // aspetta e dopo la risposta, e il consenso non deve essere riletto neanche a lettura conclusa
  it('non smonta la pagina: il consenso non si rilegge, né durante la rilettura né dopo la sua risposta', async () => {
    const { rerenderAccount } = await mount();
    await waitFor(() => expect(screen.getByLabelText('Consenso al trattamento delle misure corporee').checked).toBe(true));
    expect(consentReads()).toBe(1);

    const original = fetch;
    let release;
    const held = new Promise((resolve) => { release = resolve; });
    vi.stubGlobal('fetch', vi.fn((url, init) => (String(url).includes('user/read.php') ? held : original(url, init))));
    auth.user = { id: 1 };
    rerenderAccount();
    await waitFor(() => expect(accountReads()).toBe(1));
    expect(screen.getByLabelText('Consenso al trattamento delle misure corporee').checked).toBe(true);
    expect(screen.queryByRole('progressbar')).toBeNull();

    // La risposta arriva con un nome utente diverso (act scarica le promesse e gli effetti che ne seguono). Il segnale
    // che la pagina l'ha ricevuta è il nome del file esportato, che porta il nome nuovo
    await act(async () => {
      release(json({ success: true, id: 1, username: 'nome_nuovo', email: 'mario@example.com', created_at: '2025-03-01T10:00:00+01:00', weekly_goal_default: 3 }));
      await held;
    });
    URL.createObjectURL = vi.fn(() => 'blob:x');
    URL.revokeObjectURL = vi.fn();
    const names = [];
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function click() { names.push(this.download); });
    try {
      fireEvent.click(screen.getAllByRole('button', { name: 'Esporta' })[0]);
      await waitFor(() => expect(names).toHaveLength(1));
    } finally {
      click.mockRestore();
    }
    expect(names[0]).toMatch(/^dati_liftindex_nome_nuovo_\d{4}-\d{2}-\d{2}\.json$/);
    expect(screen.getByLabelText('Consenso al trattamento delle misure corporee').checked).toBe(true);
    expect(screen.queryByRole('progressbar')).toBeNull();
    expect(original.mock.calls.filter(([url]) => String(url).includes('user/consent.php'))).toHaveLength(1);
  });
});
