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
      'BicipitiPronto oggi', 'SchienaPronto domani', 'FemoraliPronto tra 2 giorni', 'QuadricipitiPronto tra 3 giorni',
    ]);
  });

  it('"Pronto" è verde 600 solo nel primo blocco; nel secondo c\'è la frase del giorno in secondario', () => {
    mount(data);
    const ready = within(row('Puoi allenare', 'Petto')).getByText('Pronto');
    expect(getComputedStyle(ready).color).toBe(GREEN);
    expect(getComputedStyle(ready).fontWeight).toBe('600');

    const when = within(row('A riposo', 'Schiena')).getByText('Pronto domani');
    expect(getComputedStyle(when).color).toBe(GREY);
    expect(getComputedStyle(when).fontSize).toBe('13px');
    expect(within(block('A riposo')).queryByText('Pronto')).toBeNull();
  });

  it('la frase "Pronto tra N giorni" va a capo, non è troncata con i puntini (1.4.12)', () => {
    mount(data);
    const { whiteSpace, textOverflow } = getComputedStyle(within(row('A riposo', 'Femorali')).getByText('Pronto tra 2 giorni'));
    expect(whiteSpace).not.toBe('nowrap');
    expect(textOverflow).not.toBe('ellipsis');
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

// Piano Gratis (detail "basic"): il server manda solo PRONTO / IN RECUPERO e last_trained, senza percent né ready_at.
describe('card Stato muscolare con detail "basic"', () => {
  const basic = {
    petto: { status: 'PRONTO', last_trained: '2026-10-18 10:00:00' },
    glutei: { status: 'PRONTO', last_trained: null },
    schiena: { status: 'IN RECUPERO', last_trained: '2026-10-20 10:00:00' },
    bicipiti: { status: 'IN RECUPERO', last_trained: '2026-10-21 10:00:00' },
  };
  const mountBasic = (recoveryData = basic) => render(
    <ThemeModeProvider><BodyVisualizer recoveryData={recoveryData} detail="basic" /></ThemeModeProvider>,
  );

  it('due soli stati, "Puoi allenare" e "In recupero", senza barre né giorni mancanti', () => {
    mountBasic();
    expect(within(block('Puoi allenare')).getAllByRole('listitem').map((li) => li.textContent)).toEqual(['Petto']);
    expect(within(block('In recupero')).getAllByRole('listitem').map((li) => li.textContent)).toEqual(['Schiena', 'Bicipiti']);
    expect(screen.queryByRole('progressbar')).toBeNull();
    expect(screen.queryByText(/pronto (oggi|domani|tra)/i)).toBeNull();
    expect(screen.queryByText('A riposo')).toBeNull();
  });

  it('in cima la riga con lucchetto che porta ai piani; i mai allenati restano fra i senza dati', () => {
    mountBasic();
    expect(screen.getByText('Percentuale di recupero e giorni mancanti')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Confronta i piani' }).getAttribute('href')).toBe('/piani');
    expect(screen.getByText(/^Nessun dato: .*Glutei/)).toBeTruthy();
  });

  it('con detail "full" (o senza) niente riga con lucchetto', () => {
    mount(data);
    expect(screen.queryByText('Percentuale di recupero e giorni mancanti')).toBeNull();
    expect(screen.queryByRole('link', { name: 'Confronta i piani' })).toBeNull();
  });
});
