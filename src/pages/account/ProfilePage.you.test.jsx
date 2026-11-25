// Pagina «Profilo e preferenze» (/account/profilo), il gruppo «Tu»: le righe data di nascita, sesso e inizio allenamento
// (l'email ha ProfilePage.email.test.jsx) col valore di adesso, una finestra per ognuna e un salvataggio per campo. I
// gruppi «Allenamento» e «App» sono in ProfilePage.settings.test.jsx; la validazione della data di nascita in
// ProfilePage.test.jsx. Colore scritto a mano: error #d50000. La fetch è il confine.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { screen, within, fireEvent, waitFor } from '@testing-library/react';
import i18n from '../../i18n';
import { json } from '../../test/dom';
import { describedBy, strayListChildren } from '../../test/accessibleNames';
import { textBelow } from '../../test/minText';
import { mockPointer } from '../../test/pointer';
import { renderAccount } from '../../test/accountRoutes';
import { row, open, closed, staysOpen, settingsCalls, deferred } from '../../test/settingRows';

vi.mock('react-router-dom', async (importOriginal) => ({ ...(await importOriginal()), useNavigate: () => () => {} }));
const auth = {};
vi.mock('../../context/AuthContext', () => ({ useAuth: () => auth }));

const serverAccount = (over = {}) => ({
  id: 1, username: 'mario', email: 'mario@example.com', created_at: '2025-03-01T10:00:00+01:00', is_admin: false,
  weight_unit: 'kg', locale: 'it', weekly_goal: null, weekly_goal_default: 3, weekly_goal_pending: null,
  birth_date: '1992-05-14', age: 34, gender: 'M', training_start_date: '2022-01-10', experience_years: 4,
  tier: 'free', tier_until: null, tier_last_day: null, signup_code: null, ...over,
});

// `account`: i campi del server; `settings(body)`: la risposta a update_settings.php (di base il server salva il corpo
// nell'account e lo riflette)
const stubFetch = ({ account = serverAccount(), settings = (body) => { Object.assign(account, body); return Promise.resolve(json({ success: true, ...body })); } } = {}) => (
  vi.stubGlobal('fetch', vi.fn((url, init) => (
    String(url).includes('update_settings.php') ? settings(JSON.parse(init.body))
      : String(url).includes('groups/list.php') ? Promise.resolve(json({ success: true, groups: [] }))
        : String(url).includes('user/read.php') ? Promise.resolve(json(account))
          : Promise.resolve(json({ success: true, consents: [], id: 1, weekly_goal_default: 3 }))
  )))
);

beforeEach(async () => {
  await i18n.changeLanguage('it');
  localStorage.setItem('themeMode', 'light');
  Object.assign(auth, {
    user: { id: 1 }, isLoggedIn: true, loading: false, logout: vi.fn(), updateUser: vi.fn(),
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
const birthField = (dialog) => dialog.getByRole('textbox', { name: /^Data di nascita/ });
const startField = (dialog) => dialog.getByRole('textbox', { name: /^Inizio allenamento/ });
const save = (dialog) => fireEvent.click(dialog.getByRole('button', { name: 'Salva' }));
const cancel = (dialog) => fireEvent.click(dialog.getByRole('button', { name: 'Annulla' }));
// Il corpo dell'ultimo rifiuto del server: l'errore sta nella finestra, la notifica della pagina non lo ripete
const refuse = () => stubFetch({ settings: () => Promise.resolve(json({ success: false }, 500)) });
const GREY = 'rgb(107, 102, 99)';
const SAVED = 'Profilo aggiornato con successo';
const ERROR = 'Errore nel salvataggio del profilo';

describe('il gruppo «Tu»: le righe', () => {
  it('ogni riga è un pulsante: nome = titolo, descrizione = valore (data GG/MM/AAAA, sesso, mese MM/AAAA)', async () => {
    await mount();
    for (const [name, value] of [['Data di nascita', '14/05/1992'], ['Sesso', 'Maschio'], ['Inizio allenamento', '01/2022']]) {
      const button = row(name);
      expect(button.getAttribute('aria-haspopup')).toBe('dialog');
      expect(describedBy(button)).toBe(value);
    }
  });

  it.each([
    ['M', 'Maschio'],
    ['F', 'Femmina'],
    ['O', 'Altro'],
  ])('Sesso, account con %s: «%s»', async (gender, value) => {
    stubFetch({ account: serverAccount({ gender }) });
    await mount();
    expect(describedBy(row('Sesso'))).toBe(value);
  });

  it('campi vuoti: ogni riga dice «Da indicare»', async () => {
    stubFetch({ account: serverAccount({ birth_date: null, gender: null, training_start_date: null }) });
    await mount();
    for (const name of ['Data di nascita', 'Sesso', 'Inizio allenamento']) expect(describedBy(row(name))).toBe('Da indicare');
  });

  it('in inglese titoli e valori sono quelli inglesi; le date non cambiano', async () => {
    await i18n.changeLanguage('en');
    stubFetch({ account: serverAccount({ gender: 'F', locale: 'en' }) });
    renderAccount('/account/profilo');
    await screen.findByRole('button', { name: 'Language' });
    expect(screen.getByRole('heading', { level: 2, name: 'You' })).toBeTruthy();
    expect(describedBy(row('Date of birth'))).toBe('14/05/1992');
    expect(describedBy(row('Sex'))).toBe('Female');
    expect(describedBy(row('Training start'))).toBe('01/2022');
  });

  it('senza un account letto le righe dicono «Da indicare»', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.stubGlobal('fetch', vi.fn((url) => Promise.resolve(
      String(url).includes('user/read.php') ? json({ success: false }, 500)
        : String(url).includes('groups/list.php') ? json({ success: true, groups: [] })
          : json({ success: true, consents: [], id: 1, weekly_goal_default: 3 }),
    )));
    await mount();
    for (const name of ['Data di nascita', 'Sesso', 'Inizio allenamento']) expect(describedBy(row(name))).toBe('Da indicare');
  });
});

describe('il gruppo «Tu»: la forma', () => {
  it('il titolo è un h2 da 16 px, 700, grigio e non in maiuscolo; il gruppo è una card con un elenco di righe separate da una linea', async () => {
    await mount();
    const heading = screen.getByRole('heading', { level: 2, name: 'Tu' });
    const style = getComputedStyle(heading);
    expect({ size: style.fontSize, weight: style.fontWeight, color: style.color, transform: style.textTransform })
      .toEqual({ size: '16px', weight: '700', color: GREY, transform: 'none' });
    const card = heading.nextElementSibling;
    expect(card.classList.contains('MuiCard-root')).toBe(true);
    const list = within(card).getByRole('list');
    expect(strayListChildren(list)).toEqual([]);
    const top = (li) => parseInt(getComputedStyle(li).borderTopWidth, 10) || 0;
    expect(within(card).getAllByRole('listitem').map(top)).toEqual([0, 1, 1]);
  });

  it('nessun testo del gruppo è sotto i 16 px', async () => {
    await mount();
    expect(textBelow(screen.getByRole('heading', { level: 2, name: 'Tu' }).parentElement, 16)).toEqual([]);
  });
});

describe('il gruppo «Tu»: le finestre', () => {
  it.each([
    ['Data di nascita', ['Annulla', 'Salva']],
    ['Sesso', ['Chiudi']],
    ['Inizio allenamento', ['Annulla', 'Salva']],
  ])('«%s» apre la sua finestra, col titolo come nome, a 16 px, e il piede ha %j', async (name, buttons) => {
    mockPointer(true);
    await mount();
    const dialog = open(name);
    expect(screen.getAllByRole('dialog')).toHaveLength(1);
    // il titolo c'è una volta come titolo della finestra; i campi con la data lo ripetono come etichetta
    expect(within(screen.getByRole('dialog')).getByRole('heading', { name }).textContent).toBe(name);
    // la tacca del bordo (legend) non è testo disegnato
    expect(textBelow(screen.getByRole('dialog'), 16, '.MuiChip-root, legend')).toEqual([]);
    const footer = screen.getByRole('dialog').querySelector('.MuiDialogActions-root');
    expect([...footer.querySelectorAll('button')].map((b) => b.textContent)).toEqual(buttons);
    expect(dialog).toBeTruthy();
  });

  it.each([
    ['Data di nascita', 'Annulla'],
    ['Sesso', 'Chiudi'],
    ['Inizio allenamento', 'Annulla'],
  ])('chiusa la finestra di «%s» con «%s» il fuoco è sulla sua riga e non si è salvato nulla', async (name, closer) => {
    await mount();
    const dialog = open(name);
    fireEvent.click(dialog.getByRole('button', { name: closer }));
    await closed();
    expect(document.activeElement).toBe(row(name));
    expect(settingsCalls()).toEqual([]);
  });

  it.each([['Data di nascita'], ['Sesso'], ['Inizio allenamento']])('Esc chiude la finestra di «%s» e il fuoco torna sulla riga', async (name) => {
    await mount();
    open(name);
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
    await closed();
    expect(document.activeElement).toBe(row(name));
  });
});

describe('finestra «Data di nascita»', () => {
  const apri = async () => {
    mockPointer(true);
    await mount();
    return open('Data di nascita');
  };

  it('il campo parte dalla data dell\'account, con la riga d\'aiuto dell\'età', async () => {
    const dialog = await apri();
    expect(birthField(dialog).value).toBe('14/05/1992');
    expect(birthField(dialog).getAttribute('autocomplete')).toBe('bday');
    expect(describedBy(birthField(dialog))).toBe('Età attuale: 34 anni');
  });

  it('senza data nell\'account il campo è vuoto e l\'aiuto dice che l\'età si calcola da sola', async () => {
    stubFetch({ account: serverAccount({ birth_date: null, age: null }) });
    const dialog = await apri();
    expect(birthField(dialog).value).toBe('');
    expect(describedBy(birthField(dialog))).toBe('Calcolata automaticamente');
  });

  it('una data non valida: errore sul campo, finestra aperta col fuoco sul campo, nessuna richiesta', async () => {
    const dialog = await apri();
    fireEvent.change(birthField(dialog), { target: { value: '21/07/0085' } });
    save(dialog);
    await waitFor(() => expect(birthField(dialog).getAttribute('aria-invalid')).toBe('true'));
    expect(describedBy(birthField(dialog))).toBe('Inserisci una data di nascita valida');
    expect(document.activeElement).toBe(birthField(dialog));
    staysOpen();
    expect(settingsCalls()).toEqual([]);
  });

  it('il campo vuoto: «Inserisci la data di nascita», finestra aperta, fuoco sul campo, nessuna richiesta', async () => {
    const dialog = await apri();
    fireEvent.change(birthField(dialog), { target: { value: '' } });
    save(dialog);
    await waitFor(() => expect(describedBy(birthField(dialog))).toBe('Inserisci la data di nascita'));
    expect(birthField(dialog).getAttribute('aria-invalid')).toBe('true');
    expect(document.activeElement).toBe(birthField(dialog));
    staysOpen();
    expect(settingsCalls()).toEqual([]);
  });

  it('una data valida: parte la richiesta col solo birth_date, la finestra si chiude, la riga e l\'età (alla riapertura) sono nuovi e la pagina avvisa', async () => {
    stubFetch({ settings: () => Promise.resolve(json({ success: true, birth_date: '1985-07-21', age: 40 })) });
    const dialog = await apri();
    fireEvent.change(birthField(dialog), { target: { value: '21/07/1985' } });
    save(dialog);
    await closed();
    expect(settingsCalls()).toEqual([{ birth_date: '1985-07-21' }]);
    expect(await screen.findByText(SAVED)).toBeTruthy();
    expect(describedBy(row('Data di nascita'))).toBe('21/07/1985');
    expect(document.activeElement).toBe(row('Data di nascita'));
    const again = open('Data di nascita');
    expect(birthField(again).value).toBe('21/07/1985');
    expect(describedBy(birthField(again))).toBe('Età attuale: 40 anni');
  });

  it('il rifiuto del server: la finestra resta aperta con l\'errore dentro, la riga non cambia, la pagina non avvisa', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    refuse();
    const dialog = await apri();
    fireEvent.change(birthField(dialog), { target: { value: '21/07/1985' } });
    save(dialog);
    await waitFor(() => expect(dialog.getByRole('alert').textContent).toBe(ERROR));
    staysOpen();
    expect(describedBy(screen.getByRole('button', { name: 'Data di nascita', hidden: true }))).toBe('14/05/1992');
    expect(screen.getAllByText(ERROR)).toHaveLength(1);
    expect(screen.queryByText(SAVED)).toBeNull();
  });

  it('riaperta dopo un rifiuto non ha l\'errore di prima e il campo riparte dal valore dell\'account', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    refuse();
    const dialog = await apri();
    fireEvent.change(birthField(dialog), { target: { value: '21/07/1985' } });
    save(dialog);
    await waitFor(() => expect(dialog.getByRole('alert').textContent).toBe(ERROR));
    cancel(dialog);
    await closed();
    const again = open('Data di nascita');
    expect(again.getByRole('alert').textContent).toBe('');
    expect(birthField(again).value).toBe('14/05/1992');
  });

  it('«Annulla» non salva; riaperta la finestra il campo ha il valore dell\'account', async () => {
    const dialog = await apri();
    fireEvent.change(birthField(dialog), { target: { value: '21/07/1985' } });
    cancel(dialog);
    await closed();
    expect(settingsCalls()).toEqual([]);
    expect(birthField(open('Data di nascita')).value).toBe('14/05/1992');
  });

  it('un errore di validazione non resta alla riapertura', async () => {
    const dialog = await apri();
    fireEvent.change(birthField(dialog), { target: { value: '21/07/0085' } });
    save(dialog);
    await waitFor(() => expect(birthField(dialog).getAttribute('aria-invalid')).toBe('true'));
    cancel(dialog);
    await closed();
    const again = open('Data di nascita');
    expect(birthField(again).getAttribute('aria-invalid')).not.toBe('true');
    expect(describedBy(birthField(again))).toBe('Età attuale: 34 anni');
  });

  it('due clic su «Salva» fanno una richiesta sola; «Salva» è aria-disabled, «Annulla» ed Esc non chiudono; l\'esito chiude', async () => {
    const answer = deferred();
    stubFetch({ settings: () => answer.promise });
    const dialog = await apri();
    fireEvent.change(birthField(dialog), { target: { value: '21/07/1985' } });
    save(dialog);
    await waitFor(() => expect(dialog.getByRole('button', { name: 'Salva' }).getAttribute('aria-disabled')).toBe('true'));
    save(dialog);
    cancel(dialog);
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
    staysOpen();
    expect(settingsCalls()).toEqual([{ birth_date: '1985-07-21' }]);
    answer.release(json({ success: true, birth_date: '1985-07-21', age: 40 }));
    await closed();
    expect(settingsCalls()).toHaveLength(1);
    expect(await screen.findByText(SAVED)).toBeTruthy();
  });
});

describe('finestra «Sesso»', () => {
  const group = (dialog) => dialog.getByRole('radiogroup', { name: 'Sesso' });

  it('ha tre scelte e quella dell\'account è scelta; senza valore nell\'account nessuna lo è', async () => {
    await mount();
    const dialog = open('Sesso');
    expect(within(group(dialog)).getAllByRole('radio').map((r) => [r.getAttribute('value'), r.checked])).toEqual([['M', true], ['F', false], ['O', false]]);
    expect(within(group(dialog)).getAllByRole('radio').map((r) => r.closest('label').textContent)).toEqual(['Maschio', 'Femmina', 'Altro']);
  });

  it('senza un valore nell\'account nessuna scelta è fatta', async () => {
    stubFetch({ account: serverAccount({ gender: null }) });
    await mount();
    const dialog = open('Sesso');
    expect(dialog.getAllByRole('radio').map((r) => r.checked)).toEqual([false, false, false]);
  });

  it('la scelta salva al clic il solo gender, chiude la finestra, avvisa dalla pagina e la riga dice il valore nuovo', async () => {
    await mount();
    fireEvent.click(open('Sesso').getByRole('radio', { name: 'Femmina' }));
    await closed();
    expect(settingsCalls()).toEqual([{ gender: 'F' }]);
    expect(await screen.findByText(SAVED)).toBeTruthy();
    expect(describedBy(row('Sesso'))).toBe('Femmina');
    expect(document.activeElement).toBe(row('Sesso'));
    expect(open('Sesso').getByRole('radio', { name: 'Femmina' }).checked).toBe(true);
  });

  it('il rifiuto: la finestra resta aperta con l\'errore dentro, torna la scelta di prima, la riga non cambia', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    refuse();
    await mount();
    const dialog = open('Sesso');
    fireEvent.click(dialog.getByRole('radio', { name: 'Femmina' }));
    await waitFor(() => expect(dialog.getByRole('alert').textContent).toBe(ERROR));
    staysOpen();
    expect(dialog.getByRole('radio', { name: 'Maschio' }).checked).toBe(true);
    expect(dialog.getByRole('radio', { name: 'Femmina' }).checked).toBe(false);
    expect(describedBy(screen.getByRole('button', { name: 'Sesso', hidden: true }))).toBe('Maschio');
    expect(screen.getAllByText(ERROR)).toHaveLength(1);
  });

  it('riaperta dopo un rifiuto la finestra non ha più l\'errore', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    refuse();
    await mount();
    const dialog = open('Sesso');
    fireEvent.click(dialog.getByRole('radio', { name: 'Femmina' }));
    await waitFor(() => expect(dialog.getByRole('alert').textContent).toBe(ERROR));
    fireEvent.click(dialog.getByRole('button', { name: 'Chiudi' }));
    await closed();
    expect(open('Sesso').getByRole('alert').textContent).toBe('');
  });

  it('due scelte veloci fanno una sola richiesta; la finestra non si chiude finché si salva', async () => {
    const answer = deferred();
    stubFetch({ settings: () => answer.promise });
    await mount();
    const dialog = open('Sesso');
    fireEvent.click(dialog.getByRole('radio', { name: 'Femmina' }));
    await waitFor(() => expect(group(dialog).getAttribute('aria-busy')).toBe('true'));
    fireEvent.click(dialog.getByRole('radio', { name: 'Altro' }));
    fireEvent.click(dialog.getByRole('button', { name: 'Chiudi' }));
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
    staysOpen();
    expect(settingsCalls()).toEqual([{ gender: 'F' }]);
    expect(dialog.getByRole('radio', { name: 'Femmina' }).checked).toBe(true);
    answer.release(json({ success: true, gender: 'F' }));
    await closed();
    expect(settingsCalls()).toHaveLength(1);
  });
});

describe('finestra «Inizio allenamento»', () => {
  const apri = async () => {
    mockPointer(true);
    await mount();
    return open('Inizio allenamento');
  };

  it('il campo parte dal mese dell\'account (MM/AAAA), con l\'aiuto dell\'esperienza', async () => {
    const dialog = await apri();
    expect(startField(dialog).value).toBe('01/2022');
    expect(startField(dialog).getAttribute('autocomplete')).not.toBe('bday');
    expect(describedBy(startField(dialog))).toBe('Esperienza: 4 anni');
  });

  it('senza dato nell\'account il campo è vuoto e l\'aiuto dice «Mese e anno di inizio»', async () => {
    stubFetch({ account: serverAccount({ training_start_date: null, experience_years: null }) });
    const dialog = await apri();
    expect(startField(dialog).value).toBe('');
    expect(describedBy(startField(dialog))).toBe('Mese e anno di inizio');
  });

  it('un mese prima della nascita dell\'account è già rosso', async () => {
    const dialog = await apri();
    fireEvent.change(startField(dialog), { target: { value: '03/1990' } });
    expect(startField(dialog).getAttribute('aria-invalid')).toBe('true');
  });

  it('un mese valido: parte la richiesta col solo training_start_date (primo del mese), la finestra si chiude, la riga e l\'esperienza sono nuove', async () => {
    stubFetch({ settings: () => Promise.resolve(json({ success: true, training_start_date: '2023-03-01', experience_years: 3 })) });
    const dialog = await apri();
    fireEvent.change(startField(dialog), { target: { value: '03/2023' } });
    save(dialog);
    await closed();
    expect(settingsCalls()).toEqual([{ training_start_date: '2023-03-01' }]);
    expect(await screen.findByText(SAVED)).toBeTruthy();
    expect(describedBy(row('Inizio allenamento'))).toBe('03/2023');
    expect(document.activeElement).toBe(row('Inizio allenamento'));
    expect(describedBy(startField(open('Inizio allenamento')))).toBe('Esperienza: 3 anni');
  });

  it('il campo svuotato toglie il dato: la richiesta manda null e la riga dice «Da indicare»', async () => {
    stubFetch({ settings: () => Promise.resolve(json({ success: true, training_start_date: null, experience_years: null })) });
    const dialog = await apri();
    fireEvent.change(startField(dialog), { target: { value: '' } });
    save(dialog);
    await closed();
    expect(settingsCalls()).toEqual([{ training_start_date: null }]);
    expect(describedBy(row('Inizio allenamento'))).toBe('Da indicare');
  });

  it('il rifiuto: la finestra resta aperta con l\'errore dentro, la riga non cambia, riaperta riparte dal valore dell\'account', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    refuse();
    const dialog = await apri();
    fireEvent.change(startField(dialog), { target: { value: '03/2023' } });
    save(dialog);
    await waitFor(() => expect(dialog.getByRole('alert').textContent).toBe(ERROR));
    staysOpen();
    expect(describedBy(screen.getByRole('button', { name: 'Inizio allenamento', hidden: true }))).toBe('01/2022');
    expect(screen.getAllByText(ERROR)).toHaveLength(1);
    cancel(dialog);
    await closed();
    const again = open('Inizio allenamento');
    expect(again.getByRole('alert').textContent).toBe('');
    expect(startField(again).value).toBe('01/2022');
  });

  it('«Annulla» non salva; riaperta la finestra il campo ha il valore dell\'account', async () => {
    const dialog = await apri();
    fireEvent.change(startField(dialog), { target: { value: '03/2023' } });
    cancel(dialog);
    await closed();
    expect(settingsCalls()).toEqual([]);
    expect(startField(open('Inizio allenamento')).value).toBe('01/2022');
  });

  it('due clic su «Salva» fanno una richiesta sola e la finestra non si chiude prima dell\'esito', async () => {
    const answer = deferred();
    stubFetch({ settings: () => answer.promise });
    const dialog = await apri();
    fireEvent.change(startField(dialog), { target: { value: '03/2023' } });
    save(dialog);
    await waitFor(() => expect(dialog.getByRole('button', { name: 'Salva' }).getAttribute('aria-disabled')).toBe('true'));
    save(dialog);
    cancel(dialog);
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
    staysOpen();
    expect(settingsCalls()).toEqual([{ training_start_date: '2023-03-01' }]);
    answer.release(json({ success: true, training_start_date: '2023-03-01', experience_years: 3 }));
    await closed();
    expect(settingsCalls()).toHaveLength(1);
  });
});

describe('una sola finestra aperta alla volta', () => {
  it('il clic su un\'altra riga con una finestra aperta ne lascia aperta una sola: quella nuova', async () => {
    await mount();
    open('Sesso');
    fireEvent.click(screen.getByRole('button', { name: 'Lingua', hidden: true }));
    await waitFor(() => expect(screen.getAllByRole('dialog').map((d) => d.getAttribute('aria-labelledby') && document.getElementById(d.getAttribute('aria-labelledby')).textContent)).toEqual(['Lingua']));
  });
});
