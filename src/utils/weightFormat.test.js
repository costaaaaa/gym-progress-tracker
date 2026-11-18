import { describe, it, expect, vi } from 'vitest';
import { formatWeight } from './weightFormat';

const NB = '\u00a0';

describe('formatWeight', () => {
  it('italiano: virgola, niente zeri finali, spazio non separabile prima di kg', () => {
    expect(formatWeight(82.5, 'it-IT')).toBe(`82,5${NB}kg`);
    expect(formatWeight(80, 'it-IT')).toBe(`80${NB}kg`);
  });

  it('inglese: punto decimale', () => {
    expect(formatWeight(82.5, 'en-US')).toBe(`82.5${NB}kg`);
    expect(formatWeight(1250.5, 'en-US')).toBe(`1,250.5${NB}kg`);
  });

  it('al massimo due decimali', () => {
    expect(formatWeight(79.304, 'it-IT')).toBe(`79,3${NB}kg`);
    expect(formatWeight(79.256, 'it-IT')).toBe(`79,26${NB}kg`);
  });

  it('accetta la stringa DECIMAL del backend', () => {
    expect(formatWeight('79.30', 'it-IT')).toBe(`79,3${NB}kg`);
    expect(formatWeight('80.00', 'en-US')).toBe(`80${NB}kg`);
  });

  it('zero è un peso', () => {
    expect(formatWeight(0, 'it-IT')).toBe(`0${NB}kg`);
  });

  it('senza valore: trattino', () => {
    expect(formatWeight(null, 'it-IT')).toBe('—');
    expect(formatWeight(undefined, 'it-IT')).toBe('—');
    expect(formatWeight('', 'it-IT')).toBe('—');
    expect(formatWeight('abc', 'it-IT')).toBe('—');
  });

  it('signed: segno esplicito, anche per i positivi', () => {
    expect(formatWeight(2.1, 'it-IT', { signed: true })).toBe(`+2,1${NB}kg`);
    expect(formatWeight(-2.1, 'it-IT', { signed: true })).toBe(`-2,1${NB}kg`);
  });

  it('maxDecimals limita i decimali (default 2)', () => {
    expect(formatWeight(101.33, 'it-IT', { maxDecimals: 1 })).toBe(`101,3${NB}kg`);
    expect(formatWeight(0.04, 'it-IT', { signed: true, maxDecimals: 1 })).toBe(`0${NB}kg`);
    expect(formatWeight(0.05, 'it-IT', { signed: true, maxDecimals: 1 })).toBe(`+0,1${NB}kg`);
    expect(formatWeight(101.33, 'it-IT')).toBe(`101,33${NB}kg`);
  });

  it('unit: false dà solo il numero', () => {
    expect(formatWeight('79.30', 'it-IT', { unit: false })).toBe('79,3');
  });
});

describe('formatWeight, segno scritto a mano', () => {
  it('il "+" non dipende da signDisplay (Hermes può ignorarlo)', () => {
    const original = Number.prototype.toLocaleString;
    const spy = vi.spyOn(Number.prototype, 'toLocaleString').mockImplementation(function senzaSegno(locale, options) {
      const rest = { ...options };
      delete rest.signDisplay;
      return original.call(this, locale, rest);
    });
    try {
      expect(formatWeight(2.1, 'it-IT', { signed: true })).toBe(`+2,1${NB}kg`);
      expect(formatWeight(-2.1, 'it-IT', { signed: true })).toBe(`-2,1${NB}kg`);
      expect(formatWeight(0.04, 'it-IT', { signed: true, maxDecimals: 1 })).toBe(`0${NB}kg`);
      expect(formatWeight(0.05, 'it-IT', { signed: true, maxDecimals: 1 })).toBe(`+0,1${NB}kg`);
    } finally {
      spy.mockRestore();
    }
  });

  it('con cifre non latine (en-US-u-nu-arab) il segno resta', () => {
    expect(formatWeight(-2.1, 'en-US-u-nu-arab', { signed: true })).toBe(`-٢٫١${NB}kg`);
    expect(formatWeight(2.1, 'en-US-u-nu-arab', { signed: true })).toBe(`+٢٫١${NB}kg`);
    expect(formatWeight(-2.1, 'en-US-u-nu-arab')).toBe(`-٢٫١${NB}kg`);
    expect(formatWeight(0.04, 'en-US-u-nu-arab', { signed: true, maxDecimals: 1 })).toBe(`٠${NB}kg`);
  });

  it('un negativo che arrotonda a 0 non ha segno', () => {
    expect(formatWeight(-0.04, 'it-IT', { maxDecimals: 1 })).toBe(`0${NB}kg`);
  });
});
