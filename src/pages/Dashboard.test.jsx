// Pagina Dashboard vista dall'utente: titolo unico sopra i tab, tab attivo in inchiostro come in Allenamenti.
// Colori del tema chiaro scritti a mano: text.primary #1a1816, text.secondary #6b6663.
import { describe, it, expect, vi, beforeAll, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Dashboard from './Dashboard';
import { ThemeModeProvider } from '../context/ThemeModeContext';
import { json } from '../test/dom';

vi.mock('../context/AuthContext', () => ({ useAuth: () => ({ isLoggedIn: true, loading: false }) }));

const INK = 'rgb(26, 24, 22)';
const GREY = 'rgb(107, 102, 99)';

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
    const tab = screen.getByRole('tab', { name: 'Esercizi' });
    expect(tab.getAttribute('aria-selected')).toBe('true');
    expect(getComputedStyle(tab).color).toBe(INK);
    expect(getComputedStyle(tab).fontWeight).toBe('600');
    expect(getComputedStyle(tab).fontSize).toBe('16px');
    const indicator = document.querySelector('.MuiTabs-indicator');
    expect(getComputedStyle(indicator).backgroundColor).toBe(INK);
    expect(getComputedStyle(indicator).height).toBe('2px');
    expect(getComputedStyle(tab.querySelector('svg')).color).toBe(GREY);
  });

  it('sul telefono le tre tab si dividono la riga e le etichette si leggono intere, senza scroll', async () => {
    await mount();
    // jsdom non valuta le media query: lo stile letto qui è quello da telefono, il primo
    expect(document.querySelector('.MuiTabs-scrollableX')).toBeNull();
    const tabs = screen.getAllByRole('tab');
    expect(tabs).toHaveLength(3);
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

  it('le tre tab hanno etichette corte, uguali su ogni larghezza: Esercizi · Muscoli · Misure', async () => {
    await mount();
    expect(screen.getAllByRole('tab').map((tab) => tab.textContent)).toEqual(['Esercizi', 'Muscoli', 'Misure']);
  });
});

describe('tab Muscoli', () => {
  const dashboardStats = {
    success: true,
    weekly_sets: {
      week: { petto: 3, schiena: 0, spalle: 0, bicipiti: 0, tricipiti: 0, addome: 0, quadricipiti: 0, femorali: 0, glutei: 0, adduttori: 0, abduttori: 0, polpacci: 0 },
      previous_to_date: { petto: 1, schiena: 0, spalle: 0, bicipiti: 0, tricipiti: 0, addome: 0, quadricipiti: 0, femorali: 0, glutei: 0, adduttori: 0, abduttori: 0, polpacci: 0 },
      previous_total: 2,
    },
    recovery: {},
  };

  it('?tab=muscles apre la scheda Muscoli, selezionata e con i suoi dati', async () => {
    vi.stubGlobal('fetch', vi.fn((url) => Promise.resolve(
      json(String(url).includes('workout_stats/dashboard.php') ? dashboardStats : { records: [] }),
    )));
    render(
      <ThemeModeProvider>
        <MemoryRouter initialEntries={['/dashboard?tab=muscles']}><Dashboard /></MemoryRouter>
      </ThemeModeProvider>,
    );
    const tab = await screen.findByRole('tab', { name: 'Muscoli' });
    expect(tab.getAttribute('aria-selected')).toBe('true');
    await screen.findByText(/serie allenanti/); // la scheda Muscoli ha caricato i suoi dati
    expect(screen.getByText('Petto').closest('li').textContent).toContain('3');
  });
});
