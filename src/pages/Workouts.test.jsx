// Pagina Allenamenti vista dall'utente: titolo unico sopra i tab, tab attivo in inchiostro, nessun titolo ripetuto sotto.
// Colori del tema chiaro scritti a mano: text.primary #1a1816, text.secondary #6b6663.
import { describe, it, expect, vi, beforeAll, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Workouts from './Workouts';
import { ThemeModeProvider } from '../context/ThemeModeContext';
import { json } from '../test/dom';
import { plannedSets, times } from '../test/plannedSets';

vi.mock('../context/AuthContext', () => ({ useAuth: () => ({ isLoggedIn: true, loading: false }) }));

const INK = 'rgb(26, 24, 22)';
const GREY = 'rgb(107, 102, 99)';

const day = { id: 1, name: 'Push', exercises: [{ id: 11, exercise_name: 'Panca piana', planned_sets: plannedSets(0, times(3, { min: 8, max: 8 })), rest: 90, muscle_group: 'petto' }] };
const plan = { id: 5, name: 'Push Pull', description: 'Spinta e tirata', is_active: true, days: [day] };
const otherPlan = { id: 6, name: 'Full body', description: 'Tre giorni a settimana', is_active: false, days: [day] };

// Le tab sono lazy: il primo import della Cronologia (con i suoi dialoghi) è lento, lo scaldiamo prima dei test
beforeAll(() => import('./WorkoutHistory'), 30000);

beforeEach(() => {
  localStorage.setItem('themeMode', 'light');
  vi.stubGlobal('fetch', vi.fn((url) => Promise.resolve(
    url.includes('read_plans.php') ? json({ records: [plan, otherPlan] }) : json({ records: [] }),
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

const RED = 'rgb(213, 0, 0)';
const isRed = (el) => getComputedStyle(el).backgroundColor === RED;
const fontPx = (el) => parseFloat(getComputedStyle(el).fontSize);
const withOwnText = () => [...document.body.querySelectorAll('*')]
  .filter((el) => [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim() !== ''));

describe('schede', () => {
  it('l\'unico elemento con sfondo rosso del marchio è "Nuova scheda"', async () => {
    await mount();
    const rossi = [...document.body.querySelectorAll('*')].filter(isRed);
    expect(rossi.map((el) => el.textContent)).toEqual(['Nuova scheda']);
  });

  it('il badge "Attiva" è una pillola verde pallida, senza maiuscolo e a 13px o più', async () => {
    await mount();
    const badge = screen.getByText('Attiva');
    const style = getComputedStyle(badge);
    expect(style.backgroundColor).toBe('rgb(232, 243, 236)');
    expect(style.color).toBe('rgb(22, 101, 52)');
    expect(style.textTransform).not.toBe('uppercase');
    expect(fontPx(badge)).toBeGreaterThanOrEqual(13);
  });

  it('"Attiva scheda" è un bottone con bordo, senza riempimento', async () => {
    await mount();
    const style = getComputedStyle(screen.getByRole('button', { name: 'Attiva scheda' }));
    expect(style.backgroundColor).toBe('rgba(0, 0, 0, 0)');
    expect(style.color).toBe(INK);
    expect(style.borderStyle).toBe('solid');
  });

  it('descrizione normale in text.secondary; "Mostra dettagli" in text.secondary', async () => {
    await mount();
    const descrizione = getComputedStyle(screen.getByText('Spinta e tirata'));
    expect(descrizione.fontStyle).not.toBe('italic');
    expect(descrizione.color).toBe(GREY);
    expect(getComputedStyle(screen.getAllByRole('button', { name: 'Mostra dettagli' })[0]).color).toBe(GREY);
  });

  it('card e bottoni a riposo senza ombra né sfumatura', async () => {
    await mount();
    const piatti = [...document.querySelectorAll('.MuiCard-root, .MuiButton-root')];
    expect(piatti.length).toBeGreaterThan(4);
    piatti.forEach((el) => {
      const style = getComputedStyle(el);
      expect(['', 'none']).toContain(style.boxShadow);
      expect(['', 'none']).toContain(style.backgroundImage);
    });
  });

  it('nessun testo sotto i 16px, salvo il badge "Attiva" (13px o più)', async () => {
    await mount();
    const piccoli = withOwnText()
      .filter((el) => fontPx(el) < 16 && !(el.textContent === 'Attiva' && fontPx(el) >= 13))
      .map((el) => `${el.textContent} (${getComputedStyle(el).fontSize})`);
    expect(piccoli).toEqual([]);
  });
});
