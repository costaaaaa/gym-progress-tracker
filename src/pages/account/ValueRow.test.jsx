// Riga di un'impostazione: pulsante con il titolo come nome e il valore come descrizione. Colori scritti a mano:
// text.secondary #6b6663, warning.text #a85007.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { describedBy } from '../../test/accessibleNames';
import { ThemeModeProvider } from '../../context/ThemeModeContext';
import ValueRow from './ValueRow';

const GREY = 'rgb(107, 102, 99)';
const AMBER = 'rgb(168, 80, 7)';

beforeEach(() => localStorage.setItem('themeMode', 'light'));

const show = (props = {}) => render(<ThemeModeProvider><ValueRow title="Lingua" value="Italiano" onClick={() => {}} {...props} /></ThemeModeProvider>);

describe('ValueRow', () => {
  it('è un pulsante vero che apre una finestra: nome = titolo, descrizione = valore', () => {
    show();
    const row = screen.getByRole('button', { name: 'Lingua' });
    expect(row.tagName).toBe('BUTTON');
    expect(row.getAttribute('type')).toBe('button');
    expect(row.getAttribute('aria-haspopup')).toBe('dialog');
    expect(describedBy(row)).toBe('Italiano');
  });

  it('il clic chiama onClick', () => {
    const onClick = vi.fn();
    show({ onClick });
    fireEvent.click(screen.getByRole('button', { name: 'Lingua' }));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('area toccabile alta almeno 56 px, valore a 16 px grigio su una riga sola, freccia decorativa', () => {
    show();
    const row = screen.getByRole('button', { name: 'Lingua' });
    expect(parseInt(getComputedStyle(row).minHeight, 10)).toBeGreaterThanOrEqual(56);
    const value = screen.getByText('Italiano');
    expect(getComputedStyle(value).fontSize).toBe('16px');
    expect(getComputedStyle(value).color).toBe(GREY);
    expect(getComputedStyle(value).whiteSpace).toBe('nowrap');
    const chevron = row.querySelector('svg[data-testid="ChevronRightIcon"]');
    expect(chevron.getAttribute('aria-hidden')).toBe('true');
  });

  it('se lo spazio non basta va a capo il titolo: ha lo spazio che resta e può restringersi, il valore no', () => {
    show();
    // il titolo sta nella colonna a sinistra, che prende lo spazio che resta
    const column = screen.getByText('Lingua').parentElement;
    expect(getComputedStyle(column).minWidth).toBe('0px');
    expect(getComputedStyle(column).flexGrow).toBe('1');
    expect(getComputedStyle(screen.getByText('Italiano').parentElement).flexShrink).toBe('0');
  });

  it('con valueColor il valore ha quel colore al posto del grigio', () => {
    show({ value: 'Da confermare', valueColor: 'warning.text' });
    expect(getComputedStyle(screen.getByText('Da confermare')).color).toBe(AMBER);
  });

  describe('con una seconda riga (detail)', () => {
    it('sta sotto il titolo, a 16 px grigia, va a capo anche se lunga; il nome resta il titolo, la descrizione è seconda riga e valore', () => {
      show({ title: 'Email', detail: 'atleta.con.un.indirizzo.molto.lungo@example.com', value: 'Confermata' });
      const row = screen.getByRole('button', { name: 'Email' });
      expect(describedBy(row)).toBe('atleta.con.un.indirizzo.molto.lungo@example.com Confermata');
      const detail = screen.getByText('atleta.con.un.indirizzo.molto.lungo@example.com');
      const title = screen.getByText('Email');
      expect(title.parentElement).toBe(detail.parentElement);
      expect(title.compareDocumentPosition(detail) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
      const style = getComputedStyle(detail);
      expect({ size: style.fontSize, color: style.color, wrap: style.overflowWrap }).toEqual({ size: '16px', color: GREY, wrap: 'anywhere' });
    });

    it('senza valore la descrizione è la sola seconda riga', () => {
      show({ title: 'Email', detail: 'mario@example.com', value: undefined });
      expect(describedBy(screen.getByRole('button', { name: 'Email' }))).toBe('mario@example.com');
    });
  });

  it('senza detail la descrizione è il solo valore', () => {
    show({ title: 'Lingua', value: 'Italiano' });
    expect(describedBy(screen.getByRole('button', { name: 'Lingua' }))).toBe('Italiano');
  });
});
