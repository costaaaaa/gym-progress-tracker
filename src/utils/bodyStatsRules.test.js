import { describe, it, expect } from 'vitest';
import { BODY_LIMITS, isValueOutOfRange } from './bodyStatsRules';

describe('valori delle misure corporee', () => {
  it('i campi sono sette, nell\'ordine del modulo', () => {
    expect(Object.keys(BODY_LIMITS)).toEqual(['weight', 'body_fat_percentage', 'muscle_mass_percentage', 'chest_size', 'arm_size', 'waist_size', 'leg_size']);
  });

  it('campo vuoto: va bene', () => {
    expect(isValueOutOfRange('', 500)).toBe(false);
  });

  it('zero e tetto sono inclusi', () => {
    expect(isValueOutOfRange('0', 500)).toBe(false);
    expect(isValueOutOfRange('500', 500)).toBe(false);
    expect(isValueOutOfRange('500.1', 500)).toBe(true);
  });

  it('negativi e testo non vanno', () => {
    expect(isValueOutOfRange('-1', 500)).toBe(true);
    expect(isValueOutOfRange('abc', 500)).toBe(true);
  });
});
