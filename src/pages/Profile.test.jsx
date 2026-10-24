// Pagina Profilo vista dall'utente: titolo unico sopra i tab, tab attivo in inchiostro come in Dashboard.
// Colori del tema chiaro scritti a mano: text.primary #1a1816, text.secondary #6b6663.
import { describe, it, expect, vi, beforeAll, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Profile from './Profile';
import { ThemeModeProvider } from '../context/ThemeModeContext';

vi.mock('../context/AuthContext', () => ({ useAuth: () => ({ isLoggedIn: true, loading: false }) }));

const INK = 'rgb(26, 24, 22)';
const GREY = 'rgb(107, 102, 99)';
const profile = {
  success: true, level: 7, total_xp: 3140, xp_into_level: 340, xp_for_next_level: 600,
  lifetime_volume_kg: 1000, total_sessions: 3, longest_streak: 1, exercises: [], achievements: [],
};

// Le tab sono lazy: scaldiamo il primo import prima dei test
beforeAll(() => import('./ProfileSummary'), 30000);

beforeEach(() => {
  localStorage.setItem('themeMode', 'light');
  vi.stubGlobal('fetch', vi.fn(() => Promise.resolve({ ok: true, status: 200, json: async () => profile, text: async () => '' })));
});
afterEach(() => vi.unstubAllGlobals());

const mount = async () => {
  render(
    <ThemeModeProvider>
      <MemoryRouter initialEntries={['/profile']}><Profile /></MemoryRouter>
    </ThemeModeProvider>,
  );
  await screen.findByText('Livello 7');
};

describe('shell di Profilo', () => {
  it('un solo h1 "Profilo" nello stile titolo di pagina, sopra i tab', async () => {
    await mount();
    const h1s = screen.getAllByRole('heading', { level: 1 });
    expect(h1s.map((h) => h.textContent)).toEqual(['Profilo']);
    const style = getComputedStyle(h1s[0]);
    expect(style.fontSize).toBe('28px');
    expect(style.fontWeight).toBe('800');
    expect(h1s[0].compareDocumentPosition(screen.getByRole('tablist')) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('la tab attiva è in inchiostro con indicatore da 2px e icona grigia, senza rosso', async () => {
    await mount();
    const tab = screen.getAllByRole('tab')[0];
    expect(tab.getAttribute('aria-selected')).toBe('true');
    expect(getComputedStyle(tab).color).toBe(INK);
    expect(getComputedStyle(tab).fontWeight).toBe('600');
    expect(getComputedStyle(tab).fontSize).toBe('16px');
    const indicator = document.querySelector('.MuiTabs-indicator');
    expect(getComputedStyle(indicator).backgroundColor).toBe(INK);
    expect(getComputedStyle(indicator).height).toBe('2px');
    expect(getComputedStyle(tab.querySelector('svg')).color).toBe(GREY);
  });

  it('sul telefono le due tab si dividono la riga e le etichette si leggono intere, senza scroll', async () => {
    await mount();
    // jsdom non valuta le media query: lo stile letto qui è quello da telefono, il primo
    expect(document.querySelector('.MuiTabs-scrollableX')).toBeNull();
    const tabs = screen.getAllByRole('tab');
    expect(tabs).toHaveLength(2);
    tabs.forEach((tab) => {
      const style = getComputedStyle(tab);
      expect(style.flexGrow).toBe('1');
      expect(style.flexShrink).toBe('1');
      expect(style.minWidth).toBe('0px');
      expect(style.whiteSpace).not.toBe('nowrap');
      expect(style.textOverflow).not.toBe('ellipsis');
      expect(getComputedStyle(tab.querySelector('.MuiTab-iconWrapper')).display).toBe('none');
    });
  });
});
