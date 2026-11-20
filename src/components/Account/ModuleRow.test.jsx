// Riga di un modulo: usata anche per un modulo fuori dall'elenco della card, con nome e descrizione già tradotti.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { useState } from 'react';
import { MemoryRouter } from 'react-router-dom';
import ModuleRow from './ModuleRow';
import { ThemeModeProvider } from '../../context/ThemeModeContext';
import { json } from '../../test/dom';

const auth = vi.hoisted(() => ({ value: null }));
vi.mock('../../context/AuthContext', () => ({ useAuth: () => auth.value }));

const notify = vi.fn();
const Harness = ({ modules, children }) => {
  const [user, setUser] = useState({ id: 1, modules });
  auth.value = { user, updateUser: (patch) => setUser((u) => ({ ...u, ...patch })) };
  return (
    <MemoryRouter>
      <ThemeModeProvider>
        <ul>
          <ModuleRow moduleKey="ai" name="Modulo extra" help="Una riga in più" openPath="/extra" first notify={notify}>{children}</ModuleRow>
        </ul>
      </ThemeModeProvider>
    </MemoryRouter>
  );
};
const savedBodies = () => fetch.mock.calls.map(([, init]) => JSON.parse(init.body));

beforeEach(() => {
  notify.mockClear();
  vi.stubGlobal('fetch', vi.fn((url, init) => Promise.resolve(json({ success: true, modules: { ai: true, ...JSON.parse(init.body).modules } }))));
});
afterEach(() => vi.unstubAllGlobals());

describe('ModuleRow', () => {
  it('mostra il nome e la descrizione passati a mano', () => {
    render(<Harness modules={{ ai: true }} />);
    expect(screen.getByText('Modulo extra')).toBeTruthy();
    expect(screen.getByText('Una riga in più')).toBeTruthy();
    expect(screen.getByRole('switch', { name: 'Modulo extra' }).checked).toBe(true);
  });

  it('«Apri» porta a openPath ed è presente solo se il modulo è attivo', () => {
    const { unmount } = render(<Harness modules={{ ai: true }} />);
    expect(screen.getByRole('link', { name: /Modulo extra/ }).getAttribute('href')).toBe('/extra');
    unmount();
    render(<Harness modules={{ ai: false }} />);
    expect(screen.queryByRole('link')).toBeNull();
  });

  it('spegnendo salva { ai: false } e annuncia con il nome passato', async () => {
    render(<Harness modules={{ ai: true }} />);
    fireEvent.click(screen.getByRole('switch', { name: 'Modulo extra' }));
    await waitFor(() => expect(notify).toHaveBeenCalledTimes(1));
    expect(savedBodies()).toEqual([{ modules: { ai: false } }]);
    expect(notify.mock.calls[0][0]).toContain('Modulo extra');
    expect(notify.mock.calls[0][1]).toBe('success');
  });

  it('i figli ricevono lo stato mostrato, anche quello atteso durante il salvataggio', async () => {
    let release;
    fetch.mockImplementation(() => new Promise((resolve) => { release = () => resolve(json({ success: true, modules: { ai: false } })); }));
    render(<Harness modules={{ ai: true }}>{(on) => <p>figli {on ? 'on' : 'off'}</p>}</Harness>);
    expect(screen.getByText('figli on')).toBeTruthy();
    fireEvent.click(screen.getByRole('switch', { name: 'Modulo extra' }));
    expect(screen.getByText('figli off')).toBeTruthy();
    expect(screen.getByRole('switch').getAttribute('aria-busy')).toBe('true');
    // secondo cambio ignorato mentre il primo è in corso
    fireEvent.click(screen.getByRole('switch'));
    expect(fetch).toHaveBeenCalledTimes(1);
    release();
    await waitFor(() => expect(notify).toHaveBeenCalledTimes(1));
  });
});
