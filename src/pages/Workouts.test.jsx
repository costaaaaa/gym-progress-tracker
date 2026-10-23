// Pagina Allenamenti vista dall'utente: titolo unico sopra i tab, tab attivo in inchiostro, nessun titolo ripetuto sotto.
// Colori del tema chiaro scritti a mano: text.primary #1a1816, text.secondary #6b6663.
import { describe, it, expect, vi, beforeAll, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Workouts from './Workouts';
import { ThemeModeProvider } from '../context/ThemeModeContext';

vi.mock('../context/AuthContext', () => ({ useAuth: () => ({ isLoggedIn: true, loading: false }) }));

const INK = 'rgb(26, 24, 22)';
const GREY = 'rgb(107, 102, 99)';

const plan = { id: 5, name: 'Push Pull', description: 'Spinta e tirata', is_active: true, days: [] };
const json = (data) => ({ ok: true, status: 200, json: async () => data, text: async () => '' });

// Le tab sono lazy: il primo import della Cronologia (con i suoi dialoghi) è lento, lo scaldiamo prima dei test
beforeAll(() => import('./WorkoutHistory'), 30000);

beforeEach(() => {
  localStorage.setItem('themeMode', 'light');
  vi.stubGlobal('fetch', vi.fn((url) => Promise.resolve(
    url.includes('read_plans.php') ? json({ records: [plan] }) : json({ records: [] }),
  )));
});
afterEach(() => vi.unstubAllGlobals());

const mount = async () => {
  render(
    <ThemeModeProvider>
      <MemoryRouter initialEntries={['/workouts']}><Workouts /></MemoryRouter>
    </ThemeModeProvider>,
  );
  await screen.findByText('Push Pull');
};

describe('shell di Allenamenti', () => {
  it('un solo h1 "Allenamenti" nello stile titolo di pagina, sopra i tab', async () => {
    await mount();
    const h1s = screen.getAllByRole('heading', { level: 1 });
    expect(h1s.map((h) => h.textContent)).toEqual(['Allenamenti']);
    const style = getComputedStyle(h1s[0]);
    expect(style.fontSize).toBe('28px');
    expect(style.fontWeight).toBe('800');
    expect(h1s[0].compareDocumentPosition(screen.getByRole('tablist')) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('il titolo della tab non si ripete sotto i tab, né per le schede né per la cronologia', async () => {
    await mount();
    expect(screen.getAllByText('Le tue schede')).toHaveLength(1);
    fireEvent.click(screen.getByRole('tab', { name: 'Cronologia' }));
    await screen.findByText('Nessun allenamento registrato');
    expect(screen.queryByText('Cronologia allenamenti')).toBeNull();
    expect(screen.getAllByText('Cronologia')).toHaveLength(1);
  });

  it('la tab attiva è in inchiostro con indicatore da 2px e icona grigia, senza rosso', async () => {
    await mount();
    const tab = screen.getByRole('tab', { name: 'Le tue schede' });
    expect(tab.getAttribute('aria-selected')).toBe('true');
    expect(getComputedStyle(tab).color).toBe(INK);
    expect(getComputedStyle(tab).fontWeight).toBe('600');
    const indicator = document.querySelector('.MuiTabs-indicator');
    expect(getComputedStyle(indicator).backgroundColor).toBe(INK);
    expect(getComputedStyle(indicator).height).toBe('2px');
    expect(getComputedStyle(tab.querySelector('svg')).color).toBe(GREY);
  });
});
