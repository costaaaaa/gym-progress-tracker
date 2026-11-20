// Pagina Schede vista dall'utente: titolo di pagina unico, poi le schede (nessuna scheda interna).
// Colori del tema chiaro scritti a mano: text.primary #1a1816, text.secondary #6b6663.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Plans from './Plans';
import { ThemeModeProvider } from '../context/ThemeModeContext';
import { json, expectNoNestedContainer } from '../test/dom';
import { plannedSets, times } from '../test/plannedSets';

vi.mock('../context/AuthContext', () => ({ useAuth: () => ({ isLoggedIn: true, loading: false }) }));

const INK = 'rgb(26, 24, 22)';
const GREY = 'rgb(107, 102, 99)';

const day = { id: 1, name: 'Push', exercises: [{ id: 11, exercise_name: 'Panca piana', planned_sets: plannedSets(0, times(3, { min: 8, max: 8 })), rest: 90, muscle_group: 'petto' }] };
const pullDay = { id: 2, name: 'Pull', exercises: [{ id: 12, exercise_name: 'Trazioni', planned_sets: plannedSets(0, times(3, { min: 8, max: 8 })), rest: 90, muscle_group: 'schiena' }] };
const plan = { id: 5, name: 'Push Pull', description: 'Spinta e tirata', is_active: true, days: [day, pullDay] };
const otherPlan = { id: 6, name: 'Full body', description: 'Tre giorni a settimana', is_active: false, days: [day] };

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
      <MemoryRouter initialEntries={['/schede']}><Plans /></MemoryRouter>
    </ThemeModeProvider>,
  );
  await screen.findByText('Push Pull');
};

describe('pagina Schede', () => {
  it('Layout ha già il Container: la pagina non ne apre un secondo', async () => {
    await mount();
    expectNoNestedContainer();
  });

  it('un solo h1 "Schede" nello stile titolo di pagina, senza schede interne', async () => {
    await mount();
    const h1s = screen.getAllByRole('heading', { level: 1 });
    expect(h1s.map((h) => h.textContent)).toEqual(['Schede']);
    const style = getComputedStyle(h1s[0]);
    expect(style.fontSize).toBe('28px');
    expect(style.fontWeight).toBe('800');
    expect(screen.queryByRole('tablist')).toBeNull();
    expect(screen.queryByRole('tab')).toBeNull();
  });

  it('il titolo della pagina non si ripete sotto, e l\'elenco delle schede è quello di prima', async () => {
    await mount();
    expect(screen.getAllByText('Schede')).toHaveLength(1);
    expect(screen.getByText('Full body')).toBeTruthy();
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

  it('descrizione normale in text.secondary; "Mostra giorni" in text.secondary', async () => {
    await mount();
    const descrizione = getComputedStyle(screen.getByText('Spinta e tirata'));
    expect(descrizione.fontStyle).not.toBe('italic');
    expect(descrizione.color).toBe(GREY);
    expect(getComputedStyle(screen.getAllByRole('button', { name: 'Mostra giorni' })[0]).color).toBe(GREY);
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

describe('titolo del documento', () => {
  it('è «Schede | LiftIndex»', async () => {
    await mount();
    expect(document.title).toBe('Schede | LiftIndex');
  });
});
