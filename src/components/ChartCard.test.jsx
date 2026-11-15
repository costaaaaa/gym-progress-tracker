// Tabella dei punti del grafico: due misure nello stesso giorno sono due righe distinte, senza chiavi duplicate.
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import ChartCard from './ChartCard';

afterEach(() => vi.restoreAllMocks());

describe('ChartCard, tabella', () => {
  it('due misure dello stesso giorno restano due righe e React non segnala chiavi duplicate', () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    render(
      <ChartCard
        title="Peso"
        points={[{ x: 1, value: 80 }, { x: 1, value: 81 }]}
        domain={[0, 2]}
        valueLabel="81 kg"
        ariaLabel="Peso"
        table={{ head: ['Data', 'Peso'], rows: [['1 ott', '80 kg'], ['1 ott', '81 kg']] }}
      />,
    );
    expect(screen.getAllByRole('row', { hidden: true })).toHaveLength(3);
    expect(error.mock.calls.flat().join(' ')).not.toMatch(/same key/);
  });
});
