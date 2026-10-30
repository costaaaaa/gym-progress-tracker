// Card di un esercizio in Progressi: la sparkline segue le date delle sessioni.
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import ExerciseProgressRow from './ExerciseProgressRow';
import { STATUS } from '../utils/progressOverview';
import { polylineX } from '../test/polyline';

const session = (date, value) => ({ id: date, date, value });

const item = (sessions) => ({
  id: 'bench',
  name: 'Panca piana',
  muscle: 'chest',
  status: STATUS.STALLED,
  deltaPct: null,
  last: sessions.at(-1),
  mode: 'oneRM',
  sessions,
  lastDays: 0,
  recentPR: false,
});

const sparklineX = (container) => polylineX(container.querySelector('polyline'));

describe('sparkline', () => {
  it('distanzia le sessioni secondo la data, dalla prima all\'ultima', () => {
    // Giorni 0, 1 e 10 alla stessa ora (con l'ora, come li restituisce read.php)
    const sessions = [
      session('2026-10-01 18:00:00', 80),
      session('2026-10-02 18:00:00', 82),
      session('2026-10-11 18:00:00', 85),
    ];
    const { container } = render(
      <ExerciseProgressRow item={item(sessions)} favorite={false} onToggleFavorite={() => {}} onOpen={() => {}} />,
    );
    expect(sparklineX(container)).toEqual([0, 12, 120]);
  });

  it('due sessioni nello stesso giorno restano distinte, secondo l\'ora', () => {
    // Dalle 10:00 del 1/10 alle 10:00 del 2/10: le 18:00 sono a un terzo
    const sessions = [
      session('2026-10-01 10:00:00', 80),
      session('2026-10-01 18:00:00', 82),
      session('2026-10-02 10:00:00', 85),
    ];
    const { container } = render(
      <ExerciseProgressRow item={item(sessions)} favorite={false} onToggleFavorite={() => {}} onOpen={() => {}} />,
    );
    expect(sparklineX(container)).toEqual([0, 40, 120]);
  });
});

describe('nota "più avanti nella seduta" (#26)', () => {
  const declining = (laterInSession) => ({
    ...item([session('2026-10-01 18:00:00', 100), session('2026-10-08 18:00:00', 90)]),
    status: STATUS.DECLINING,
    deltaPct: -10,
    laterInSession,
  });
  const renderRow = (it) => render(<ExerciseProgressRow item={it} favorite={false} onToggleFavorite={() => {}} onOpen={() => {}} />);

  it('il calo coincide con l\'esercizio fatto più tardi: la nota è una riga a sé, il delta resta com\'era', () => {
    renderRow(declining(true));
    expect(screen.getByText('▼ 10%')).toBeTruthy();
    const note = screen.getByText('più avanti nella seduta');
    expect(note.closest('[data-row-badge]')).toBeNull();
  });

  it('senza il flag resta solo il ▼', () => {
    renderRow(declining(false));
    expect(screen.getByText('▼ 10%')).toBeTruthy();
    expect(screen.queryByText(/seduta/)).toBeNull();
  });
});
