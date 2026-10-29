import { describe, it, expect } from 'vitest';
import { formatDate } from './format';
import { setBrowserTimeZone } from '../test/timeZone';

describe('formatDate', () => {
  it('una data senza orario è quel giorno, anche a ovest di UTC (no giorno prima)', () => {
    setBrowserTimeZone('America/New_York');
    expect(formatDate('2026-10-20', { day: 'numeric', month: 'long' })).toBe('20 ottobre');
    expect(formatDate('2026-01-01', { day: 'numeric', month: 'long', year: 'numeric' })).toBe('1 gennaio 2026');
  });
  it('data e ora senza fuso (ora locale di un allenamento): il giorno scritto', () => {
    expect(formatDate('2026-10-20 00:30:00', { day: 'numeric', month: 'long' })).toBe('20 ottobre');
    expect(formatDate('2026-10-20 23:30:00', { day: 'numeric', month: 'long' })).toBe('20 ottobre');
  });
  it('un istante ISO con offset si mostra nel fuso del browser', () => {
    const iso = '2026-10-20T12:00:00Z';
    expect(formatDate(iso, { day: 'numeric', month: 'long' })).toBe(new Date(iso).toLocaleDateString('it-IT', { day: 'numeric', month: 'long' }));
  });
  it('una Date è il suo giorno locale', () => {
    expect(formatDate(new Date(2026, 9, 20, 23, 30), { day: 'numeric', month: 'long' })).toBe('20 ottobre');
  });
});
