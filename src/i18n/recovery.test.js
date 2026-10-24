// Testi della card "Stato muscolare": le chiavi della vista a due blocchi ci sono in italiano e in inglese.
import { describe, it, expect } from 'vitest';
import it_ from './it.json';
import en from './en.json';

describe('catalogo: stato muscolare', () => {
  it('italiano', () => {
    expect(it_['recovery.can_train']).toBe('Puoi allenare');
    expect(it_['recovery.resting']).toBe('A riposo');
    expect(it_['recovery.no_data_list']).toBe('Nessun dato: {{list}}');
  });

  it('inglese', () => {
    expect(en['recovery.can_train']).toBe('Ready to train');
    expect(en['recovery.resting']).toBe('Resting');
    expect(en['recovery.no_data_list']).toBe('No data: {{list}}');
  });
});
