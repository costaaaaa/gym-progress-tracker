import { describe, it, expect } from 'vitest';
import { HOME_BLOCKS, effectiveLayout, moveBlock, setHidden, setLarge } from './homeLayout';

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

const keys = (layout) => layout.map((entry) => entry.key);

describe('moveBlock', () => {
  it('sposta di un posto su e giù, con nascosto e misura che restano', () => {
    const layout = effectiveLayout([{ key: 'groups', hidden: true, large: true }]);
    const down = moveBlock(DEFAULT, 'last', 1);
    expect(keys(down)).toEqual(['levels', 'last', 'groups', 'recovery', 'body']);
    expect(keys(moveBlock(down, 'last', -1))).toEqual(HOME_BLOCKS);
    const moved = moveBlock(layout, 'groups', -1);
    expect(moved.find((entry) => entry.key === 'groups')).toEqual({ key: 'groups', hidden: true, large: true });
  });

  it('ai capi non fa nulla', () => {
    expect(moveBlock(DEFAULT, 'last', -1)).toEqual(DEFAULT);
    expect(moveBlock(DEFAULT, 'body', 1)).toEqual(DEFAULT);
  });

  it('una chiave sconosciuta non fa nulla', () => {
    expect(moveBlock(DEFAULT, 'altro', 1)).toEqual(DEFAULT);
  });

  it('i blocchi non elencati restano al loro posto e non contano come vicino', () => {
    const listed = (key) => key !== 'groups';
    // levels scende: salta groups (non elencato) e prende il posto di recovery; groups resta dov'era
    expect(keys(moveBlock(DEFAULT, 'levels', 1, listed))).toEqual(['last', 'recovery', 'groups', 'levels', 'body']);
    expect(keys(moveBlock(DEFAULT, 'recovery', -1, listed))).toEqual(['last', 'recovery', 'groups', 'levels', 'body']);
    // senza vicini elencati non fa nulla
    expect(moveBlock(DEFAULT, 'body', 1, listed)).toEqual(DEFAULT);
    expect(moveBlock(DEFAULT, 'last', -1, listed)).toEqual(DEFAULT);
  });

  it('non muta l\'ingresso', () => {
    const before = JSON.stringify(DEFAULT);
    moveBlock(DEFAULT, 'levels', 1);
    expect(JSON.stringify(DEFAULT)).toBe(before);
  });
});

describe('setHidden e setLarge', () => {
  it('nascondono e mostrano un blocco senza toccare gli altri né l\'ordine', () => {
    const hidden = setHidden(DEFAULT, 'groups', true);
    expect(keys(hidden)).toEqual(HOME_BLOCKS);
    expect(hidden.map((entry) => entry.hidden)).toEqual([false, false, true, false, false]);
    expect(setHidden(hidden, 'groups', false)).toEqual(DEFAULT);
  });

  it('la misura grande e piccola; «last» resta sempre piccolo', () => {
    const large = setLarge(DEFAULT, 'body', true);
    expect(large.find((entry) => entry.key === 'body').large).toBe(true);
    expect(setLarge(large, 'body', false)).toEqual(DEFAULT);
    expect(setLarge(DEFAULT, 'last', true)).toEqual(DEFAULT);
  });

  it('una chiave sconosciuta non cambia nulla e l\'ingresso non si muta', () => {
    const before = JSON.stringify(DEFAULT);
    expect(setHidden(DEFAULT, 'altro', true)).toEqual(DEFAULT);
    expect(setLarge(DEFAULT, 'levels', true)).not.toBe(DEFAULT);
    expect(JSON.stringify(DEFAULT)).toBe(before);
  });
});
