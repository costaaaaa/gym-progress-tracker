import { describe, it, expect } from 'vitest';
import { clockDate, clockDay } from './calendarDay';

describe('clockDate: l\'ora locale del luogo letta come orologio', () => {
  it('i campi di calendario e orologio sono quelli della stringa, in qualunque fuso del browser', () => {
    const d = clockDate('2026-10-18 21:30:15');
    expect([d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate(), d.getUTCHours(), d.getUTCMinutes(), d.getUTCSeconds()])
      .toEqual([2026, 10, 18, 21, 30, 15]);
  });
  it('accetta anche la "T" e la sola data (mezzanotte)', () => {
    expect(clockDate('2026-10-18T21:30:00').getUTCHours()).toBe(21);
    expect(clockDate('2026-10-18').getUTCHours()).toBe(0);
  });
  it('un\'ora che nel fuso del browser non esiste resta quella scritta (02:30 del 29/03/2026 a Roma)', () => {
    expect(clockDate('2026-03-29 02:30:00').getUTCHours()).toBe(2);
  });
  it('valore illeggibile o mancante: data non valida', () => {
    expect(Number.isNaN(clockDate('boh').getTime())).toBe(true);
    expect(Number.isNaN(clockDate(undefined).getTime())).toBe(true);
  });
});

describe('clockDay: il giorno scritto', () => {
  it('da un orologio, da una sola data e da un orologio con la T', () => {
    expect(clockDay('2026-10-18 23:30:00')).toBe('2026-10-18');
    expect(clockDay('2026-10-18')).toBe('2026-10-18');
    expect(clockDay('2026-10-18T02:00:00')).toBe('2026-10-18');
  });
  it('da un ISO con offset è il giorno scritto, non quello UTC', () => {
    expect(clockDay('2026-10-18T23:30:00-04:00')).toBe('2026-10-18');
    expect(clockDay('2026-10-18T00:30:00+09:00')).toBe('2026-10-18');
  });
  it('valore illeggibile o mancante: null', () => {
    expect(clockDay('boh')).toBeNull();
    expect(clockDay('2026-10-1')).toBeNull();
    expect(clockDay(undefined)).toBeNull();
  });
});
