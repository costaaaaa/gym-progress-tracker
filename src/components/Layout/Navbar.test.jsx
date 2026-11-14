// Barra in alto vista dall'utente: il link alla home porta il marchio LiftIndex, il nome accessibile è uno solo.
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Navbar from './Navbar';
import { ThemeModeProvider } from '../../context/ThemeModeContext';
import { maxWidthStyle } from '../../test/mediaStyle';

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

// Reflow a 320 px (1.4.10): sotto 390 px i bottoni di accesso si stringono, sotto 360 px resta il marchio senza la scritta.
// jsdom non valuta le media query: si leggono le regole che gli elementi ricevono sotto quelle larghezze.
describe('barra in alto: schermi stretti', () => {
  const mount = () => render(<MemoryRouter><ThemeModeProvider><Navbar /></ThemeModeProvider></MemoryRouter>);

  it('sotto 390 px i bottoni Accedi e Registrati hanno meno spazio ai lati', () => {
    mount();
    for (const name of ['Accedi', 'Registrati']) {
      const style = maxWidthStyle(screen.getByRole('link', { name }), 389.95);
      expect(style['padding-left']).toBe('8px');
      expect(style['padding-right']).toBe('8px');
    }
  });

  it('sotto 390 px i controlli di destra stanno più vicini', () => {
    mount();
    const group = screen.getByRole('link', { name: 'Accedi' }).parentElement;
    expect(maxWidthStyle(group, 389.95).gap).toBe('4px');
  });

  it('sotto 360 px la scritta LiftIndex resta solo per chi usa lo screen reader, il nome del link non cambia', () => {
    mount();
    const style = maxWidthStyle(screen.getByText('LiftIndex'), 359.95);
    expect(style.position).toBe('absolute');
    expect(style.width).toBe('1px');
    expect(style.height).toBe('1px');
    expect(style.overflow).toBe('hidden');
    expect(screen.getByRole('link', { name: 'LiftIndex' })).toBeTruthy();
  });
});
