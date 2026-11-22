// Il grafico di un esercizio: tooltip (data, posizione, valore nell'unità dell'utente) e punti dei record.
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import i18n from '../../i18n';
import { ChartTooltip, PRDot } from './ExerciseChart';
import { textBelow } from '../../test/minText';

// Recharts passa al tooltip { active, payload: [{ payload: punto del grafico }] }
const renderTooltip = (point, props = {}) => render(<ChartTooltip active payload={[{ payload: point }]} mode="oneRM" t={i18n.t.bind(i18n)} {...props} />);

describe('ChartTooltip', () => {
  it('mostra la posizione, se la sessione ce l\'ha', () => {
    renderTooltip({ dateLabel: '18/10/2026', value: 100, isPR: false, position: 2 });
    expect(screen.getByText('18/10/2026')).toBeTruthy();
    expect(screen.getByText('2° esercizio')).toBeTruthy();
  });

  it('non ha nulla per una sessione senza posizione', () => {
    renderTooltip({ dateLabel: '18/10/2026', value: 100, isPR: false, position: null });
    expect(screen.getByText('18/10/2026')).toBeTruthy();
    expect(screen.queryByText(/esercizio/)).toBeNull();
  });

  it('mostra il valore (in kg) nell\'unità dell\'utente', () => {
    renderTooltip({ dateLabel: '18/10/2026', value: 100, isPR: false }, { weightUnit: 'lb' });
    expect(screen.getByText('220,5 lb')).toBeTruthy();
  });

  it('segna il record, e nessun testo è sotto i 16px', () => {
    const { container } = renderTooltip({ dateLabel: '18/10/2026', value: 100, isPR: true, position: 1 });
    expect(screen.getByText(/· PR/)).toBeTruthy();
    expect(textBelow(container, 16)).toEqual([]);
  });

  it('inattivo o senza punti non disegna nulla', () => {
    const { container } = render(<ChartTooltip active={false} payload={[]} mode="oneRM" t={i18n.t.bind(i18n)} />);
    expect(container.firstChild).toBeNull();
  });
});

describe('PRDot', () => {
  const dot = (props) => render(<svg><PRDot color="#111" dotOutline="#fff" {...props} /></svg>).container.querySelector('circle');

  it('il record è un punto grande con il contorno, gli altri sono piccoli', () => {
    const record = dot({ cx: 10, cy: 20, payload: { isPR: true } });
    expect(record.getAttribute('r')).toBe('6');
    expect(record.getAttribute('stroke')).toBe('#fff');
    expect(dot({ cx: 10, cy: 20, payload: { isPR: false } }).getAttribute('r')).toBe('3');
  });

  it('senza coordinate non disegna nulla', () => {
    expect(dot({ payload: { isPR: true } })).toBeNull();
  });
});
