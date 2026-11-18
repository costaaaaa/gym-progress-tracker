import { describe, it, expect } from 'vitest';
import {
  LB_IN_KG, DEFAULT_WEIGHT_UNIT, isWeightUnit, weightUnitLabel, kgToDisplay, formatWeightInUnit, formatWeightRounded, inputToKg, formatSetInUnit,
} from './weightUnit';

const NB = ' ';

describe('costanti e unità', () => {
  it('1 lb = 0,45359237 kg, default kg', () => {
    expect(LB_IN_KG).toBe(0.45359237);
    expect(DEFAULT_WEIGHT_UNIT).toBe('kg');
  });

  it('solo kg e lb sono unità valide', () => {
    expect(isWeightUnit('kg')).toBe(true);
    expect(isWeightUnit('lb')).toBe(true);
    expect(['LB', 'st', '', null, undefined, 5].some(isWeightUnit)).toBe(false);
  });

  it('etichetta: kg o lb, kg per un valore non valido', () => {
    expect(weightUnitLabel('kg')).toBe('kg');
    expect(weightUnitLabel('lb')).toBe('lb');
    expect(weightUnitLabel('st')).toBe('kg');
    expect(weightUnitLabel(undefined)).toBe('kg');
  });
});

describe('kgToDisplay', () => {
  it('in kg il valore resta quello di oggi', () => {
    expect(kgToDisplay(82.5, 'kg')).toBe(82.5);
    expect(kgToDisplay('79.30', 'kg')).toBe(79.3);
  });

  it('in lb è arrotondato al quarto di libbra', () => {
    expect(kgToDisplay(100, 'lb')).toBe(220.5); // 220,462 → 220,5
    expect(kgToDisplay(102.06, 'lb')).toBe(225); // 225,005
    expect(kgToDisplay(100.2, 'lb')).toBe(221); // 220,903 → 221
    expect(kgToDisplay(0, 'lb')).toBe(0);
  });

  it('un valore mancante o non numerico resta null', () => {
    expect(kgToDisplay(null, 'lb')).toBeNull();
    expect(kgToDisplay('', 'kg')).toBeNull();
    expect(kgToDisplay('abc', 'lb')).toBeNull();
    expect(kgToDisplay(undefined, 'kg')).toBeNull();
  });
});

describe('formatWeightInUnit', () => {
  it('lb in italiano: virgola, senza zeri inutili', () => {
    expect(formatWeightInUnit(100, 'lb', 'it-IT')).toBe(`220,5${NB}lb`);
    expect(formatWeightInUnit(102.06, 'lb', 'it-IT')).toBe(`225${NB}lb`);
    expect(formatWeightInUnit(100.337, 'lb', 'it-IT')).toBe(`221,25${NB}lb`);
  });

  it('lb in inglese: punto', () => {
    expect(formatWeightInUnit(100, 'lb', 'en-US')).toBe(`220.5${NB}lb`);
    expect(formatWeightInUnit(100.337, 'lb', 'en-US')).toBe(`221.25${NB}lb`);
  });

  it('kg come oggi', () => {
    expect(formatWeightInUnit(79.3, 'kg', 'it-IT')).toBe(`79,3${NB}kg`);
    expect(formatWeightInUnit('80.00', 'kg', 'en-US')).toBe(`80${NB}kg`);
  });

  it('senza valore: trattino; unit: false solo il numero', () => {
    expect(formatWeightInUnit(null, 'lb', 'it-IT')).toBe('—');
    expect(formatWeightInUnit(100, 'lb', 'it-IT', { unit: false })).toBe('220,5');
  });
});

describe('formatWeightRounded (totali e soglie)', () => {
  it('lb: intero più vicino, convertendo il totale in kg', () => {
    expect(formatWeightRounded(100, 'lb', 'it-IT')).toBe(`220${NB}lb`);
    expect(formatWeightRounded(12345.6, 'lb', 'it-IT')).toBe(`27.217${NB}lb`);
    expect(formatWeightRounded(12345.6, 'lb', 'en-US')).toBe(`27,217${NB}lb`);
  });

  it('kg: intero più vicino', () => {
    expect(formatWeightRounded(1234.4, 'kg', 'it-IT')).toBe(`1234${NB}kg`);
    expect(formatWeightRounded(100, 'kg', 'it-IT')).toBe(`100${NB}kg`);
  });

  it('senza valore: trattino', () => {
    expect(formatWeightRounded(undefined, 'lb', 'it-IT')).toBe('—');
  });
});

describe('inputToKg', () => {
  it('un valore troppo grande per essere arrotondato è null, non NaN', () => {
    expect(inputToKg(1e21, 'kg')).toBeNull();
    expect(inputToKg(1e300, 'lb')).toBeNull();
    expect(inputToKg('9'.repeat(25), 'kg')).toBeNull();
    expect(inputToKg('9'.repeat(25), 'lb')).toBeNull();
  });

  it('kg: il numero scritto, a 0,01', () => {
    expect(inputToKg('82,5', 'kg')).toBe(82.5);
    expect(inputToKg('82.5', 'kg')).toBe(82.5);
    expect(inputToKg('82.504', 'kg')).toBe(82.5);
  });

  it('lb: convertito in kg e arrotondato a 0,01', () => {
    expect(inputToKg('225', 'lb')).toBe(102.06);
    expect(inputToKg('220,5', 'lb')).toBe(100.02);
    expect(inputToKg('220.5', 'lb')).toBe(100.02);
    expect(inputToKg('0', 'lb')).toBe(0);
  });

  it('testo vuoto, non numerico o negativo: null', () => {
    for (const text of ['', '  ', 'abc', '-5', null, undefined, 'NaN', 'Infinity']) {
      expect(inputToKg(text, 'lb')).toBeNull();
    }
  });

  it.each(['12abc', '1e3', '0x10', '1.000,5', '-0', '.5', '5.', '1 2', '1,2,3', '1.2.3', '+5', ',5', '5,', '--5', '１２'])(
    'testo non fatto di sole cifre con al più un decimale: %j → null', (text) => {
      expect(inputToKg(text, 'kg')).toBeNull();
      expect(inputToKg(text, 'lb')).toBeNull();
    });

  it.each([['12', 12], ['12,5', 12.5], ['12.5', 12.5], ['0', 0], ['  12,5  ', 12.5], ['007', 7]])('%j in kg → %j', (text, kg) => {
    expect(inputToKg(text, 'kg')).toBe(kg);
  });

  it('un numero finito e non negativo resta accettato; il resto no', () => {
    expect(inputToKg(12.5, 'kg')).toBe(12.5);
    expect(inputToKg(225, 'lb')).toBe(102.06);
    expect(inputToKg(0, 'kg')).toBe(0);
    for (const n of [-1, NaN, Infinity, -0.001]) expect(inputToKg(n, 'kg')).toBeNull();
  });

  it('i mezzi a 0,01 kg si arrotondano per eccesso senza errori di virgola mobile', () => {
    expect(inputToKg('1.005', 'kg')).toBe(1.01);
    expect(inputToKg('2.675', 'kg')).toBe(2.68);
    expect(inputToKg('8.345', 'kg')).toBe(8.35);
    expect(inputToKg('225', 'lb')).toBe(102.06); // 102,0582…
  });
});

describe('andata e ritorno', () => {
  it('ogni multiplo di 0,25 lb da 0 a 2204: lb → kg (0,01) → lb (0,25) torna uguale', () => {
    const bad = [];
    for (let quarters = 0; quarters <= 2204 * 4; quarters++) {
      const lb = quarters / 4;
      const kg = inputToKg(String(lb), 'lb');
      if (kgToDisplay(kg, 'lb') !== lb) bad.push([lb, kg, kgToDisplay(kg, 'lb')]);
    }
    expect(bad).toEqual([]);
  });

  it('con 2204 lb il peso resta nel limite del database (0-999,99 kg)', () => {
    expect(inputToKg('2204', 'lb')).toBeLessThanOrEqual(999.99);
  });

  it('il limite del server è 999,99 kg: lo fissano i fatti, inputToKg non mette tetti', () => {
    expect(kgToDisplay(999.99, 'lb')).toBe(2204.5);
    expect(inputToKg('2204.5', 'lb')).toBeLessThanOrEqual(999.99);
    expect(inputToKg('2204.75', 'lb')).toBeGreaterThan(999.99);
  });
});

describe('formatSetInUnit: una serie nella unità dell\'utente', () => {
  it('kg come formatSet, lb al quarto di libbra', () => {
    expect(formatSetInUnit(80, 8, 'kg', 'it-IT')).toBe(`80${NB}kg${NB}×${NB}8`);
    expect(formatSetInUnit(100, 5, 'lb', 'it-IT')).toBe(`220,5${NB}lb${NB}×${NB}5`);
    expect(formatSetInUnit(100, 5, 'lb', 'en-US')).toBe(`220.5${NB}lb${NB}×${NB}5`);
  });

  it('peso assente = 0, come formatSet', () => {
    expect(formatSetInUnit(null, 12, 'kg', 'it-IT')).toBe(`0${NB}kg${NB}×${NB}12`);
    expect(formatSetInUnit('', 12, 'lb', 'it-IT')).toBe(`0${NB}lb${NB}×${NB}12`);
  });
});
