// Account: la cornice (dati letti una volta sola) e l'elenco a /account: testata con il livello, voci, «Esci» ed «Elimina account».
// Colori scritti a mano: text.primary #1a1816, text.secondary #6b6663, primary/error #d50000 (in scuro error #ff5252).
// La fetch è il confine.
// Le pagine delle voci hanno i loro file in src/pages/account/; qui c'è quello che hanno in comune.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { screen, within, fireEvent, waitFor } from '@testing-library/react';
import i18n from '../i18n';
import { textBelow } from '../test/minText';
import { json, expectPageTitleBlock } from '../test/dom';
import { describedBy } from '../test/accessibleNames';
import { renderAccount } from '../test/accountRoutes';
import { reads } from '../test/settingRows';

vi.mock('react-router-dom', async (importOriginal) => ({ ...(await importOriginal()), useNavigate: () => () => {} }));
const auth = {};
vi.mock('../context/AuthContext', () => ({ useAuth: () => auth }));

const INK = 'rgb(26, 24, 22)';
const GREY = 'rgb(107, 102, 99)';
const RED = 'rgb(213, 0, 0)';
const RED_ON_DARK = 'rgb(255, 82, 82)';

const FREE = { tier: 'free', tier_until: null, tier_last_day: null, signup_code: null };
const stubFetch = ({ is_admin = false, tierFields = FREE } = {}) => vi.stubGlobal('fetch', vi.fn((url) => Promise.resolve(
  String(url).includes('groups/list.php') ? json({ success: true, groups: [] })
    : String(url).includes('user/consent.php') ? json({ success: true, consents: { terms: { granted: true, version: 1 }, health_data: { granted: true, version: 1 } } })
      : String(url).includes('user/read.php') ? json({
        id: 1, username: 'atleta_con_un_nome_molto_lungo', email: 'atleta.con.un.indirizzo.lungo@example.com',
        created_at: '2025-03-01T10:00:00+01:00', is_admin, weight_unit: 'kg', weekly_goal_default: 3, ...tierFields,
      })
        : json({ success: true, consents: [], id: 1, weekly_goal_default: 3 }),
)));

beforeEach(async () => {
  await i18n.changeLanguage('it');
  localStorage.setItem('themeMode', 'light');
  Object.assign(auth, {
    user: { id: 1 }, isLoggedIn: true, loading: false, logout: vi.fn(), updateUser: vi.fn(),
    emailState: { verified: true, email: 'atleta.con.un.indirizzo.lungo@example.com', pendingEmail: null, blocked: false, daysLeft: null },
    openEmailDialog: vi.fn(), refreshEmailState: () => Promise.resolve(),
  });
  stubFetch();
});
afterEach(() => {
  vi.unstubAllGlobals();
  localStorage.clear();
});

const mount = async (path = '/account') => {
  const view = renderAccount(path);
  await screen.findByRole('heading', { level: 1 });
  return view;
};

const ROWS = [
  ['Profilo e preferenze', '/account/profilo', 'Email, profilo fisico, lingua, unità, tema, obiettivo', 'Profile and preferences', 'Email, physical profile, language, units, theme, goal'],
  ['Moduli', '/account/moduli', 'Cosa vedere in LiftIndex', 'Modules', 'What to see in LiftIndex'],
  ['Dati e privacy', '/account/dati', 'Consenso alle misure, gruppi mostrati, esportazione', 'Data and privacy', 'Measurement consent, groups shown, export'],
  ['Sicurezza', '/account/sicurezza', 'Password', 'Security', 'Password'],
];

describe('titolo della pagina', () => {
  it('un solo h1 «Account» nello stile titolo di pagina, e il titolo del documento lo segue', async () => {
    await mount();
    const h1s = screen.getAllByRole('heading', { level: 1 });
    expect(h1s.map((h) => h.textContent)).toEqual(['Account']);
    expect(getComputedStyle(h1s[0]).fontSize).toBe('28px');
    expect(getComputedStyle(h1s[0]).fontWeight).toBe('800');
    expectPageTitleBlock(h1s[0]);
    // il titolo del documento lo scrive un effetto, a volte dopo il primo disegno
    await waitFor(() => expect(document.title).toBe('Account | LiftIndex'));
  });
});

const tierRow = () => screen.getByTestId('account-tier');
const follows = (a, b) => Boolean(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING);

describe('testata', () => {
  it('avatar con l\'iniziale, nome utente ed email, senza troncarli', async () => {
    await mount();
    const name = screen.getByText('atleta_con_un_nome_molto_lungo');
    const email = screen.getByText('atleta.con.un.indirizzo.lungo@example.com');
    expect(screen.getByText('A')).toBeTruthy();
    for (const el of [name, email]) {
      expect(getComputedStyle(el).textOverflow).not.toBe('ellipsis');
      expect(getComputedStyle(el).whiteSpace).not.toBe('nowrap');
    }
  });

  it('la riga del livello sta sotto nome ed email e prima dell\'elenco, con un solo «Vedi i piani»', async () => {
    stubFetch({ tierFields: { tier: 'plus', tier_until: null, tier_last_day: null, signup_code: null } });
    await mount();
    expect(tierRow().textContent).toBe('Livello: Plus, senza scadenza');
    const name = screen.getByText('atleta_con_un_nome_molto_lungo');
    expect(follows(name, tierRow())).toBe(true);
    expect(follows(screen.getByText('atleta.con.un.indirizzo.lungo@example.com'), tierRow())).toBe(true);
    expect(follows(tierRow(), screen.getByRole('link', { name: 'Profilo e preferenze' }))).toBe(true);
    // nella colonna di nome ed email, non accanto all'avatar
    expect(tierRow().parentElement.parentElement).toBe(name.parentElement);
    expect(name.parentElement.contains(screen.getByText('A'))).toBe(false);
    expect(screen.getAllByRole('link', { name: 'Vedi i piani' })).toHaveLength(1);
  });

  it('senza il campo del livello (server più vecchio) la riga e il suo collegamento non compaiono', async () => {
    stubFetch({ tierFields: {} });
    await mount();
    expect(screen.queryByTestId('account-tier')).toBeNull();
    expect(screen.queryByRole('link', { name: 'Vedi i piani' })).toBeNull();
  });
});

describe('elenco delle voci', () => {
  it('quattro voci, nell\'ordine: Profilo e preferenze, Moduli, Dati e privacy, Sicurezza; prima di loro solo «Vedi i piani» della testata', async () => {
    await mount();
    const hrefs = screen.getAllByRole('link').map((a) => a.getAttribute('href'));
    expect(hrefs).toEqual(['/piani', ...ROWS.map(([, href]) => href)]);
    expect(hrefs.filter((href) => href.endsWith('/piano'))).toEqual([]);
  });

  it('la voce «Preferenze» di una volta non c\'è: dopo i collegamenti dell\'elenco, nessuno si chiama così', async () => {
    await mount();
    // i collegamenti della pagina: le voci e «Vedi i piani» della testata
    expect(screen.getAllByRole('link')).toHaveLength(ROWS.length + 1);
    expect(screen.queryByRole('link', { name: 'Preferenze' })).toBeNull();
  });

  it.each(ROWS)('«%s» porta a %s e ha la sua riga di aiuto', async (name, href, help) => {
    await mount();
    const link = screen.getByRole('link', { name });
    expect(link.getAttribute('href')).toBe(href);
    expect(describedBy(link)).toBe(help);
  });

  it('ogni riga ha un\'area toccabile di almeno 44 px, con la freccia', async () => {
    await mount();
    for (const [name] of ROWS) {
      const link = screen.getByRole('link', { name });
      expect(parseInt(getComputedStyle(link).minHeight, 10)).toBeGreaterThanOrEqual(44);
      expect(link.querySelector('svg[data-testid="ChevronRightIcon"]')).toBeTruthy();
    }
  });

  it('in inglese i nomi e gli aiuti sono quelli inglesi', async () => {
    await i18n.changeLanguage('en');
    await mount();
    for (const [, href, , name, help] of ROWS) {
      const link = screen.getByRole('link', { name });
      expect(link.getAttribute('href')).toBe(href);
      expect(describedBy(link)).toBe(help);
    }
  });

  it('nessun testo della pagina è sotto i 16px', async () => {
    await mount();
    expect(textBelow(document.body, 16)).toEqual([]);
  });
});

describe('Amministrazione', () => {
  it('per un admin c\'è la riga verso /admin, in una card a sé sotto l\'elenco, con testo in inchiostro', async () => {
    stubFetch({ is_admin: true });
    await mount();
    const link = await screen.findByRole('link', { name: 'Amministrazione' });
    expect(link.getAttribute('href')).toBe('/admin');
    expect(describedBy(link)).toBe('Esercizi da approvare e catalogo');
    expect(getComputedStyle(within(link).getByText('Amministrazione')).color).toBe(INK);
    const lastRow = screen.getByRole('link', { name: 'Sicurezza' });
    expect(link.closest('.MuiCard-root')).not.toBe(lastRow.closest('.MuiCard-root'));
    expect(follows(lastRow, link)).toBe(true);
  });

  it('per gli altri non c\'è', async () => {
    await mount();
    expect(screen.getByRole('link', { name: 'Sicurezza' })).toBeTruthy();
    expect(screen.queryByRole('link', { name: 'Amministrazione' })).toBeNull();
  });
});

describe('Esci', () => {
  it('è outlined neutro, largo quanto la colonna: testo in inchiostro e bordo grigio visibile', async () => {
    await mount();
    const button = screen.getByRole('button', { name: 'Esci' });
    expect(button.classList.contains('MuiButton-outlined')).toBe(true);
    const style = getComputedStyle(button);
    expect(style.color).toBe(INK);
    expect(style.borderColor).toBe(GREY);
    expect(style.width).toBe('100%');
  });

  it('chiama logout', async () => {
    await mount();
    fireEvent.click(screen.getByRole('button', { name: 'Esci' }));
    expect(auth.logout).toHaveBeenCalledTimes(1);
  });
});

describe('Elimina account', () => {
  const apri = async () => {
    await mount();
    fireEvent.click(screen.getByRole('button', { name: 'Elimina account' }));
    return screen.findByRole('dialog');
  };

  it('è un pulsante di solo testo nel rosso del tema, sotto «Esci»', async () => {
    await mount();
    const del = screen.getByRole('button', { name: 'Elimina account' });
    expect(del.classList.contains('MuiButton-text')).toBe(true);
    expect(getComputedStyle(del).color).toBe(RED);
    expect(follows(screen.getByRole('button', { name: 'Esci' }), del)).toBe(true);
  });

  it('in tema scuro il pulsante è nel rosso chiaro del tema (error.main), non nel rosso del marchio', async () => {
    localStorage.setItem('themeMode', 'dark');
    await mount();
    expect(getComputedStyle(screen.getByRole('button', { name: 'Elimina account' })).color).toBe(RED_ON_DARK);
  });

  it('apre la finestra di conferma', async () => {
    const dialog = await apri();
    expect(within(dialog).getByText(/consapevole/)).toBeTruthy();
  });

  it('il dialogo di conferma resta rosso: titolo e bottone di eliminazione', async () => {
    await apri();
    const dialog = document.querySelector('.MuiDialog-root');
    expect(getComputedStyle(dialog.querySelector('.MuiDialogTitle-root')).color).toBe(RED);
    fireEvent.click(dialog.querySelector('input[type=checkbox]'));
    const confirm = dialog.querySelector('.MuiDialogActions-root .MuiButton-containedError');
    expect(getComputedStyle(confirm).backgroundColor).toBe(RED);
  });

  it('occhio di «elimina account»: il mouseDown è annullato e il clic alterna password e testo', async () => {
    const dialog = await apri();
    const eye = within(dialog).getByRole('button', { name: 'Mostra o nascondi la password' });
    expect(fireEvent.mouseDown(eye)).toBe(false);
    expect(within(dialog).getByLabelText(/^Password/).getAttribute('type')).toBe('password');
    fireEvent.click(eye);
    expect(within(dialog).getByLabelText(/^Password/).getAttribute('type')).toBe('text');
  });

  it('l\'eliminazione dell\'account chiede la password attuale, con un occhio nominato', async () => {
    const dialog = await apri();
    expect(within(dialog).getByLabelText(/^Password/).getAttribute('autocomplete')).toBe('current-password');
    expect(within(dialog).getByRole('button', { name: 'Mostra o nascondi la password' })).toBeTruthy();
  });
});

describe('le pagine delle voci', () => {
  it.each(ROWS)('«%s»: titolo, titolo del documento e «indietro» verso /account', async (name, href) => {
    await mount(href);
    expect(screen.getAllByRole('heading', { level: 1 }).map((h) => h.textContent)).toEqual([name]);
    expect(getComputedStyle(screen.getByRole('heading', { level: 1 })).fontSize).toBe('28px');
    expectPageTitleBlock(screen.getByRole('heading', { level: 1 }));
    await waitFor(() => expect(document.title).toBe(`${name} | LiftIndex`));
    const back = screen.getByRole('link', { name: 'Torna all\'Account' });
    expect(back.getAttribute('href')).toBe('/account');
    const style = getComputedStyle(back);
    expect([style.width, style.height]).toEqual(['44px', '44px']);
  });

  it.each(ROWS)('«%s» in inglese: titolo e «indietro» inglesi', async (_name, href, _help, english) => {
    await i18n.changeLanguage('en');
    await mount(href);
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe(english);
    expect(screen.getByRole('link', { name: 'Back to Account' }).getAttribute('href')).toBe('/account');
  });

  it.each(ROWS)('«%s»: nessun testo della pagina è sotto i 16px (escluse le etichette dei campi, che MUI rimpicciolisce)', async (_name, href) => {
    await mount(href);
    expect(textBelow(document.body, 16, '.MuiChip-root, .MuiFormLabel-root, .MuiFormHelperText-root, legend')).toEqual([]);
  });
});

describe('la cornice legge i dati una volta sola', () => {
  it('quando cambia l\'utente i dati si rileggono e la pagina resta montata: la finestra aperta resta aperta', async () => {
    const { rerenderAccount } = await mount();
    fireEvent.click(screen.getByRole('button', { name: 'Elimina account' }));
    await screen.findByRole('dialog');
    expect(reads()).toBe(1);

    auth.user = { id: 1 };
    rerenderAccount();
    await waitFor(() => expect(reads()).toBe(2));
    expect(screen.getByRole('dialog')).toBeTruthy();
    expect(screen.queryByRole('progressbar')).toBeNull();
  });

  it('la rilettura arriva alle pagine: il nuovo livello compare nella riga del livello della testata', async () => {
    const { rerenderAccount } = await mount();
    expect(tierRow().textContent).toBe('Livello: Gratis');
    stubFetch({ tierFields: { tier: 'pro', tier_until: null, tier_last_day: null, signup_code: null } });
    auth.user = { id: 1 };
    rerenderAccount();
    await waitFor(() => expect(tierRow().textContent).toBe('Livello: Pro, senza scadenza'));
  });

  it('prima lettura fallita, poi riuscita: la pagina passa dai valori di ripiego ai dati veri', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    let readCount = 0;
    vi.stubGlobal('fetch', vi.fn((url) => Promise.resolve(
      String(url).includes('user/read.php')
        ? (++readCount === 1 ? json({}, 500) : json({ id: 1, username: 'mario', email: 'mario@example.com', created_at: '2025-03-01T10:00:00+01:00', locale: 'en', weekly_goal_default: 3 }))
        : json({ success: true, consents: [], id: 1, weekly_goal_default: 3 }),
    )));
    try {
      const { rerenderAccount } = renderAccount('/account/profilo');
      await screen.findByRole('heading', { level: 1, name: 'Profilo e preferenze' });
      expect(describedBy(screen.getByRole('button', { name: 'Lingua' }))).toBe('Italiano');
      expect(readCount).toBe(1);

      auth.user = { id: 1 };
      rerenderAccount();
      await waitFor(() => expect(describedBy(screen.getByRole('button', { name: 'Lingua' }))).toBe('English'));
      expect(readCount).toBe(2);
    } finally {
      error.mockRestore();
    }
  });

  it('senza accesso non mostra la pagina, solo l\'attesa', async () => {
    Object.assign(auth, { user: null, isLoggedIn: false });
    renderAccount();
    await waitFor(() => expect(screen.getByRole('progressbar')).toBeTruthy());
    expect(screen.queryByRole('heading', { level: 1 })).toBeNull();
  });
});
