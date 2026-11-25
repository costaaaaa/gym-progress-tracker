// Pagina «Profilo e preferenze» (/account/profilo), la parte dei gruppi «Allenamento» e «App»: righe col valore di adesso
// e una finestra per ognuna (obiettivo settimanale, unità di misura, strumenti della serie, lingua, tema). Il gruppo «Tu» e la
// parte alta hanno i loro file: ProfilePage.you.test.jsx, ProfilePage.test.jsx e ProfilePage.email.test.jsx.
// Colori scritti a mano: text.secondary #6b6663, primary/error #d50000. La fetch è il confine.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { screen, within, fireEvent, waitFor } from '@testing-library/react';
import i18n from '../../i18n';
import { json } from '../../test/dom';
import { setBrowserTimeZone } from '../../test/timeZone';
import { textBelow } from '../../test/minText';
import { describedBy, strayListChildren } from '../../test/accessibleNames';
import { renderAccount } from '../../test/accountRoutes';
import { row, open, closed, staysOpen, settingsCalls, reads, deferred } from '../../test/settingRows';

vi.mock('react-router-dom', async (importOriginal) => ({ ...(await importOriginal()), useNavigate: () => () => {} }));
// Come in AuthContext vero, updateUser crea un `user` nuovo e ridisegna chi lo legge (gli strumenti si leggono da lì): un
// utente nuovo fa rileggere i dati alla cornice, come nell'app
const auth = {};
const { readers } = vi.hoisted(() => ({ readers: new Set() }));
vi.mock('../../context/AuthContext', async () => {
  const { useReducer, useEffect } = await import('react');
  return {
    useAuth: () => {
      const [, redraw] = useReducer((n) => n + 1, 0);
      useEffect(() => { readers.add(redraw); return () => readers.delete(redraw); }, []);
      return auth;
    },
  };
});

const GREY = 'rgb(107, 102, 99)';
const RED = 'rgb(213, 0, 0)';

const serverAccount = (over = {}) => ({
  id: 1, username: 'mario', email: 'mario@example.com', created_at: '2025-03-01T10:00:00+01:00', is_admin: false,
  weight_unit: 'kg', locale: 'it', weekly_goal: null, weekly_goal_default: 3, weekly_goal_pending: null,
  tier: 'free', tier_until: null, tier_last_day: null, signup_code: null, ...over,
});

// `account`: i campi del server (l'oggetto si legge a ogni lettura; `null` = la lettura risponde 500); `settings(body)`: la
// risposta a update_settings.php (di base il server salva il corpo nell'account e lo riflette, come farebbe davvero)
const stubFetch = ({ account = serverAccount(), settings = (body) => { Object.assign(account ?? {}, body); return Promise.resolve(json({ success: true, ...body })); } } = {}) => (
  vi.stubGlobal('fetch', vi.fn((url, init) => (
    String(url).includes('update_settings.php') ? settings(JSON.parse(init.body))
      : String(url).includes('groups/list.php') ? Promise.resolve(json({ success: true, groups: [] }))
        : String(url).includes('user/read.php') ? Promise.resolve(account ? json(account) : json({ success: false }, 500))
          : Promise.resolve(json({ success: true, consents: [], id: 1, weekly_goal_default: 3 }))
  )))
);

beforeEach(async () => {
  await i18n.changeLanguage('it');
  localStorage.setItem('themeMode', 'light');
  Object.assign(auth, {
    user: { id: 1 }, isLoggedIn: true, loading: false, logout: vi.fn(),
    updateUser: vi.fn((patch) => { auth.user = { ...auth.user, ...patch }; readers.forEach((redraw) => redraw()); }),
    emailState: { verified: true, email: 'mario@example.com', pendingEmail: null, blocked: false, daysLeft: null },
    openEmailDialog: vi.fn(), refreshEmailState: () => Promise.resolve(),
  });
  stubFetch();
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  localStorage.clear();
});

const mount = async () => {
  const view = renderAccount('/account/profilo');
  await screen.findByRole('button', { name: 'Lingua' });
  return view;
};

describe('la pagina', () => {
  it('si chiama «Profilo e preferenze», ha il titolo del documento e «indietro» verso /account', async () => {
    await mount();
    expect(screen.getAllByRole('heading', { level: 1 }).map((h) => h.textContent)).toEqual(['Profilo e preferenze']);
    // il titolo del documento lo scrive un effetto, a volte dopo il primo disegno
    await waitFor(() => expect(document.title).toBe('Profilo e preferenze | LiftIndex'));
    expect(screen.getByRole('link', { name: 'Torna all\'Account' }).getAttribute('href')).toBe('/account');
  });

  it('il gruppo «Allenamento» (obiettivo, unità, strumenti) viene prima del gruppo «App» (lingua, tema)', async () => {
    await mount();
    const headings = screen.getAllByRole('heading', { level: 2 }).filter((h) => ['Allenamento', 'App'].includes(h.textContent));
    expect(headings.map((h) => h.textContent)).toEqual(['Allenamento', 'App']);
    const rowsAfter = (heading) => within(heading.nextElementSibling).getAllByRole('button').map((b) => b.textContent);
    expect(rowsAfter(headings[0])).toEqual(['Obiettivo settimanaleDefault (3)', 'Unità di misurakg, cm', 'Strumenti della serie3 accesi su 3']);
    expect(rowsAfter(headings[1])).toEqual(['LinguaItaliano', 'TemaChiaro']);
    expect(headings[0].compareDocumentPosition(headings[1]) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('i titoli dei gruppi sono h2 da 16 px, 700, grigi e non in maiuscolo; ogni gruppo è una card con un elenco', async () => {
    await mount();
    for (const name of ['Allenamento', 'App']) {
      const heading = screen.getByRole('heading', { level: 2, name });
      const style = getComputedStyle(heading);
      expect({ size: style.fontSize, weight: style.fontWeight, color: style.color, transform: style.textTransform })
        .toEqual({ size: '16px', weight: '700', color: GREY, transform: 'none' });
      const card = heading.nextElementSibling;
      expect(card.classList.contains('MuiCard-root')).toBe(true);
      const list = within(card).getByRole('list');
      expect(strayListChildren(list)).toEqual([]);
    }
  });

  it('le righe di un gruppo sono separate da una linea; la prima non ha la linea sopra', async () => {
    await mount();
    const items = within(screen.getByRole('heading', { level: 2, name: 'Allenamento' }).nextElementSibling).getAllByRole('listitem');
    expect(items).toHaveLength(3);
    const top = (li) => parseInt(getComputedStyle(li).borderTopWidth, 10) || 0;
    expect(items.map(top)).toEqual([0, 1, 1]);
  });

  it('la card dell\'unità di misura di una volta non c\'è più: niente selettore, solo la riga', async () => {
    await mount();
    expect(screen.getAllByText('Unità di misura')).toHaveLength(1);
    expect(screen.queryByRole('combobox', { name: 'Unità di misura' })).toBeNull();
  });

  it('nessun testo dei due gruppi è sotto i 16px', async () => {
    await mount();
    for (const name of ['Allenamento', 'App']) {
      const heading = screen.getByRole('heading', { level: 2, name });
      expect(textBelow(heading.parentElement, 16)).toEqual([]);
    }
  });
});

describe('le righe', () => {
  it('ogni riga è un pulsante: nome = titolo, descrizione = valore di adesso', async () => {
    await mount();
    for (const [name, value] of [['Obiettivo settimanale', 'Default (3)'], ['Unità di misura', 'kg, cm'], ['Strumenti della serie', '3 accesi su 3'], ['Lingua', 'Italiano'], ['Tema', 'Chiaro']]) {
      const button = row(name);
      expect(button.getAttribute('aria-haspopup')).toBe('dialog');
      expect(describedBy(button)).toBe(value);
    }
  });

  it.each([
    ['nessuna scelta: il default', { weekly_goal: null, weekly_goal_default: 4 }, 'Default (4)'],
    ['un allenamento (singolare)', { weekly_goal: 1 }, '1 allenamento'],
    ['quattro allenamenti (plurale)', { weekly_goal: 4 }, '4 allenamenti'],
    ['un cambio in attesa vale più di quello in vigore', { weekly_goal: 3, weekly_goal_pending: { goal: 5, from: '2026-11-30' } }, '5 allenamenti'],
    ['un cambio in attesa verso il default', { weekly_goal: 3, weekly_goal_pending: { goal: null, from: '2026-11-30' } }, 'Default (3)'],
  ])('Obiettivo settimanale, %s: «%s»', async (_name, fields, value) => {
    stubFetch({ account: serverAccount(fields) });
    await mount();
    expect(describedBy(row('Obiettivo settimanale'))).toBe(value);
  });

  it.each([
    ['kg', 'kg, cm'],
    ['lb', 'lb, in'],
    [undefined, 'kg, cm'],
  ])('Unità di misura, account con %s: «%s»', async (unit, value) => {
    stubFetch({ account: serverAccount({ weight_unit: unit }) });
    await mount();
    expect(describedBy(row('Unità di misura'))).toBe(value);
  });

  it.each([
    ['nessuno acceso', { rest_timer_enabled: false, focus_tools: { technique: false, suggested_weight: false } }, 'Nessuno acceso'],
    ['uno acceso', { rest_timer_enabled: false, focus_tools: { technique: false } }, '1 acceso su 3'],
    ['due accesi', { focus_tools: { technique: false } }, '2 accesi su 3'],
    ['tutti accesi', { id: 1 }, '3 accesi su 3'],
  ])('Strumenti della serie, %s: «%s»', async (_name, user, value) => {
    auth.user = user;
    await mount();
    expect(describedBy(row('Strumenti della serie'))).toBe(value);
  });

  it.each([
    [null, 'Sistema'],
    ['light', 'Chiaro'],
    ['dark', 'Scuro'],
  ])('Tema, con la chiave themeMode a %s: «%s»', async (saved, value) => {
    if (saved) localStorage.setItem('themeMode', saved);
    else localStorage.removeItem('themeMode');
    await mount();
    expect(describedBy(row('Tema'))).toBe(value);
  });

  it.each([
    ['it', 'Italiano'],
    ['en', 'English'],
  ])('Lingua, account con %s: «%s» (il nome della lingua non si traduce)', async (locale, value) => {
    stubFetch({ account: serverAccount({ locale }) });
    await mount();
    expect(describedBy(row('Lingua'))).toBe(value);
  });

  it('in inglese i titoli e i valori sono quelli inglesi', async () => {
    await i18n.changeLanguage('en');
    stubFetch({ account: serverAccount({ weekly_goal: 4, weight_unit: 'lb', locale: 'en' }) });
    renderAccount('/account/profilo');
    await screen.findByRole('button', { name: 'Language' });
    expect(describedBy(row('Set tools'))).toBe('3 of 3 on');
    expect(describedBy(row('Weekly goal'))).toBe('4 workouts');
    expect(describedBy(row('Units'))).toBe('lb, in');
    expect(describedBy(row('Language'))).toBe('English');
    expect(describedBy(row('Theme'))).toBe('Light');
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Profile and preferences');
    expect(screen.getByRole('heading', { level: 2, name: 'Training' })).toBeTruthy();
    expect(screen.getByRole('heading', { level: 2, name: 'App' })).toBeTruthy();
  });
});

describe('le finestre', () => {
  it.each([
    ['Obiettivo settimanale'],
    ['Unità di misura'],
    ['Strumenti della serie'],
    ['Lingua'],
    ['Tema'],
  ])('«%s» apre la sua finestra, col titolo scritto una volta sola, e «Chiudi» la chiude', async (name) => {
    await mount();
    const dialog = open(name);
    expect(screen.getAllByRole('dialog')).toHaveLength(1);
    expect(dialog.getAllByText(name)).toHaveLength(1);
    expect(textBelow(screen.getByRole('dialog'), 16)).toEqual([]);
    fireEvent.click(dialog.getByRole('button', { name: 'Chiudi' }));
    await closed();
  });

  it.each([
    ['Obiettivo settimanale'],
    ['Unità di misura'],
    ['Strumenti della serie'],
    ['Lingua'],
    ['Tema'],
  ])('chiusa la finestra di «%s» il fuoco è sulla sua riga', async (name) => {
    await mount();
    const dialog = open(name);
    fireEvent.click(dialog.getByRole('button', { name: 'Chiudi' }));
    await closed();
    expect(document.activeElement).toBe(row(name));
  });

  it('Esc chiude e il fuoco torna sulla riga', async () => {
    await mount();
    open('Lingua');
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
    await closed();
    expect(document.activeElement).toBe(row('Lingua'));
  });
});

// Unità di misura e lingua: la scelta salva subito e, se riesce, chiude la finestra con la notifica della pagina
describe.each([
  {
    title: 'Unità di misura', from: 'Metriche (kg, cm)', to: 'Imperiali (lb, in)',
    body: { weight_unit: 'lb' }, patch: { weight_unit: 'lb' }, rowBefore: 'kg, cm', rowAfter: 'lb, in',
    saved: 'Unità di misura aggiornata', error: 'Errore nel salvataggio dell\'unità di misura',
    help: 'I dati restano salvati in kg e cm: cambia solo come si mostrano e si inseriscono', example: 'Esempio: 100 kg ≈ 220 lb',
  },
  {
    title: 'Lingua', from: 'Italiano', to: 'English',
    body: { locale: 'en' }, patch: { locale: 'en' }, rowBefore: 'Italiano', rowAfter: 'English',
    // La notifica è nella lingua appena scelta
    saved: 'Language updated', error: 'Errore nel salvataggio della lingua',
    help: 'Lingua dell\'app, delle email e dei nomi degli esercizi', example: null,
  },
])('finestra «$title»', ({ title, from, to, body, patch, rowBefore, rowAfter, saved, error, help, example }) => {
  it('ha due radio (quello di adesso scelto) col titolo come nome del gruppo, l\'aiuto e, dove c\'è, l\'esempio', async () => {
    await mount();
    const dialog = open(title);
    const group = dialog.getByRole('radiogroup', { name: title });
    expect(within(group).getAllByRole('radio')).toHaveLength(2);
    expect(dialog.getByRole('radio', { name: from }).checked).toBe(true);
    expect(dialog.getByRole('radio', { name: to }).checked).toBe(false);
    expect(describedBy(group)).toBe(help);
    expect(dialog.getByText(help)).toBeTruthy();
    if (example) expect(dialog.getByText(example)).toBeTruthy();
    else expect(dialog.queryByText('Esempio: 100 kg ≈ 220 lb')).toBeNull();
  });

  it('la scelta salva il corpo giusto, aggiorna l\'utente, chiude la finestra, avvisa dalla pagina e la riga mostra il valore nuovo', async () => {
    await mount();
    expect(describedBy(row(title))).toBe(rowBefore);
    fireEvent.click(open(title).getByRole('radio', { name: to }));
    await closed();
    expect(settingsCalls()).toEqual([body]);
    expect(auth.updateUser).toHaveBeenCalledWith(patch);
    expect(await screen.findByText(saved)).toBeTruthy();
    expect(describedBy(row(title))).toBe(rowAfter);
  });

  it.each([
    ['il server rifiuta', () => Promise.resolve(json({ success: false, message: 'no' }, 500))],
    ['la rete non risponde', () => Promise.reject(new Error('offline'))],
  ])('%s: la finestra resta aperta con l\'errore dentro, torna la scelta di prima, la riga e l\'utente non cambiano', async (_name, settings) => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    stubFetch({ settings });
    await mount();
    const dialog = open(title);
    fireEvent.click(dialog.getByRole('radio', { name: to }));
    await waitFor(() => expect(dialog.getByRole('alert').textContent).toBe(error));
    expect(screen.getByRole('dialog')).toBeTruthy();
    expect(dialog.getByRole('radio', { name: from }).checked).toBe(true);
    expect(dialog.getByRole('radio', { name: to }).checked).toBe(false);
    expect(describedBy(screen.getByRole('button', { name: title, hidden: true }))).toBe(rowBefore);
    expect(auth.updateUser).not.toHaveBeenCalled();
    // l'errore sta nella finestra: la notifica della pagina non ne ha uno suo
    expect(screen.getAllByText(error)).toHaveLength(1);
  });

  it('riaperta dopo un rifiuto la finestra non ha più l\'errore di prima', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    stubFetch({ settings: () => Promise.resolve(json({ success: false }, 500)) });
    await mount();
    const dialog = open(title);
    fireEvent.click(dialog.getByRole('radio', { name: to }));
    await waitFor(() => expect(dialog.getByRole('alert').textContent).toBe(error));
    fireEvent.click(dialog.getByRole('button', { name: 'Chiudi' }));
    await closed();
    expect(open(title).getByRole('alert').textContent).toBe('');
  });

  it('due scelte veloci fanno una sola richiesta; il controllo non è disabilitato ma «occupato»; la finestra non si chiude finché si salva', async () => {
    const answer = deferred();
    stubFetch({ settings: () => answer.promise });
    await mount();
    const dialog = open(title);
    fireEvent.click(dialog.getByRole('radio', { name: to }));
    await waitFor(() => expect(dialog.getByRole('radiogroup', { name: title }).getAttribute('aria-busy')).toBe('true'));
    fireEvent.click(dialog.getByRole('radio', { name: from }));
    expect(settingsCalls()).toEqual([body]);
    expect(dialog.getByRole('radio', { name: to }).checked).toBe(true);
    for (const radio of dialog.getAllByRole('radio')) expect(radio.disabled).toBe(false);
    fireEvent.click(dialog.getByRole('button', { name: 'Chiudi' }));
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
    staysOpen();
    answer.resolve(json({ success: true, ...body }));
    await closed();
    expect(settingsCalls()).toEqual([body]);
    expect(await screen.findByText(saved)).toBeTruthy();
  });
});

// Il caso opposto: l'account parte da lb o da en e la scelta di tornare indietro è rifiutata
describe.each([
  {
    title: 'Unità di misura', account: { weight_unit: 'lb' }, chosen: 'Imperiali (lb, in)', other: 'Metriche (kg, cm)',
    rowValue: 'lb, in', error: 'Errore nel salvataggio dell\'unità di misura',
  },
  {
    title: 'Lingua', account: { locale: 'en' }, chosen: 'English', other: 'Italiano',
    rowValue: 'English', error: 'Errore nel salvataggio della lingua',
  },
])('finestra «$title» partendo da $chosen', ({ title, account, chosen, other, rowValue, error }) => {
  it('il valore scelto è quello dell\'account', async () => {
    stubFetch({ account: serverAccount(account) });
    await mount();
    expect(describedBy(row(title))).toBe(rowValue);
    const dialog = open(title);
    expect(dialog.getByRole('radio', { name: chosen }).checked).toBe(true);
    expect(dialog.getByRole('radio', { name: other }).checked).toBe(false);
  });

  it('un rifiuto: resta scelto il valore di prima, la riga non cambia e l\'errore sta nella finestra', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    stubFetch({ account: serverAccount(account), settings: () => Promise.resolve(json({ success: false }, 500)) });
    await mount();
    const dialog = open(title);
    fireEvent.click(dialog.getByRole('radio', { name: other }));
    await waitFor(() => expect(dialog.getByRole('alert').textContent).toBe(error));
    expect(screen.getByRole('dialog')).toBeTruthy();
    expect(dialog.getByRole('radio', { name: chosen }).checked).toBe(true);
    expect(dialog.getByRole('radio', { name: other }).checked).toBe(false);
    expect(describedBy(screen.getByRole('button', { name: title, hidden: true }))).toBe(rowValue);
    expect(auth.updateUser).not.toHaveBeenCalled();
  });
});

// Il tema è di questo browser: la scelta vale al clic, senza richiesta al server né avviso della pagina
describe('finestra «Tema»', () => {
  const html = () => document.documentElement.getAttribute('data-theme');

  it.each([
    [null, 'Sistema'],
    ['light', 'Chiaro'],
    ['dark', 'Scuro'],
  ])('ha tre radio col nome del gruppo «Tema» e, con la chiave a %s, scelto «%s»; sotto l\'aiuto', async (saved, chosen) => {
    if (saved) localStorage.setItem('themeMode', saved);
    else localStorage.removeItem('themeMode');
    await mount();
    const dialog = open('Tema');
    const group = dialog.getByRole('radiogroup', { name: 'Tema' });
    expect(within(group).getAllByRole('radio').map((r) => [r.closest('label').textContent, r.checked])).toEqual(
      ['Sistema', 'Chiaro', 'Scuro'].map((name) => [name, name === chosen]),
    );
    expect(describedBy(group)).toBe('Sistema segue l\'aspetto del dispositivo');
    expect(dialog.getByText('Sistema segue l\'aspetto del dispositivo')).toBeTruthy();
  });

  it('in inglese i nomi e l\'aiuto sono inglesi', async () => {
    await i18n.changeLanguage('en');
    localStorage.removeItem('themeMode');
    renderAccount('/account/profilo');
    await screen.findByRole('button', { name: 'Language' });
    expect(describedBy(row('Theme'))).toBe('System');
    const dialog = open('Theme');
    expect(within(dialog.getByRole('radiogroup', { name: 'Theme' })).getAllByRole('radio').map((r) => r.closest('label').textContent)).toEqual(['System', 'Light', 'Dark']);
    expect(describedBy(dialog.getByRole('radiogroup', { name: 'Theme' }))).toBe('System follows your device\'s appearance');
  });

  // Il sistema, in jsdom, è chiaro: da «Scuro» tornare a «Sistema» riporta <html> al chiaro e toglie la chiave
  it.each([
    ['Scuro', 'light', 'dark', 'dark'],
    ['Chiaro', 'dark', 'light', 'light'],
    ['Sistema', 'dark', 'light', null],
  ])('scegliere «%s» da %s: il tema diventa %s subito, la finestra si chiude, la riga ha il valore nuovo e il fuoco torna sulla riga', async (name, from, theme, key) => {
    localStorage.setItem('themeMode', from);
    await mount();
    expect(html()).toBe(from);
    fireEvent.click(open('Tema').getByRole('radio', { name }));
    await closed();
    expect(html()).toBe(theme);
    expect(localStorage.getItem('themeMode')).toBe(key);
    expect(describedBy(row('Tema'))).toBe(name);
    expect(document.activeElement).toBe(row('Tema'));
  });

  it('non fa richieste di salvataggio né avvisi della pagina', async () => {
    await mount();
    fireEvent.click(open('Tema').getByRole('radio', { name: 'Scuro' }));
    await closed();
    expect(settingsCalls()).toEqual([]);
    expect(screen.queryByRole('status')).toBeNull();
    expect(screen.queryByText('Tema aggiornato')).toBeNull();
  });
});

describe('finestra «Obiettivo settimanale»', () => {
  const goalGroup = (dialog) => dialog.getByRole('group', { name: 'Obiettivo settimanale' });
  const pressed = (dialog) => within(goalGroup(dialog)).getAllByRole('button').filter((b) => b.getAttribute('aria-pressed') === 'true').map((b) => b.textContent);

  it('ha l\'aiuto, i pulsanti da 1 a 7 e «Default (3)» e la riga «Vale da questa settimana»; la scelta di adesso è premuta', async () => {
    await mount();
    const dialog = open('Obiettivo settimanale');
    expect(dialog.getByText('Quanti allenamenti a settimana contano per la tua serie. Default: i giorni della scheda attiva, oppure 3 senza scheda')).toBeTruthy();
    expect(within(goalGroup(dialog)).getAllByRole('button').map((b) => b.textContent)).toEqual(['1', '2', '3', '4', '5', '6', '7', 'Default (3)']);
    expect(pressed(dialog)).toEqual(['Default (3)']);
    expect(dialog.getByText('Vale da questa settimana. Un cambio fatto da mercoledì a domenica vale dal lunedì successivo')).toBeTruthy();
  });

  it('i pulsanti sono in Lexend 500, come i chip che si premono; quello scelto è neutro, non rosso', async () => {
    await mount();
    const dialog = open('Obiettivo settimanale');
    for (const b of within(goalGroup(dialog)).getAllByRole('button')) {
      const { fontFamily, fontWeight } = getComputedStyle(b);
      expect({ label: b.textContent, fontFamily, fontWeight }).toEqual({ label: b.textContent, fontFamily: '"Lexend", sans-serif', fontWeight: '500' });
    }
    const selected = goalGroup(dialog).querySelector('.Mui-selected');
    expect(selected).not.toBeNull();
    expect(getComputedStyle(selected).color).not.toBe(RED);
  });

  // La riga «Vale da lunedì gg/mm» è una data scritta senza fuso: non cambia con quello del browser
  describe.each(['UTC', 'Europe/Rome', 'America/Los_Angeles', 'Asia/Tokyo'])('un cambio in attesa (%s)', (zone) => {
    it('il clic salva, la finestra resta aperta con l\'esito dentro, «Vale da lunedì 30/11» e la riga col valore nuovo', async () => {
      setBrowserTimeZone(zone);
      stubFetch({ settings: () => Promise.resolve(json({ success: true, weekly_goal: 3, weekly_goal_default: 3, weekly_goal_pending: { goal: 5, from: '2026-11-30' } })) });
      await mount();
      const dialog = open('Obiettivo settimanale');
      fireEvent.click(within(goalGroup(dialog)).getByRole('button', { name: '5' }));
      await waitFor(() => expect(dialog.getByRole('status').textContent).toBe('Obiettivo settimanale aggiornato'));
      expect(settingsCalls()).toEqual([{ weekly_goal: 5 }]);
      expect(screen.getByRole('dialog')).toBeTruthy();
      expect(dialog.getByRole('alert').textContent).toBe('');
      expect(pressed(dialog)).toEqual(['5']);
      expect(dialog.getByText('Vale da lunedì 30/11')).toBeTruthy();
      expect(describedBy(screen.getByRole('button', { name: 'Obiettivo settimanale', hidden: true }))).toBe('5 allenamenti');
      // l'esito è dentro la finestra: la notifica della pagina non ripete nulla
      expect(screen.getAllByText('Obiettivo settimanale aggiornato')).toHaveLength(1);
    });
  });

  it('«Default» salva weekly_goal null', async () => {
    stubFetch({ account: serverAccount({ weekly_goal: 4 }), settings: () => Promise.resolve(json({ success: true, weekly_goal: null, weekly_goal_default: 3, weekly_goal_pending: null })) });
    await mount();
    const dialog = open('Obiettivo settimanale');
    expect(pressed(dialog)).toEqual(['4']);
    fireEvent.click(within(goalGroup(dialog)).getByRole('button', { name: 'Default (3)' }));
    await waitFor(() => expect(dialog.getByRole('status').textContent).toBe('Obiettivo settimanale aggiornato'));
    expect(settingsCalls()).toEqual([{ weekly_goal: null }]);
    expect(pressed(dialog)).toEqual(['Default (3)']);
    expect(describedBy(screen.getByRole('button', { name: 'Obiettivo settimanale', hidden: true }))).toBe('Default (3)');
  });

  it('un rifiuto: l\'errore sta nella finestra, resta la scelta di prima e la riga non cambia', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    stubFetch({ account: serverAccount({ weekly_goal: 4 }), settings: () => Promise.resolve(json({ success: false }, 500)) });
    await mount();
    const dialog = open('Obiettivo settimanale');
    fireEvent.click(within(goalGroup(dialog)).getByRole('button', { name: '6' }));
    await waitFor(() => expect(dialog.getByRole('alert').textContent).toBe('Errore nel salvataggio dell\'obiettivo settimanale'));
    expect(dialog.getByRole('status').textContent).toBe('');
    expect(pressed(dialog)).toEqual(['4']);
    expect(describedBy(screen.getByRole('button', { name: 'Obiettivo settimanale', hidden: true }))).toBe('4 allenamenti');
    expect(screen.getAllByText('Errore nel salvataggio dell\'obiettivo settimanale')).toHaveLength(1);
  });

  it('un esito uguale al precedente si rilegge: le regioni ripartono vuote a ogni scelta', async () => {
    const answer = deferred();
    stubFetch({ settings: () => answer.promise });
    await mount();
    const dialog = open('Obiettivo settimanale');
    fireEvent.click(within(goalGroup(dialog)).getByRole('button', { name: '2' }));
    answer.resolve(json({ success: true, weekly_goal: 2, weekly_goal_default: 3, weekly_goal_pending: null }));
    await waitFor(() => expect(dialog.getByRole('status').textContent).toBe('Obiettivo settimanale aggiornato'));
    const second = deferred();
    stubFetch({ settings: () => second.promise });
    fireEvent.click(within(goalGroup(dialog)).getByRole('button', { name: '3' }));
    await waitFor(() => expect(dialog.getByRole('status').textContent).toBe(''));
    second.resolve(json({ success: true, weekly_goal: 3, weekly_goal_default: 3, weekly_goal_pending: null }));
    await waitFor(() => expect(dialog.getByRole('status').textContent).toBe('Obiettivo settimanale aggiornato'));
  });

  it('due scelte veloci fanno una sola richiesta; i pulsanti non sono disabilitati ma «occupati»; la finestra non si chiude finché si salva', async () => {
    const answer = deferred();
    stubFetch({ settings: () => answer.promise });
    await mount();
    const dialog = open('Obiettivo settimanale');
    fireEvent.click(within(goalGroup(dialog)).getByRole('button', { name: '5' }));
    await waitFor(() => expect(goalGroup(dialog).getAttribute('aria-busy')).toBe('true'));
    fireEvent.click(within(goalGroup(dialog)).getByRole('button', { name: '6' }));
    expect(settingsCalls()).toEqual([{ weekly_goal: 5 }]);
    expect(pressed(dialog)).toEqual(['5']);
    for (const b of within(goalGroup(dialog)).getAllByRole('button')) expect(b.disabled).toBe(false);
    fireEvent.click(dialog.getByRole('button', { name: 'Chiudi' }));
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
    staysOpen();
    answer.resolve(json({ success: true, weekly_goal: 5, weekly_goal_default: 3, weekly_goal_pending: null }));
    await waitFor(() => expect(dialog.getByRole('status').textContent).toBe('Obiettivo settimanale aggiornato'));
    expect(goalGroup(dialog).getAttribute('aria-busy')).toBe('false');
  });

  it('riaperta la finestra l\'esito di prima non c\'è più', async () => {
    await mount();
    const dialog = open('Obiettivo settimanale');
    fireEvent.click(within(goalGroup(dialog)).getByRole('button', { name: '2' }));
    await waitFor(() => expect(dialog.getByRole('status').textContent).toBe('Obiettivo settimanale aggiornato'));
    fireEvent.click(dialog.getByRole('button', { name: 'Chiudi' }));
    await closed();
    const again = open('Obiettivo settimanale');
    expect(again.getByRole('status').textContent).toBe('');
    expect(again.getByRole('alert').textContent).toBe('');
  });
});

describe('finestra «Strumenti della serie»', () => {
  const group = (dialog) => dialog.getByRole('list', { name: 'Strumenti della serie' });

  it('ha i tre interruttori, timer di recupero compreso, legati ciascuno al proprio titolo', async () => {
    await mount();
    const dialog = open('Strumenti della serie');
    expect(within(group(dialog)).getAllByRole('switch').map((s) => s.getAttribute('aria-label'))).toEqual(['Timer di recupero', 'Tecnica di intensità', 'Peso suggerito']);
    expect(dialog.getByRole('switch', { name: 'Timer di recupero' })).toBeTruthy();
  });

  it.each([
    ['Timer di recupero', { rest_timer_enabled: false }],
    ['Tecnica di intensità', { focus_tools: { technique: false } }],
    ['Peso suggerito', { focus_tools: { suggested_weight: false } }],
  ])('%s: il cambio salva subito la chiave giusta, aggiorna l\'utente e l\'esito sta dentro la finestra', async (name, body) => {
    stubFetch({ settings: () => Promise.resolve(json({ success: true, rest_timer_enabled: false, focus_tools: { technique: false, suggested_weight: false } })) });
    await mount();
    const dialog = open('Strumenti della serie');
    fireEvent.click(within(group(dialog)).getByRole('switch', { name }));
    await waitFor(() => expect(settingsCalls()).toEqual([body]));
    await waitFor(() => expect(dialog.getByRole('status').textContent).toBe(`${name}: spento`));
    expect(auth.updateUser).toHaveBeenCalled();
    expect(screen.getByRole('dialog')).toBeTruthy();
    expect(screen.getAllByText(`${name}: spento`)).toHaveLength(1);
  });

  it('il conteggio nella riga cambia dopo il salvataggio', async () => {
    stubFetch({ settings: () => Promise.resolve(json({ success: true, rest_timer_enabled: true, focus_tools: { technique: false, suggested_weight: true } })) });
    await mount();
    expect(describedBy(row('Strumenti della serie'))).toBe('3 accesi su 3');
    const dialog = open('Strumenti della serie');
    fireEvent.click(dialog.getByRole('switch', { name: 'Tecnica di intensità' }));
    await waitFor(() => expect(dialog.getByRole('status').textContent).toBe('Tecnica di intensità: spento'));
    expect(describedBy(screen.getByRole('button', { name: 'Strumenti della serie', hidden: true }))).toBe('2 accesi su 3');
  });

  it('un rifiuto: l\'errore sta nella finestra e il conteggio non cambia', async () => {
    stubFetch({ settings: () => Promise.resolve(json({ success: false }, 500)) });
    await mount();
    const dialog = open('Strumenti della serie');
    fireEvent.click(dialog.getByRole('switch', { name: 'Peso suggerito' }));
    await waitFor(() => expect(dialog.getByRole('alert').textContent).toBe('Errore nel salvataggio. Riprova.'));
    expect(describedBy(screen.getByRole('button', { name: 'Strumenti della serie', hidden: true }))).toBe('3 accesi su 3');
  });
});

// Come per le altre finestre: finché un salvataggio è in corso la finestra non si chiude (con Esc, «Chiudi» o il clic fuori),
// così l'errore non si perde e non parte una seconda richiesta da una finestra riaperta
describe('finestra «Strumenti della serie»: durante un salvataggio', () => {
  const pressEsc = () => fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape', code: 'Escape' });
  const slowSave = async () => {
    const pending = deferred();
    stubFetch({ settings: () => pending.promise });
    await mount();
    const dialog = open('Strumenti della serie');
    fireEvent.click(dialog.getByRole('switch', { name: 'Tecnica di intensità' }));
    await waitFor(() => expect(settingsCalls()).toHaveLength(1));
    return { dialog, pending };
  };

  it('Esc e «Chiudi» non la chiudono', async () => {
    const { dialog } = await slowSave();
    await waitFor(() => expect(dialog.getByRole('button', { name: 'Chiudi' }).getAttribute('aria-disabled')).toBe('true'));
    pressEsc();
    fireEvent.click(dialog.getByRole('button', { name: 'Chiudi' }));
    staysOpen();
  });

  it('arriva un rifiuto: l\'errore si legge nella finestra, poi si può chiudere', async () => {
    const { dialog, pending } = await slowSave();
    pressEsc();
    pending.resolve(json({ success: false }, 500));
    await waitFor(() => expect(dialog.getByRole('alert').textContent).toBe('Errore nel salvataggio. Riprova.'));
    await waitFor(() => expect(dialog.getByRole('button', { name: 'Chiudi' }).getAttribute('aria-disabled')).toBeNull());
    staysOpen();
    fireEvent.click(dialog.getByRole('button', { name: 'Chiudi' }));
    await closed();
    expect(settingsCalls()).toHaveLength(1);
  });

  it('a salvataggio finito si chiude con Esc e «Chiudi»', async () => {
    const { dialog, pending } = await slowSave();
    pending.resolve(json({ success: true, rest_timer_enabled: true, focus_tools: { technique: false, suggested_weight: true } }));
    await waitFor(() => expect(dialog.getByRole('status').textContent).toBe('Tecnica di intensità: spento'));
    await waitFor(() => expect(dialog.getByRole('button', { name: 'Chiudi' }).getAttribute('aria-disabled')).toBeNull());
    pressEsc();
    await closed();
    expect(settingsCalls()).toHaveLength(1);
  });
});

describe('la finestra non porta pulsanti del profilo', () => {
  it('nella finestra dell\'obiettivo solo 1-7, Default e Chiudi: niente «Annulla» né «Salva»', async () => {
    await mount();
    const dialog = open('Obiettivo settimanale');
    expect(dialog.getAllByRole('button').map((b) => b.textContent)).toEqual(['1', '2', '3', '4', '5', '6', '7', 'Default (3)', 'Chiudi']);
  });
});

describe('valori sempre freschi, una sola fonte', () => {
  it('cambiato l\'obiettivo, tornando all\'elenco e rientrando la riga mostra il valore nuovo, senza una nuova lettura', async () => {
    stubFetch({ settings: () => Promise.resolve(json({ success: true, weekly_goal: 5, weekly_goal_default: 3, weekly_goal_pending: null })) });
    await mount();
    expect(reads()).toBe(1);
    const dialog = open('Obiettivo settimanale');
    fireEvent.click(within(dialog.getByRole('group', { name: 'Obiettivo settimanale' })).getByRole('button', { name: '5' }));
    await waitFor(() => expect(dialog.getByRole('status').textContent).toBe('Obiettivo settimanale aggiornato'));
    fireEvent.click(dialog.getByRole('button', { name: 'Chiudi' }));
    await closed();
    fireEvent.click(screen.getByRole('link', { name: 'Torna all\'Account' }));
    await screen.findByRole('heading', { level: 1, name: 'Account' });
    fireEvent.click(screen.getByRole('link', { name: 'Profilo e preferenze' }));
    await screen.findByRole('button', { name: 'Lingua' });
    expect(describedBy(row('Obiettivo settimanale'))).toBe('5 allenamenti');
    expect(reads()).toBe(1);
  });

  it('lo stesso per l\'unità di misura e per la lingua', async () => {
    await mount();
    fireEvent.click(open('Unità di misura').getByRole('radio', { name: 'Imperiali (lb, in)' }));
    await closed();
    fireEvent.click(open('Lingua').getByRole('radio', { name: 'English' }));
    await closed();
    fireEvent.click(screen.getByRole('link', { name: 'Torna all\'Account' }));
    await screen.findByRole('heading', { level: 1, name: 'Account' });
    fireEvent.click(screen.getByRole('link', { name: 'Profilo e preferenze' }));
    await screen.findByRole('button', { name: 'Lingua' });
    expect(describedBy(row('Unità di misura'))).toBe('lb, in');
    expect(describedBy(row('Lingua'))).toBe('English');
  });
});

describe('lettura dell\'account fallita', () => {
  it('scegliere lb salva lo stesso e la riga dice «lb, in»', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    stubFetch({ account: null });
    await mount();
    expect(describedBy(row('Unità di misura'))).toBe('kg, cm');
    fireEvent.click(open('Unità di misura').getByRole('radio', { name: 'Imperiali (lb, in)' }));
    await closed();
    expect(settingsCalls()).toEqual([{ weight_unit: 'lb' }]);
    expect(describedBy(row('Unità di misura'))).toBe('lb, in');
  });
});

describe('una rilettura dei dati', () => {
  it('non smonta la pagina: l\'obiettivo scelto e il suo esito, dentro la finestra aperta, restano', async () => {
    const account = serverAccount();
    stubFetch({ account, settings: () => Promise.resolve(json({ success: true, weekly_goal: 5, weekly_goal_default: 3, weekly_goal_pending: null })) });
    const { rerenderAccount } = await mount();
    const dialog = open('Obiettivo settimanale');
    fireEvent.click(within(dialog.getByRole('group', { name: 'Obiettivo settimanale' })).getByRole('button', { name: '5' }));
    await waitFor(() => expect(dialog.getByRole('status').textContent).toBe('Obiettivo settimanale aggiornato'));
    // il server ha ormai il valore nuovo; l'utente cambia identità e la cornice rilegge
    account.weekly_goal = 5;
    auth.user = { id: 1 };
    expect(reads()).toBe(1);
    rerenderAccount();
    await waitFor(() => expect(reads()).toBe(2));
    expect(screen.getByRole('dialog')).toBeTruthy();
    expect(within(dialog.getByRole('group', { name: 'Obiettivo settimanale' })).getByRole('button', { name: '5' }).getAttribute('aria-pressed')).toBe('true');
    expect(dialog.getByRole('status').textContent).toBe('Obiettivo settimanale aggiornato');
  });
});
