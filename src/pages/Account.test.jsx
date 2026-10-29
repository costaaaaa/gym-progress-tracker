// Account: l'obiettivo settimanale ha il font dei chip, come nell'app (lì è una riga di chip); la "Zona pericolosa" è
// rosata con il bottone pieno rosso, il resto è inchiostro. Colori scritti a mano. Tema chiaro: text.primary #1a1816,
// text.secondary #6b6663, background.paper #fff, primary/error #d50000, error.muted #fdecec, error.border #f5c6c6,
// error.title #9b0000. Tema scuro (solo la zona pericolosa): error.main #ff5252 con alpha 0.1 (fondo) e 0.35 (bordo),
// error.title #ff9e9e; bottoni pieni di errore #d50000 con testo bianco.
// La fetch è il confine. Le impostazioni sono chiuse in un Collapse, che le tiene comunque montate.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, within, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Account from './Account';
import { ThemeModeProvider } from '../context/ThemeModeContext';
import { textBelow } from '../test/minText';
import { json } from '../test/dom';
import { setBrowserTimeZone } from '../test/timeZone';

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

describe('testi', () => {
  it('nessun testo della pagina è sotto i 16px (escluse le etichette dei campi, che MUI rimpicciolisce)', async () => {
    await mount();
    expect(textBelow(document.body, 16, '.MuiChip-root, .MuiFormLabel-root, .MuiFormHelperText-root, legend')).toEqual([]);
  });
});

describe('esporta i dati', () => {
  afterEach(() => vi.useRealTimers());

  // 00:30 a Roma è ancora ieri in UTC; 23:30 a New York è già domani in UTC
  it.each([['Europe/Rome', 0, 30], ['America/New_York', 23, 30]])('il file porta il giorno locale (%s, %i:%i), non quello UTC', async (zone, hour, minute) => {
    setBrowserTimeZone(zone);
    await mount();
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(2026, 9, 20, hour, minute));
    URL.createObjectURL = vi.fn(() => 'blob:x');
    URL.revokeObjectURL = vi.fn();
    const names = [];
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function click() { names.push(this.download); });
    fireEvent.click(screen.getAllByRole('button', { name: 'Esporta' })[0]);
    await waitFor(() => expect(names).toHaveLength(1));
    expect(names[0]).toBe('dati_liftindex_atleta_con_un_nome_molto_lungo_2026-10-20.json');
  });
});
