// Barra di navigazione mobile: Home · Schede · pulsante centrale · Storico · Progressi. Il rosso della voce attiva è un testo,
// in scuro il rosso chiaro; il pulsante centrale apre il ventaglio.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act, within } from '@testing-library/react';
import { MemoryRouter, useNavigate } from 'react-router-dom';
import BottomNav from './BottomNav';
import DirectionsRunIcon from '@mui/icons-material/DirectionsRun';
import { registerCenterAction } from '../../hooks/useCenterActions';
import { ThemeModeProvider } from '../../context/ThemeModeContext';
import { DRAFT_STORAGE_KEY } from '../../utils/focusDraft';

const auth = vi.hoisted(() => ({ value: null }));
vi.mock('../../context/AuthContext', () => ({ useAuth: () => auth.value }));

let mobile = true;
const listeners = new Set();
// Cambia la larghezza della finestra: avvisa chi ascolta il media query, come fa il browser
const resizeTo = (isMobile) => { mobile = isMobile; act(() => listeners.forEach((listener) => listener())); };
beforeEach(() => {
  mobile = true;
  listeners.clear();
  localStorage.clear();
  auth.value = { user: { username: 'atleta_demo' }, isLoggedIn: true, loading: false };
  const lists = {};
  // Un solo oggetto per ogni query, con `matches` riletto a ogni lettura (MUI tiene l'oggetto e ascolta `change`)
  window.matchMedia = (query) => lists[query] ??= {
    get matches() { return query.includes('max-width') && mobile; },
    media: query,
    addEventListener: (_, l) => listeners.add(l), removeEventListener: (_, l) => listeners.delete(l),
    addListener: (l) => listeners.add(l), removeListener: (l) => listeners.delete(l),
  };
});

const renderNav = (mode = 'light', path = '/') => {
  localStorage.setItem('themeMode', mode);
  return render(<MemoryRouter initialEntries={[path]}><ThemeModeProvider><BottomNav /></ThemeModeProvider></MemoryRouter>);
};
const labelColor = (label) => getComputedStyle(screen.getByText(label)).color;
const centerButton = () => screen.getByRole('button', { name: 'Cosa vuoi fare' });
const current = () => screen.queryAllByRole('link').filter((a) => a.getAttribute('aria-current') === 'page').map((a) => a.textContent);

describe.each([
  ['light', 'rgb(213, 0, 0)'],
  ['dark', 'rgb(255, 82, 82)'],
])('barra mobile in %s', (mode, red) => {
  it('la voce attiva ha il rosso dei testi', () => {
    renderNav(mode);
    expect(labelColor('Home')).toBe(red);
  });
});

describe('barra mobile: voci', () => {
  it('quattro voci e il pulsante centrale, nell\'ordine Home, Schede, Storico, Progressi', () => {
    renderNav();
    const nav = screen.getByRole('navigation', { name: 'Navigazione principale' });
    expect([...nav.querySelectorAll('a')].map((a) => [a.textContent, a.getAttribute('href')])).toEqual([
      ['Home', '/'], ['Schede', '/schede'], ['Storico', '/storico'], ['Progressi', '/progressi'],
    ]);
    expect(centerButton()).toBeTruthy();
  });

  it('il Profilo non è nella barra: si apre dall\'avatar in alto', () => {
    renderNav();
    expect(screen.queryByRole('link', { name: 'Profilo' })).toBeNull();
    expect(screen.queryByText('Profilo')).toBeNull();
  });

  it.each([
    ['/', 'Home'],
    ['/schede', 'Schede'],
    ['/storico', 'Storico'],
    ['/progressi', 'Progressi'],
  ])('su %s la voce attiva è «%s», e solo quella', (path, name) => {
    renderNav('light', path);
    expect(current()).toEqual([name]);
  });

  it('su un esercizio (/progressi/esercizi/<id>) la voce «Progressi» resta attiva, e solo quella', () => {
    renderNav('light', '/progressi/esercizi/3');
    expect(current()).toEqual(['Progressi']);
  });

  it('su una scheda (/schede/<id>) la voce «Schede» resta attiva, e solo quella', () => {
    renderNav('light', '/schede/12');
    expect(current()).toEqual(['Schede']);
  });

  it('su «Tutti gli esercizi» (/schede/esercizi) la voce «Schede» resta attiva, e solo quella', () => {
    renderNav('light', '/schede/esercizi');
    expect(current()).toEqual(['Schede']);
  });

  it('su un allenamento (/storico/<id>) la voce «Storico» resta attiva, e solo quella', () => {
    renderNav('light', '/storico/12');
    expect(current()).toEqual(['Storico']);
  });

  it('con l'Account aperto nessuna voce della barra è attiva', () => {
    renderNav('light', '/account');
    expect(current()).toEqual([]);
  });

  it('non compare per gli ospiti, con l\'app bloccata, su /focus e sul desktop', () => {
    auth.value = { user: null, isLoggedIn: false, loading: false };
    const guest = renderNav();
    expect(guest.container.querySelector('nav')).toBeNull();
    guest.unmount();

    auth.value = { user: { username: 'atleta_demo' }, isLoggedIn: true, emailState: { blocked: true } };
    const blocked = renderNav();
    expect(blocked.container.querySelector('nav')).toBeNull();
    blocked.unmount();

    auth.value = { user: { username: 'atleta_demo' }, isLoggedIn: true };
    const focus = renderNav('light', '/focus');
    expect(focus.container.querySelector('nav')).toBeNull();
    focus.unmount();

    mobile = false;
    const desktop = renderNav();
    expect(desktop.container.querySelector('nav')).toBeNull();
  });
});

// Ogni voce riempie la sua cella fino al bordo dello schermo: il contorno del focus sta dentro la cella, non fuori
describe('barra mobile: focus da tastiera', () => {
  it.each(['Home', 'Storico'])('la voce %s ha il contorno del tema dentro la cella', (name) => {
    renderNav('light');
    const link = screen.getAllByRole('link').find((a) => a.textContent.includes(name));
    fireEvent.keyDown(document.body, { key: 'Tab' });
    act(() => link.focus());
    expect(getComputedStyle(link).outline).toBe('2px solid #1a1816');
    expect(getComputedStyle(link).outlineOffset).toBe('-4px');
  });

  it('il pulsante centrale ha il contorno del tema dentro la cella', () => {
    renderNav('light');
    fireEvent.keyDown(document.body, { key: 'Tab' });
    act(() => centerButton().focus());
    expect(getComputedStyle(centerButton()).outline).toBe('2px solid #1a1816');
    expect(getComputedStyle(centerButton()).outlineOffset).toBe('-4px');
  });
});

describe('pulsante centrale', () => {
  it('ha il simbolo del logo, nessuna scritta, un bersaglio di almeno 44 px e annuncia una finestra', () => {
    renderNav();
    const button = centerButton();
    expect(button.querySelector('[data-testid="logo-mark"]')).toBeTruthy();
    expect(button.textContent).toBe('');
    expect(button.getAttribute('aria-haspopup')).toBe('dialog');
    expect(button.getAttribute('aria-expanded')).toBe('false');
    expect(parseFloat(getComputedStyle(button).height)).toBeGreaterThanOrEqual(44);
  });

  it('un tocco apre il ventaglio, anche con due sole voci, e aria-expanded diventa true', () => {
    auth.value = { user: { username: 'atleta_demo', modules: { body: false } }, isLoggedIn: true };
    renderNav();
    fireEvent.click(centerButton());
    const dialog = screen.getByRole('dialog', { name: 'Cosa vuoi fare' });
    expect(dialog.querySelectorAll('a')).toHaveLength(2);
    // Aperto, il resto della pagina (pulsante compreso) è nascosto al lettore di schermo
    expect(screen.getByRole('button', { name: 'Cosa vuoi fare', hidden: true }).getAttribute('aria-expanded')).toBe('true');
  });

  it('con il modulo Misure attivo le voci sono tre: Inizia, Registra, Misura', () => {
    renderNav();
    fireEvent.click(centerButton());
    expect([...screen.getByRole('dialog').querySelectorAll('a')].map((a) => a.textContent)).toEqual(['Inizia', 'Registra', 'Misura']);
  });

  it('Esc chiude il ventaglio e il fuoco torna al pulsante centrale', () => {
    renderNav();
    fireEvent.click(centerButton());
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(document.activeElement).toBe(centerButton());
    expect(centerButton().getAttribute('aria-expanded')).toBe('false');
  });

  it('il tocco sul velo chiude e riporta il fuoco al pulsante centrale', () => {
    renderNav();
    fireEvent.click(centerButton());
    fireEvent.click(screen.getByTestId('fan-veil'));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(document.activeElement).toBe(centerButton());
  });

  it('scegliendo una voce il ventaglio si chiude', () => {
    renderNav();
    fireEvent.click(centerButton());
    fireEvent.click(screen.getByRole('link', { name: 'Registra allenamento passato' }));
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('con un allenamento a metà la prima voce è «Riprendi», riletto a ogni apertura', () => {
    renderNav();
    fireEvent.click(centerButton());
    expect(screen.getByRole('link', { name: 'Inizia allenamento' })).toBeTruthy();
    fireEvent.click(screen.getByTestId('fan-veil'));
    localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify({ selectedDay: { id: 1 }, startTime: 1 }));
    fireEvent.click(centerButton());
    expect(screen.getByRole('link', { name: 'Riprendi allenamento' }).textContent).toBe('Riprendi');
    expect(screen.queryByRole('link', { name: 'Inizia allenamento' })).toBeNull();
  });
});

describe('ventaglio che resta aperto', () => {
  let navigate;
  const Spy = () => { navigate = useNavigate(); return null; };
  const renderTree = () => render(
    <MemoryRouter initialEntries={['/', '/schede']} initialIndex={1}><ThemeModeProvider><BottomNav /><Spy /></ThemeModeProvider></MemoryRouter>,
  );

  it('si chiude quando cambia l\'indirizzo (tasto indietro del browser)', () => {
    renderTree();
    fireEvent.click(centerButton());
    expect(screen.getByRole('dialog')).toBeTruthy();
    act(() => navigate(-1));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(centerButton().getAttribute('aria-expanded')).toBe('false');
  });

  it('si chiude quando la finestra supera la soglia md e, tornando stretta, non ricompare aperto', () => {
    renderTree();
    fireEvent.click(centerButton());
    resizeTo(false);
    expect(document.querySelector('nav')).toBeNull();
    resizeTo(true);
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(centerButton().getAttribute('aria-expanded')).toBe('false');
  });
});

describe('barra mobile: voce aggiunta da fuori', () => {
  const onSelect = vi.fn();
  let remove;
  beforeEach(() => {
    onSelect.mockClear();
    remove = registerCenterAction({ key: 'cardio', label: 'Cardio', shortLabel: 'Cardio', Icon: DirectionsRunIcon, onSelect });
  });
  afterEach(() => act(() => remove()));

  it('il ventaglio ha quattro voci e la nuova è un pulsante', () => {
    renderNav();
    fireEvent.click(centerButton());
    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getAllByRole('link')).toHaveLength(3);
    expect(within(dialog).getByRole('button', { name: 'Cardio' })).toBeTruthy();
  });

  it('scegliendola il ventaglio si chiude, onSelect parte una volta e il fuoco torna al pulsante centrale', () => {
    renderNav();
    fireEvent.click(centerButton());
    fireEvent.click(screen.getByRole('button', { name: 'Cardio' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(document.activeElement).toBe(centerButton());
  });
});
