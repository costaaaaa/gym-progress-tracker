import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { BODY_LIMITS, isValueOutOfRange } from './bodyStatsRules';

// La copia lato client dei limiti non deve poter divergere dall'elenco del server (STATS_LIMITS, stessi campi, stesso ordine).
const phpRules = readFileSync(join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'backend', 'lib', 'stats_rules.php'), 'utf8');
const serverLimits = () => {
  const block = phpRules.match(/const STATS_LIMITS = array\(([^)]*)\)/)[1];
  return Object.fromEntries([...block.matchAll(/'(\w+)'\s*=>\s*(\d+)/g)].map(([, field, max]) => [field, Number(max)]));
};

describe('valori delle misure corporee', () => {
  it('campi, ordine e massimi coincidono con STATS_LIMITS del server', () => {
    const server = serverLimits();
    expect(Object.keys(server)).toHaveLength(7);
    expect(Object.entries(BODY_LIMITS)).toEqual(Object.entries(server));
  });

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
