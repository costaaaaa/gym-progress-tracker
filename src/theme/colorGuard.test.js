// Guardia: nessun colore scritto a mano (hex o rgb/rgba/hsl) fuori dal tema (issue #15). I valori
// ammessi sono i file che disegnano su canvas con palette propria, e le ombre nere dentro boxShadow
// (sono ombre, non palette: un'ombra nera scritta altrove, es. bgcolor, resta una violazione).
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { relative } from 'node:path';
import { srcDir, walk, THEME_FILE } from './sourceFiles';

// File interi fuori dalla guardia: disegnano su canvas con template propri (vedi issue #15)
const SKIPPED_FILES = [
  'utils/shareCard.js',
  'utils/renderShareCard.js',
  'utils/celebrate.js',
  THEME_FILE, // qui vivono i token
];

// Valori ammessi solo in questo file: scacchiera di anteprima e card su canvas
const FILE_EXCEPTIONS = {
  'components/ShareCardDialog.jsx': ['#8a8a8a', '#6f6f6f', '#0a0a0b'],
};

const HEX_RE = /#(?:[0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{4}|[0-9a-fA-F]{3})\b/g;
const FUNC_RE = /\b(?:rgba?|hsla?)\([^)]*\)/g;

// Un'ombra nera rgba/rgb(0,0,0,…): non è un colore di palette, ma solo dentro boxShadow (altrove,
// es. bgcolor o color, resta una violazione).
const isBlackShadow = (value) => /^rgba?\(\s*0\s*,\s*0\s*,\s*0\s*[,)]/.test(value);

// Nome della proprietà (es. "boxShadow", "bgcolor") più vicina prima della posizione data: per sapere
// dentro quale prop sta il valore trovato, senza dover isolare l'espressione completa.
function nearestPropBefore(text, index) {
  let last = null;
  for (const m of text.matchAll(/([a-zA-Z_$][\w$]*)\s*:/g)) {
    if (m.index >= index) break;
    last = m[1];
  }
  return last;
}

function violationsIn(relPath, text) {
  if (SKIPPED_FILES.includes(relPath)) return [];
  const allowed = FILE_EXCEPTIONS[relPath] || [];
  const found = [];
  for (const re of [HEX_RE, FUNC_RE]) {
    for (const match of text.matchAll(re)) {
      const value = match[0];
      if (allowed.includes(value)) continue;
      if (isBlackShadow(value) && nearestPropBefore(text, match.index) === 'boxShadow') continue;
      found.push(value);
    }
  }
  return found;
}

describe('guardia colori: la regex', () => {
  it('trova gli hex e gli rgb/rgba/hsl scritti a mano', () => {
    const sample = "bgcolor: '#faf9f8', pill: 'rgba(34, 197, 94, 0.15)'";
    expect(sample.match(HEX_RE)).toEqual(['#faf9f8']);
    expect(sample.match(FUNC_RE)).toEqual(['rgba(34, 197, 94, 0.15)']);
  });

  it('trova anche gli hex corti, con alpha e a 8 cifre, e hsl/hsla', () => {
    const sample = "a: '#fff', b: '#fff8', c: '#ffffff80', d: 'hsl(210, 50%, 50%)', e: 'hsla(210, 50%, 50%, 0.5)'";
    expect(sample.match(HEX_RE)).toEqual(['#fff', '#fff8', '#ffffff80']);
    expect(sample.match(FUNC_RE)).toEqual(['hsl(210, 50%, 50%)', 'hsla(210, 50%, 50%, 0.5)']);
  });

  it('non trova un token del tema né un\'ancora come "#section"', () => {
    expect('radius.sm'.match(HEX_RE)).toBeNull();
    expect("to=\"#section\"".match(HEX_RE)).toBeNull();
  });

  it('riconosce un\'ombra nera come eccezione, non come colore', () => {
    expect(isBlackShadow('rgba(0,0,0,0.5)')).toBe(true);
    expect(isBlackShadow('rgba(0, 0, 0, 0.08)')).toBe(true);
    expect(isBlackShadow('rgba(213,0,0,0.4)')).toBe(false);
  });
});

describe('guardia colori: le ombre nere', () => {
  it('un\'ombra nera dentro boxShadow è ammessa', () => {
    expect(violationsIn('x.jsx', "sx={{ p: 1, boxShadow: '0 8px 24px rgba(0,0,0,0.08)' }}")).toEqual([]);
  });

  it('la stessa ombra nera fuori da boxShadow (es. bgcolor) non è ammessa', () => {
    expect(violationsIn('x.jsx', "sx={{ bgcolor: 'rgba(0,0,0,0.5)' }}")).toEqual(['rgba(0,0,0,0.5)']);
  });

  it('un\'ombra nera nel ramo di un ternario dentro boxShadow è ammessa in entrambi i rami', () => {
    const text = "boxShadow: isDark ? '0 10px 40px rgba(0,0,0,0.5)' : '0 10px 40px rgba(0,0,0,0.15)',";
    expect(violationsIn('x.jsx', text)).toEqual([]);
  });
});

describe('guardia colori: i sorgenti', () => {
  it('nessun file sotto src/ (fuori dal tema e dalle eccezioni) usa hex o rgb/rgba/hsl a mano', () => {
    const offenders = [];
    for (const file of walk(srcDir)) {
      const rel = relative(srcDir, file);
      const violations = violationsIn(rel, readFileSync(file, 'utf8'));
      if (violations.length) offenders.push(`${rel}: ${violations.join(', ')}`);
    }
    expect(offenders).toEqual([]);
  });
});
