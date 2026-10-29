import { describe, it, expect } from 'vitest';
import { formatClockTime, differentZone, workoutInstant, offsetLabel, zoneCity, workoutZoneBadge, isoClock, zoneClock, moveToZoneDay } from './workoutTime';

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

describe('zoneClock: l\'orologio di un istante in un fuso', () => {
  const instant = Date.UTC(2026, 9, 18, 2, 30, 15);
  it('lo stesso istante ha un orologio diverso per ogni fuso', () => {
    expect(zoneClock(instant, 'America/New_York')).toBe('2026-10-17 22:30:15');
    expect(zoneClock(instant, 'Europe/Rome')).toBe('2026-10-18 04:30:15');
    expect(zoneClock(instant, 'Asia/Tokyo')).toBe('2026-10-18 11:30:15');
  });
  it('mezzanotte è 00:00, non 24:00', () => {
    expect(zoneClock(Date.UTC(2026, 9, 18, 4, 0, 0), 'America/New_York')).toBe('2026-10-18 00:00:00');
  });
  it('accetta anche un Date', () => {
    expect(zoneClock(new Date(instant), 'Asia/Tokyo')).toBe('2026-10-18 11:30:15');
  });
});

describe('moveToZoneDay: stesso orario del luogo, su un altro giorno', () => {
  it('New York: le 22:30 del 17 spostate al 18 sono le 22:30 del 18 a New York', () => {
    const start = Date.UTC(2026, 9, 18, 2, 30, 0); // 17 ottobre 22:30 a New York (UTC−4)
    expect(moveToZoneDay(start, '2026-10-18', 'America/New_York')).toBe(Date.UTC(2026, 9, 19, 2, 30, 0));
  });
  it('lo stesso giorno non sposta nulla', () => {
    const start = Date.UTC(2026, 9, 18, 2, 30, 0);
    expect(moveToZoneDay(start, '2026-10-17', 'America/New_York')).toBe(start);
  });
  it('attraverso il cambio dell\'ora legale l\'orario del luogo resta lo stesso', () => {
    const start = Date.UTC(2026, 9, 30, 21, 0, 0); // 30 ottobre 17:00 a New York (UTC−4)
    const moved = moveToZoneDay(start, '2026-11-02', 'America/New_York'); // dopo il 1 novembre: UTC−5
    expect(moved).toBe(Date.UTC(2026, 10, 2, 22, 0, 0));
    expect(zoneClock(moved, 'America/New_York')).toBe('2026-11-02 17:00:00');
  });
  it('Tokyo, a est di UTC: il giorno del luogo è quello scritto, non quello UTC', () => {
    const start = Date.UTC(2026, 9, 17, 16, 0, 0); // 18 ottobre 01:00 a Tokyo
    expect(moveToZoneDay(start, '2026-10-20', 'Asia/Tokyo')).toBe(Date.UTC(2026, 9, 19, 16, 0, 0));
  });
});
