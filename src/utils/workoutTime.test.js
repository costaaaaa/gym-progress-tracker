import { describe, it, expect } from 'vitest';
import { formatClockTime, differentZone, workoutInstant, offsetLabel, zoneCity, workoutZoneBadge, isoClock } from './workoutTime';

describe('formatClockTime', () => {
  it('mostra l\'ora scritta, senza convertirla nel fuso del browser', () => {
    expect(formatClockTime('2026-10-18 02:00:00')).toBe('02:00');
    expect(formatClockTime('2026-10-18 23:59:00')).toBe('23:59');
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

describe('differentZone', () => {
  it('true solo con due fusi riconosciuti e diversi', () => {
    expect(differentZone('America/New_York', 'Europe/Rome')).toBe(true);
    expect(differentZone('Europe/Rome', 'Europe/Rome')).toBe(false);
    expect(differentZone('Europe/Kiev', 'Europe/Kyiv')).toBe(false);
  });
  it('fuso mancante o sconosciuto: false', () => {
    expect(differentZone(undefined, 'Europe/Rome')).toBe(false);
    expect(differentZone('America/New_York', null)).toBe(false);
    expect(differentZone('Mondo/Nuovo', 'Europe/Rome')).toBe(false);
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

describe('isoClock', () => {
  it('l\'orologio scritto in un ISO con offset, senza convertirlo', () => {
    expect(isoClock('2026-10-18T02:00:00-04:00')).toBe('2026-10-18 02:00:00');
    expect(isoClock('2026-10-18T23:30:00+09:00')).toBe('2026-10-18 23:30:00');
  });
  it('valore illeggibile: null', () => {
    expect(isoClock('boh')).toBeNull();
    expect(isoClock(undefined)).toBeNull();
  });
});
