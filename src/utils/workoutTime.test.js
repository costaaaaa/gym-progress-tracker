import { describe, it, expect, beforeEach } from 'vitest';
import { differentZone, workoutInstant, zoneCity, workoutZoneBadge, isoClock, zoneClock, moveToZoneDay } from './workoutTime';
import { setBrowserTimeZone } from '../test/timeZone';

describe('workoutInstant: l\'istante vero di un allenamento', () => {
  it('vale l\'istante di started_at, qualunque sia il fuso del browser', () => {
    expect(workoutInstant({ date: '2026-10-18 02:00:00', started_at: '2026-10-18T02:00:00-04:00' })).toBe(Date.UTC(2026, 9, 18, 6, 0, 0));
  });
});

describe('offset nel badge', () => {
  beforeEach(() => setBrowserTimeZone('Europe/Rome'));
  // L'offset si legge dall'ISO di started_at; il fuso (New York) serve solo perché il badge compaia
  const offset = (iso) => workoutZoneBadge({ time_zone: 'America/New_York', started_at: iso })?.split(' · ')[1] ?? null;
  it('UTC−4 con il meno tipografico', () => {
    expect(offset('2026-10-18T02:00:00-04:00')).toBe('UTC−4');
  });
  it('UTC+2, UTC+9', () => {
    expect(offset('2026-10-18T02:00:00+02:00')).toBe('UTC+2');
    expect(offset('2026-10-18T02:00:00+09:00')).toBe('UTC+9');
  });
  it('mezze ore: UTC+5:30, UTC−9:30', () => {
    expect(offset('2026-10-18T02:00:00+05:30')).toBe('UTC+5:30');
    expect(offset('2026-10-18T02:00:00-09:30')).toBe('UTC−9:30');
  });
  it('offset zero: UTC', () => {
    expect(offset('2026-10-18T02:00:00+00:00')).toBe('UTC');
    expect(offset('2026-10-18T02:00:00Z')).toBe('UTC');
  });
  it('più di due cifre di ore e valore illeggibile', () => {
    expect(offset('2026-10-18T02:00:00+12:00')).toBe('UTC+12');
    expect(offset('boh')).toBeNull();
    expect(offset(undefined)).toBeNull();
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
  beforeEach(() => setBrowserTimeZone('Europe/Rome'));
  it('true solo con un fuso riconosciuto e diverso da quello del browser', () => {
    expect(differentZone('America/New_York')).toBe(true);
    expect(differentZone('Europe/Rome')).toBe(false);
    expect(differentZone('Europe/Kiev')).toBe(true);
  });
  it('nome diverso dello stesso fuso (alias IANA): false', () => {
    setBrowserTimeZone('Europe/Kyiv');
    expect(differentZone('Europe/Kiev')).toBe(false);
  });
  it('fuso mancante o sconosciuto: false', () => {
    expect(differentZone(undefined)).toBe(false);
    expect(differentZone('Mondo/Nuovo')).toBe(false);
  });
});

describe('workoutZoneBadge', () => {
  beforeEach(() => setBrowserTimeZone('Europe/Rome'));
  const ny = { time_zone: 'America/New_York', started_at: '2026-10-18T02:00:00-04:00' };
  it('fuso diverso da quello del browser: città e offset', () => {
    expect(workoutZoneBadge(ny)).toBe('New York · UTC−4');
  });
  it('stesso fuso: nessun badge', () => {
    setBrowserTimeZone('America/New_York');
    expect(workoutZoneBadge(ny)).toBeNull();
  });
  it('allenamento senza fuso o senza started_at: nessun badge', () => {
    expect(workoutZoneBadge({ date: '2026-10-18 02:00:00' })).toBeNull();
    expect(workoutZoneBadge({ time_zone: 'America/New_York' })).toBeNull();
  });
  it('nome diverso dello stesso fuso (alias IANA): nessun badge', () => {
    setBrowserTimeZone('Europe/Kyiv');
    const kyiv = { time_zone: 'Europe/Kiev', started_at: '2026-10-18T02:00:00+03:00' };
    expect(workoutZoneBadge(kyiv)).toBeNull();
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
