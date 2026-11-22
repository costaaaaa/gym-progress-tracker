// Card «Moduli» dell'Account: una riga per modulo con interruttore, salvataggio subito, errore con ritorno indietro,
// avviso non bloccante dei Gruppi. La fetch è il confine; lo stato dell'account è quello vero del contesto (qui un finto
// con uno stato, perché la card legge i moduli da lì).
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, within, fireEvent, waitFor } from '@testing-library/react';
import { useState } from 'react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import ModulesCard from './ModulesCard';
import { ThemeModeProvider } from '../../context/ThemeModeContext';
import { json } from '../../test/dom';

const auth = vi.hoisted(() => ({ value: null }));
vi.mock('../../context/AuthContext', () => ({ useAuth: () => auth.value }));

const ALL = { body: true, recovery: true, levels: true, groups: true, ai: true };
const updateUser = vi.fn();
const notify = vi.fn();

let groups;
let settings;
const stubFetch = () => vi.stubGlobal('fetch', vi.fn((url, init) => Promise.resolve(
  url.includes('update_settings.php') ? settings(JSON.parse(init.body))
    : url.includes('groups/list.php') ? json({ success: true, groups })
      : json({ success: false }, 404),
)));
const okSettings = (modules) => (body) => json({ success: true, modules: { ...modules, ...body.modules } });
const savedBodies = () => fetch.mock.calls.filter(([url]) => url.includes('update_settings.php')).map(([, init]) => JSON.parse(init.body));

// L'indirizzo a cui si è arrivati: i collegamenti dell'avviso dei Gruppi portano a un'altra pagina
const Where = () => {
  const { pathname, hash } = useLocation();
  return <p data-testid="where">{`${pathname}${hash}`}</p>;
};

const Harness = ({ initial }) => {
  const [user, setUser] = useState(initial);
  auth.value = { user, updateUser: (patch) => { updateUser(patch); setUser((u) => ({ ...u, ...patch })); } };
  return <MemoryRouter><ThemeModeProvider><ModulesCard notify={notify} /><Where /></ThemeModeProvider></MemoryRouter>;
};
const mount = (modules = ALL, user = { id: 1, modules }) => {
  settings = okSettings(modules);
  render(<Harness initial={user} />);
};
const sw = (name) => screen.getByRole('switch', { name });

beforeEach(() => {
  updateUser.mockClear();
  notify.mockClear();
  localStorage.setItem('themeMode', 'light');
  groups = [];
  stubFetch();
});
afterEach(() => vi.unstubAllGlobals());

describe('righe', () => {
  it('quattro righe nell\'ordine Misure · Recupero e serie per muscolo · Livelli e traguardi · Gruppi, senza il modulo AI', () => {
    mount();
    expect(screen.getByRole('heading', { name: 'Moduli' })).toBeTruthy();
    expect(screen.getAllByRole('switch').map((s) => s.getAttribute('aria-label')))
      .toEqual(['Misure', 'Recupero e serie per muscolo', 'Livelli e traguardi', 'Gruppi']);
    expect(screen.queryByText(/assistent/i)).toBeNull();
  });

  it('ogni riga ha una descrizione e lo stato in parole: attivo / non attivo', () => {
    mount({ ...ALL, levels: false });
    const rows = screen.getAllByRole('listitem');
    expect(rows).toHaveLength(4);
    expect(within(rows[0]).getByText('attivo')).toBeTruthy();
    expect(within(rows[2]).getByText('non attivo')).toBeTruthy();
    rows.forEach((row) => expect(row.textContent.length).toBeGreaterThan(30));
  });

  it('l\'interruttore riflette il modulo e il suo nome accessibile è il nome del modulo', () => {
    mount({ ...ALL, groups: false });
    expect(sw('Misure').checked).toBe(true);
    expect(sw('Gruppi').checked).toBe(false);
    expect(sw('Gruppi').getAttribute('role')).toBe('switch');
  });

  it('un account senza moduli li ha tutti attivi', () => {
    mount(undefined, { id: 1 });
    screen.getAllByRole('switch').forEach((s) => expect(s.checked).toBe(true));
  });

  it('il bersaglio dell\'interruttore è di almeno 44 px', () => {
    mount();
    const target = sw('Misure').closest('label');
    expect(parseInt(getComputedStyle(target).minHeight, 10)).toBeGreaterThanOrEqual(44);
    expect(parseInt(getComputedStyle(target).minWidth, 10)).toBeGreaterThanOrEqual(44);
  });

  it('«Apri» c\'è solo a modulo attivo e porta alla pagina di oggi del modulo', () => {
    mount({ ...ALL, recovery: false });
    const link = (row) => within(screen.getAllByRole('listitem')[row]).queryByRole('link', { name: /^Apri/ });
    expect(link(0).getAttribute('href')).toBe('/progressi?tab=body');
    expect(link(1)).toBeNull();
    expect(link(2).getAttribute('href')).toBe('/livelli');
    expect(link(3).getAttribute('href')).toBe('/gruppi');
    expect(link(0).getAttribute('aria-label')).toBe('Apri Misure');
  });
});

it('«Apri» di Recupero porta alla tab Volume dei Progressi', () => {
  mount();
  expect(within(screen.getAllByRole('listitem')[1]).getByRole('link', { name: /^Apri/ }).getAttribute('href')).toBe('/progressi?tab=volume');
});

describe('salvataggio', () => {
  it('spegnere un modulo salva subito solo quella chiave, aggiorna il contesto e lo annuncia', async () => {
    mount();
    fireEvent.click(sw('Misure'));
    await waitFor(() => expect(updateUser).toHaveBeenCalledWith({ modules: { ...ALL, body: false } }));
    expect(savedBodies()).toEqual([{ modules: { body: false } }]);
    expect(sw('Misure').checked).toBe(false);
    expect(within(screen.getAllByRole('listitem')[0]).getByText('non attivo')).toBeTruthy();
    expect(notify).toHaveBeenCalledWith('Misure: non attivo', 'success');
    // A modulo non attivo «Apri» non c'è più
    expect(within(screen.getAllByRole('listitem')[0]).queryByRole('link')).toBeNull();
  });

  it('riattivarlo salva true e lo annuncia come attivo', async () => {
    mount({ ...ALL, levels: false });
    fireEvent.click(sw('Livelli e traguardi'));
    await waitFor(() => expect(notify).toHaveBeenCalledWith('Livelli e traguardi: attivo', 'success'));
    expect(savedBodies()).toEqual([{ modules: { levels: true } }]);
    expect(sw('Livelli e traguardi').checked).toBe(true);
  });

  it('l\'interruttore mostra subito il nuovo stato; durante il salvataggio non è disattivato, tiene il fuoco e un altro clic è ignorato', async () => {
    let finish;
    settings = () => new Promise((resolve) => { finish = () => resolve(json({ success: true, modules: { ...ALL, body: false } })); });
    render(<Harness initial={{ id: 1, modules: ALL }} />);
    sw('Misure').focus();
    fireEvent.click(sw('Misure'));
    expect(sw('Misure').checked).toBe(false);
    expect(sw('Misure').disabled).toBe(false);
    expect(sw('Misure').getAttribute('aria-busy')).toBe('true');
    expect(document.activeElement).toBe(sw('Misure'));
    fireEvent.click(sw('Misure'));
    expect(fetch.mock.calls.filter(([url]) => url.includes('update_settings.php'))).toHaveLength(1);
    finish();
    await waitFor(() => expect(sw('Misure').getAttribute('aria-busy')).not.toBe('true'));
    expect(sw('Misure').checked).toBe(false);
    expect(document.activeElement).toBe(sw('Misure'));
  });

  it('due interruttori cambiati di seguito con le risposte in ordine inverso: ogni risposta aggiorna solo la sua chiave', async () => {
    const finish = [];
    settings = () => new Promise((resolve) => { finish.push(resolve); });
    render(<Harness initial={{ id: 1, modules: ALL }} />);
    fireEvent.click(sw('Misure'));
    fireEvent.click(sw('Recupero e serie per muscolo'));
    // Il server li ha applicati in ordine: la seconda risposta li ha entrambi, la prima solo il primo, ma arriva dopo
    finish[1](json({ success: true, modules: { ...ALL, body: false, recovery: false } }));
    await waitFor(() => expect(notify).toHaveBeenCalledTimes(1));
    finish[0](json({ success: true, modules: { ...ALL, body: false } }));
    await waitFor(() => expect(notify).toHaveBeenCalledTimes(2));
    expect(sw('Misure').checked).toBe(false);
    expect(sw('Recupero e serie per muscolo').checked).toBe(false);
    expect(updateUser).toHaveBeenLastCalledWith({ modules: { ...ALL, body: false, recovery: false } });
  });

  it('un account senza elenco dei moduli (subito dopo il login) riceve l\'elenco intero restituito dal server', async () => {
    const full = { body: false, recovery: true, levels: true, groups: false, ai: true };
    settings = () => json({ success: true, modules: full });
    render(<Harness initial={{ id: 1 }} />);
    fireEvent.click(sw('Misure'));
    await waitFor(() => expect(updateUser).toHaveBeenCalledWith({ modules: full }));
    expect(sw('Gruppi').checked).toBe(false);
  });

  it('se il salvataggio fallisce l\'interruttore torna indietro e l\'errore si vede', async () => {
    mount();
    settings = () => json({ success: false, message: 'Errore interno del server.' }, 500);
    fireEvent.click(sw('Misure'));
    await waitFor(() => expect(notify).toHaveBeenCalledWith('Errore nel salvataggio dei moduli', 'error'));
    expect(sw('Misure').checked).toBe(true);
    expect(updateUser).not.toHaveBeenCalled();
  });

  it('se la rete cade l\'interruttore torna indietro e l\'errore si vede', async () => {
    mount();
    settings = () => Promise.reject(new TypeError('rete'));
    fireEvent.click(sw('Gruppi'));
    await waitFor(() => expect(notify).toHaveBeenCalledWith('Errore nel salvataggio dei moduli', 'error'));
    expect(sw('Gruppi').checked).toBe(true);
  });
});

describe('avviso dei Gruppi', () => {
  const warning = (text) => screen.queryByText(text);

  it('spegnendo Gruppi stando in 2 gruppi: «Resti nei tuoi 2 gruppi…», con i collegamenti «Cosa mostro» ed «Esci dai gruppi»', async () => {
    groups = [{ id: 1 }, { id: 2 }];
    mount();
    fireEvent.click(sw('Gruppi'));
    expect(await screen.findByText('Resti nei tuoi 2 gruppi e gli altri membri continuano a vedere ciò che hai scelto di mostrare.')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Cosa mostro' })).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Esci dai gruppi' })).toBeTruthy();
    expect(screen.queryByRole('link', { name: 'Gestisci i gruppi' })).toBeNull();
    // Non blocca: il modulo è non attivo
    expect(sw('Gruppi').checked).toBe(false);
    expect(savedBodies()).toEqual([{ modules: { groups: false } }]);
  });

  it('l\'avviso sta in una regione annunciata, presente nel DOM anche prima che compaia', async () => {
    groups = [{ id: 1 }];
    mount();
    const region = within(screen.getAllByRole('listitem')[3]).getByRole('status');
    expect(region.textContent).toBe('');
    fireEvent.click(sw('Gruppi'));
    await waitFor(() => expect(region.textContent).toMatch(/Resti nel tuo gruppo/));
    expect(within(screen.getAllByRole('listitem')[3]).getByRole('status')).toBe(region);
  });

  it('con un gruppo solo il testo è al singolare', async () => {
    groups = [{ id: 1 }];
    mount();
    fireEvent.click(sw('Gruppi'));
    expect(await screen.findByText('Resti nel tuo gruppo e gli altri membri continuano a vedere ciò che hai scelto di mostrare.')).toBeTruthy();
  });

  it('senza gruppi non c\'è nessun avviso', async () => {
    mount();
    fireEvent.click(sw('Gruppi'));
    await waitFor(() => expect(sw('Gruppi').checked).toBe(false));
    expect(warning(/Resti nel/)).toBeNull();
  });

  it('spegnendo un altro modulo l\'avviso non compare', async () => {
    groups = [{ id: 1 }];
    mount();
    fireEvent.click(sw('Misure'));
    await waitFor(() => expect(sw('Misure').checked).toBe(false));
    expect(warning(/Resti nel/)).toBeNull();
  });

  it('con Gruppi già non attivo e un gruppo, l\'avviso c\'è anche alla riapertura della pagina', async () => {
    groups = [{ id: 1 }, { id: 2 }, { id: 3 }];
    mount({ ...ALL, groups: false });
    expect(await screen.findByText('Resti nei tuoi 3 gruppi e gli altri membri continuano a vedere ciò che hai scelto di mostrare.')).toBeTruthy();
  });

  it('riattivando Gruppi l\'avviso sparisce', async () => {
    groups = [{ id: 1 }];
    mount({ ...ALL, groups: false });
    await screen.findByText(/Resti nel tuo gruppo/);
    fireEvent.click(sw('Gruppi'));
    await waitFor(() => expect(warning(/Resti nel/)).toBeNull());
  });

  it.each([['Cosa mostro', 'groups-shown'], ['Esci dai gruppi', 'groups-list']])('«%s» porta a «Dati e privacy», al suo punto della card', async (name, id) => {
    groups = [{ id: 1 }];
    mount({ ...ALL, groups: false });
    const link = await screen.findByRole('link', { name });
    expect(link.getAttribute('href')).toBe(`/account/dati#${id}`);
    fireEvent.click(link);
    expect(screen.getByTestId('where').textContent).toBe(`/account/dati#${id}`);
  });

  it('i due collegamenti hanno un bersaglio di almeno 44 px', async () => {
    groups = [{ id: 1 }];
    mount({ ...ALL, groups: false });
    for (const name of ['Cosa mostro', 'Esci dai gruppi']) {
      expect(parseInt(getComputedStyle(await screen.findByRole('link', { name })).minHeight, 10)).toBeGreaterThanOrEqual(44);
    }
  });
});
