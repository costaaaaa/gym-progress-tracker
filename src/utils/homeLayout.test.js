import { describe, it, expect } from 'vitest';
import { HOME_BLOCKS, effectiveLayout } from './homeLayout';

const DEFAULT = HOME_BLOCKS.map((key) => ({ key, hidden: false, large: false }));

describe('effectiveLayout', () => {
  it('i blocchi, nell\'ordine predefinito', () => {
    expect(HOME_BLOCKS).toEqual(['last', 'levels', 'groups', 'recovery', 'body']);
  });

  it.each([[null], [undefined], [[]], ['levels'], [42], [{ key: 'levels' }], [true]])('senza un elenco valido (%j) vale il predefinito: tutti, piccoli, visibili', (saved) => {
    expect(effectiveLayout(saved)).toEqual(DEFAULT);
  });

  it('le voci salvate restano nell\'ordine salvato, con nascosto e misura', () => {
    const saved = [
      { key: 'body', hidden: false, large: true },
      { key: 'levels', hidden: true, large: false },
      { key: 'last', hidden: false, large: false },
      { key: 'recovery', hidden: false, large: true },
      { key: 'groups', hidden: false, large: false },
    ];
    expect(effectiveLayout(saved)).toEqual(saved);
  });

  it('le chiavi che mancano si aggiungono in coda, nell\'ordine predefinito, visibili e piccole', () => {
    expect(effectiveLayout([{ key: 'body', hidden: true, large: true }, { key: 'levels', hidden: false, large: true }])).toEqual([
      { key: 'body', hidden: true, large: true },
      { key: 'levels', hidden: false, large: true },
      { key: 'last', hidden: false, large: false },
      { key: 'groups', hidden: false, large: false },
      { key: 'recovery', hidden: false, large: false },
    ]);
  });

  it('le chiavi ignote e i doppioni si scartano (vale la prima voce)', () => {
    const result = effectiveLayout([
      { key: 'cardio', hidden: false, large: true },
      { key: 'groups', hidden: true, large: true },
      { key: 'groups', hidden: false, large: false },
      { key: 'levels', hidden: false, large: false },
    ]);
    expect(result.map((entry) => entry.key)).toEqual(['groups', 'levels', 'last', 'recovery', 'body']);
    expect(result[0]).toEqual({ key: 'groups', hidden: true, large: true });
  });

  it('«last» non è mai grande', () => {
    expect(effectiveLayout([{ key: 'last', hidden: false, large: true }])[0]).toEqual({ key: 'last', hidden: false, large: false });
  });

  it('voci non valide: senza chiave, non oggetti, tipi sbagliati', () => {
    const result = effectiveLayout([
      null, 'levels', 7, [], { hidden: true }, { key: 7 }, { key: null },
      { key: 'groups', hidden: 'yes', large: 1 },
      { key: 'body', hidden: true },
    ]);
    expect(result).toEqual([
      { key: 'groups', hidden: false, large: false },
      { key: 'body', hidden: true, large: false },
      { key: 'last', hidden: false, large: false },
      { key: 'levels', hidden: false, large: false },
      { key: 'recovery', hidden: false, large: false },
    ]);
  });

  it('non cambia l\'elenco ricevuto', () => {
    const saved = [{ key: 'body', hidden: false, large: true }];
    const copy = JSON.parse(JSON.stringify(saved));
    effectiveLayout(saved);
    expect(saved).toEqual(copy);
  });
});
