// Riga di un'impostazione: pulsante con il titolo come nome e il valore come descrizione. Colore scritto a mano:
// text.secondary #6b6663.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { describedBy } from '../../test/accessibleNames';
import { ThemeModeProvider } from '../../context/ThemeModeContext';
import ValueRow from './ValueRow';

const GREY = 'rgb(107, 102, 99)';

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
    const title = screen.getByText('Lingua');
    expect(getComputedStyle(title).minWidth).toBe('0px');
    expect(getComputedStyle(title).flexGrow).toBe('1');
    expect(getComputedStyle(screen.getByText('Italiano').parentElement).flexShrink).toBe('0');
  });
});
