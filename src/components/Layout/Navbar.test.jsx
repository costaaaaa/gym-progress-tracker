// Barra in alto vista dall'utente: il link alla home porta il marchio LiftIndex, il nome accessibile è uno solo.
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Navbar from './Navbar';
import { ThemeModeProvider } from '../../context/ThemeModeContext';
import { mediaStyle } from '../../test/mediaStyle';

const auth = vi.hoisted(() => ({ value: { user: null, isLoggedIn: false, loading: false } }));
vi.mock('../../context/AuthContext', () => ({
  useAuth: () => auth.value,
}));

describe('barra in alto', () => {
  it('il link alla home mostra il marchio LiftIndex, non il manubrio', () => {
    render(<MemoryRouter><ThemeModeProvider><Navbar /></ThemeModeProvider></MemoryRouter>);
    const homeLink = screen.getByRole('link', { name: 'LiftIndex' });
    expect(homeLink.getAttribute('href')).toBe('/');
    expect(within(homeLink).getByTestId('logo-mark')).toBeTruthy();
    expect(within(homeLink).queryByTestId('FitnessCenterIcon')).toBeNull();
  });
});

// Voce attiva della navigazione desktop: il rosso è un testo, in scuro dev'essere quello chiaro (4.5 : 1 su #141416)
describe('barra in alto: voce attiva', () => {
  afterEach(() => {
    auth.value = { user: null, isLoggedIn: false, loading: false };
  });
  const activeColor = (mode) => {
    localStorage.setItem('themeMode', mode);
    auth.value = { user: { username: 'atleta_demo' }, isLoggedIn: true, loading: false };
    render(<MemoryRouter initialEntries={['/']}><ThemeModeProvider><Navbar /></ThemeModeProvider></MemoryRouter>);
    return getComputedStyle(screen.getByRole('link', { name: 'Home' })).color;
  };

  it('in chiaro è il rosso del marchio', () => {
    expect(activeColor('light')).toBe('rgb(213, 0, 0)');
  });

  it('in scuro è il rosso chiaro', () => {
    expect(activeColor('dark')).toBe('rgb(255, 82, 82)');
  });
});

// Reflow a 320 px (1.4.10): sui telefoni i bottoni di accesso si stringono, sotto 360 px resta il marchio senza la scritta.
// jsdom non valuta le media query: si leggono le regole che gli elementi ricevono sotto quelle larghezze.
describe('barra in alto: schermi stretti', () => {
  afterEach(() => {
    auth.value = { user: null, isLoggedIn: false, loading: false };
  });
  const mount = () => render(<MemoryRouter><ThemeModeProvider><Navbar /></ThemeModeProvider></MemoryRouter>);

  it('sui telefoni i bottoni Accedi e Registrati hanno meno spazio ai lati, da 600 px come prima', () => {
    mount();
    for (const name of ['Accedi', 'Registrati']) {
      const link = screen.getByRole('link', { name });
      expect(mediaStyle(link, 0)['padding-left']).toBe('8px');
      expect(mediaStyle(link, 0)['padding-right']).toBe('8px');
      expect(mediaStyle(link, 600)['padding-left']).toBe('18px');
      expect(mediaStyle(link, 600)['padding-right']).toBe('18px');
    }
  });

  it('sui telefoni Accedi e Registrati stanno più vicini, da 600 px come prima', () => {
    mount();
    const buttons = screen.getByRole('link', { name: 'Accedi' }).parentElement;
    expect(mediaStyle(buttons, 0).gap).toBe('4px');
    expect(mediaStyle(buttons, 600).gap).toBe('12px');
  });

  it('per chi è loggato tema e avatar restano a 12 px anche sui telefoni', () => {
    auth.value = { user: { username: 'atleta_demo' }, isLoggedIn: true, loading: false };
    mount();
    const group = screen.getByRole('link', { name: 'Profilo' }).parentElement;
    expect(mediaStyle(group).gap).toBe('12px');
  });

  it('sotto 360 px la scritta LiftIndex resta solo per chi usa lo screen reader, il nome del link non cambia', () => {
    mount();
    const style = mediaStyle(screen.getByText('LiftIndex'), 359.95, 'max');
    expect(style.position).toBe('absolute');
    expect(style.width).toBe('1px');
    expect(style.height).toBe('1px');
    expect(style.overflow).toBe('hidden');
    expect(screen.getByRole('link', { name: 'LiftIndex' })).toBeTruthy();
  });

  it('se i controlli non stanno accanto al marchio (spaziatura del testo) vanno a capo invece di uscire dallo schermo', () => {
    mount();
    const group = screen.getByRole('link', { name: 'Accedi' }).parentElement.parentElement;
    const toolbar = group.parentElement;
    expect(mediaStyle(toolbar)['flex-wrap']).toBe('wrap');
    expect(mediaStyle(toolbar, 0).display).toBe('flex');
    expect(mediaStyle(toolbar, 600).display).toBe('grid');
    expect(mediaStyle(toolbar, 600)['grid-template-columns']).toBe('1fr auto');
    expect(mediaStyle(toolbar, 900)['grid-template-columns']).toBe('1fr auto 1fr');
    expect(mediaStyle(group, 0)['margin-left']).toBe('auto');
    expect(mediaStyle(group, 600)['margin-left']).toBe('0px');
  });
});

// Con la spaziatura del testo la barra va su due righe: il palco della landing, fisso sotto la barra, ne segue l'altezza.
describe('barra in alto: altezza pubblicata', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    document.documentElement.style.removeProperty('--navbar-height');
  });

  it('scrive in --navbar-height l\'altezza della riga dei controlli, la aggiorna quando cambia e la toglie allo smontaggio', () => {
    let resize;
    vi.stubGlobal('ResizeObserver', class { constructor(cb) { this.cb = cb; } observe() { resize = this.cb; } disconnect() {} });
    const height = vi.spyOn(Element.prototype, 'getBoundingClientRect').mockReturnValue({ height: 64 });
    const value = () => document.documentElement.style.getPropertyValue('--navbar-height');
    const { unmount } = render(<MemoryRouter><ThemeModeProvider><Navbar /></ThemeModeProvider></MemoryRouter>);
    expect(value()).toBe('64px');
    height.mockReturnValue({ height: 79 });
    resize();
    expect(value()).toBe('79px');
    unmount();
    expect(value()).toBe('');
  });
});

// Bersaglio tocco (2.5.8): il bottone del tema accanto al marchio è almeno 40 x 40 px, non i 30 px di size="small"
describe('barra in alto: bottone del tema', () => {
  it('è almeno 40 x 40 px', () => {
    render(<MemoryRouter><ThemeModeProvider><Navbar /></ThemeModeProvider></MemoryRouter>);
    const button = screen.getByRole('button', { name: 'Modalità scura' });
    const style = mediaStyle(button, null);
    expect(parseInt(style.width, 10)).toBeGreaterThanOrEqual(40);
    expect(parseInt(style.height, 10)).toBeGreaterThanOrEqual(40);
  });
});

// Moduli: la voce «Gruppi» c'è solo a modulo attivo (un account senza moduli li ha tutti attivi)
describe('barra in alto: voce Gruppi', () => {
  afterEach(() => {
    auth.value = { user: null, isLoggedIn: false, loading: false };
  });
  const links = (user) => {
    auth.value = { user, isLoggedIn: true, loading: false };
    render(<MemoryRouter initialEntries={['/']}><ThemeModeProvider><Navbar /></ThemeModeProvider></MemoryRouter>);
    return ['Home', 'Allenamenti', 'Dashboard', 'Gruppi'].filter((name) => screen.queryByRole('link', { name }));
  };

  it('con Gruppi attivo la voce c\'è', () => {
    expect(links({ username: 'atleta_demo', modules: { groups: true } })).toEqual(['Home', 'Allenamenti', 'Dashboard', 'Gruppi']);
  });

  it('con Gruppi non attivo la voce non c\'è e le altre restano', () => {
    expect(links({ username: 'atleta_demo', modules: { groups: false } })).toEqual(['Home', 'Allenamenti', 'Dashboard']);
  });

  it('un account senza moduli ha la voce', () => {
    expect(links({ username: 'atleta_demo' })).toContain('Gruppi');
  });
});
