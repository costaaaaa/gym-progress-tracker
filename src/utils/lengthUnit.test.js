import { describe, it, expect } from 'vitest';
import {
  CM_PER_IN, lengthUnitLabel, cmToDisplay, formatLengthInUnit, lengthInputToCm, fieldTextToCmText, maxLengthInUnit,
} from './lengthUnit';
import { BODY_LIMITS } from './bodyStatsRules';

const NB = ' ';

describe('costanti e etichetta', () => {
  it('1 in = 2,54 cm esatti', () => {
    expect(CM_PER_IN).toBe(2.54);
  });

  it('cm con kg (e con un valore non valido), in con lb', () => {
    expect(lengthUnitLabel('kg')).toBe('cm');
    expect(lengthUnitLabel('lb')).toBe('in');
    expect(lengthUnitLabel(undefined)).toBe('cm');
    expect(lengthUnitLabel('st')).toBe('cm');
  });
});

describe('cmToDisplay', () => {
  it('in cm il valore com\'è, anche da testo', () => {
    expect(cmToDisplay(83.25, 'kg')).toBe(83.25);
    expect(cmToDisplay('83.25', 'kg')).toBe(83.25);
  });

  it('in pollici a un decimale', () => {
    expect(cmToDisplay(100, 'lb')).toBe(39.4); // 39,37
    expect(cmToDisplay('83.25', 'lb')).toBe(32.8); // 32,78
    expect(cmToDisplay(2.54, 'lb')).toBe(1);
    expect(cmToDisplay(300, 'lb')).toBe(118.1); // 118,11
    expect(cmToDisplay(0, 'lb')).toBe(0);
  });

  it('mancante o non numerico: null', () => {
    expect(cmToDisplay(null, 'lb')).toBeNull();
    expect(cmToDisplay('', 'lb')).toBeNull();
    expect(cmToDisplay(undefined, 'kg')).toBeNull();
    expect(cmToDisplay('abc', 'lb')).toBeNull();
  });

  it('il decimale a metà sale: 0,127 cm sono 0,05 in, ma non esiste un cm a 0,01 che cada a metà', () => {
    // 0,13 cm = 0,0512 in → 0,1; 0,12 cm = 0,0472 in → 0
    expect(cmToDisplay(0.13, 'lb')).toBe(0.1);
    expect(cmToDisplay(0.12, 'lb')).toBe(0);
  });
});

describe('formatLengthInUnit', () => {
  it('cm con la lingua, in con un decimale, spazio non separabile e unità', () => {
    expect(formatLengthInUnit(83.25, 'kg', 'it-IT')).toBe(`83,25${NB}cm`);
    expect(formatLengthInUnit(100, 'lb', 'it-IT')).toBe(`39,4${NB}in`);
    expect(formatLengthInUnit(100, 'lb', 'en-US')).toBe(`39.4${NB}in`);
    expect(formatLengthInUnit(30.48, 'lb', 'en-US')).toBe(`12${NB}in`);
  });

  it('unit: false dà solo il numero; senza valore "—"', () => {
    expect(formatLengthInUnit(100, 'lb', 'it-IT', { unit: false })).toBe('39,4');
    expect(formatLengthInUnit(102, 'kg', 'it-IT', { unit: false })).toBe('102');
    expect(formatLengthInUnit(null, 'lb', 'it-IT')).toBe('—');
    expect(formatLengthInUnit('', 'kg', 'it-IT')).toBe('—');
  });
});

describe('lengthInputToCm: testo scritto nell\'unità → cm a 0,01', () => {
  it('in cm il testo com\'è arrotondato a 0,01, in pollici × 2,54', () => {
    expect(lengthInputToCm('83.25', 'kg')).toBe(83.25);
    expect(lengthInputToCm('83,25', 'kg')).toBe(83.25);
    expect(lengthInputToCm('32.8', 'lb')).toBe(83.31); // 83,312
    expect(lengthInputToCm('1', 'lb')).toBe(2.54);
    expect(lengthInputToCm('118.1', 'lb')).toBe(299.97); // 299,974
  });

  it('arrotonda ai mezzi per eccesso senza errori di virgola mobile', () => {
    expect(lengthInputToCm('2.675', 'kg')).toBe(2.68);
    expect(lengthInputToCm('8.345', 'kg')).toBe(8.35);
    // 10,25 in = 26,035 cm esatti → 26,04 (con Math.round(x * 100) / 100 darebbe 26,03)
    expect(lengthInputToCm('10.25', 'lb')).toBe(26.04);
  });

  it('testo non valido: null', () => {
    ['', 'abc', '12abc', '1e3', '0x10', '1.000,5', '-0', '-5', '.5', '5.', ' ', 'NaN', 'Infinity'].forEach((text) => {
      expect(lengthInputToCm(text, 'lb')).toBeNull();
      expect(lengthInputToCm(text, 'kg')).toBeNull();
    });
  });
});

describe('fieldTextToCmText: campo → testo in cm per le regole e il payload', () => {
  it('in cm il testo com\'è (anche non valido: lo giudicano le regole), vuoto resta vuoto', () => {
    expect(fieldTextToCmText('83.25', 'kg')).toBe('83.25');
    expect(fieldTextToCmText('abc', 'kg')).toBe('abc');
    expect(fieldTextToCmText('', 'kg')).toBe('');
  });

  it('in pollici cm a 0,01 come testo; non valido null; vuoto vuoto', () => {
    expect(fieldTextToCmText('32.8', 'lb')).toBe('83.31');
    expect(fieldTextToCmText('', 'lb')).toBe('');
    expect(fieldTextToCmText('1e2', 'lb')).toBeNull();
    expect(fieldTextToCmText('-5', 'lb')).toBeNull();
  });
});

describe('maxLengthInUnit', () => {
  it('in cm il limite com\'è; in pollici il decimo più alto sotto di esso', () => {
    expect(maxLengthInUnit(300, 'kg')).toBe(300);
    expect(maxLengthInUnit(300, 'lb')).toBe(118.1); // 118,11
    expect(maxLengthInUnit(150, 'lb')).toBe(59); // 59,06
    expect(maxLengthInUnit(200, 'lb')).toBe(78.7); // 78,74
  });

  it('il massimo scrivibile in pollici è accettato dal server; un decimo in più no', () => {
    Object.entries(BODY_LIMITS).filter(([name]) => name.endsWith('_size')).forEach(([, max]) => {
      const top = maxLengthInUnit(max, 'lb');
      expect(lengthInputToCm(String(top), 'lb')).toBeLessThanOrEqual(max);
      expect(lengthInputToCm(String(Math.round((top + 0.1) * 10) / 10), 'lb')).toBeGreaterThan(max);
    });
  });
});

describe('stabilità: pollici → cm (0,01) → pollici', () => {
  it('ogni decimo di pollice da 0 al massimo di ogni misura torna uguale (tutto l\'intervallo)', () => {
    const bad = [];
    const maxTenths = Math.round(maxLengthInUnit(Math.max(...Object.entries(BODY_LIMITS).filter(([n]) => n.endsWith('_size')).map(([, m]) => m)), 'lb') * 10);
    for (let tenths = 0; tenths <= maxTenths; tenths++) {
      const inches = tenths / 10;
      const cm = lengthInputToCm(String(inches), 'lb');
      const back = cmToDisplay(cm, 'lb');
      if (back !== inches) bad.push([inches, cm, back]);
    }
    expect(bad).toEqual([]);
    expect(maxTenths).toBe(1181);
  });

  it('e oltre, fino a 400 in, per non dipendere dai limiti di oggi', () => {
    const bad = [];
    for (let tenths = 0; tenths <= 4000; tenths++) {
      const inches = tenths / 10;
      const back = cmToDisplay(lengthInputToCm(String(inches), 'lb'), 'lb');
      if (back !== inches) bad.push([inches, back]);
    }
    expect(bad).toEqual([]);
  });
});
