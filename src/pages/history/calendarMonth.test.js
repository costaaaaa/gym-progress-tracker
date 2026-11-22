// I conti del mese del calendario dello Storico: giorni, celle con la settimana che parte da lunedì, mese precedente e successivo.
import { describe, it, expect } from 'vitest';
import { isDayKey, isMonthKey, monthCells, monthDays, monthOf, shiftMonth } from './calendarMonth';

const blanks = (cells) => cells.filter((cell) => cell === null).length;

describe('monthDays', () => {
  it.each([
    ['2026-11', 30],
    ['2026-10', 31],
    ['2026-02', 28],
    ['2024-02', 29], // bisestile
    ['2100-02', 28], // secolo non bisestile
    ['2000-02', 29], // secolo bisestile
  ])('%s ha %i giorni, dal primo all\'ultimo, scritti YYYY-MM-DD', (month, count) => {
    const days = monthDays(month);
    expect(days).toHaveLength(count);
    expect(days[0]).toBe(`${month}-01`);
    expect(days[count - 1]).toBe(`${month}-${count}`);
    expect(days[8]).toBe(`${month}-09`);
  });
});

describe('monthCells', () => {
  it('un mese che inizia di lunedì non ha celle vuote prima del primo (giugno 2026)', () => {
    const cells = monthCells('2026-06');
    expect(cells[0]).toBe('2026-06-01');
    expect(cells).toHaveLength(30);
  });

  it('un mese che inizia di domenica ha sei celle vuote prima del primo (febbraio 2026)', () => {
    const cells = monthCells('2026-02');
    expect(blanks(cells)).toBe(6);
    expect(cells.slice(0, 6)).toEqual([null, null, null, null, null, null]);
    expect(cells[6]).toBe('2026-02-01');
    expect(cells).toHaveLength(34);
  });

  it('novembre 2026 inizia di domenica: sei celle vuote, poi i 30 giorni', () => {
    const cells = monthCells('2026-11');
    expect(blanks(cells)).toBe(6);
    expect(cells[6]).toBe('2026-11-01');
    expect(cells[cells.length - 1]).toBe('2026-11-30');
  });

  it('ottobre 2026 inizia di giovedì: tre celle vuote', () => {
    const cells = monthCells('2026-10');
    expect(blanks(cells)).toBe(3);
    expect(cells[3]).toBe('2026-10-01');
  });

  it('febbraio 2024 (bisestile) inizia di giovedì e arriva al 29', () => {
    const cells = monthCells('2024-02');
    expect(blanks(cells)).toBe(3);
    expect(cells[cells.length - 1]).toBe('2024-02-29');
    expect(cells).toHaveLength(32);
  });

  it('le celle vuote sono solo all\'inizio e ogni giorno cade nella colonna giusta (lunedì = colonna 0)', () => {
    const cells = monthCells('2026-12'); // il primo dicembre 2026 è un martedì
    expect(cells.indexOf('2026-12-01')).toBe(1);
    expect(cells.indexOf('2026-12-07') % 7).toBe(0); // lunedì
    expect(cells.indexOf('2026-12-31') % 7).toBe(3); // giovedì
    expect(cells.slice(blanks(cells)).every((cell) => cell !== null)).toBe(true);
  });
});

describe('shiftMonth e monthOf', () => {
  it('avanti e indietro dentro l\'anno', () => {
    expect(shiftMonth('2026-11', 1)).toBe('2026-12');
    expect(shiftMonth('2026-11', -1)).toBe('2026-10');
  });

  it('cambio d\'anno nei due versi', () => {
    expect(shiftMonth('2026-12', 1)).toBe('2027-01');
    expect(shiftMonth('2026-01', -1)).toBe('2025-12');
  });

  it('il mese di un giorno è YYYY-MM', () => {
    expect(monthOf('2026-03-31')).toBe('2026-03');
  });
});

describe('isMonthKey', () => {
  it.each(['2026-01', '2026-12', '1999-07'])('%s è un mese', (value) => expect(isMonthKey(value)).toBe(true));
  it.each(['2026-00', '2026-13', '2026-1', '26-11', '2026-11-03', '', null, undefined, 'novembre'])('%s non lo è', (value) => expect(isMonthKey(value)).toBe(false));
});

describe('isDayKey', () => {
  it.each(['2026-11-18', '2026-01-01', '2026-12-31', '2024-02-29'])('%s è un giorno', (value) => expect(isDayKey(value)).toBe(true));
  it.each(['2026-02-31', '2026-13-01', '2026-00-10', '2026-11-00', '2026-04-31', '2026-02-29', 'ieri', '2026-11', '2026-1-5', '2026-11-18 10:00:00', '', null, undefined, 20261118])('%s non lo è', (value) => expect(isDayKey(value)).toBe(false));
});
