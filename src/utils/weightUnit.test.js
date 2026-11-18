import { describe, it, expect } from 'vitest';
import {
  LB_IN_KG, DEFAULT_WEIGHT_UNIT, isWeightUnit, weightUnitLabel, kgToDisplay, formatWeightInUnit, formatWeightRounded, inputToKg, formatSetInUnit,
  maxWeightInUnit, weightStepInUnit, weightToField, fieldToKg, fieldToKgText,
  kgToTotal, formatTotalInUnit, formatEstimateInUnit, kgToBodyDisplay, formatBodyWeightInUnit, bodyWeightToField,
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
  it('kg con la virgola della lingua, lb al quarto di libbra', () => {
    expect(formatSetInUnit(80, 8, 'kg', 'it-IT')).toBe(`80${NB}kg${NB}×${NB}8`);
    expect(formatSetInUnit(100, 5, 'lb', 'it-IT')).toBe(`220,5${NB}lb${NB}×${NB}5`);
    expect(formatSetInUnit(100, 5, 'lb', 'en-US')).toBe(`220.5${NB}lb${NB}×${NB}5`);
  });

  it('peso assente = 0', () => {
    expect(formatSetInUnit(null, 12, 'kg', 'it-IT')).toBe(`0${NB}kg${NB}×${NB}12`);
    expect(formatSetInUnit('', 12, 'lb', 'it-IT')).toBe(`0${NB}lb${NB}×${NB}12`);
  });
});

const MAX = 999.99;

describe('campo peso in lb, dati in kg', () => {
  it('weightToField: in kg il testo com\'è, in lb al quarto di libbra come testo per il campo', () => {
    expect(weightToField('100', 'kg')).toBe('100');
    expect(weightToField('20.0', 'kg')).toBe('20.0');
    expect(weightToField('080', 'kg')).toBe('080');
    expect(weightToField('', 'kg')).toBe('');
    expect(weightToField('100', 'lb')).toBe('220.5');
    expect(weightToField('0', 'lb')).toBe('0');
    expect(weightToField('', 'lb')).toBe('');
    expect(weightToField('abc', 'lb')).toBe('');
  });

  it('fieldToKg: kg con la lettura di sempre (parseFloat), lb tramite inputToKg, non valido = null', () => {
    expect(fieldToKg('82.5', 'kg', MAX)).toBe(82.5);
    expect(fieldToKg('', 'kg', MAX)).toBeNull();
    expect(fieldToKg('1000', 'kg', MAX)).toBeNull();
    expect(fieldToKg('220', 'lb', MAX)).toBe(99.79);
    expect(fieldToKg('220,5', 'lb', MAX)).toBe(100.02);
    expect(fieldToKg('1e3', 'lb', MAX)).toBeNull();
    expect(fieldToKg('2204.5', 'lb', MAX)).toBe(999.94);
    expect(fieldToKg('2204.75', 'lb', MAX)).toBeNull();
    expect(fieldToKg('0', 'lb', MAX)).toBe(0);
  });

  it('un campo precompilato e non toccato produce i kg originali, non quelli riconvertiti', () => {
    const origin = { text: weightToField('100', 'lb'), kg: '100' };
    expect(fieldToKg('220.5', 'lb', MAX, origin)).toBe(100);
    expect(fieldToKg('220.5', 'lb', MAX)).toBe(100.02);
    expect(fieldToKg('221', 'lb', MAX, origin)).toBe(100.24);
  });

  it('il limite vale anche per un valore che arriva dall\'origine (in kg ogni testo riportato ne ha una)', () => {
    expect(fieldToKg('1000', 'kg', MAX, { text: '1000', kg: '1000' })).toBeNull();
    expect(fieldToKg('-5', 'kg', MAX, { text: '-5', kg: '-5' })).toBeNull();
    expect(fieldToKg('abc', 'kg', MAX, { text: 'abc', kg: 'abc' })).toBeNull();
    expect(fieldToKg('20.0', 'kg', MAX, { text: '20.0', kg: '20.0' })).toBe(20);
  });

  it('fieldToKgText: la stringa in kg da riportare alla serie dopo; in kg il testo com\'è', () => {
    expect(fieldToKgText('82.5', 'kg', MAX)).toBe('82.5');
    expect(fieldToKgText('abc', 'kg', MAX)).toBe('abc');
    expect(fieldToKgText('220', 'lb', MAX)).toBe('99.79');
    expect(fieldToKgText('abc', 'lb', MAX)).toBe('');
    expect(fieldToKgText('220.5', 'lb', MAX, { text: '220.5', kg: '100' })).toBe('100');
  });

  it('maxWeightInUnit: il limite in kg; in lb il quarto di libbra più alto sotto di esso', () => {
    expect(maxWeightInUnit(MAX, 'kg')).toBe(MAX);
    expect(maxWeightInUnit(MAX, 'lb')).toBe(2204.5);
  });

  it('weightStepInUnit: 0,5 kg, 2,5 lb', () => {
    expect(weightStepInUnit('kg')).toBe(0.5);
    expect(weightStepInUnit('lb')).toBe(2.5);
  });
});

describe('kgToTotal e formatTotalInUnit (totali)', () => {
  it('in kg il totale resta com\'è, senza arrotondare', () => {
    expect(kgToTotal(4200.5, 'kg')).toBe(4200.5);
    expect(kgToTotal('4200.50', 'kg')).toBe(4200.5);
    expect(kgToTotal(null, 'kg')).toBeNull();
  });

  it('in lb si converte il totale e si arrotonda all\'intero', () => {
    expect(kgToTotal(4200, 'lb')).toBe(9259); // 9259,43
    expect(kgToTotal(0, 'lb')).toBe(0);
  });

  it('formatTotalInUnit: in kg come formatWeightInUnit, in lb intero con separatori e unità', () => {
    expect(formatTotalInUnit(42000.5, 'kg', 'it-IT')).toBe(`42.000,5${NB}kg`);
    expect(formatTotalInUnit(42000, 'lb', 'it-IT')).toBe(`92.594${NB}lb`);
    expect(formatTotalInUnit(42000, 'lb', 'en-US')).toBe(`92,594${NB}lb`);
    expect(formatTotalInUnit(undefined, 'lb', 'en-US')).toBe('—');
  });
});

describe('formatEstimateInUnit (1RM stimato)', () => {
  it('in kg un decimale come oggi, in lb al quarto di libbra', () => {
    expect(formatEstimateInUnit(106.66, 'kg', 'it-IT')).toBe(`106,7${NB}kg`);
    expect(formatEstimateInUnit(100, 'lb', 'it-IT')).toBe(`220,5${NB}lb`);
    expect(formatEstimateInUnit(102.06, 'lb', 'en-US')).toBe(`225${NB}lb`);
    expect(formatEstimateInUnit(100.6, 'lb', 'it-IT')).toBe(`221,75${NB}lb`);
  });
});

describe('peso corporeo (un decimale in lb)', () => {
  it('kgToBodyDisplay: kg com\'è, lb a 0,1', () => {
    expect(kgToBodyDisplay(79.3, 'kg')).toBe(79.3);
    expect(kgToBodyDisplay(80, 'lb')).toBe(176.4); // 176,37
    expect(kgToBodyDisplay(null, 'lb')).toBeNull();
  });

  it('formatBodyWeightInUnit: delta con segno e un decimale', () => {
    expect(formatBodyWeightInUnit(79.3, 'kg', 'it-IT')).toBe(`79,3${NB}kg`);
    expect(formatBodyWeightInUnit(80, 'lb', 'it-IT')).toBe(`176,4${NB}lb`);
    expect(formatBodyWeightInUnit(-0.7, 'lb', 'en-US', { signed: true, maxDecimals: 1 })).toBe(`-1.5${NB}lb`);
    expect(formatBodyWeightInUnit(0.5, 'kg', 'en-US', { signed: true, maxDecimals: 1 })).toBe(`+0.5${NB}kg`);
    expect(formatBodyWeightInUnit('', 'lb', 'it-IT')).toBe('—');
  });

  it('bodyWeightToField: kg com\'è, lb come stringa a 0,1', () => {
    expect(bodyWeightToField('79.30', 'kg')).toBe('79.30');
    expect(bodyWeightToField('80.00', 'lb')).toBe('176.4');
    expect(bodyWeightToField('', 'lb')).toBe('');
    expect(bodyWeightToField(null, 'lb')).toBe('');
  });

  it('andata e ritorno: ogni 0,1 lb da 0 a 2204 → kg a 0,01 → stessa cifra', () => {
    for (let i = 0; i <= 22040; i += 1) {
      const lb = i / 10;
      const kg = inputToKg(String(lb), 'lb');
      expect(bodyWeightToField(kg, 'lb')).toBe(String(lb));
    }
  });
});
