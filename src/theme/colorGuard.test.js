// Guardia: nessun colore scritto a mano (hex o rgb/rgba/hsl) fuori dal tema (issue #15). I valori
// ammessi sono i file che disegnano su canvas con palette propria, e le ombre nere scritte dentro
// boxShadow (sono ombre, non palette: un'ombra nera scritta altrove, es. bgcolor, o tenuta in una
// variabile invece che scritta dentro boxShadow, resta una violazione).
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { relative } from 'node:path';
import { srcDir, walk, THEME_FILE } from '../test/sourceFiles';

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

// Nome della proprietà (es. "boxShadow", "bgcolor") che contiene il valore alla posizione data: risale
// il testo tenendo il conto della profondità di parentesi/graffe/quadre e dei "?" ternari in sospeso.
// Una "{" apre un nuovo oggetto (si riparte senza una proprietà corrente); una "(" o una "[" restano
// nello stesso valore (es. gli elementi di un array o gli argomenti di una funzione: erediteranno la
// proprietà del livello che le contiene). Una "," chiude la proprietà corrente solo dentro una "{"
// (dentro "(" o "[" fa parte dello stesso valore). Un "=" conta come i due punti di un oggetto: serve
// per un attributo JSX (bgcolor="...") o un'assegnazione (const c = '...'). Un ":" che chiude un
// ternario in sospeso (isDark ? shadowVar : '...') non viene scambiato per una nuova proprietà.
function nearestPropBefore(text, index) {
  let depth = 0;
  const propAtDepth = [null];
  const isBraceDepth = [true];
  const ternaryPending = [0];
  let quote = null;
  for (let i = 0; i < index; i++) {
    const c = text[i];
    if (quote) {
      if (c === '\\') { i++; continue; }
      if (c === quote) quote = null;
      continue;
    }
    if (c === '\'' || c === '"' || c === '`') { quote = c; continue; }
    if (c === '{') {
      depth++; propAtDepth[depth] = null; isBraceDepth[depth] = true; ternaryPending[depth] = 0;
      continue;
    }
    if (c === '(' || c === '[') {
      depth++; propAtDepth[depth] = propAtDepth[depth - 1]; isBraceDepth[depth] = false; ternaryPending[depth] = 0;
      continue;
    }
    if (c === '}' || c === ')' || c === ']') {
      propAtDepth.length = depth; isBraceDepth.length = depth; ternaryPending.length = depth;
      depth = Math.max(0, depth - 1);
      continue;
    }
    if (c === ',' && isBraceDepth[depth]) { propAtDepth[depth] = null; continue; }
    if (c === '?' && text[i + 1] !== '.' && text[i + 1] !== '?') { ternaryPending[depth]++; continue; }
    if (c === ':') {
      if (ternaryPending[depth] > 0) { ternaryPending[depth]--; continue; }
      const m = /(['"]?)([a-zA-Z_$][\w$]*)\1\s*$/.exec(text.slice(0, i));
      if (m) propAtDepth[depth] = m[2];
      continue;
    }
    if (c === '=' && text[i + 1] !== '=' && text[i - 1] !== '!' && text[i - 1] !== '<' && text[i - 1] !== '>') {
      const m = /([a-zA-Z_$][\w$]*)\s*$/.exec(text.slice(0, i));
      if (m) propAtDepth[depth] = m[1];
      continue;
    }
  }
  return propAtDepth[depth];
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

  it('un ternario con una variabile in un ramo e un\'ombra nell\'altro resta dentro boxShadow', () => {
    const text = "boxShadow: isDark ? shadowVar : '0 0 4px rgba(0,0,0,.2)',";
    expect(violationsIn('x.jsx', text)).toEqual([]);
  });

  it('un attributo JSX dopo un boxShadow non è dentro boxShadow', () => {
    const text = 'sx={{ boxShadow: 1 }} />\n<Box bgcolor="rgba(0,0,0,0.5)">';
    expect(violationsIn('x.jsx', text)).toEqual(['rgba(0,0,0,0.5)']);
  });

  it('un\'ombra assegnata a una variabile dopo un boxShadow non è dentro boxShadow: va scritta lì', () => {
    const text = "sx={{ boxShadow: '0 8px 24px rgba(0,0,0,0.08)' }}\nconst c = 'rgba(0,0,0,.5)';";
    expect(violationsIn('x.jsx', text)).toEqual(['rgba(0,0,0,.5)']);
  });

  it('bgcolor sulla riga dopo un boxShadow, nello stesso oggetto, non è ammesso', () => {
    const text = "sx={{ boxShadow: '0 8px 24px rgba(0,0,0,0.08)',\n  bgcolor: 'rgba(0,0,0,0.5)' }}";
    expect(violationsIn('x.jsx', text)).toEqual(['rgba(0,0,0,0.5)']);
  });

  it('un template literal dentro boxShadow resta ammesso', () => {
    expect(violationsIn('x.jsx', 'boxShadow: `0 10px 40px rgba(0,0,0,0.5)`,')).toEqual([]);
  });

  it('un array su più righe dentro boxShadow resta ammesso', () => {
    const text = "boxShadow: [\n  '0 1px 2px rgba(0,0,0,.1)',\n  '0 2px 4px rgba(0,0,0,.1)',\n].join(', '),";
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
