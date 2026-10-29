import { describe, it, expect, beforeEach } from 'vitest';
import { readyInDays } from './recoveryDay';
import { setBrowserTimeZone } from '../test/timeZone';

describe('readyInDays', () => {
  let now;
  beforeEach(() => {
    setBrowserTimeZone('Europe/Rome');
    now = new Date(2026, 9, 21, 18, 30);
  });
  it('stesso giorno di calendario: 0, anche a un minuto da mezzanotte', () => {
    expect(readyInDays('2026-10-21T23:59:00+02:00', now)).toBe(0);
  });
  it('dopo mezzanotte: domani, anche se mancano poche ore', () => {
    expect(readyInDays('2026-10-22T00:30:00+02:00', now)).toBe(1);
  });
  it('conta i giorni di calendario, non le ore', () => {
    expect(readyInDays('2026-10-24T06:30:00+02:00', now)).toBe(3);
  });
  it('già passato: 0', () => {
    expect(readyInDays('2026-10-20T08:00:00+02:00', now)).toBe(0);
  });
  it('un ISO con offset è un istante: il giorno è quello del browser, non quello scritto', () => {
    setBrowserTimeZone('America/New_York');
    // 22 ottobre 00:30 a Tokyo sono le 11:30 del 21 a New York
    expect(readyInDays('2026-10-22T00:30:00+09:00', new Date(2026, 9, 21, 18, 30))).toBe(0);
    setBrowserTimeZone('Asia/Tokyo');
    // 21 ottobre 23:30 a UTC−8 sono le 16:30 del 22 a Tokyo
    expect(readyInDays('2026-10-21T23:30:00-08:00', new Date(2026, 9, 21, 18, 30))).toBe(1);
  });
  it('accetta anche l\'orologio senza offset ("Y-m-d H:i:s", come nella demo)', () => {
    expect(readyInDays('2026-10-22 00:30:00', now)).toBe(1);
  });
  it('dato mancante o illeggibile: null', () => {
    expect(readyInDays(undefined, now)).toBeNull();
    expect(readyInDays('boh', now)).toBeNull();
  });
});
