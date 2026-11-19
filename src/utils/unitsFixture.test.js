import { describe, it, expect } from 'vitest';
import { readFileSync, writeFileSync } from 'node:fs';
import { kgToDisplay, BODY_LB_DIVISIONS } from './weightUnit';
import { cmToDisplay } from './lengthUnit';

// Fixture delle conversioni kg → lb e cm → pollici, generata dai moduli veri (weightUnit.js, lengthUnit.js) e riletta
// dal test PHP dell'export (tests/units_test.php) con confronto esatto: le due implementazioni devono dare gli stessi
// numeri. Questo test garantisce che il file sia fresco. Per rigenerarlo dopo un cambio alle regole:
//   UPDATE_UNITS_FIXTURE=1 npx vitest run src/utils/unitsFixture.test.js

const FIXTURE_PATH = 'tests/fixtures/units_cases.json'; // relativo alla radice del repo (cwd di vitest)
const QUARTER = 4;
const GRID_MAX_CENTS = 30000; // da 0 a 300,00 con passo 0,01

// Un valore a 0,01 da un numero intero di centesimi, come arriva dal database (testo "83.25" → numero)
const fromCents = (cents) => Number((cents / 100).toFixed(2));

const grid = (convert) => Array.from({ length: GRID_MAX_CENTS + 1 }, (_, cents) => convert(fromCents(cents)));

// Oltre i 300: una serie arriva a 999,99 kg e il peso corporeo a 500 kg. Griglia rada, passo 0,07
const SPARSE_STEP_CENTS = 7;
const sparse = (startCents, toCents, convert) => ({
  from_cents: startCents,
  step_cents: SPARSE_STEP_CENTS,
  expected: Array.from({ length: Math.floor((toCents - startCents) / SPARSE_STEP_CENTS) + 1 }, (_, i) => convert(startCents + i * SPARSE_STEP_CENTS)),
});

const POINT_VALUES = [0, 0.01, 0.11, 0.12, 0.13, 0.5, 1, 1.27, 2.54, 2.55, 20, 45.36, 60, 83.25, 100, 100.5, 226.8, 300, 999.99];

const buildCases = () => ({
  note: 'Generato da src/utils/unitsFixture.test.js dai moduli JS: non modificare a mano.',
  points: [
    ...POINT_VALUES.map((input) => ({ kind: 'weight_quarter', input, expected: kgToDisplay(input, 'lb', QUARTER) })),
    ...POINT_VALUES.map((input) => ({ kind: 'weight_tenth', input, expected: kgToDisplay(input, 'lb', BODY_LB_DIVISIONS) })),
    ...POINT_VALUES.map((input) => ({ kind: 'length_tenth', input, expected: cmToDisplay(input, 'lb') })),
  ],
  grids: {
    description: 'input = indice / 100 (0,00 … 300,00); expected[indice] = valore convertito',
    weight_quarter: grid((kg) => kgToDisplay(kg, 'lb', QUARTER)),
    weight_tenth: grid((kg) => kgToDisplay(kg, 'lb', BODY_LB_DIVISIONS)),
    length_tenth: grid((cm) => cmToDisplay(cm, 'lb')),
  },
  sparse: {
    description: 'input = (from_cents + indice * step_cents) / 100; expected[indice] = valore convertito',
    weight_quarter: sparse(GRID_MAX_CENTS + 1, 99999, (cents) => kgToDisplay(fromCents(cents), 'lb', QUARTER)),
    weight_tenth: sparse(GRID_MAX_CENTS + 1, 50000, (cents) => kgToDisplay(fromCents(cents), 'lb', BODY_LB_DIVISIONS)),
  },
});

// Un valore per riga di griglia sarebbe enorme: una riga per griglia
const serialize = (cases) => {
  const { grids, sparse: sparseGrids, points, ...rest } = cases;
  const { description, ...lists } = grids;
  const gridLines = Object.entries(lists).map(([name, values]) => `    ${JSON.stringify(name)}: ${JSON.stringify(values)}`);
  const { description: sparseDescription, ...sparseLists } = sparseGrids;
  const sparseLines = Object.entries(sparseLists).map(([name, g]) => `    ${JSON.stringify(name)}: ${JSON.stringify(g)}`);
  const pointLines = points.map((p) => `    ${JSON.stringify(p)}`);
  return `{\n  "note": ${JSON.stringify(rest.note)},\n  "points": [\n${pointLines.join(',\n')}\n  ],\n  "grids": {\n    "description": ${JSON.stringify(description)},\n${gridLines.join(',\n')}\n  },\n  "sparse": {\n    "description": ${JSON.stringify(sparseDescription)},\n${sparseLines.join(',\n')}\n  }\n}\n`;
};

describe('fixture delle conversioni', () => {
  it('tests/fixtures/units_cases.json è quella che generano i moduli JS', () => {
    const fresh = serialize(buildCases());
    if (globalThis.process?.env.UPDATE_UNITS_FIXTURE) writeFileSync(FIXTURE_PATH, fresh);
    expect(readFileSync(FIXTURE_PATH, 'utf8')).toBe(fresh);
  });

  it('i valori noti sono quelli attesi dall\'app', () => {
    expect(kgToDisplay(100, 'lb', QUARTER)).toBe(220.5);
    expect(kgToDisplay(83.25, 'lb', BODY_LB_DIVISIONS)).toBe(183.5);
    expect(cmToDisplay(83.25, 'lb')).toBe(32.8);
  });
});
