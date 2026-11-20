// Barra in alto vista dall'utente: il link alla home porta il marchio LiftIndex, il nome accessibile è uno solo.
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, screen, within, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Navbar from './Navbar';
import { ThemeModeProvider } from '../../context/ThemeModeContext';
import { mediaStyle } from '../../test/mediaStyle';
import { DRAFT_STORAGE_KEY } from '../../utils/focusDraft';

const realMatchMedia = window.matchMedia;

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

// Desktop: Home · Schede · Storico · Progressi (senza Gruppi, che si apre dalla card in Home e da «Apri» nei Moduli),
// pulsante diviso «Inizia allenamento ▾», tema, avatar
describe('barra in alto: desktop', () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => {
    auth.value = { user: null, isLoggedIn: false, loading: false };
  });
  const mount = (user = { username: 'atleta_demo' }, path = '/') => {
    auth.value = { user, isLoggedIn: true, loading: false };
    return render(<MemoryRouter initialEntries={[path]}><ThemeModeProvider><Navbar /></ThemeModeProvider></MemoryRouter>);
  };
  const currentLinks = () => screen.getAllByRole('link').filter((a) => a.getAttribute('aria-current') === 'page').map((a) => a.getAttribute('aria-label') || a.textContent);

  it('le voci sono Home, Schede, Storico, Progressi, senza Gruppi anche a modulo attivo', () => {
    mount({ username: 'atleta_demo', modules: { groups: true } });
    const items = ['Home', 'Schede', 'Storico', 'Progressi'].map((name) => screen.getByRole('link', { name }).getAttribute('href'));
    expect(items).toEqual(['/', '/schede', '/storico', '/dashboard']);
    expect(screen.queryByRole('link', { name: 'Gruppi' })).toBeNull();
    expect(screen.queryByRole('link', { name: 'Allenamenti' })).toBeNull();
    expect(screen.queryByRole('link', { name: 'Dashboard' })).toBeNull();
  });

  it.each([['/', 'Home'], ['/schede', 'Schede'], ['/storico', 'Storico'], ['/dashboard', 'Progressi']])('su %s la voce attiva è «%s»', (path, name) => {
    mount(undefined, path);
    expect(currentLinks()).toEqual([name]);
  });

  it('il pulsante diviso ha due bersagli: «Inizia allenamento» porta al Focus, «Altre azioni» apre il menu', () => {
    mount();
    expect(screen.getByRole('link', { name: 'Inizia allenamento' }).getAttribute('href')).toBe('/focus');
    const more = screen.getByRole('button', { name: 'Altre azioni' });
    expect(more.getAttribute('aria-haspopup')).toBe('menu');
    expect(more.getAttribute('aria-expanded')).toBe('false');
    fireEvent.click(more);
    expect(more.getAttribute('aria-expanded')).toBe('true');
    const items = screen.getAllByRole('menuitem');
    expect(items.map((item) => [item.textContent, item.getAttribute('href')])).toEqual([
      ['Registra allenamento passato', '/storico'], ['Nuova misura', '/dashboard?tab=body'],
    ]);
  });

  it('senza il modulo Misure il menu ha solo «Registra allenamento passato»', () => {
    mount({ username: 'atleta_demo', modules: { body: false } });
    fireEvent.click(screen.getByRole('button', { name: 'Altre azioni' }));
    expect(screen.getAllByRole('menuitem').map((item) => item.textContent)).toEqual(['Registra allenamento passato']);
  });

  it('con un allenamento a metà il pulsante è «Riprendi allenamento»', () => {
    localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify({ selectedDay: { id: 1 }, startTime: 1 }));
    mount();
    expect(screen.getByRole('link', { name: 'Riprendi allenamento' }).getAttribute('href')).toBe('/focus');
    expect(screen.queryByRole('link', { name: 'Inizia allenamento' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Altre azioni' }));
    expect(screen.getAllByRole('menuitem').map((item) => item.textContent)).not.toContain('Riprendi allenamento');
  });

  it('l\'avatar apre il Profilo e ha aria-current solo con il Profilo aperto', () => {
    mount();
    expect(screen.getByRole('link', { name: 'Profilo' }).getAttribute('href')).toBe('/profilo');
    expect(screen.getByRole('link', { name: 'Profilo' }).getAttribute('aria-current')).toBeNull();
  });

  it('con il Profilo aperto l\'avatar è la pagina corrente e nessuna voce della barra lo è', () => {
    mount(undefined, '/profilo');
    expect(currentLinks()).toEqual(['Profilo']);
  });

  it('il pulsante diviso non c\'è per gli ospiti', () => {
    auth.value = { user: null, isLoggedIn: false, loading: false };
    render(<MemoryRouter><ThemeModeProvider><Navbar /></ThemeModeProvider></MemoryRouter>);
    expect(screen.queryByRole('link', { name: 'Inizia allenamento' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Altre azioni' })).toBeNull();
  });
});

// Telefono: in alto solo il nome scritto (il simbolo sta nel pulsante centrale della barra in basso), il tema e l'avatar
describe('barra in alto: telefono', () => {
  afterEach(() => {
    auth.value = { user: null, isLoggedIn: false, loading: false };
    window.matchMedia = realMatchMedia;
  });
  const mountPhone = () => {
    window.matchMedia = (query) => ({ matches: query.includes('max-width'), media: query, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} });
    auth.value = { user: { username: 'atleta_demo' }, isLoggedIn: true, loading: false };
    render(<MemoryRouter><ThemeModeProvider><Navbar /></ThemeModeProvider></MemoryRouter>);
  };

  it('il nome LiftIndex è scritto, senza il simbolo nel quadrato rosso', () => {
    mountPhone();
    const homeLink = screen.getByRole('link', { name: 'LiftIndex' });
    expect(within(homeLink).queryByTestId('logo-mark')).toBeNull();
  });

  it('il nome resta visibile anche sotto 360 px (non c\'è il simbolo a tenere il posto)', () => {
    mountPhone();
    expect(mediaStyle(screen.getByText('LiftIndex'), 359.95, 'max').position).not.toBe('absolute');
  });

  it('restano il selettore del tema e l\'avatar; né voci né pulsante diviso (stanno nella barra in basso)', () => {
    mountPhone();
    expect(screen.getByRole('button', { name: 'Modalità scura' })).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Profilo' })).toBeTruthy();
    expect(screen.queryByRole('link', { name: 'Schede' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Altre azioni' })).toBeNull();
  });
});
