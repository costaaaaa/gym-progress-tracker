import { describe, it, expect } from 'vitest';
import i18n from './index';
import { formatDate, formatClockTime, formatNumber } from './format';
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

describe('formatClockTime', () => {
  it('mostra l\'ora scritta, senza convertirla nel fuso del browser', () => {
    setBrowserTimeZone('America/New_York');
    expect(formatClockTime('2026-10-18 02:00:00')).toBe('02:00');
    expect(formatClockTime('2026-10-18 23:59:00')).toBe('23:59');
  });
});

describe('formatNumber', () => {
  it('in italiano il punto delle migliaia c\'è da quattro cifre in su (toLocaleString da solo parte da cinque)', () => {
    expect(formatNumber(950)).toBe('950');
    expect(formatNumber(3140)).toBe('3.140');
    expect(formatNumber(184250)).toBe('184.250');
    expect(formatNumber(4820.5, { maximumFractionDigits: 2 })).toBe('4.820,5');
    expect(formatNumber(1234567.25, { maximumFractionDigits: 2 })).toBe('1.234.567,25');
    expect(formatNumber(0)).toBe('0');
  });

  it('in inglese la virgola delle migliaia c\'è da quattro cifre in su', async () => {
    await i18n.changeLanguage('en');
    expect(formatNumber(950)).toBe('950');
    expect(formatNumber(3140)).toBe('3,140');
    expect(formatNumber(184250)).toBe('184,250');
    expect(formatNumber(4820.5, { maximumFractionDigits: 2 })).toBe('4,820.5');
    expect(formatNumber(1234567.25, { maximumFractionDigits: 2 })).toBe('1,234,567.25');
  });

  it('con useGrouping: false le migliaia si spengono (anni, identificativi)', async () => {
    expect(formatNumber(2026, { useGrouping: false })).toBe('2026');
    expect(formatNumber(184250, { useGrouping: false })).toBe('184250');
    await i18n.changeLanguage('en');
    expect(formatNumber(2026, { useGrouping: false })).toBe('2026');
  });

  it('i decimali restano quelli chiesti, con o senza migliaia', () => {
    expect(formatNumber(72.5)).toBe('72,5');
    expect(formatNumber(3140.5, { minimumFractionDigits: 1, maximumFractionDigits: 1 })).toBe('3.140,5');
    expect(formatNumber(12, { minimumFractionDigits: 1, maximumFractionDigits: 1 })).toBe('12,0');
  });
});
