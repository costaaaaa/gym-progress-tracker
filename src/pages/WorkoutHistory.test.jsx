// Cronologia allenamenti vista dall'utente: intestazioni dei mesi, riga con azioni (icone su desktop, menu "⋮" su telefono).
// Colori del tema chiaro scritti a mano: text.primary #1a1816, text.secondary #6b6663, rosso del marchio #d50000.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import WorkoutHistory from './WorkoutHistory';
import { ThemeModeProvider } from '../context/ThemeModeContext';

vi.mock('../context/AuthContext', () => ({ useAuth: () => ({ isLoggedIn: true, loading: false }) }));

const GREY = 'rgb(107, 102, 99)';
const RED = 'rgb(213, 0, 0)';

const exercise = (id, name) => ({ id, exercise_name: name, muscle_group: 'petto', sets: [{ set_number: 1, weight: 60, reps: 8 }] });
const workout = {
  id: 7,
  date: '2026-10-18 02:00:00',
  duration_seconds: 3600,
  notes: '',
  exercises: [exercise(1, 'Panca piana'), exercise(2, 'Croci'), exercise(3, 'Dip')],
};
const plan = { id: 5, name: 'Push Pull', is_active: true, days: [] };
const json = (data) => ({ ok: true, status: 200, json: async () => data, text: async () => '' });

const originalMatchMedia = window.matchMedia;
// Telefono: le media query "max-width" (breakpoint sotto sm) combaciano, le altre no
const simulaTelefono = () => {
  window.matchMedia = (query) => ({
    matches: query.includes('max-width'), media: query, onchange: null,
    addEventListener: () => {}, removeEventListener: () => {}, addListener: () => {}, removeListener: () => {}, dispatchEvent: () => false,
  });
};

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(2026, 9, 20, 12, 0));
  localStorage.setItem('themeMode', 'light');
  vi.stubGlobal('fetch', vi.fn((url) => Promise.resolve(
    url.includes('read_plans.php') ? json({ records: [plan] })
      : url.includes('workout_history/read.php') ? json({ records: [workout] })
        : json({ success: true }),
  )));
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  window.matchMedia = originalMatchMedia;
});

const mount = async () => {
  render(
    <ThemeModeProvider>
      <MemoryRouter><WorkoutHistory isEmbedded /></MemoryRouter>
    </ThemeModeProvider>,
  );
  await screen.findByText('02:00 · 3 esercizi');
};

describe('intestazioni e testi', () => {
  it('il titolo del mese è nello stile titolo di card, senza sottolineatura rossa', async () => {
    await mount();
    const mese = screen.getByText('Ottobre 2026');
    const style = getComputedStyle(mese);
    expect(style.fontSize).toBe('17px');
    expect(style.fontWeight).toBe('700');
    expect(['', 'none']).toContain(style.borderBottomStyle);
  });

  it('la sottoriga "02:00 · 3 esercizi" è a 16px in text.secondary', async () => {
    await mount();
    const style = getComputedStyle(screen.getByText('02:00 · 3 esercizi'));
    expect(style.fontSize).toBe('16px');
    expect(style.color).toBe(GREY);
  });

  it('nessun testo sotto i 16px', async () => {
    await mount();
    const piccoli = [...document.body.querySelectorAll('*')]
      .filter((el) => !el.closest('.MuiCollapse-hidden'))
      .filter((el) => [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim() !== ''))
      .filter((el) => parseFloat(getComputedStyle(el).fontSize) < 16)
      .map((el) => `${el.textContent} (${getComputedStyle(el).fontSize})`);
    expect(piccoli).toEqual([]);
  });

  it('di rosso resta solo il bottone principale, nessun bordo o sfondo decorativo', async () => {
    await mount();
    const rossi = [...document.body.querySelectorAll('*')].filter((el) => !el.closest('.MuiCollapse-hidden')).filter((el) => {
      const s = getComputedStyle(el);
      return [s.backgroundColor, s.borderTopColor, s.borderBottomColor, s.borderLeftColor, s.borderRightColor].includes(RED);
    });
    expect(rossi.map((el) => el.textContent)).toEqual(['Registra allenamento']);
  });
});

describe('azioni della riga su desktop', () => {
  it('condividi, cambia data ed elimina restano icone; il menu "Altre azioni" non c\'è', async () => {
    await mount();
    expect(screen.getByRole('button', { name: 'Condividi allenamento' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Modifica data' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Elimina allenamento' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Altre azioni' })).toBeNull();
  });
});

describe('azioni della riga su telefono', () => {
  beforeEach(simulaTelefono);

  it('le tre icone lasciano il posto a un menu "Altre azioni" con condividi, cambia data ed elimina', async () => {
    await mount();
    expect(screen.queryByRole('button', { name: 'Condividi allenamento' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Elimina allenamento' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Altre azioni' }));
    const menu = screen.getByRole('menu');
    expect(within(menu).getAllByRole('menuitem').map((v) => v.textContent)).toEqual(['Condividi allenamento', 'Modifica data', 'Elimina allenamento']);
  });

  it('"Elimina allenamento" dal menu apre la conferma', async () => {
    await mount();
    fireEvent.click(screen.getByRole('button', { name: 'Altre azioni' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Elimina allenamento' }));
    expect(await screen.findByText('Conferma eliminazione')).toBeTruthy();
    expect(screen.getByText('Sei sicuro di voler eliminare questo allenamento?')).toBeTruthy();
  });

  it('con un allenamento troppo vecchio "Modifica data" è disabilitata e il menu ne spiega il motivo', async () => {
    const vecchio = { ...workout, date: '2026-08-01 02:00:00' };
    vi.stubGlobal('fetch', vi.fn((url) => Promise.resolve(
      url.includes('read_plans.php') ? json({ records: [plan] })
        : url.includes('workout_history/read.php') ? json({ records: [vecchio] })
          : json({ success: true }),
    )));
    await mount();
    fireEvent.click(screen.getByText('Agosto 2026'));
    fireEvent.click(screen.getByRole('button', { name: 'Altre azioni' }));
    const voce = within(screen.getByRole('menu')).getByRole('menuitem', { name: /Modifica data/ });
    expect(voce.getAttribute('aria-disabled')).toBe('true');
    expect(within(voce).getByText('Si possono spostare solo gli allenamenti degli ultimi 30 giorni')).toBeTruthy();
    const altre = within(screen.getByRole('menu')).getByRole('menuitem', { name: 'Condividi allenamento' });
    expect(altre.textContent).toBe('Condividi allenamento');
  });

  it('toccare la riga ne apre il dettaglio', async () => {
    await mount();
    const riga = screen.getByText('02:00 · 3 esercizi').closest('[aria-expanded]');
    expect(riga.getAttribute('aria-expanded')).toBe('false');
    fireEvent.click(riga);
    expect(riga.getAttribute('aria-expanded')).toBe('true');
  });
});
