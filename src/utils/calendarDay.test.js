import { describe, it, expect } from 'vitest';
import { clockDate, clockDay, localDate } from './calendarDay';
import { setBrowserTimeZone } from '../test/timeZone';

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

describe('localDate: l\'orologio scritto come Date nel fuso del browser', () => {
  it('i campi locali sono quelli della stringa, a ovest e a est di UTC', () => {
    for (const zone of ['America/New_York', 'Asia/Tokyo']) {
      setBrowserTimeZone(zone);
      const d = localDate('2026-10-18 23:30:15');
      expect([d.getFullYear(), d.getMonth() + 1, d.getDate(), d.getHours(), d.getMinutes(), d.getSeconds()]).toEqual([2026, 10, 18, 23, 30, 15]);
    }
  });
  it('la sola data è mezzanotte locale', () => {
    setBrowserTimeZone('America/New_York');
    const d = localDate('2026-10-18');
    expect([d.getDate(), d.getHours()]).toEqual([18, 0]);
  });
  it('valore illeggibile: data non valida', () => {
    expect(Number.isNaN(localDate('boh').getTime())).toBe(true);
  });
});
