// Card «Visibilità nei gruppi» dell'Account: senza gruppi il collegamento a /gruppi c'è solo se il modulo Gruppi è attivo;
// il blocco «Cosa mostro» ha quattro interruttori che salvano subito (la fetch è il confine, lo stato dell'account è un finto).
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { useState } from 'react';
import { MemoryRouter } from 'react-router-dom';
import GroupsVisibilityCard from './GroupsVisibilityCard';
import { ThemeModeProvider } from '../../context/ThemeModeContext';
import { json, expectDestructiveConfirm } from '../../test/dom';

const auth = vi.hoisted(() => ({ value: null }));
vi.mock('../../context/AuthContext', () => ({ useAuth: () => auth.value }));

const ALL = { workouts: true, volume: true, streak: true, level: true };
const notify = vi.fn();
let settings;
let groups;

beforeEach(() => {
  notify.mockClear();
  groups = [];
  settings = (body) => json({ success: true, group_visibility: { ...ALL, ...body.group_visibility } });
  localStorage.setItem('themeMode', 'light');
  vi.stubGlobal('fetch', vi.fn((url, init) => Promise.resolve(
    String(url).includes('update_settings.php') ? settings(JSON.parse(init.body)) : json({ success: true, groups }),
  )));
});
afterEach(() => vi.unstubAllGlobals());

const Harness = ({ initial, route = '/' }) => {
  const [user, setUser] = useState(initial);
  auth.value = { user, updateUser: (patch) => setUser((u) => ({ ...u, ...patch })) };
  return <MemoryRouter initialEntries={[route]}><ThemeModeProvider><GroupsVisibilityCard notify={notify} /></ThemeModeProvider></MemoryRouter>;
};
const mount = (modules, user = { id: 1, modules }, route) => render(<Harness initial={user} route={route} />);
const sw = (name) => screen.getByRole('switch', { name });
const saved = () => fetch.mock.calls.filter(([url]) => String(url).includes('update_settings.php')).map(([, init]) => JSON.parse(init.body));

describe('senza gruppi', () => {
  it('con Gruppi attivo il testo ha il collegamento a /gruppi', async () => {
    mount({ groups: true });
    const link = await screen.findByRole('link');
    expect(link.getAttribute('href')).toBe('/gruppi');
  });

  it('con Gruppi non attivo il testo resta e il collegamento no', async () => {
    mount({ groups: false });
    await screen.findByText(/Non sei in nessun gruppo/);
    expect(screen.queryByRole('link')).toBeNull();
  });
});

describe('fuoco', () => {
  it('il contorno del fuoco non è tolto: nessuna regola outline: none sulla card', async () => {
    mount({ groups: true });
    await screen.findByRole('link');
    const css = [...document.querySelectorAll('style')].map((s) => s.textContent + [...(s.sheet?.cssRules ?? [])].map((r) => r.cssText).join('')).join('');
    expect(css).not.toMatch(/:focus\s*\{[^}]*outline:\s*none/);
    expect(css).toMatch(/:focus-visible\s*\{[^}]*outline/);
  });
});

describe('Cosa mostro', () => {
  it('quattro interruttori col nome dell\'opzione, nello stato dell\'account', async () => {
    mount({ groups: true }, { id: 1, modules: { groups: true }, group_visibility: { ...ALL, streak: false } });
    expect(screen.getAllByRole('switch').map((s) => s.getAttribute('aria-label')))
      .toEqual(['Allenamenti della settimana', 'Volume', 'Streak', 'Livello']);
    expect(sw('Streak').checked).toBe(false);
    expect(sw('Livello').checked).toBe(true);
    expect(screen.getByText('Se non mostri un dato, non vedi quello degli altri membri.')).toBeTruthy();
    expect(parseInt(getComputedStyle(sw('Volume').closest('label')).minHeight, 10)).toBeGreaterThanOrEqual(44);
  });

  it('account senza group_visibility: tutto mostrato', () => {
    mount({ groups: true }, { id: 1 });
    screen.getAllByRole('switch').forEach((s) => expect(s.checked).toBe(true));
  });

  it('c\'è anche senza gruppi e con il modulo Gruppi non attivo', async () => {
    mount({ groups: false });
    await screen.findByText(/Non sei in nessun gruppo/);
    expect(screen.getAllByRole('switch')).toHaveLength(4);
    expect(document.getElementById('groups-shown')).toBeTruthy();
  });

  it('salva subito solo la chiave cambiata e lo annuncia', async () => {
    mount({ groups: true }, { id: 1, modules: { groups: true }, group_visibility: ALL });
    fireEvent.click(sw('Streak'));
    await waitFor(() => expect(notify).toHaveBeenCalledWith('Streak: non mostro', 'success'));
    expect(saved()).toEqual([{ group_visibility: { streak: false } }]);
    expect(sw('Streak').checked).toBe(false);
  });

  it('errore: l\'interruttore torna com\'era e l\'errore è annunciato', async () => {
    settings = () => json({ success: false }, 500);
    mount({ groups: true }, { id: 1, modules: { groups: true }, group_visibility: ALL });
    fireEvent.click(sw('Livello'));
    await waitFor(() => expect(notify).toHaveBeenCalledWith(expect.stringMatching(/Errore/), 'error'));
    expect(sw('Livello').checked).toBe(true);
  });

  it('un secondo tocco durante il salvataggio è ignorato', async () => {
    let finish;
    settings = () => new Promise((resolve) => { finish = () => resolve(json({ success: true, group_visibility: { ...ALL, level: false } })); });
    mount({ groups: true }, { id: 1, modules: { groups: true }, group_visibility: ALL });
    fireEvent.click(sw('Livello'));
    expect(sw('Livello').checked).toBe(false);
    expect(sw('Livello').getAttribute('aria-busy')).toBe('true');
    fireEvent.click(sw('Livello'));
    expect(saved()).toHaveLength(1);
    finish();
    await waitFor(() => expect(sw('Livello').getAttribute('aria-busy')).not.toBe('true'));
    expect(sw('Livello').checked).toBe(false);
  });

  it('due salvataggi con le risposte in ordine inverso: ogni risposta aggiorna solo la sua chiave', async () => {
    const finish = [];
    settings = () => new Promise((resolve) => { finish.push(resolve); });
    mount({ groups: true }, { id: 1, modules: { groups: true }, group_visibility: ALL });
    fireEvent.click(sw('Allenamenti della settimana'));
    fireEvent.click(sw('Streak'));
    finish[1](json({ success: true, group_visibility: { ...ALL, workouts: false, streak: false } }));
    await waitFor(() => expect(sw('Streak').getAttribute('aria-busy')).not.toBe('true'));
    finish[0](json({ success: true, group_visibility: { ...ALL, workouts: false } }));
    await waitFor(() => expect(sw('Allenamenti della settimana').getAttribute('aria-busy')).not.toBe('true'));
    expect(sw('Allenamenti della settimana').checked).toBe(false);
    expect(sw('Streak').checked).toBe(false);
  });
});

describe('dipendenze', () => {
  it('Volume senza allenamenti: non modificabile, in posizione no, col motivo; riattivando gli allenamenti torna il valore salvato', async () => {
    mount({ groups: true }, { id: 1, modules: { groups: true }, group_visibility: ALL });
    fireEvent.click(sw('Allenamenti della settimana'));
    await waitFor(() => expect(sw('Volume').disabled).toBe(true));
    expect(sw('Volume').checked).toBe(false);
    const reason = document.getElementById(sw('Volume').getAttribute('aria-describedby'));
    expect(reason.textContent).toContain('Si mostra solo insieme agli allenamenti della settimana.');
    fireEvent.click(sw('Allenamenti della settimana'));
    await waitFor(() => expect(sw('Volume').disabled).toBe(false));
    expect(sw('Volume').checked).toBe(true);
    expect(saved()).toEqual([{ group_visibility: { workouts: false } }, { group_visibility: { workouts: true } }]);
  });

  it('Streak e Livello con il modulo Livelli non attivo: non modificabili, in posizione no, con il motivo, nessun salvataggio', () => {
    mount({ groups: true, levels: false }, { id: 1, modules: { groups: true, levels: false }, group_visibility: ALL });
    ['Streak', 'Livello'].forEach((name) => {
      expect(sw(name).disabled).toBe(true);
      expect(sw(name).checked).toBe(false);
      expect(document.getElementById(sw(name).getAttribute('aria-describedby')).textContent)
        .toContain('Il modulo Livelli e traguardi non è attivo: streak e livello non si mostrano.');
    });
    expect(screen.getAllByText(/Il modulo Livelli e traguardi non è attivo/)).toHaveLength(1);
    expect(sw('Volume').disabled).toBe(false);
    expect(saved()).toEqual([]);
  });
});

describe('struttura', () => {
  it('il titolo della card è un\'intestazione di livello 2 e «Cosa mostro» di livello 3', () => {
    mount({ groups: true });
    expect(screen.getByRole('heading', { level: 2 }).textContent).toBe('Gruppi e visibilità');
    expect(screen.getByRole('heading', { level: 3 }).textContent).toBe('Cosa mostro');
  });

  it('i punti di arrivo dei collegamenti dell\'avviso dei moduli esistono nella card vera e prendono il fuoco', async () => {
    mount({ groups: true });
    await screen.findByText(/Non sei in nessun gruppo/);
    ['groups-shown', 'groups-list'].forEach((id) => {
      const el = document.getElementById(id);
      expect(el).toBeTruthy();
      expect(el.closest('#groups-visibility')).toBeTruthy();
      el.focus();
      expect(document.activeElement).toBe(el);
    });
  });
});

describe('arrivo da un collegamento', () => {
  it.each([['groups-shown', 'il blocco «Cosa mostro»'], ['groups-list', 'l\'elenco dei gruppi']])('con #%s nell\'indirizzo prende il fuoco %s', async (id) => {
    mount({ groups: true }, undefined, `/account/dati#${id}`);
    await waitFor(() => expect(document.activeElement).toBe(document.getElementById(id)));
  });
});

describe('uscire da un gruppo', () => {
  const leaveCalls = () => fetch.mock.calls.filter(([url]) => String(url).includes('leave.php'));
  const MEMBER_GROUP = { id: 7, name: 'Palestra Rossi', my_role: 'member' };

  it('chiede conferma nella stessa finestra dell\'uscita dal dettaglio del gruppo, non con quella del browser, ed esce solo dopo «Esci»', async () => {
    const browserConfirm = vi.spyOn(window, 'confirm');
    groups = [MEMBER_GROUP];
    mount({ groups: true });
    fireEvent.click(await screen.findByRole('button', { name: 'Esci' }));
    const dialog = within(screen.getByRole('dialog'));
    expect(dialog.getByText('Uscire da «Palestra Rossi»?')).toBeTruthy();
    expectDestructiveConfirm('I tuoi dati spariscono subito dalla classifica. Per rientrare servirà un nuovo invito.', 'Esci', { ink: 'rgb(26, 24, 22)', red: 'rgb(213, 0, 0)' });
    expect(leaveCalls()).toHaveLength(0);
    fireEvent.click(dialog.getByRole('button', { name: 'Esci' }));
    await waitFor(() => expect(leaveCalls()).toHaveLength(1));
    expect(JSON.parse(leaveCalls()[0][1].body)).toEqual({ group_id: 7 });
    await waitFor(() => expect(screen.queryByText('Palestra Rossi')).toBeNull());
    expect(browserConfirm).not.toHaveBeenCalled();
  });

  it('un secondo tocco su «Esci» mentre la finestra si chiude non esce due volte', async () => {
    groups = [MEMBER_GROUP];
    mount({ groups: true });
    fireEvent.click(await screen.findByRole('button', { name: 'Esci' }));
    const esci = within(screen.getByRole('dialog')).getByRole('button', { name: 'Esci' });
    fireEvent.click(esci);
    fireEvent.click(esci);
    await waitFor(() => expect(screen.queryByText('Palestra Rossi')).toBeNull());
    expect(leaveCalls()).toHaveLength(1);
  });

  it('«Annulla» chiude la finestra e il gruppo resta', async () => {
    groups = [MEMBER_GROUP];
    mount({ groups: true });
    fireEvent.click(await screen.findByRole('button', { name: 'Esci' }));
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Annulla' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(leaveCalls()).toHaveLength(0);
    expect(screen.getByText('Palestra Rossi')).toBeTruthy();
  });
});
