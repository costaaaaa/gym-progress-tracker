// Gruppi vista dall'utente (elenco, dettaglio con classifica, invito): il rosso del marchio resta all'azione
// principale, il resto è inchiostro, grigio o verde. La fetch è il confine. Colori del tema chiaro scritti a mano:
// text.primary #1a1816, text.secondary #6b6663, success #15803d, primary/error #d50000, action.selected rgba(0,0,0,.08).
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, within, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import Groups from './Groups';
import GroupDetail from './GroupDetail';
import JoinGroup from './JoinGroup';
import { ThemeModeProvider } from '../context/ThemeModeContext';
import { textBelow } from '../test/minText';

vi.mock('../context/AuthContext', () => {
  const auth = { user: { id: 1, username: 'mario88' }, isLoggedIn: true, loading: false };
  return { useAuth: () => auth };
});

const INK = 'rgb(26, 24, 22)';
const GREY = 'rgb(107, 102, 99)';
const GREEN = 'rgb(21, 128, 61)';
const RED = 'rgb(213, 0, 0)';
const PINK = 'rgb(251, 235, 235)';
const SELECTED = 'rgba(0, 0, 0, 0.08)';

const group = (over = {}) => ({
  id: 7, name: 'Palestra Rossi', type: 'gym', members_count: 3, max_members: 30, my_role: 'owner',
  invite_code: 'K7M2QX9PHD', invite_enabled: true, name_locked: false, ...over,
});
const week = { from: '2026-10-19', to: '2026-10-25' };
const rows = [
  { rank: 1, username: 'luca', is_me: false, workouts: 3, goal: 3, volume_kg: 5200, adherence: 1 },
  { rank: 2, username: 'mario88', is_me: true, workouts: 2, goal: 3, volume_kg: 4100, adherence: 0.66 },
];
const members = [
  { username: 'luca', role: 'member', is_me: false, ref: 'a1' },
  { username: 'mario88', role: 'owner', is_me: true, ref: null },
];

const json = (data) => ({ ok: true, status: 200, json: async () => data });
const stub = ({ myRole = 'owner' } = {}) => vi.stubGlobal('fetch', vi.fn((url) => Promise.resolve(
  url.includes('groups/list.php') ? json({ success: true, groups: [group({ my_role: myRole }), group({ id: 8, name: 'Amici del giovedì', type: 'friends', my_role: 'member' })] })
    : url.includes('groups/read.php') ? json({ success: true, group: group({ my_role: myRole }), week, members, board: rows, board_type: 'week' })
      : url.includes('groups/preview.php') ? json({ success: true, group: group({ already_member: false, is_full: false }) })
        : json({ success: true }),
)));

beforeEach(() => {
  localStorage.setItem('themeMode', 'light');
  stub();
});
afterEach(() => {
  vi.unstubAllGlobals();
  localStorage.clear();
});

const colorOf = (el) => getComputedStyle(el).color;
// Esenti: chip e badge ("tu", tipo del gruppo) e le etichette dei campi, che MUI rimpicciolisce
const small = () => textBelow(document.body, 16, '.MuiChip-root, .MuiFormLabel-root, .MuiFormHelperText-root, legend');

describe('elenco dei gruppi', () => {
  const mount = async () => {
    render(<MemoryRouter><ThemeModeProvider><Groups /></ThemeModeProvider></MemoryRouter>);
    await screen.findByText('Palestra Rossi');
  };

  it('nella card del gruppo non c\'è il quadratino rosato con l\'icona rossa', async () => {
    await mount();
    const card = screen.getByText('Palestra Rossi').closest('.MuiCard-root');
    const all = [card, ...card.querySelectorAll('*')];
    expect(all.map((el) => getComputedStyle(el).backgroundColor)).not.toContain(PINK);
    expect(card.querySelector('svg')).toBeNull();
  });

  it('«Entra» con il codice è outlined neutro', async () => {
    await mount();
    fireEvent.change(screen.getByLabelText('Codice invito'), { target: { value: 'ABC' } });
    const style = getComputedStyle(screen.getByRole('button', { name: 'Entra' }));
    expect(style.color).toBe(INK);
    expect(style.borderColor).toBe(GREY);
  });

  it('«Crea gruppo» resta l\'azione principale: pieno rosso', async () => {
    await mount();
    expect(getComputedStyle(screen.getByRole('button', { name: 'Crea gruppo' })).backgroundColor).toBe(RED);
  });

  it('i testi sono almeno 16px', async () => {
    await mount();
    expect(small()).toEqual([]);
  });
});

describe('dettaglio del gruppo', () => {
  const mount = async () => {
    render(
      <MemoryRouter initialEntries={['/gruppi/7']}>
        <ThemeModeProvider><Routes><Route path="/gruppi/:id" element={<GroupDetail />} /></Routes></ThemeModeProvider>
      </MemoryRouter>,
    );
    await screen.findByText('Classifica');
  };

  it('l\'interruttore «Inviti aperti» acceso è verde, non rosso del marchio', async () => {
    await mount();
    const base = screen.getByLabelText('Inviti aperti').closest('.MuiSwitch-switchBase');
    expect(colorOf(base)).toBe(GREEN);
    expect(getComputedStyle(base.parentElement.querySelector('.MuiSwitch-track')).backgroundColor).toBe(GREEN);
  });

  it.each(['Nuovo codice', 'Rinomina il gruppo', 'Elimina il gruppo', 'Segnala un contenuto', 'I tuoi gruppi'])(
    '«%s» è un bottone di testo in inchiostro, il rosso non c\'è',
    async (name) => {
      await mount();
      expect(colorOf(screen.queryByRole('button', { name }) ?? screen.getByRole('link', { name }))).toBe(INK);
    },
  );

  it('chi non è proprietario vede «Esci dal gruppo» in inchiostro', async () => {
    stub({ myRole: 'member' });
    await mount();
    expect(colorOf(screen.getByRole('button', { name: 'Esci dal gruppo' }))).toBe(INK);
  });

  it('il rosso c\'è solo nel dialogo di conferma dell\'eliminazione', async () => {
    await mount();
    fireEvent.click(screen.getByRole('button', { name: 'Elimina il gruppo' }));
    await waitFor(() => expect(document.querySelector('.MuiDialog-root .MuiButton-containedError')).not.toBeNull());
    expect(getComputedStyle(document.querySelector('.MuiDialog-root .MuiButton-containedError')).backgroundColor).toBe(RED);
  });

  it('nella classifica «tu» è un chip neutro e la riga propria ha il fondo grigio, non rosato', async () => {
    await mount();
    const me = screen.getByText('mario88', { selector: 'ol p' }).closest('li');
    expect(getComputedStyle(me).backgroundColor).toBe(SELECTED);
    const chip = within(me).getByText('tu').closest('.MuiChip-root');
    expect(getComputedStyle(chip).backgroundColor).not.toBe(RED);
    expect(getComputedStyle(chip).color).toBe(INK);
    const other = screen.getByText('luca', { selector: 'ol p' }).closest('li');
    expect(getComputedStyle(other).backgroundColor).not.toBe(SELECTED);
  });

  it('la barra dell\'aderenza resta rossa: è il dato', async () => {
    await mount();
    const bar = screen.getAllByRole('progressbar')[0].querySelector('.MuiLinearProgress-bar');
    expect(getComputedStyle(bar).backgroundColor).toBe(RED);
  });

  it('i testi sono almeno 16px', async () => {
    await mount();
    expect(small()).toEqual([]);
  });
});

describe('invito', () => {
  it('l\'icona dei gruppi non è nel rosso del marchio', async () => {
    render(
      <MemoryRouter initialEntries={['/entra?codice=K7M2QX9PHD']}>
        <ThemeModeProvider><Routes><Route path="/entra" element={<JoinGroup />} /></Routes></ThemeModeProvider>
      </MemoryRouter>,
    );
    await screen.findByText('Palestra Rossi');
    const icon = document.querySelector('[data-testid="GroupsOutlinedIcon"]');
    expect(icon).not.toBeNull();
    expect(colorOf(icon)).toBe(GREY);
  });
});
