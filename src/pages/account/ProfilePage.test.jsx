// Pagina «Profilo e preferenze» (/account/profilo), la parte alta: nome utente ed email (la loro prova sta in
// ProfilePage.email.test.jsx) e profilo fisico (data di nascita, sesso, inizio allenamento). I gruppi «Allenamento» e
// «App» (obiettivo, unità di misura, strumenti, lingua) sono in ProfilePage.settings.test.jsx. Colori scritti a mano:
// text.primary #1a1816, text.secondary #6b6663. La fetch è il confine.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { screen, within, fireEvent, waitFor, act } from '@testing-library/react';
import { format, subYears, subDays, startOfToday } from 'date-fns';
import { json } from '../../test/dom';
import { pinLocalClock } from '../../test/timeZone';
import { birthFieldChange } from '../../test/birthFieldSpy';
import { describedBy } from '../../test/accessibleNames';
import { mockPointer } from '../../test/pointer';
import { renderAccount } from '../../test/accountRoutes';

// Il campo data vero, con l'onChange della data di nascita a portata di test (vedi src/test/birthFieldSpy.js)
vi.mock('../../components/LabeledDatePicker', async (importOriginal) => (
  (await import('../../test/birthFieldSpy')).spyOnBirthField(await importOriginal())
));

vi.mock('react-router-dom', async (importOriginal) => ({ ...(await importOriginal()), useNavigate: () => () => {} }));
// Lo stesso oggetto a ogni render: la cornice ricarica i dati quando `user` cambia identità.
const { updateUser } = vi.hoisted(() => ({ updateUser: vi.fn() }));
vi.mock('../../context/AuthContext', () => {
  const auth = {
    user: { id: 1 }, isLoggedIn: true, loading: false, logout: () => {}, updateUser,
    emailState: { verified: true, email: 'atleta.con.un.indirizzo.lungo@example.com', pendingEmail: null, blocked: false, daysLeft: null },
    openEmailDialog: () => {}, refreshEmailState: () => Promise.resolve(),
  };
  return { useAuth: () => auth };
});

const INK = 'rgb(26, 24, 22)';
const GREY = 'rgb(107, 102, 99)';

const stubFetch = () => vi.stubGlobal('fetch', vi.fn((url) => Promise.resolve(
  url.includes('groups/list.php') ? json({ success: true, groups: [] })
    : url.includes('user/read.php') ? json({
      id: 1, username: 'atleta_con_un_nome_molto_lungo', email: 'atleta.con.un.indirizzo.lungo@example.com',
      created_at: '2025-03-01T10:00:00+01:00', is_admin: false, weight_unit: 'kg', weekly_goal_default: 3,
      email_verified: true, email_verification: null, pending_email: null,
      tier: 'free', tier_until: null, tier_last_day: null, signup_code: null,
    })
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
  const view = renderAccount('/account/profilo');
  await screen.findByText('atleta_con_un_nome_molto_lungo');
  return view;
};
const button = (name) => screen.getByRole('button', { name });

describe('Profilo: le card', () => {
  it('nome utente, email col suo stato e «membro da» nella prima card; poi il profilo fisico; poi il gruppo «Allenamento»', async () => {
    await mount();
    const identity = within(screen.getByText('atleta_con_un_nome_molto_lungo').closest('.MuiCard-root'));
    expect(identity.getByText('atleta.con.un.indirizzo.lungo@example.com')).toBeTruthy();
    expect(identity.getByText('Confermata')).toBeTruthy();
    expect(identity.getByText('Membro da marzo 2025')).toBeTruthy();
    const physical = screen.getByText('Profilo fisico').closest('.MuiCard-root');
    const training = screen.getByRole('heading', { level: 2, name: 'Allenamento' }).nextElementSibling;
    expect(new Set([identity.getByText('Confermata').closest('.MuiCard-root'), physical, training]).size).toBe(3);
    expect(screen.getByText('atleta_con_un_nome_molto_lungo').closest('.MuiCard-root').compareDocumentPosition(physical) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(physical.compareDocumentPosition(training) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });
});

describe('bottoni', () => {
  it('«Cambia indirizzo» è outlined neutro: testo in inchiostro e bordo grigio visibile', async () => {
    await mount();
    const style = getComputedStyle(screen.getAllByRole('button', { name: 'Cambia indirizzo' }).find((b) => b.classList.contains('MuiButton-outlined')));
    expect(style.color).toBe(INK);
    expect(style.borderColor).toBe(GREY);
  });
});

describe('intestazione', () => {
  it('nome ed email non vengono troncati', async () => {
    await mount();
    const name = screen.getByText('atleta_con_un_nome_molto_lungo');
    const email = screen.getByText('atleta.con.un.indirizzo.lungo@example.com');
    for (const el of [name, email]) {
      expect(getComputedStyle(el).textOverflow).not.toBe('ellipsis');
      expect(getComputedStyle(el).whiteSpace).not.toBe('nowrap');
    }
  });
});

describe('profilo fisico', () => {
  it('il salvataggio del profilo non rimanda più il timer di recupero', async () => {
    await mount();
    fetch.mockClear();
    fireEvent.click(button('Salva profilo'));
    await waitFor(() => expect(fetch.mock.calls.filter(([url]) => url.includes('update_settings.php'))).toHaveLength(1));
    const body = JSON.parse(fetch.mock.calls.find(([url]) => url.includes('update_settings.php'))[1].body);
    expect(body).not.toHaveProperty('rest_timer_enabled');
  });
});

// 2.5.3: su telefono i campi data aprono un dialogo; il nome accessibile contiene l'etichetta visibile
describe('campi data su telefono', () => {
  it('data di nascita e mese di inizio allenamento hanno un nome che contiene l\'etichetta', async () => {
    await mount();
    expect(screen.getByRole('textbox', { name: /^Data di nascita/ })).toBeTruthy();
    expect(screen.getByRole('textbox', { name: /^Mese inizio allenamento/ })).toBeTruthy();
  });
});

describe('data di nascita', () => {
  // Con il puntatore preciso il campo si scrive da tastiera; su telefono è di sola lettura
  const apri = async () => {
    mockPointer(true);
    await mount();
    return screen.getByRole('textbox', { name: /^Data di nascita/ });
  };

  it('dichiara a cosa serve (autocomplete bday), il mese di inizio allenamento no', async () => {
    const birth = await apri();
    expect(birth.getAttribute('autocomplete')).toBe('bday');
    expect(screen.getByRole('textbox', { name: /^Mese inizio allenamento/ }).getAttribute('autocomplete')).not.toBe('bday');
  });

  it('oltre i 100 anni: errore sul campo, focus, nessuna richiesta di salvataggio', async () => {
    const birth = await apri();
    fireEvent.change(birth, { target: { value: '21/07/0085' } });
    fetch.mockClear();
    fireEvent.click(button('Salva profilo'));
    await waitFor(() => expect(birth.getAttribute('aria-invalid')).toBe('true'));
    expect(describedBy(birth)).toBe('Inserisci una data di nascita valida');
    expect(document.activeElement).toBe(birth);
    expect(fetch).not.toHaveBeenCalled();
  });

  it('cambiando la data l\'errore sparisce', async () => {
    const birth = await apri();
    fireEvent.change(birth, { target: { value: '21/07/0085' } });
    fireEvent.click(button('Salva profilo'));
    await waitFor(() => expect(birth.getAttribute('aria-invalid')).toBe('true'));
    fireEvent.change(birth, { target: { value: '' } });
    expect(birth.getAttribute('aria-invalid')).not.toBe('true');
  });

  it('una data fuori dai limiti (meno di 14 anni) è già rossa prima di salvare, come il resto dei campi data', async () => {
    const birth = await apri();
    fireEvent.change(birth, { target: { value: format(startOfToday(), 'dd/MM/yyyy') } });
    expect(birth.getAttribute('aria-invalid')).toBe('true');
  });

  it('un Invalid Date (campo scritto a metà) è una data non valida: errore sul campo, fuoco, nessuna richiesta', async () => {
    const birth = await apri();
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
      const birth = await apri();
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
    const birth = await apri();
    fireEvent.change(birth, { target: { value: '21/07/1985' } });
    fireEvent.click(button('Salva profilo'));
    await waitFor(() => expect(fetch.mock.calls.some(([url, init]) => url.includes('update_settings.php') && JSON.parse(init.body).birth_date === '1985-07-21')).toBe(true));
  });
});

describe('una rilettura dei dati', () => {
  it('non smonta la pagina: il profilo fisico scritto a metà resta com\'è', async () => {
    mockPointer(true);
    const { rerenderAccount } = await mount();
    const birth = screen.getByRole('textbox', { name: /^Data di nascita/ });
    fireEvent.change(birth, { target: { value: '21/07/1985' } });
    const reads = () => fetch.mock.calls.filter(([url]) => String(url).includes('user/read.php')).length;
    expect(reads()).toBe(1);
    const { useAuth } = await import('../../context/AuthContext');
    useAuth().user = { id: 1 };
    rerenderAccount();
    await waitFor(() => expect(reads()).toBe(2));
    expect(screen.getByRole('textbox', { name: /^Data di nascita/ })).toBe(birth);
    expect(birth.value).toBe('21/07/1985');
  });
});
