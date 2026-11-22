// Riga di un esercizio in Progressi: collegamento alla sua pagina, la sparkline segue le date delle sessioni.
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import ExerciseProgressRow from './ExerciseProgressRow';
import { STATUS } from '../../utils/progressOverview';
import { polylineX } from '../../test/polyline';

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

// La riga è un collegamento: serve un router
const wrapper = ({ children }) => <MemoryRouter><ul>{children}</ul></MemoryRouter>;

const sparklineX = (container) => polylineX(container.querySelector('polyline'));

describe('collegamento e stella', () => {
  it('la riga è un elemento di elenco con un collegamento a /progressi/esercizi/<id>, e la stella è un pulsante a parte', () => {
    const onToggle = vi.fn();
    render(<ExerciseProgressRow item={item([session('2026-10-01 18:00:00', 80), session('2026-10-08 18:00:00', 90)])} favorite={false} onToggleFavorite={onToggle} />, { wrapper });
    const link = screen.getByRole('link');
    expect(link.getAttribute('href')).toBe('/progressi/esercizi/bench');
    expect(screen.getByRole('listitem')).toBeTruthy();
    const star = screen.getByRole('button', { name: 'Aggiungi ai preferiti' });
    expect(link.contains(star)).toBe(false);
    fireEvent.click(star);
    expect(onToggle).toHaveBeenCalledWith('bench');
  });
});

describe('sparkline', () => {
  it('distanzia le sessioni secondo la data, dalla prima all\'ultima', () => {
    // Giorni 0, 1 e 10 alla stessa ora (con l'ora, come li restituisce read.php)
    const sessions = [
      session('2026-10-01 18:00:00', 80),
      session('2026-10-02 18:00:00', 82),
      session('2026-10-11 18:00:00', 85),
    ];
    const { container } = render(
      <ExerciseProgressRow item={item(sessions)} favorite={false} onToggleFavorite={() => {}} />,
      { wrapper },
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
      <ExerciseProgressRow item={item(sessions)} favorite={false} onToggleFavorite={() => {}} />,
      { wrapper },
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
  const renderRow = (it) => render(<ExerciseProgressRow item={it} favorite={false} onToggleFavorite={() => {}} />, { wrapper });

  it('il calo coincide con l\'esercizio fatto più tardi: la nota è una riga a sé, il delta resta com\'era', () => {
    renderRow(declining(true));
    expect(screen.getByText('▼ 10%')).toBeTruthy();
    const note = screen.getByText('più avanti nella seduta');
    // sta nel collegamento, accanto al blocco del valore, non dentro la riga della variazione
    expect(note.parentElement).toBe(screen.getByRole('link'));
  });

  it('senza il flag resta solo il ▼', () => {
    renderRow(declining(false));
    expect(screen.getByText('▼ 10%')).toBeTruthy();
    expect(screen.queryByText(/seduta/)).toBeNull();
  });
});

describe('unità di peso', () => {
  it('la riga mostra il valore nell\'unità passata', () => {
    const sessions = [session('2026-10-01 18:00:00', 80), session('2026-10-08 18:00:00', 100)];
    render(<ExerciseProgressRow item={item(sessions)} weightUnit="lb" favorite={false} onToggleFavorite={() => {}} />, { wrapper });
    expect(screen.getByText('220,5 lb')).toBeTruthy();
    expect(screen.queryByText(/kg/)).toBeNull();
  });
});
