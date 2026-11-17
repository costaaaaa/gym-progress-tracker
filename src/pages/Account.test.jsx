// Account: l'obiettivo settimanale ha il font dei chip, come nell'app (lì è una riga di chip); la "Zona pericolosa" è
// rosata con il bottone pieno rosso, il resto è inchiostro. Colori scritti a mano. Tema chiaro: text.primary #1a1816,
// text.secondary #6b6663, background.paper #fff, primary/error #d50000, error.muted #fdecec, error.border #f5c6c6,
// error.title #9b0000. Tema scuro (solo la zona pericolosa): error.main #ff5252 con alpha 0.1 (fondo) e 0.35 (bordo),
// error.title #ff9e9e; bottoni pieni di errore #d50000 con testo bianco.
// La fetch è il confine. Le impostazioni sono chiuse in un Collapse, che le tiene comunque montate.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, within, fireEvent, waitFor, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { format, subYears, subDays, startOfToday } from 'date-fns';
import Account from './Account';
import { ThemeModeProvider } from '../context/ThemeModeContext';
import i18n from '../i18n';
import { textBelow } from '../test/minText';
import { json } from '../test/dom';
import { pinLocalClock } from '../test/timeZone';
import { birthFieldChange } from '../test/birthFieldSpy';
import { describedBy } from '../test/accessibleNames';
import { mockPointer } from '../test/pointer';

// Il campo data vero, con l'onChange della data di nascita a portata di test (vedi src/test/birthFieldSpy.js)
vi.mock('../components/LabeledDatePicker', async (importOriginal) => (
  (await import('../test/birthFieldSpy')).spyOnBirthField(await importOriginal())
));

vi.mock('react-router-dom', async (importOriginal) => ({ ...(await importOriginal()), useNavigate: () => () => {} }));
// Lo stesso oggetto a ogni render: la pagina ricarica i dati quando `user` cambia identità.
vi.mock('../context/AuthContext', () => {
  const auth = {
    user: { id: 1 }, isLoggedIn: true, loading: false, logout: () => {}, updateUser: () => {},
    emailState: { verified: true, email: 'atleta.con.un.indirizzo.lungo@example.com', pendingEmail: null, blocked: false, daysLeft: null },
    openEmailDialog: () => {}, refreshEmailState: () => Promise.resolve(),
  };
  return { useAuth: () => auth };
});

const INK = 'rgb(26, 24, 22)';
const GREY = 'rgb(107, 102, 99)';
const GREEN = 'rgb(21, 128, 61)';
const RED = 'rgb(213, 0, 0)';
const DANGER_PINK = 'rgb(253, 236, 236)';
const DANGER_BORDER = 'rgb(245, 198, 198)';
const DANGER_TITLE = 'rgb(155, 0, 0)';
const DANGER_PINK_DARK = 'rgba(255, 82, 82, 0.1)';
const DANGER_BORDER_DARK = 'rgba(255, 82, 82, 0.35)';
const DANGER_TITLE_DARK = 'rgb(255, 158, 158)';
const WHITE = 'rgb(255, 255, 255)';

const groups = [
  { id: 7, name: 'Palestra Rossi', my_role: 'owner' },
  { id: 8, name: 'Amici del giovedì', my_role: 'member' },
];
const stubFetch = ({ is_admin = false } = {}) => vi.stubGlobal('fetch', vi.fn((url) => Promise.resolve(
  url.includes('groups/list.php') ? json({ success: true, groups })
    : url.includes('user/consent.php') ? json({ success: true, consents: { terms: { granted: true, version: 1 }, health_data: { granted: true, version: 1 } } })
    : url.includes('user/read.php') ? json({
      id: 1, username: 'atleta_con_un_nome_molto_lungo', email: 'atleta.con.un.indirizzo.lungo@example.com',
      created_at: '2025-03-01T10:00:00+01:00', is_admin, weekly_goal_default: 3,
      email_verified: true, email_verification: null, pending_email: null,
      tier: 'free', tier_until: null, tier_last_day: null, signup_code: null,
    })
      : json({ success: true, consents: [], id: 1, weekly_goal_default: 3 }),
)));

beforeEach(() => {
  localStorage.setItem('themeMode', 'light');
  stubFetch();
});
afterEach(() => {
  vi.unstubAllGlobals();
  localStorage.clear();
});

const mount = async () => {
  render(<MemoryRouter><ThemeModeProvider><Account isEmbedded /></ThemeModeProvider></MemoryRouter>);
  await screen.findByText('atleta_con_un_nome_molto_lungo');
  await screen.findByText('Palestra Rossi');
};
const button = (name) => screen.getByRole('button', { name });

describe('obiettivo settimanale', () => {
  it('i pulsanti sono in Lexend 500, come i chip che si premono', async () => {
    render(<MemoryRouter><ThemeModeProvider><Account /></ThemeModeProvider></MemoryRouter>);
    const group = await screen.findByLabelText('Obiettivo settimanale');
    for (const button of group.querySelectorAll('button')) {
      const { fontFamily, fontWeight } = getComputedStyle(button);
      expect({ label: button.textContent, fontFamily, fontWeight })
        .toEqual({ label: button.textContent, fontFamily: '"Lexend", sans-serif', fontWeight: '500' });
    }
  });
});

describe('bottoni', () => {
  it.each(['Modifica', 'Cambia password', 'Esporta', 'Esci'])('«%s» è outlined neutro: testo in inchiostro e bordo grigio visibile', async (name) => {
    await mount();
    const style = getComputedStyle(screen.getAllByRole('button', { name }).find((b) => b.classList.contains('MuiButton-outlined')));
    expect(style.color).toBe(INK);
    expect(style.borderColor).toBe(GREY);
  });

  it('«Apri» di Amministrazione è outlined neutro', async () => {
    stubFetch({ is_admin: true });
    await mount();
    const style = getComputedStyle(button('Apri'));
    expect(style.color).toBe(INK);
    expect(style.borderColor).toBe(GREY);
  });

  it('«Gestisci» e «Esci» dei gruppi sono in inchiostro, non rosso del marchio né errore', async () => {
    await mount();
    const card = screen.getByText('Gruppi e visibilità', { selector: 'p' }).closest('.MuiCard-root');
    expect(getComputedStyle(within(card).getByRole('link', { name: 'Gestisci' })).color).toBe(INK);
    expect(getComputedStyle(within(card).getByRole('button', { name: 'Esci' })).color).toBe(INK);
  });
});

describe('intestazione', () => {
  it('«Modifica» non sta sulla riga di nome ed email, che non vengono troncati', async () => {
    await mount();
    const name = screen.getByText('atleta_con_un_nome_molto_lungo');
    const email = screen.getByText('atleta.con.un.indirizzo.lungo@example.com');
    for (const el of [name, email]) {
      expect(getComputedStyle(el).textOverflow).not.toBe('ellipsis');
      expect(getComputedStyle(el).whiteSpace).not.toBe('nowrap');
    }
    const identity = name.parentElement.parentElement;
    expect(identity.contains(button('Modifica'))).toBe(false);
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
});

describe('informativa e termini in inglese', () => {
  it('i due link portano alle pagine inglesi', async () => {
    await i18n.changeLanguage('en');
    await mount();
    expect(screen.getByRole('link', { name: 'Privacy notice' }).getAttribute('href')).toBe('/en/privacy.html');
    expect(screen.getByRole('link', { name: 'Terms of use' }).getAttribute('href')).toBe('/en/terms.html');
  });
});

describe('zona pericolosa', () => {
  const card = () => screen.getByText('Zona pericolosa', { selector: 'p' }).closest('.MuiCard-root');

  it('la card è rosata: sfondo e bordo rosa, titolo in rosso scuro', async () => {
    await mount();
    const style = getComputedStyle(card());
    expect(style.backgroundColor).toBe(DANGER_PINK);
    expect(style.borderColor).toBe(DANGER_BORDER);
    expect(getComputedStyle(screen.getByText('Zona pericolosa', { selector: 'p' })).color).toBe(DANGER_TITLE);
  });

  it('«Elimina account» è pieno rosso con testo bianco', async () => {
    await mount();
    const del = within(card()).getByRole('button', { name: 'Elimina account' });
    expect(del.classList.contains('MuiButton-containedError')).toBe(true);
    expect(getComputedStyle(del).backgroundColor).toBe(RED);
    expect(getComputedStyle(del).color).toBe(WHITE);
  });

  it('in scuro: fondo e bordo sono un rosso trasparente sulla card, titolo rosa chiaro, bottone rosso del marchio con testo bianco', async () => {
    localStorage.setItem('themeMode', 'dark');
    await mount();
    const style = getComputedStyle(card());
    expect(style.backgroundColor).toBe(DANGER_PINK_DARK);
    expect(style.borderColor).toBe(DANGER_BORDER_DARK);
    expect(getComputedStyle(screen.getByText('Zona pericolosa', { selector: 'p' })).color).toBe(DANGER_TITLE_DARK);
    const del = getComputedStyle(within(card()).getByRole('button', { name: 'Elimina account' }));
    expect(del.backgroundColor).toBe(RED);
    expect(del.color).toBe(WHITE);
  });

  it('i testi della card restano leggibili sul rosa (grigio del tema)', async () => {
    await mount();
    expect(getComputedStyle(screen.getByText(/Elimina definitivamente/)).color).toBe(GREY);
  });

  it('il dialogo di conferma resta rosso: titolo e bottone di eliminazione', async () => {
    await mount();
    fireEvent.click(within(card()).getByRole('button', { name: 'Elimina account' }));
    await screen.findByText(/consapevole/);
    const dialog = document.querySelector('.MuiDialog-root');
    expect(getComputedStyle(dialog.querySelector('.MuiDialogTitle-root')).color).toBe(RED);
    fireEvent.click(dialog.querySelector('input[type=checkbox]'));
    const confirm = dialog.querySelector('.MuiDialogActions-root .MuiButton-containedError');
    expect(getComputedStyle(confirm).backgroundColor).toBe(RED);
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
    fireEvent.click(button('Modifica'));
    expect(screen.getByRole('checkbox', { name: 'Timer di recupero' })).toBeTruthy();
  });
});

describe('password e dati personali', () => {
  const apriCambioPassword = async () => {
    await mount();
    fireEvent.click(button('Cambia password'));
    return screen.findByRole('dialog');
  };

  it('i campi del cambio password dichiarano a cosa servono (autocomplete)', async () => {
    const dialog = await apriCambioPassword();
    expect(within(dialog).getByLabelText(/^Password attuale/).getAttribute('autocomplete')).toBe('current-password');
    expect(within(dialog).getByLabelText(/^Nuova password/).getAttribute('autocomplete')).toBe('new-password');
    expect(within(dialog).getByLabelText(/^Conferma nuova password/).getAttribute('autocomplete')).toBe('new-password');
  });

  it('i tre occhi hanno un nome in italiano che distingue i campi', async () => {
    const dialog = await apriCambioPassword();
    expect(within(dialog).getByRole('button', { name: 'Mostra o nascondi la password attuale' })).toBeTruthy();
    expect(within(dialog).getByRole('button', { name: 'Mostra o nascondi la nuova password' })).toBeTruthy();
    expect(within(dialog).getByRole('button', { name: 'Mostra o nascondi la conferma della password' })).toBeTruthy();
  });

  describe('conferma della nuova password: riga riservata', () => {
    const NEW = 'Nuova!Pass2026';
    const confirmField = (dialog) => within(dialog).getByLabelText(/^Conferma nuova password/);
    const fill = (dialog, { current = 'Vecchia!Pass1', next = NEW, confirm } = {}) => {
      fireEvent.change(within(dialog).getByLabelText(/^Password attuale/), { target: { value: current } });
      fireEvent.change(within(dialog).getByLabelText(/^Nuova password/), { target: { value: next } });
      if (confirm !== undefined) fireEvent.change(confirmField(dialog), { target: { value: confirm } });
    };
    const save = (dialog) => fireEvent.click(within(dialog).getByRole('button', { name: 'Salva' }));

    it('a campo vuoto suggerimento grigio; uguali spunta e annuncio; diverse e uscita: rosso e annuncio', async () => {
      const dialog = await apriCambioPassword();
      fill(dialog);
      expect(describedBy(confirmField(dialog))).toBe('Riscrivi la stessa password');
      expect(within(dialog).getByRole('status').textContent).toBe('');
      fireEvent.change(confirmField(dialog), { target: { value: NEW } });
      expect(describedBy(confirmField(dialog))).toBe('Le password coincidono');
      expect(within(dialog).getByRole('status').textContent).toBe('Le password coincidono');
      fireEvent.change(confirmField(dialog), { target: { value: 'Nuova!Pass' } });
      expect(describedBy(confirmField(dialog))).toBe('Riscrivi la stessa password');
      expect(confirmField(dialog).getAttribute('aria-invalid')).toBe('false');
      fireEvent.blur(confirmField(dialog));
      expect(describedBy(confirmField(dialog))).toBe('Le password non coincidono');
      expect(confirmField(dialog).getAttribute('aria-invalid')).toBe('true');
      expect(within(dialog).getByRole('status').textContent).toBe('Le password non coincidono');
    });

    it('l\'occhio della conferma non è un\'uscita dal campo', async () => {
      const dialog = await apriCambioPassword();
      fill(dialog, { confirm: 'Nuova!Pass' });
      const eye = within(dialog).getByRole('button', { name: 'Mostra o nascondi la conferma della password' });
      fireEvent.blur(confirmField(dialog), { relatedTarget: eye });
      expect(describedBy(confirmField(dialog))).toBe('Riscrivi la stessa password');
      expect(fireEvent.mouseDown(eye)).toBe(false);
    });

    it('«Salva» con conferma diversa: riga rossa, focus sul campo, niente avviso in alto, nessuna chiamata', async () => {
      const dialog = await apriCambioPassword();
      fill(dialog, { confirm: 'Nuova!Pass' });
      const calls = fetch.mock.calls.length;
      save(dialog);
      expect(describedBy(confirmField(dialog))).toBe('Le password non coincidono');
      expect(confirmField(dialog).getAttribute('aria-invalid')).toBe('true');
      expect(document.activeElement).toBe(confirmField(dialog));
      expect(within(dialog).queryByRole('alert')).toBeNull();
      expect(fetch.mock.calls.length).toBe(calls);
    });

    it('«Salva» con la conferma vuota: «Tutti i campi sono obbligatori» in alto, la riga resta il suggerimento', async () => {
      const dialog = await apriCambioPassword();
      fill(dialog);
      save(dialog);
      expect(within(dialog).getByRole('alert').textContent).toBe('Tutti i campi sono obbligatori');
      expect(describedBy(confirmField(dialog))).toBe('Riscrivi la stessa password');
      expect(confirmField(dialog).getAttribute('aria-invalid')).toBe('false');
    });

    it('un avviso in alto di un invio precedente sparisce quando poi la conferma è diversa', async () => {
      const dialog = await apriCambioPassword();
      fill(dialog);
      save(dialog);
      expect(within(dialog).getByRole('alert')).toBeTruthy();
      fireEvent.change(confirmField(dialog), { target: { value: 'Nuova!Pass' } });
      save(dialog);
      expect(within(dialog).queryByRole('alert')).toBeNull();
      expect(describedBy(confirmField(dialog))).toBe('Le password non coincidono');
    });

    it('le altre regole restano nell\'avviso in alto: password fuori regola, uguale all\'attuale', async () => {
      const dialog = await apriCambioPassword();
      fill(dialog, { next: 'corta', confirm: 'corta' });
      save(dialog);
      expect(within(dialog).getByRole('alert').textContent).toBe('La password deve contenere almeno 8 caratteri');
      fill(dialog, { current: NEW, next: NEW, confirm: NEW });
      save(dialog);
      expect(within(dialog).getByRole('alert').textContent).toBe('La nuova password deve essere diversa da quella attuale');
    });

    it('uscire da «Nuova password» con la conferma scritta e diversa mostra il rosso', async () => {
      const dialog = await apriCambioPassword();
      fill(dialog, { confirm: 'Nuova!Pass' });
      expect(confirmField(dialog).getAttribute('aria-invalid')).toBe('false');
      fireEvent.blur(within(dialog).getByLabelText(/^Nuova password/));
      expect(confirmField(dialog).getAttribute('aria-invalid')).toBe('true');
      expect(describedBy(confirmField(dialog))).toBe('Le password non coincidono');
    });

    it('uscire da «Password attuale» non mostra il rosso: non fa parte della coppia', async () => {
      const dialog = await apriCambioPassword();
      fill(dialog, { confirm: 'Nuova!Pass' });
      fireEvent.blur(within(dialog).getByLabelText(/^Password attuale/));
      expect(confirmField(dialog).getAttribute('aria-invalid')).toBe('false');
      expect(describedBy(confirmField(dialog))).toBe('Riscrivi la stessa password');
    });

    it('dopo il rosso, modificare «Nuova password» (restando diversa) riporta il suggerimento', async () => {
      const dialog = await apriCambioPassword();
      fill(dialog, { confirm: 'Nuova!Pass' });
      fireEvent.blur(confirmField(dialog));
      expect(confirmField(dialog).getAttribute('aria-invalid')).toBe('true');
      fireEvent.change(within(dialog).getByLabelText(/^Nuova password/), { target: { value: 'Nuova!Pass2027' } });
      expect(confirmField(dialog).getAttribute('aria-invalid')).toBe('false');
      expect(describedBy(confirmField(dialog))).toBe('Riscrivi la stessa password');
    });

    it('il clic sull\'occhio di «Nuova password» non toglie il focus al campo', async () => {
      const dialog = await apriCambioPassword();
      const eye = within(dialog).getByRole('button', { name: 'Mostra o nascondi la nuova password' });
      expect(fireEvent.mouseDown(eye)).toBe(false);
    });

    it('alla riapertura niente rosso rimasto dalla volta prima', async () => {
      const dialog = await apriCambioPassword();
      fill(dialog, { confirm: 'Nuova!Pass' });
      save(dialog);
      expect(confirmField(dialog).getAttribute('aria-invalid')).toBe('true');
      fireEvent.click(within(dialog).getByRole('button', { name: 'Annulla' }));
      await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
      fireEvent.click(button('Cambia password'));
      const again = await screen.findByRole('dialog');
      fill(again, { confirm: 'Nuova!Pass' });
      expect(confirmField(again).getAttribute('aria-invalid')).toBe('false');
      expect(describedBy(confirmField(again))).toBe('Riscrivi la stessa password');
    });
  });

  it.each([
    ['password attuale', /^Password attuale/, 'Mostra o nascondi la password attuale'],
    ['nuova password', /^Nuova password/, 'Mostra o nascondi la nuova password'],
    ['conferma', /^Conferma nuova password/, 'Mostra o nascondi la conferma della password'],
  ])('occhio di «%s»: il mouseDown è annullato e il clic alterna password e testo', async (_n, label, name) => {
    const dialog = await apriCambioPassword();
    const eye = within(dialog).getByRole('button', { name });
    expect(fireEvent.mouseDown(eye)).toBe(false);
    expect(within(dialog).getByLabelText(label).getAttribute('type')).toBe('password');
    fireEvent.click(eye);
    expect(within(dialog).getByLabelText(label).getAttribute('type')).toBe('text');
    fireEvent.click(eye);
    expect(within(dialog).getByLabelText(label).getAttribute('type')).toBe('password');
  });

  it('occhio di «elimina account»: il mouseDown è annullato e il clic alterna password e testo', async () => {
    await mount();
    fireEvent.click(within(screen.getByText('Zona pericolosa', { selector: 'p' }).closest('.MuiCard-root')).getByRole('button', { name: 'Elimina account' }));
    const dialog = await screen.findByRole('dialog');
    const eye = within(dialog).getByRole('button', { name: 'Mostra o nascondi la password' });
    expect(fireEvent.mouseDown(eye)).toBe(false);
    expect(within(dialog).getByLabelText(/^Password/).getAttribute('type')).toBe('password');
    fireEvent.click(eye);
    expect(within(dialog).getByLabelText(/^Password/).getAttribute('type')).toBe('text');
  });

  it('l\'eliminazione dell\'account chiede la password attuale, con un occhio nominato', async () => {
    await mount();
    fireEvent.click(within(screen.getByText('Zona pericolosa', { selector: 'p' }).closest('.MuiCard-root')).getByRole('button', { name: 'Elimina account' }));
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByLabelText(/^Password/).getAttribute('autocomplete')).toBe('current-password');
    expect(within(dialog).getByRole('button', { name: 'Mostra o nascondi la password' })).toBeTruthy();
  });
});

describe('testi', () => {
  it('nessun testo della pagina è sotto i 16px (escluse le etichette dei campi, che MUI rimpicciolisce)', async () => {
    await mount();
    expect(textBelow(document.body, 16, '.MuiChip-root, .MuiFormLabel-root, .MuiFormHelperText-root, legend')).toEqual([]);
  });
});

// 2.5.3: su telefono i campi data aprono un dialogo; il nome accessibile contiene l'etichetta visibile
describe('campi data su telefono', () => {
  it('data di nascita e mese di inizio allenamento hanno un nome che contiene l\'etichetta', async () => {
    await mount();
    fireEvent.click(screen.getAllByRole('button', { name: /^Modifica/ })[0]);
    expect(screen.getByRole('textbox', { name: /^Data di nascita/ })).toBeTruthy();
    expect(screen.getByRole('textbox', { name: /^Mese inizio allenamento/ })).toBeTruthy();
  });
});

describe('data di nascita', () => {
  // Con il puntatore preciso il campo si scrive da tastiera; su telefono è di sola lettura
  const apriModifica = async () => {
    mockPointer(true);
    await mount();
    fireEvent.click(screen.getAllByRole('button', { name: /^Modifica/ })[0]);
    return screen.getByRole('textbox', { name: /^Data di nascita/ });
  };

  it('dichiara a cosa serve (autocomplete bday), il mese di inizio allenamento no', async () => {
    const birth = await apriModifica();
    expect(birth.getAttribute('autocomplete')).toBe('bday');
    expect(screen.getByRole('textbox', { name: /^Mese inizio allenamento/ }).getAttribute('autocomplete')).not.toBe('bday');
  });

  it('oltre i 100 anni: errore sul campo, focus, nessuna richiesta di salvataggio', async () => {
    const birth = await apriModifica();
    fireEvent.change(birth, { target: { value: '21/07/0085' } });
    fetch.mockClear();
    fireEvent.click(button('Salva profilo'));
    await waitFor(() => expect(birth.getAttribute('aria-invalid')).toBe('true'));
    expect(describedBy(birth)).toBe('Inserisci una data di nascita valida');
    expect(document.activeElement).toBe(birth);
    expect(fetch).not.toHaveBeenCalled();
  });

  it('cambiando la data l\'errore sparisce', async () => {
    const birth = await apriModifica();
    fireEvent.change(birth, { target: { value: '21/07/0085' } });
    fireEvent.click(button('Salva profilo'));
    await waitFor(() => expect(birth.getAttribute('aria-invalid')).toBe('true'));
    fireEvent.change(birth, { target: { value: '' } });
    expect(birth.getAttribute('aria-invalid')).not.toBe('true');
  });

  it('una data fuori dai limiti (meno di 14 anni) è già rossa prima di salvare, come il resto dei campi data', async () => {
    const birth = await apriModifica();
    fireEvent.change(birth, { target: { value: format(startOfToday(), 'dd/MM/yyyy') } });
    expect(birth.getAttribute('aria-invalid')).toBe('true');
  });

  it('un Invalid Date (campo scritto a metà) è una data non valida: errore sul campo, fuoco, nessuna richiesta', async () => {
    const birth = await apriModifica();
    act(() => birthFieldChange.current(new Date(NaN)));
    fetch.mockClear();
    fireEvent.click(button('Salva profilo'));
    await waitFor(() => expect(describedBy(birth)).toBe('Inserisci una data di nascita valida'));
    expect(birth.getAttribute('aria-invalid')).toBe('true');
    expect(document.activeElement).toBe(birth);
    expect(fetch).not.toHaveBeenCalled();
    expect(screen.queryByText('Errore nel salvataggio del profilo')).toBeNull();
  });

  // Il server accetta esattamente 100 anni (rifiuta birth < oggi - 100 anni): oggi di 100 anni fa passa, il giorno prima no
  describe.each(['UTC', 'Europe/Rome', 'America/Los_Angeles', 'Asia/Tokyo'])('confine dei 100 anni (%s)', (zone) => {
    // Fuso e orologio a mezzogiorno di quel fuso (una corsa a cavallo della mezzanotte non cambia «oggi»)
    beforeEach(() => pinLocalClock(zone, 2026, 10, 15, 12, 0));
    afterEach(() => vi.useRealTimers());

    // La data si calcola dopo il fuso: «oggi» dipende da lì
    const saveWith = async (dateFor) => {
      const birth = await apriModifica();
      fireEvent.change(birth, { target: { value: format(dateFor(), 'dd/MM/yyyy') } });
      fetch.mockClear();
      fireEvent.click(button('Salva profilo'));
      return birth;
    };

    it('esattamente 100 anni fa oggi: il salvataggio parte', async () => {
      await saveWith(() => subYears(startOfToday(), 100));
      await waitFor(() => expect(fetch.mock.calls.some(([url, init]) => url.includes('update_settings.php') && JSON.parse(init.body).birth_date === format(subYears(startOfToday(), 100), 'yyyy-MM-dd'))).toBe(true));
    });

    it('un giorno prima: errore sul campo, nessuna richiesta', async () => {
      const birth = await saveWith(() => subDays(subYears(startOfToday(), 100), 1));
      await waitFor(() => expect(birth.getAttribute('aria-invalid')).toBe('true'));
      expect(describedBy(birth)).toBe('Inserisci una data di nascita valida');
      expect(fetch).not.toHaveBeenCalled();
    });
  });

  it('una data valida si salva', async () => {
    const birth = await apriModifica();
    fireEvent.change(birth, { target: { value: '21/07/1985' } });
    fireEvent.click(button('Salva profilo'));
    await waitFor(() => expect(fetch.mock.calls.some(([url, init]) => url.includes('update_settings.php') && JSON.parse(init.body).birth_date === '1985-07-21')).toBe(true));
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
