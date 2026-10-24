// Pagina Dashboard vista dall'utente: titolo unico sopra i tab, tab attivo in inchiostro come in Allenamenti.
// Colori del tema chiaro scritti a mano: text.primary #1a1816, text.secondary #6b6663.
import { describe, it, expect, vi, beforeAll, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Dashboard from './Dashboard';
import { ThemeModeProvider } from '../context/ThemeModeContext';

vi.mock('../context/AuthContext', () => ({ useAuth: () => ({ isLoggedIn: true, loading: false }) }));

const INK = 'rgb(26, 24, 22)';
const GREY = 'rgb(107, 102, 99)';
const json = (data) => ({ ok: true, status: 200, json: async () => data, text: async () => '' });

// Le tab sono lazy: il primo import di Progressi (con grafici e dialoghi) è lento, lo scaldiamo prima dei test
beforeAll(() => import('./Progress'), 30000);

beforeEach(() => {
  localStorage.setItem('themeMode', 'light');
  vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(json({ records: [] }))));
});
afterEach(() => vi.unstubAllGlobals());

const mount = async () => {
  render(
    <ThemeModeProvider>
      <MemoryRouter initialEntries={['/dashboard']}><Dashboard /></MemoryRouter>
    </ThemeModeProvider>,
  );
  await screen.findByText(/Nessun dato di allenamento/);
};

describe('shell di Dashboard', () => {
  it('un solo h1 "Dashboard" nello stile titolo di pagina, sopra i tab', async () => {
    await mount();
    const h1s = screen.getAllByRole('heading', { level: 1 });
    expect(h1s.map((h) => h.textContent)).toEqual(['Dashboard']);
    const style = getComputedStyle(h1s[0]);
    expect(style.fontSize).toBe('28px');
    expect(style.fontWeight).toBe('800');
    expect(h1s[0].compareDocumentPosition(screen.getByRole('tablist')) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('la tab attiva è in inchiostro con indicatore da 2px e icona grigia, senza rosso', async () => {
    await mount();
    const tab = screen.getByRole('tab', { name: 'Progressi workout' });
    expect(tab.getAttribute('aria-selected')).toBe('true');
    expect(getComputedStyle(tab).color).toBe(INK);
    expect(getComputedStyle(tab).fontWeight).toBe('600');
    expect(getComputedStyle(tab).fontSize).toBe('16px');
    const indicator = document.querySelector('.MuiTabs-indicator');
    expect(getComputedStyle(indicator).backgroundColor).toBe(INK);
    expect(getComputedStyle(indicator).height).toBe('2px');
    expect(getComputedStyle(tab.querySelector('svg')).color).toBe(GREY);
  });
});
