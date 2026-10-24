// Account: l'obiettivo settimanale ha il font dei chip, come nell'app (lì è una riga di chip); il rosso resta
// all'azione che cancella (dialogo di eliminazione), il resto è inchiostro. Colori del tema chiaro scritti a mano:
// text.primary #1a1816, text.secondary #6b6663, divider #ececea, background.paper #fff, primary/error #d50000.
// La fetch è il confine. Le impostazioni sono chiuse in un Collapse, che le tiene comunque montate.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, within, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Account from './Account';
import { ThemeModeProvider } from '../context/ThemeModeContext';
import { textBelow } from '../test/minText';

vi.mock('react-router-dom', async (importOriginal) => ({ ...(await importOriginal()), useNavigate: () => () => {} }));
// Lo stesso oggetto a ogni render: la pagina ricarica i dati quando `user` cambia identità.
vi.mock('../context/AuthContext', () => {
  const auth = { user: { id: 1 }, isLoggedIn: true, loading: false, logout: () => {}, updateUser: () => {} };
  return { useAuth: () => auth };
});

const INK = 'rgb(26, 24, 22)';
const GREY = 'rgb(107, 102, 99)';
const GREEN = 'rgb(21, 128, 61)';
const RED = 'rgb(213, 0, 0)';
const DIVIDER = 'rgb(236, 236, 234)';
const WHITE = 'rgb(255, 255, 255)';

const groups = [
  { id: 7, name: 'Palestra Rossi', my_role: 'owner' },
  { id: 8, name: 'Amici del giovedì', my_role: 'member' },
];
const json = (data) => ({ ok: true, status: 200, json: async () => data });
const stubFetch = ({ is_admin = false } = {}) => vi.stubGlobal('fetch', vi.fn((url) => Promise.resolve(
  url.includes('groups/list.php') ? json({ success: true, groups })
    : url.includes('user/consent.php') ? json({ success: true, consents: { terms: { granted: true, version: 1 }, health_data: { granted: true, version: 1 } } })
    : url.includes('user/read.php') ? json({
      id: 1, username: 'atleta_con_un_nome_molto_lungo', email: 'atleta.con.un.indirizzo.lungo@example.com',
      created_at: '2025-03-01 10:00:00', is_admin, weekly_goal_default: 3,
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

describe('zona pericolosa', () => {
  const card = () => screen.getByText('Zona pericolosa', { selector: 'p' }).closest('.MuiCard-root');

  it('è una card normale: sfondo bianco, bordo divisore, titolo in inchiostro', async () => {
    await mount();
    const style = getComputedStyle(card());
    expect(style.backgroundColor).toBe(WHITE);
    expect(style.borderColor).toBe(DIVIDER);
    expect(getComputedStyle(screen.getByText('Zona pericolosa', { selector: 'p' })).color).toBe(INK);
  });

  it('«Elimina account» è outlined neutro, non pieno rosso', async () => {
    await mount();
    const del = within(card()).getByRole('button', { name: 'Elimina account' });
    expect(del.classList.contains('MuiButton-outlined')).toBe(true);
    expect(getComputedStyle(del).color).toBe(INK);
    expect(getComputedStyle(del).backgroundColor).not.toBe(RED);
  });

  it('il rosso c\'è solo nel dialogo di conferma: titolo e bottone di eliminazione', async () => {
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

describe('testi', () => {
  it('nessun testo della pagina è sotto i 16px (escluse le etichette dei campi, che MUI rimpicciolisce)', async () => {
    await mount();
    expect(textBelow(document.body, 16, '.MuiChip-root, .MuiFormLabel-root, .MuiFormHelperText-root, legend')).toEqual([]);
  });
});
