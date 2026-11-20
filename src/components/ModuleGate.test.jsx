// Pagina «Il modulo X non è attivo»: niente errore e niente pagina, i dati sono rimasti, «Attiva» salva e mostra la
// destinazione richiesta. Nessuna attivazione automatica.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { useState } from 'react';
import { MemoryRouter } from 'react-router-dom';
import ModuleGate from './ModuleGate';
import { ThemeModeProvider } from '../context/ThemeModeContext';
import { json } from '../test/dom';

const auth = vi.hoisted(() => ({ value: null }));
vi.mock('../context/AuthContext', () => ({ useAuth: () => auth.value }));

const ALL = { body: true, recovery: true, levels: true, groups: true, ai: true };
let settings;
const updateUser = vi.fn();

const Harness = ({ modules, module = 'groups', name }) => {
  const [user, setUser] = useState({ id: 1, modules });
  auth.value = { user, updateUser: (patch) => { updateUser(patch); setUser((u) => ({ ...u, ...patch })); } };
  return <MemoryRouter><ThemeModeProvider><ModuleGate module={module} name={name}><p>Contenuto della pagina</p></ModuleGate></ThemeModeProvider></MemoryRouter>;
};
const savedBodies = () => fetch.mock.calls.map(([, init]) => JSON.parse(init.body));

beforeEach(() => {
  updateUser.mockClear();
  settings = (body) => json({ success: true, modules: { ...ALL, groups: false, ...body.modules } });
  vi.stubGlobal('fetch', vi.fn((url, init) => Promise.resolve(settings(JSON.parse(init.body)))));
});
afterEach(() => vi.unstubAllGlobals());

describe('modulo attivo', () => {
  it('mostra la pagina e non chiama il server', () => {
    render(<Harness modules={ALL} />);
    expect(screen.getByText('Contenuto della pagina')).toBeTruthy();
    expect(fetch).not.toHaveBeenCalled();
  });

  it('un account senza moduli la mostra (tutto attivo)', () => {
    render(<Harness modules={undefined} />);
    expect(screen.getByText('Contenuto della pagina')).toBeTruthy();
  });
});

describe('modulo non attivo', () => {
  it('con name il titolo usa quel nome', () => {
    render(<Harness modules={{ ...ALL, groups: false }} name="Modulo extra" />);
    expect(screen.getByRole('heading', { name: 'Il modulo Modulo extra non è attivo' })).toBeTruthy();
  });

  const off = { ...ALL, groups: false };

  it('al posto della pagina c\'è «Il modulo Gruppi non è attivo», con una riga sui dati rimasti e «Attiva»', () => {
    render(<Harness modules={off} />);
    expect(screen.queryByText('Contenuto della pagina')).toBeNull();
    expect(screen.getByRole('heading', { level: 1, name: 'Il modulo Gruppi non è attivo' })).toBeTruthy();
    expect(screen.getByText(/I tuoi dati sono rimasti/)).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Attiva' })).toBeTruthy();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('il nome è quello giusto del modulo', () => {
    render(<Harness modules={{ ...ALL, levels: false }} module="levels" />);
    expect(screen.getByRole('heading', { name: 'Il modulo Livelli e traguardi non è attivo' })).toBeTruthy();
  });

  it('non si attiva da solo', () => {
    render(<Harness modules={off} />);
    expect(fetch).not.toHaveBeenCalled();
  });

  it('«Attiva» salva solo quel modulo, aggiorna il contesto e mostra la pagina richiesta', async () => {
    render(<Harness modules={off} />);
    fireEvent.click(screen.getByRole('button', { name: 'Attiva' }));
    expect(await screen.findByText('Contenuto della pagina')).toBeTruthy();
    expect(savedBodies()).toEqual([{ modules: { groups: true } }]);
    expect(updateUser).toHaveBeenCalledWith({ modules: { ...ALL, groups: true } });
  });

  it('se il salvataggio fallisce resta la pagina «non attivo», con l\'errore visibile e «Attiva» di nuovo premibile', async () => {
    settings = () => json({ success: false }, 500);
    render(<Harness modules={off} />);
    fireEvent.click(screen.getByRole('button', { name: 'Attiva' }));
    expect((await screen.findByRole('alert')).textContent).toBe('Non sono riuscito ad attivare il modulo. Riprova.');
    expect(screen.queryByText('Contenuto della pagina')).toBeNull();
    await waitFor(() => expect(screen.getByRole('button', { name: 'Attiva' }).disabled).toBe(false));
  });
});
