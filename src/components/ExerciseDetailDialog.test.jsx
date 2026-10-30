// Dettaglio esercizio: la cronologia mostra il giorno scritto e il badge del fuso per le sessioni fatte altrove.
import { createContext, useContext, cloneElement } from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, within, fireEvent } from '@testing-library/react';
import i18n from '../i18n';
import ExerciseDetailDialog from './ExerciseDetailDialog';
import { setBrowserTimeZone } from '../test/timeZone';

// jsdom non misura nulla e Recharts non disegna: grafico e tooltip si ricostruiscono dai dati del
// LineChart, col tooltip aperto sull'ultimo punto
const ChartData = createContext([]);
vi.mock('recharts', () => ({
  ResponsiveContainer: ({ children }) => children,
  LineChart: ({ data, children }) => <ChartData.Provider value={data}>{children}</ChartData.Provider>,
  Tooltip: ({ content }) => {
    const data = useContext(ChartData);
    return <div data-testid="tooltip">{cloneElement(content, { active: true, payload: [{ payload: data.at(-1) }] })}</div>;
  },
  Line: () => null, XAxis: () => null, YAxis: () => null, CartesianGrid: () => null,
}));

const session = (id, date, extra = {}) => ({ id, date, value: 100, volume: 800, bestSet: { weight: 100, reps: 8 }, isPR: false, ...extra });
const item = (sessions) => ({
  id: 'squat', name: 'Squat', muscle: 'legs', mode: 'e1rm', best: 100, last: { value: 100 }, skipped: 0, sessions,
});

beforeEach(() => setBrowserTimeZone('Europe/Rome'));

describe('ExerciseDetailDialog: fuso nella cronologia', () => {
  it('una sessione fatta a New York mostra il giorno scritto e il badge', () => {
    render(<ExerciseDetailDialog item={item([
      session(1, '2026-10-18 02:00:00', { started_at: '2026-10-18T02:00:00-04:00', time_zone: 'America/New_York' }),
    ])} onClose={() => {}} />);
    const row = screen.getByText('18/10/2026', { selector: 'td' }).closest('tr');
    expect(within(row).getByText('New York · UTC−4')).toBeTruthy();
  });
  it('il badge non è sotto i 12px del testo delle celle sul telefono', () => {
    render(<ExerciseDetailDialog item={item([
      session(1, '2026-10-18 02:00:00', { started_at: '2026-10-18T02:00:00-04:00', time_zone: 'America/New_York' }),
    ])} onClose={() => {}} />);
    const row = screen.getByText('18/10/2026', { selector: 'td' }).closest('tr');
    const badge = within(row).getByText('New York · UTC−4').closest('.MuiChip-root');
    expect(parseFloat(getComputedStyle(badge).fontSize)).toBeGreaterThanOrEqual(12);
  });
  it('una sessione nel fuso del dispositivo non ha il badge', () => {
    render(<ExerciseDetailDialog item={item([
      session(1, '2026-10-18 02:00:00', { started_at: '2026-10-18T02:00:00+02:00', time_zone: 'Europe/Rome' }),
    ])} onClose={() => {}} />);
    expect(screen.queryByText(/UTC/)).toBeNull();
  });
});

const fireShowAll = () => fireEvent.click(screen.getByRole('button', { name: /Show all|Mostra tutti/ }));

describe('ExerciseDetailDialog: posizione dell\'esercizio nella seduta (#26)', () => {
  const rowOf = (date) => screen.getByText(date, { selector: 'td' }).closest('tr');

  it('le sessioni con la posizione mostrano "1° esercizio" sotto la data, le altre niente', () => {
    render(<ExerciseDetailDialog item={item([
      session(1, '2026-10-18 10:00:00', { position: null }),
      session(2, '2026-10-20 10:00:00', { position: 1 }),
      session(3, '2026-10-22 10:00:00', { position: 3 }),
    ])} onClose={() => {}} />);
    expect(within(rowOf('20/10/2026')).getByText('1° esercizio')).toBeTruthy();
    expect(within(rowOf('22/10/2026')).getByText('3° esercizio')).toBeTruthy();
    expect(within(rowOf('18/10/2026')).queryByText(/esercizio/)).toBeNull();
  });

  it('senza nessuna posizione non c\'è nessuna etichetta né legenda', () => {
    render(<ExerciseDetailDialog item={item([
      session(1, '2026-10-18 10:00:00', { position: null }),
      session(2, '2026-10-20 10:00:00'),
    ])} onClose={() => {}} />);
    expect(screen.queryByText(/esercizio/i, { selector: 'td *, td' })).toBeNull();
    expect(screen.queryByText(/posizione|seduta/i)).toBeNull();
  });

  it('sta accanto al badge del fuso, non al posto suo', () => {
    render(<ExerciseDetailDialog item={item([
      session(1, '2026-10-18 02:00:00', { position: 2, started_at: '2026-10-18T02:00:00-04:00', time_zone: 'America/New_York' }),
    ])} onClose={() => {}} />);
    const row = rowOf('18/10/2026');
    expect(within(row).getByText('New York · UTC−4')).toBeTruthy();
    expect(within(row).getByText('2° esercizio')).toBeTruthy();
  });

  it('il tooltip del grafico la mostra, se la sessione ce l\'ha', () => {
    render(<ExerciseDetailDialog item={item([session(1, '2026-10-18 10:00:00', { position: 2 })])} onClose={() => {}} />);
    expect(within(screen.getByTestId('tooltip')).getByText('2° esercizio')).toBeTruthy();
  });

  it('il tooltip non ha nulla per una sessione senza posizione', () => {
    render(<ExerciseDetailDialog item={item([session(1, '2026-10-18 10:00:00', { position: null })])} onClose={() => {}} />);
    expect(within(screen.getByTestId('tooltip')).queryByText(/esercizio/)).toBeNull();
  });

  it('in inglese gli ordinali sono 1st, 2nd, 3rd, 4th, 11th, 12th, 13th, 21st', async () => {
    await i18n.changeLanguage('en');
    const positions = [1, 2, 3, 4, 11, 12, 13, 21];
    render(<ExerciseDetailDialog item={item(positions.map((position, i) => (
      session(i + 1, `2026-10-${10 + i} 10:00:00`, { position })
    )))} onClose={() => {}} />);
    fireShowAll();
    ['1st', '2nd', '3rd', '4th', '11th', '12th', '13th', '21st'].forEach((label) => {
      expect(screen.getAllByText(`${label} exercise`).length).toBeGreaterThan(0);
    });
  });
});
