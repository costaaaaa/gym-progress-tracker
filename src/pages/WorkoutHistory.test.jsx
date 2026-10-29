// Cronologia allenamenti vista dall'utente: intestazioni dei mesi, riga con azioni (icone su desktop, menu "⋮" su telefono).
// Colori del tema chiaro scritti a mano: text.primary #1a1816, text.secondary #6b6663, rosso del marchio #d50000.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, within, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import WorkoutHistory from './WorkoutHistory';
import { ThemeModeProvider } from '../context/ThemeModeContext';
import { json } from '../test/dom';
import { setBrowserTimeZone } from '../test/timeZone';

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

const originalMatchMedia = window.matchMedia;
// Telefono: le media query "max-width" (breakpoint sotto sm) combaciano, le altre no
const simulaTelefono = () => {
  window.matchMedia = (query) => ({
    matches: query.includes('max-width'), media: query, onchange: null,
    addEventListener: () => {}, removeEventListener: () => {}, addListener: () => {}, removeListener: () => {}, dispatchEvent: () => false,
  });
};

beforeEach(() => {
  setBrowserTimeZone('Europe/Rome');
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
    expect(await screen.findByRole('button', { name: 'Condividi allenamento' })).toBeTruthy();
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
    fireEvent.click(await screen.findByRole('button', { name: 'Altre azioni' }));
    const menu = screen.getByRole('menu');
    expect(within(menu).getAllByRole('menuitem').map((v) => v.textContent)).toEqual(['Condividi allenamento', 'Modifica data', 'Elimina allenamento']);
  });

  it('"Elimina allenamento" dal menu apre la conferma', async () => {
    await mount();
    fireEvent.click(await screen.findByRole('button', { name: 'Altre azioni' }));
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

describe('eliminazione con «Annulla»', () => {
  const eliminazioni = () => fetch.mock.calls.filter(([url, init]) => url.includes('workout_history/delete.php') && !JSON.parse(init.body).preview);
  const RIGA = '02:00 · 3 esercizi';

  // Dopo la conferma i timer dell'app (il conto dei 10 secondi) sono finti, così il test li fa scorrere
  const confermaEliminazione = async () => {
    await mount();
    fireEvent.click(await screen.findByRole('button', { name: 'Elimina allenamento' }));
    await screen.findByText('Conferma eliminazione');
    vi.useFakeTimers({ toFake: ['Date', 'setTimeout', 'clearTimeout'] });
    vi.setSystemTime(new Date(2026, 9, 20, 12, 0));
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Elimina' }));
    await passano(500); // il dialog finisce di chiudersi e il resto della pagina torna accessibile
  };
  const passano = (ms) => act(async () => { vi.advanceTimersByTime(ms); });
  const RESTO = 10000 - 500; // dei 10 secondi dell'«Annulla» ne sono passati 500 mentre il dialog si chiudeva

  it('dopo la conferma la riga sparisce subito, compare «Allenamento eliminato» con «Annulla» e il server non è ancora chiamato', async () => {
    await confermaEliminazione();
    expect(screen.queryByText(RIGA)).toBeNull();
    expect(screen.getByText('Allenamento eliminato')).toBeTruthy();
    expect(within(screen.getByRole('alert')).getByRole('button', { name: 'Annulla' })).toBeTruthy();
    await passano(RESTO - 1);
    expect(eliminazioni()).toHaveLength(0);
  });

  it('allo scadere dei 10 secondi parte la richiesta di eliminazione', async () => {
    await confermaEliminazione();
    await passano(RESTO);
    expect(eliminazioni()).toHaveLength(1);
    expect(JSON.parse(eliminazioni()[0][1].body)).toEqual({ id: 7 });
    expect(screen.queryByText(RIGA)).toBeNull();
  });

  it('«Annulla» riporta la riga in lista e il server non viene mai chiamato', async () => {
    await confermaEliminazione();
    fireEvent.click(within(screen.getByRole('alert')).getByRole('button', { name: 'Annulla' }));
    expect(screen.getByText(RIGA)).toBeTruthy();
    await passano(20000);
    expect(eliminazioni()).toHaveLength(0);
  });

  it('se il server rifiuta, la riga torna in lista e compare l\'errore', async () => {
    vi.stubGlobal('fetch', vi.fn((url, init) => Promise.resolve(
      url.includes('read_plans.php') ? json({ records: [plan] })
        : url.includes('workout_history/read.php') ? json({ records: [workout] })
          : url.includes('workout_history/delete.php') && !JSON.parse(init.body).preview ? json({ message: 'Allenamento bloccato' }, 400)
            : json({ success: true }),
    )));
    await confermaEliminazione();
    await passano(RESTO);
    expect(screen.getByText(RIGA)).toBeTruthy();
    expect(screen.getByText('Allenamento bloccato')).toBeTruthy();
  });

  it('se una richiesta fallisce mentre un\'altra eliminazione aspetta, «Annulla» e l\'errore non si sovrappongono', async () => {
    const altro = { ...workout, id: 8, date: '2026-10-17 02:00:00', exercises: workout.exercises.slice(0, 2) };
    vi.stubGlobal('fetch', vi.fn((url, init) => Promise.resolve(
      url.includes('read_plans.php') ? json({ records: [plan] })
        : url.includes('workout_history/read.php') ? json({ records: [workout, altro] })
          : url.includes('workout_history/delete.php') && !JSON.parse(init.body).preview ? json({ message: 'Allenamento bloccato' }, 400)
            : json({ success: true }),
    )));
    await mount();
    fireEvent.click((await screen.findAllByRole('button', { name: 'Elimina allenamento' }))[0]);
    await screen.findByText('Conferma eliminazione');
    vi.useFakeTimers({ toFake: ['Date', 'setTimeout', 'clearTimeout'] });
    vi.setSystemTime(new Date(2026, 9, 20, 12, 0));
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Elimina' }));
    await passano(500);
    fireEvent.click(screen.getAllByRole('button', { name: 'Elimina allenamento' })[0]);
    await passano(0);
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Elimina' }));
    await passano(500);

    const errore = screen.getByText('Allenamento bloccato').closest('.MuiSnackbar-root');
    const annulla = screen.getByText('Allenamento eliminato').closest('.MuiSnackbar-root');
    expect(getComputedStyle(errore).bottom).not.toBe(getComputedStyle(annulla).bottom);
  });
});

describe('avvisi su Salute del telefono', () => {
  const AVVISO_ELIMINA = 'Questo allenamento è anche nell\'app Salute del telefono e lì resta. Per toglierlo anche da lì, eliminalo dall\'app LiftIndex sul telefono.';
  const serveWorkout = (w) => vi.stubGlobal('fetch', vi.fn((url) => Promise.resolve(
    url.includes('read_plans.php') ? json({ records: [plan] })
      : url.includes('workout_history/read.php') ? json({ records: [w] })
        : json({ success: true }),
  )));

  it('eliminando un allenamento che è in Salute il dialog lo dice', async () => {
    serveWorkout({ ...workout, health_written: true });
    await mount();
    fireEvent.click(await screen.findByRole('button', { name: 'Elimina allenamento' }));
    expect(await screen.findByText(AVVISO_ELIMINA)).toBeTruthy();
  });

  it('eliminando un allenamento che non è in Salute il dialog non ne parla', async () => {
    serveWorkout({ ...workout, health_written: false });
    await mount();
    fireEvent.click(await screen.findByRole('button', { name: 'Elimina allenamento' }));
    await screen.findByText('Conferma eliminazione');
    expect(screen.queryByText(AVVISO_ELIMINA)).toBeNull();
  });
});

describe('data e ora dell\'allenamento: l\'orologio del luogo, non quello del browser', () => {
  const stubRecords = (records) => vi.stubGlobal('fetch', vi.fn((url) => Promise.resolve(
    url.includes('read_plans.php') ? json({ records: [plan] })
      : url.includes('workout_history/read.php') ? json({ records }) : json({ success: true }),
  )));
  const mountWith = async (records, firstText) => {
    stubRecords(records);
    render(<ThemeModeProvider><MemoryRouter><WorkoutHistory isEmbedded /></MemoryRouter></ThemeModeProvider>);
    await screen.findByText(firstText);
  };

  it('un\'ora che nel fuso del browser non esiste (02:30 del cambio ora) resta quella scritta', async () => {
    await mountWith([{ ...workout, id: 1, date: '2026-03-29 02:30:00' }, { ...workout, id: 2, date: '2026-03-08 02:30:00' }], 'Marzo 2026');
    fireEvent.click(screen.getByText('Marzo 2026'));
    expect(screen.getAllByText('02:30 · 3 esercizi')).toHaveLength(2);
  });

  it('allenamento fatto a New York mentre il dispositivo è a Roma: badge accanto all\'orario', async () => {
    await mountWith([{ ...workout, time_zone: 'America/New_York', started_at: '2026-10-18T02:00:00-04:00' }], '02:00 · 3 esercizi');
    expect(screen.getByLabelText('Fuso orario: New York · UTC−4')).toBeTruthy();
    expect(screen.getByText('02:00 · 3 esercizi')).toBeTruthy();
  });

  it('stesso fuso del dispositivo o allenamento senza fuso: nessun badge', async () => {
    setBrowserTimeZone('America/New_York');
    await mountWith([{ ...workout, time_zone: 'America/New_York', started_at: '2026-10-18T02:00:00-04:00' }], '02:00 · 3 esercizi');
    expect(screen.queryByLabelText(/Fuso orario/)).toBeNull();
  });

  it('il testo del badge non scende sotto i 16px', async () => {
    await mountWith([{ ...workout, time_zone: 'America/New_York', started_at: '2026-10-18T02:00:00-04:00' }], '02:00 · 3 esercizi');
    expect(getComputedStyle(screen.getByText('New York · UTC−4')).fontSize).toBe('16px');
  });
});

describe('serie di riscaldamento (#66): visibili ma escluse dal conteggio', () => {
  const stubRecords = (records) => vi.stubGlobal('fetch', vi.fn((url) => Promise.resolve(
    url.includes('read_plans.php') ? json({ records: [plan] })
      : url.includes('workout_history/read.php') ? json({ records }) : json({ success: true }),
  )));

  it('marca la serie di riscaldamento e conta solo le allenanti nel badge "serie"', async () => {
    const withWarmup = {
      ...workout,
      exercises: [
        {
          ...exercise(1, 'Panca piana'),
          sets: [
            { set_number: 1, weight: 20, reps: 10, is_warmup: true },
            { set_number: 2, weight: 60, reps: 8 },
          ],
        },
        exercise(2, 'Croci'),
        exercise(3, 'Dip'),
      ],
    };
    stubRecords([withWarmup]);
    render(<ThemeModeProvider><MemoryRouter><WorkoutHistory isEmbedded /></MemoryRouter></ThemeModeProvider>);
    const riga = (await screen.findByText('02:00 · 3 esercizi')).closest('[aria-expanded]');
    fireEvent.click(riga);
    const pancaBox = screen.getByText('Panca piana').closest('div').parentElement;
    expect(within(pancaBox).getByText('Risc.')).toBeTruthy();
    expect(within(pancaBox).getByText('1 serie')).toBeTruthy();
  });
});
