// Card "Stato muscolare" vista dall'utente: due blocchi (puoi allenare / a riposo) e la riga dei gruppi senza dati.
// Colori del tema chiaro scritti a mano: recovery.ready #15803d, recovering #b45309, fatigued #7c2d12,
// text.secondary #6b6663.
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import BodyVisualizer from './BodyVisualizer';
import { ThemeModeProvider } from '../context/ThemeModeContext';
import { textBelow } from '../test/minText';
import { setBrowserTimeZone } from '../test/timeZone';

const GREEN = 'rgb(21, 128, 61)';
const AMBER = 'rgb(180, 83, 9)';
const BROWN = 'rgb(124, 45, 18)';
const GREY = 'rgb(107, 102, 99)';

// Oggi: mercoledì 21 ottobre 2026. I ready_at sono istanti con offset di Roma: il giorno dipende dal fuso del browser.
const data = {
  petto: { status: 'PRONTO', percent: 100, ready_at: null },
  glutei: { status: 'PRONTO', percent: 100, ready_at: null },
  schiena: { status: 'IN RECUPERO', percent: 60, ready_at: '2026-10-22T08:00:00+02:00' },
  bicipiti: { status: 'IN RECUPERO', percent: 150, ready_at: '2026-10-21T20:00:00+02:00' },
  quadricipiti: { status: 'AFFATICATO', percent: 20, ready_at: '2026-10-24T08:00:00+02:00' },
  femorali: { status: 'AFFATICATO', percent: 40, ready_at: '2026-10-23T08:00:00+02:00' },
  tricipiti: { status: null },
};

beforeEach(() => {
  setBrowserTimeZone('Europe/Rome');
  localStorage.setItem('themeMode', 'light');
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(2026, 9, 21, 18, 30));
});
afterEach(() => vi.useRealTimers());

const mount = (recoveryData) => render(<ThemeModeProvider><BodyVisualizer recoveryData={recoveryData} /></ThemeModeProvider>);
const block = (name) => screen.getByRole('list', { name });
const row = (name, muscle) => within(block(name)).getByText(muscle).closest('li');
const fill = (name, muscle) => within(row(name, muscle)).getByRole('progressbar').firstElementChild;

describe('card Stato muscolare', () => {
  it('mostra i due blocchi con il titolo e i gruppi giusti, "a riposo" per giorni crescenti', () => {
    mount(data);
    expect(screen.getByText('Stato muscolare')).toBeTruthy();
    expect(within(block('Puoi allenare')).getAllByRole('listitem').map((li) => li.textContent)).toEqual(['PettoPronto', 'GluteiPronto']);
    expect(within(block('A riposo')).getAllByRole('listitem').map((li) => li.textContent)).toEqual([
      'Bicipitipronto oggi', 'Schienapronto domani', 'Femoralipronto tra 2 giorni', 'Quadricipitipronto tra 3 giorni',
    ]);
  });

  it('"Pronto" è verde 600 solo nel primo blocco; nel secondo c\'è la frase del giorno in secondario', () => {
    mount(data);
    const ready = within(row('Puoi allenare', 'Petto')).getByText('Pronto');
    expect(getComputedStyle(ready).color).toBe(GREEN);
    expect(getComputedStyle(ready).fontWeight).toBe('600');

    const when = within(row('A riposo', 'Schiena')).getByText('pronto domani');
    expect(getComputedStyle(when).color).toBe(GREY);
    expect(getComputedStyle(when).fontSize).toBe('13px');
    expect(within(block('A riposo')).queryByText('Pronto')).toBeNull();
  });

  it('la barra è larga quanto la percentuale (al massimo 100) e prende il colore dello stato', () => {
    mount(data);
    expect(getComputedStyle(fill('A riposo', 'Schiena')).width).toBe('60%');
    expect(getComputedStyle(fill('A riposo', 'Bicipiti')).width).toBe('100%');
    expect(getComputedStyle(fill('A riposo', 'Quadricipiti')).width).toBe('20%');
    expect(getComputedStyle(fill('Puoi allenare', 'Petto')).backgroundColor).toBe(GREEN);
    expect(getComputedStyle(fill('A riposo', 'Schiena')).backgroundColor).toBe(AMBER);
    expect(getComputedStyle(fill('A riposo', 'Quadricipiti')).backgroundColor).toBe(BROWN);
  });

  it('elenca in fondo i gruppi senza dati, in secondario', () => {
    mount(data);
    const line = screen.getByText('Nessun dato: Spalle, Tricipiti, Addome, Adduttori, Abduttori, Polpacci');
    expect(getComputedStyle(line).color).toBe(GREY);
    expect(getComputedStyle(line).fontSize).toBe('13px');
  });

  it('tutto pronto: solo "Puoi allenare"', () => {
    mount(Object.fromEntries(
      [
        'petto', 'schiena', 'spalle', 'bicipiti', 'tricipiti', 'addome', 'quadricipiti', 'femorali', 'glutei',
        'adduttori', 'abduttori', 'polpacci',
      ]
        .map((g) => [g, { status: 'PRONTO', percent: 100, ready_at: null }]),
    ));
    expect(screen.getByText('Puoi allenare')).toBeTruthy();
    expect(screen.queryByText('A riposo')).toBeNull();
    expect(screen.queryByText(/Nessun dato/)).toBeNull();
  });

  it('senza dati: nessun blocco, solo la riga dei gruppi senza dati', () => {
    mount(undefined);
    expect(screen.queryByText('Puoi allenare')).toBeNull();
    expect(screen.queryByText('A riposo')).toBeNull();
    expect(screen.getByText(/^Nessun dato: Petto, Schiena/)).toBeTruthy();
  });

  it('nessun testo sotto i 13 px', () => {
    const { container } = mount(data);
    expect(textBelow(container, 13)).toEqual([]);
  });
});
