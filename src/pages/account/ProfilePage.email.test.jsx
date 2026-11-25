// Pagina «Profilo e preferenze»: la riga «Email» del gruppo «Tu» (indirizzo e stato), la sua finestra (stato, «Scrivi il
// codice», cambio in attesa e suo annullamento, «Cambia indirizzo») e la finestra «Cambia indirizzo». La fetch è il
// confine, lo stato dell'email viene dal contesto (qui finto: conta cosa ne fa la pagina). Colori scritti a mano:
// text.secondary #6b6663, text.primary #1a1816, warning.text #a85007.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { screen, fireEvent, waitFor, within } from '@testing-library/react';
import i18n from '../../i18n';
import { json } from '../../test/dom';
import { describedBy } from '../../test/accessibleNames';
import { renderAccount } from '../../test/accountRoutes';
import { row, open, closed, staysOpen, deferred } from '../../test/settingRows';

vi.mock('react-router-dom', async (importOriginal) => ({ ...(await importOriginal()), useNavigate: () => () => {} }));
const auth = {};
vi.mock('../../context/AuthContext', () => ({ useAuth: () => auth }));

const GREY = 'rgb(107, 102, 99)';
const INK = 'rgb(26, 24, 22)';
const AMBER = 'rgb(168, 80, 7)';

const state = (extra = {}) => ({ verified: true, email: 'mario@example.com', pendingEmail: null, blocked: false, daysLeft: null, ...extra });
let calls;

beforeEach(async () => {
  await i18n.changeLanguage('it');
  calls = [];
  Object.assign(auth, {
    user: { id: 1 }, isLoggedIn: true, loading: false, logout: () => {}, updateUser: () => {},
    emailState: state(),
    openEmailDialog: vi.fn(),
    refreshEmailState: vi.fn(() => Promise.resolve()),
    // La risposta alla richiesta di annullare il cambio in attesa
    cancelReply: () => Promise.resolve(json({ success: true, cancelled: true })),
  });
  vi.stubGlobal('fetch', vi.fn((url, init) => {
    calls.push({ url: String(url), init });
    const u = String(url);
    if (u.includes('groups/list.php')) return Promise.resolve(json({ success: true, groups: [] }));
    if (u.includes('user/consent.php')) return Promise.resolve(json({ success: true, consents: { terms: { granted: true, version: 1 }, health_data: { granted: true, version: 1 } } }));
    if (u.includes('user/read.php')) return Promise.resolve(json({ id: 1, username: 'mario', email: 'vecchio@example.com', created_at: '2025-03-01T10:00:00+01:00', weekly_goal_default: 3, tier: 'free', tier_until: null, tier_last_day: null, signup_code: null }));
    if (u.includes('change_email.php')) return Promise.resolve(json(auth.changeReply ?? { success: true, mode: 'immediate', email: 'nuovo@example.com', pending_email: null }));
    if (u.includes('cancel_email_change.php')) return auth.cancelReply();
    return Promise.resolve(json({ success: true, consents: [], id: 1, weekly_goal_default: 3 }));
  }));
  localStorage.setItem('themeMode', 'light');
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  delete auth.changeReply;
  localStorage.clear();
});

const mount = async () => {
  renderAccount('/account/profilo');
  await screen.findByRole('button', { name: 'Email' });
};
const cancelCalls = () => calls.filter((c) => c.url.includes('cancel_email_change.php'));

describe('la riga «Email»', () => {
  it('confermata: nome «Email», descrizione «indirizzo, stato» e lo stato nel grigio degli altri valori', async () => {
    await mount();
    expect(row('Email').getAttribute('aria-haspopup')).toBe('dialog');
    expect(describedBy(row('Email'))).toBe('mario@example.com Confermata');
    expect(getComputedStyle(screen.getByText('Confermata')).color).toBe(GREY);
  });

  it('da confermare: «Da confermare» in arancio', async () => {
    auth.emailState = state({ verified: false, daysLeft: 4 });
    await mount();
    expect(describedBy(row('Email'))).toBe('mario@example.com Da confermare');
    expect(getComputedStyle(screen.getByText('Da confermare')).color).toBe(AMBER);
  });

  it('cambio in attesa su un account confermato: il vecchio indirizzo e «Da confermare» in arancio', async () => {
    auth.emailState = state({ pendingEmail: 'nuovo@example.com' });
    await mount();
    expect(describedBy(row('Email'))).toBe('mario@example.com Da confermare');
    expect(getComputedStyle(screen.getByText('Da confermare')).color).toBe(AMBER);
  });

  it('senza stato (non ancora letto) c\'è l\'indirizzo dell\'account e nessun valore', async () => {
    auth.emailState = null;
    await mount();
    expect(describedBy(row('Email'))).toBe('vecchio@example.com');
    expect(screen.queryByText('Confermata')).toBeNull();
    expect(screen.queryByText('Da confermare')).toBeNull();
  });

  it('l\'indirizzo è quello dello stato del contesto (cambia dopo una conferma), non quello caricato all\'apertura', async () => {
    await mount();
    expect(screen.queryByText('vecchio@example.com')).toBeNull();
    expect(screen.getByText('mario@example.com')).toBeTruthy();
  });

  it('un indirizzo lungo non viene troncato: va a capo', async () => {
    auth.emailState = state({ email: 'atleta.con.un.indirizzo.molto.lungo@example.com' });
    await mount();
    const style = getComputedStyle(screen.getByText('atleta.con.un.indirizzo.molto.lungo@example.com'));
    expect(style.textOverflow).not.toBe('ellipsis');
    expect(style.whiteSpace).not.toBe('nowrap');
    expect(style.overflowWrap).toBe('anywhere');
  });

  it('in inglese: «Email», «Confirmed», «Not confirmed»', async () => {
    await i18n.changeLanguage('en');
    auth.emailState = state({ verified: false });
    renderAccount('/account/profilo');
    await screen.findByRole('button', { name: 'Email' });
    expect(describedBy(row('Email'))).toBe('mario@example.com Not confirmed');
  });
});

describe('la finestra «Email»', () => {
  it('confermata: l\'indirizzo, «Confermata», «Cambia indirizzo» e «Chiudi»; niente «Scrivi il codice»', async () => {
    await mount();
    const dialog = open('Email');
    expect(dialog.getAllByText('Email')).toHaveLength(1);
    expect(dialog.getByText('mario@example.com')).toBeTruthy();
    expect(dialog.getByText('Confermata')).toBeTruthy();
    expect(dialog.queryByRole('button', { name: 'Scrivi il codice' })).toBeNull();
    expect(dialog.getAllByRole('button').map((b) => b.textContent)).toEqual(['Cambia indirizzo', 'Chiudi']);
  });

  it('da confermare: «Da confermare» e il comando per scrivere il codice', async () => {
    auth.emailState = state({ verified: false, daysLeft: 4 });
    await mount();
    const dialog = open('Email');
    expect(dialog.getByText('Da confermare')).toBeTruthy();
    expect(dialog.queryByText('Confermata')).toBeNull();
    expect(dialog.getByRole('button', { name: 'Scrivi il codice' })).toBeTruthy();
  });

  it('cambio in attesa su un account confermato: resta «Confermata» col vecchio indirizzo e compare l\'attesa con «Scrivi il codice» e «Annulla»', async () => {
    auth.emailState = state({ pendingEmail: 'nuovo@example.com' });
    await mount();
    const dialog = open('Email');
    expect(dialog.getByText('mario@example.com')).toBeTruthy();
    expect(dialog.getByText('Confermata')).toBeTruthy();
    expect(dialog.getByText('In attesa di conferma: nuovo@example.com')).toBeTruthy();
    expect(dialog.getByRole('button', { name: 'Scrivi il codice' })).toBeTruthy();
    expect(dialog.getByRole('button', { name: 'Annulla il cambio di indirizzo' }).textContent).toBe('Annulla');
  });

  it('senza stato: solo l\'indirizzo e «Chiudi»', async () => {
    auth.emailState = null;
    await mount();
    const dialog = open('Email');
    expect(dialog.getByText('vecchio@example.com')).toBeTruthy();
    expect(dialog.getAllByRole('button').map((b) => b.textContent)).toEqual(['Chiudi']);
  });

  it('«Cambia indirizzo» è outlined neutro: testo in inchiostro e bordo grigio visibile; i comandi sono alti almeno 44 px', async () => {
    auth.emailState = state({ verified: false, daysLeft: 4 });
    await mount();
    const dialog = open('Email');
    const change = dialog.getByRole('button', { name: 'Cambia indirizzo' });
    expect(change.classList.contains('MuiButton-outlined')).toBe(true);
    expect(getComputedStyle(change).color).toBe(INK);
    expect(getComputedStyle(change).borderColor).toBe(GREY);
    for (const name of ['Scrivi il codice', 'Cambia indirizzo', 'Chiudi']) {
      expect(getComputedStyle(dialog.getByRole('button', { name })).minHeight).toBe('44px');
    }
  });

  it('«Chiudi» la chiude e il fuoco torna sulla riga', async () => {
    await mount();
    fireEvent.click(open('Email').getByRole('button', { name: 'Chiudi' }));
    await closed();
    expect(document.activeElement).toBe(row('Email'));
  });

  it('«Scrivi il codice» chiude la finestra prima di aprire quella del codice, con il fuoco sulla riga', async () => {
    auth.emailState = state({ verified: false, daysLeft: 4 });
    let atCall;
    auth.openEmailDialog = vi.fn(() => { atCall = { focus: document.activeElement, inDialog: Boolean(document.activeElement.closest('[role="dialog"]')) }; });
    await mount();
    const emailRow = row('Email');
    fireEvent.click(open('Email').getByRole('button', { name: 'Scrivi il codice' }));
    expect(auth.openEmailDialog).toHaveBeenCalledTimes(1);
    expect(atCall.inDialog).toBe(false);
    expect(atCall.focus).toBe(emailRow);
  });

  it('«Scrivi il codice» del cambio in attesa fa lo stesso', async () => {
    auth.emailState = state({ pendingEmail: 'nuovo@example.com' });
    let atCall;
    auth.openEmailDialog = vi.fn(() => { atCall = { focus: document.activeElement, inDialog: Boolean(document.activeElement.closest('[role="dialog"]')) }; });
    await mount();
    const emailRow = row('Email');
    fireEvent.click(open('Email').getByRole('button', { name: 'Scrivi il codice' }));
    expect(auth.openEmailDialog).toHaveBeenCalledTimes(1);
    expect(atCall.inDialog).toBe(false);
    expect(atCall.focus).toBe(emailRow);
  });
});

describe('«Annulla» del cambio in attesa, dentro la finestra «Email»', () => {
  const pendingMount = async () => {
    auth.emailState = state({ pendingEmail: 'nuovo@example.com' });
    await mount();
    return open('Email');
  };
  const cancel = (dialog) => fireEvent.click(dialog.getByRole('button', { name: 'Annulla il cambio di indirizzo' }));

  it('riuscito: toglie il cambio in attesa, rilegge lo stato, l\'esito si legge nella finestra che resta aperta e la riga è aggiornata', async () => {
    auth.refreshEmailState = vi.fn(() => { auth.emailState = state(); return Promise.resolve(); });
    const dialog = await pendingMount();
    cancel(dialog);
    await waitFor(() => expect(dialog.getByRole('status').textContent).toBe('Cambio di indirizzo annullato.'));
    expect(cancelCalls()).toHaveLength(1);
    expect(cancelCalls()[0].init.method).toBe('POST');
    expect(auth.refreshEmailState).toHaveBeenCalled();
    expect(dialog.getByRole('alert').textContent).toBe('');
    staysOpen();
    expect(dialog.queryByText('In attesa di conferma: nuovo@example.com')).toBeNull();
    // l'esito è dentro la finestra: la notifica della pagina non lo ripete
    expect(screen.getAllByText('Cambio di indirizzo annullato.')).toHaveLength(1);
    fireEvent.click(dialog.getByRole('button', { name: 'Chiudi' }));
    await closed();
    expect(describedBy(row('Email'))).toBe('mario@example.com Confermata');
  });

  it.each([
    ['la rete non risponde', () => Promise.reject(new Error('offline')), 'Non riesco a collegarmi. Riprova.'],
    ['il server risponde con un messaggio', () => Promise.resolve(json({ success: false, message: 'Nessun cambio da annullare.' }, 409)), 'Nessun cambio da annullare.'],
    ['il server risponde senza messaggio', () => Promise.resolve(json({ success: false }, 500)), 'Qualcosa non ha funzionato. Riprova.'],
  ])('%s: l\'errore sta nella finestra, che resta aperta, e il cambio in attesa resta', async (_name, reply, text) => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    auth.cancelReply = reply;
    const dialog = await pendingMount();
    cancel(dialog);
    await waitFor(() => expect(dialog.getByRole('alert').textContent).toBe(text));
    expect(dialog.getByRole('status').textContent).toBe('');
    staysOpen();
    expect(dialog.getByText('In attesa di conferma: nuovo@example.com')).toBeTruthy();
    expect(auth.refreshEmailState).not.toHaveBeenCalled();
    expect(screen.getAllByText(text)).toHaveLength(1);
  });

  it('riaperta la finestra l\'esito di prima non c\'è più', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    auth.cancelReply = () => Promise.resolve(json({ success: false }, 500));
    const dialog = await pendingMount();
    cancel(dialog);
    await waitFor(() => expect(dialog.getByRole('alert').textContent).toBe('Qualcosa non ha funzionato. Riprova.'));
    fireEvent.click(dialog.getByRole('button', { name: 'Chiudi' }));
    await closed();
    expect(open('Email').getByRole('alert').textContent).toBe('');
  });

  it('due clic fanno una richiesta sola e la finestra non si chiude (Esc, «Chiudi») finché la richiesta è in corso', async () => {
    const answer = deferred();
    auth.cancelReply = () => answer.promise;
    const dialog = await pendingMount();
    cancel(dialog);
    await waitFor(() => expect(dialog.getByRole('button', { name: 'Chiudi' }).getAttribute('aria-disabled')).toBe('true'));
    cancel(dialog);
    fireEvent.click(dialog.getByRole('button', { name: 'Chiudi' }));
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
    staysOpen();
    expect(cancelCalls()).toHaveLength(1);
    answer.resolve(json({ success: true, cancelled: true }));
    await waitFor(() => expect(dialog.getByRole('status').textContent).toBe('Cambio di indirizzo annullato.'));
    expect(cancelCalls()).toHaveLength(1);
  });
});

describe('Cambia indirizzo', () => {
  const openChange = () => fireEvent.click(open('Email').getByRole('button', { name: 'Cambia indirizzo' }));
  const changeDialog = () => within(screen.getByRole('dialog', { name: 'Cambia indirizzo email' }));
  const submitChange = () => {
    const dialog = changeDialog();
    fireEvent.change(dialog.getByLabelText(/^Nuovo indirizzo email/), { target: { value: 'nuovo@example.com' } });
    fireEvent.change(dialog.getByLabelText(/^Password/), { target: { value: 'Segreta!2026' } });
    fireEvent.click(dialog.getByRole('button', { name: 'Cambia indirizzo' }));
  };

  it('chiude la finestra «Email» e apre «Cambia indirizzo»: mai due finestre insieme', async () => {
    await mount();
    openChange();
    expect(screen.getAllByRole('dialog').map((d) => d.getAttribute('aria-labelledby'))).toEqual(['email-change-title']);
    expect(changeDialog().getByText('Cambia indirizzo email')).toBeTruthy();
  });

  it('alla chiusura di «Cambia indirizzo» il fuoco è sulla riga «Email»', async () => {
    await mount();
    openChange();
    fireEvent.click(changeDialog().getByRole('button', { name: 'Annulla' }));
    await closed();
    expect(document.activeElement).toBe(row('Email'));
  });

  it('Esc chiude «Cambia indirizzo» e il fuoco torna sulla riga «Email»', async () => {
    await mount();
    openChange();
    fireEvent.keyDown(screen.getByRole('dialog', { name: 'Cambia indirizzo email' }), { key: 'Escape' });
    await closed();
    expect(document.activeElement).toBe(row('Email'));
  });

  it('account non confermato: l\'indirizzo cambia subito e si apre la finestra del codice', async () => {
    auth.emailState = state({ verified: false, daysLeft: 4 });
    await mount();
    openChange();
    submitChange();
    await waitFor(() => expect(auth.openEmailDialog).toHaveBeenCalledTimes(1));
    expect(auth.refreshEmailState).toHaveBeenCalled();
    expect(JSON.parse(calls.find((c) => c.url.includes('change_email.php')).init.body)).toEqual({ email: 'nuovo@example.com', password: 'Segreta!2026' });
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Cambia indirizzo email' })).toBeNull());
  });

  it('account confermato: il nuovo indirizzo resta in attesa e si apre la finestra per scrivere il suo codice', async () => {
    auth.changeReply = { success: true, mode: 'pending', email: null, pending_email: 'nuovo@example.com' };
    await mount();
    openChange();
    submitChange();
    await waitFor(() => expect(auth.openEmailDialog).toHaveBeenCalledTimes(1));
    expect(auth.refreshEmailState).toHaveBeenCalled();
  });

  it('indirizzo già in uso: l\'errore sta sul campo dell\'indirizzo e non si apre il codice', async () => {
    auth.changeReply = { success: false, code: 'email_taken', field: 'email' };
    await mount();
    openChange();
    submitChange();
    await waitFor(() => expect(changeDialog().getByLabelText(/^Nuovo indirizzo email/).getAttribute('aria-invalid')).toBe('true'));
    expect(auth.openEmailDialog).not.toHaveBeenCalled();
  });
});
