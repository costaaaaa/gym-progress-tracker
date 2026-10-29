import { describe, it, expect } from 'vitest';
import { clockDate, formatClockDate, formatClockTime, workoutInstant, offsetLabel, zoneCity, workoutZoneBadge } from './workoutTime';

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

describe('formatClockDate e formatClockTime', () => {
  it('mostrano giorno e ora scritti, senza convertirli nel fuso del browser', () => {
    expect(formatClockDate('2026-10-18 02:00:00', { day: 'numeric', month: 'long', year: 'numeric' })).toBe('18 ottobre 2026');
    expect(formatClockTime('2026-10-18 02:00:00')).toBe('02:00');
    expect(formatClockTime('2026-10-18 23:59:00')).toBe('23:59');
  });
  it('una sola data (YYYY-MM-DD) è quel giorno, non il giorno prima a ovest di UTC', () => {
    expect(formatClockDate('2026-10-20', { day: 'numeric', month: 'long' })).toBe('20 ottobre');
  });
});

describe('workoutInstant: l\'istante vero di un allenamento', () => {
  it('con started_at vale quell\'istante, qualunque sia il fuso del browser', () => {
    expect(workoutInstant({ date: '2026-10-18 02:00:00', started_at: '2026-10-18T02:00:00-04:00' })).toBe(Date.UTC(2026, 9, 18, 6, 0, 0));
  });
  it('senza started_at (backend vecchio) l\'orologio si legge nel fuso del browser, come prima', () => {
    expect(workoutInstant({ date: '2026-10-18 02:00:00' })).toBe(new Date(2026, 9, 18, 2, 0, 0).getTime());
  });
});

describe('offsetLabel', () => {
  it('UTC−4 con il meno tipografico', () => {
    expect(offsetLabel('2026-10-18T02:00:00-04:00')).toBe('UTC−4');
  });
  it('UTC+2, UTC+9', () => {
    expect(offsetLabel('2026-10-18T02:00:00+02:00')).toBe('UTC+2');
    expect(offsetLabel('2026-10-18T02:00:00+09:00')).toBe('UTC+9');
  });
  it('mezze ore: UTC+5:30, UTC−9:30', () => {
    expect(offsetLabel('2026-10-18T02:00:00+05:30')).toBe('UTC+5:30');
    expect(offsetLabel('2026-10-18T02:00:00-09:30')).toBe('UTC−9:30');
  });
  it('offset zero: UTC', () => {
    expect(offsetLabel('2026-10-18T02:00:00+00:00')).toBe('UTC');
    expect(offsetLabel('2026-10-18T02:00:00Z')).toBe('UTC');
  });
  it('più di due cifre di ore e valore illeggibile', () => {
    expect(offsetLabel('2026-10-18T02:00:00+12:00')).toBe('UTC+12');
    expect(offsetLabel('boh')).toBeNull();
    expect(offsetLabel(undefined)).toBeNull();
  });
});

describe('zoneCity', () => {
  it('ultimo segmento del nome IANA, con gli underscore diventati spazi', () => {
    expect(zoneCity('America/New_York')).toBe('New York');
    expect(zoneCity('America/Argentina/Buenos_Aires')).toBe('Buenos Aires');
    expect(zoneCity('Europe/Rome')).toBe('Rome');
    expect(zoneCity('UTC')).toBe('UTC');
  });
});

describe('workoutZoneBadge', () => {
  const ny = { time_zone: 'America/New_York', started_at: '2026-10-18T02:00:00-04:00' };
  it('fuso diverso da quello del browser: città e offset', () => {
    expect(workoutZoneBadge(ny, 'Europe/Rome')).toBe('New York · UTC−4');
  });
  it('stesso fuso: nessun badge', () => {
    expect(workoutZoneBadge(ny, 'America/New_York')).toBeNull();
  });
  it('allenamento senza fuso o senza started_at (backend vecchio): nessun badge', () => {
    expect(workoutZoneBadge({ date: '2026-10-18 02:00:00' }, 'Europe/Rome')).toBeNull();
    expect(workoutZoneBadge({ time_zone: 'America/New_York' }, 'Europe/Rome')).toBeNull();
  });
  it('fuso del browser sconosciuto: nessun badge (non si sa se è diverso)', () => {
    expect(workoutZoneBadge(ny, null)).toBeNull();
  });
  it('nome diverso dello stesso fuso (alias IANA): nessun badge', () => {
    const kyiv = { time_zone: 'Europe/Kiev', started_at: '2026-10-18T02:00:00+03:00' };
    expect(workoutZoneBadge(kyiv, 'Europe/Kyiv')).toBeNull();
  });
});
