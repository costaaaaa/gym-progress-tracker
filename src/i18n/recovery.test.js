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

// Le parole dello stato di recupero (card «Per muscolo» e card «Stato muscolare»): iniziale maiuscola, in italiano e in inglese
const WORDS = {
  it: {
    'recovery.ready': 'Pronto',
    'recovery.ready_today': 'Pronto oggi',
    'recovery.ready_tomorrow': 'Pronto domani',
    'recovery.ready_in_days_one': 'Pronto tra {{count}} giorno',
    'recovery.ready_in_days_other': 'Pronto tra {{count}} giorni',
    'recovery.basic_resting': 'In recupero',
    'progress.volume.no_data': 'Nessun dato',
  },
  en: {
    'recovery.ready': 'Ready',
    'recovery.ready_today': 'Ready today',
    'recovery.ready_tomorrow': 'Ready tomorrow',
    'recovery.ready_in_days_one': 'Ready in {{count}} day',
    'recovery.ready_in_days_other': 'Ready in {{count}} days',
    'recovery.basic_resting': 'Recovering',
    'progress.volume.no_data': 'No data',
  },
};

describe.each([['it', it_], ['en', en]])('catalogo %s: parole del recupero', (lang, catalog) => {
  it.each(Object.entries(WORDS[lang]))('%s è «%s»', (key, text) => {
    expect(catalog[key]).toBe(text);
  });
});
