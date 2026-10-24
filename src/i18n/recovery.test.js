// Catalogo "Stato muscolare": le chiavi nuove ci sono in italiano e in inglese, quelle tolte non ci sono più.
import { describe, it, expect } from 'vitest';
import it_ from './it.json';
import en from './en.json';

const NEW_KEYS = ['recovery.can_train', 'recovery.resting', 'recovery.no_data_list'];
const REMOVED_KEYS = ['recovery.recovering', 'recovery.fatigued', 'recovery.no_data'];

describe.each([['it', it_], ['en', en]])('catalogo %s: stato muscolare', (_lang, catalog) => {
  it('ha le chiavi nuove, non vuote', () => {
    for (const key of NEW_KEYS) {
      expect(typeof catalog[key]).toBe('string');
      expect(catalog[key].trim()).not.toBe('');
    }
  });

  it('non ha più le chiavi tolte', () => {
    for (const key of REMOVED_KEYS) expect(catalog).not.toHaveProperty(key);
  });
});
