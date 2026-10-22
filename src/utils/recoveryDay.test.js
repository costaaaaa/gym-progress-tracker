import { describe, it, expect } from 'vitest';
import { readyInDays } from './recoveryDay';

const now = new Date(2026, 9, 21, 18, 30);

describe('readyInDays', () => {
  it('stesso giorno di calendario: 0, anche a un minuto da mezzanotte', () => {
    expect(readyInDays('2026-10-21 23:59:00', now)).toBe(0);
  });
  it('dopo mezzanotte: domani, anche se mancano poche ore', () => {
    expect(readyInDays('2026-10-22 00:30:00', now)).toBe(1);
  });
  it('conta i giorni di calendario, non le ore', () => {
    expect(readyInDays('2026-10-24 06:30:00', now)).toBe(3);
  });
  it('già passato: 0', () => {
    expect(readyInDays('2026-10-20 08:00:00', now)).toBe(0);
  });
  it('dato mancante o illeggibile: null', () => {
    expect(readyInDays(undefined, now)).toBeNull();
    expect(readyInDays('boh', now)).toBeNull();
  });
});
