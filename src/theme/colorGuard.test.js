// Guardia: nessun colore scritto a mano (hex o rgb/rgba/hsl) fuori dal tema (issue #15). I valori
// ammessi sono i file che disegnano su canvas con palette propria, e le ombre nere scritte dentro
// boxShadow (sono ombre, non palette: un'ombra nera scritta altrove, es. bgcolor, o tenuta in una
// variabile invece che scritta dentro boxShadow, resta una violazione).
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { relative } from 'node:path';
import { srcDir, walk, THEME_FILE } from '../test/sourceFiles';
import { parseSource, walkAst } from '../test/sourceAst';

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
// es. bgcolor o color, o tenuta in una variabile invece che scritta dentro boxShadow, resta una
// violazione).
const isBlackShadow = (value) => /^rgba?\(\s*0\s*,\s*0\s*,\s*0\s*[,)]/.test(value);

// Chiave di una Property o di un JSXAttribute, identificatore o stringa
function keyNameOf(node) {
  if (node.type === 'Property') return node.key.type === 'Identifier' ? node.key.name : String(node.key.value);
  if (node.type === 'JSXAttribute') return node.name.name;
  return null;
}

// true se tra gli antenati (a qualunque profondità: un ternario, una map, un join...) c'è una
// Property o un JSXAttribute con chiave "boxShadow"
const hasBoxShadowAncestor = (ancestors) => ancestors.some(
  (a) => (a.type === 'Property' || a.type === 'JSXAttribute') && keyNameOf(a) === 'boxShadow',
);

function colorsIn(value) {
  const found = [];
  for (const re of [HEX_RE, FUNC_RE]) {
    for (const m of value.matchAll(re)) found.push(m[0]);
  }
  return found;
}

// Ogni Literal stringa e ogni pezzo statico (quasi) di un TemplateLiteral: i commenti non sono nodi
// dell'albero, quindi un hex o un apostrofo in un commento non arriva mai qui.
function violationsIn(relPath, text) {
  if (SKIPPED_FILES.includes(relPath)) return [];
  const allowed = FILE_EXCEPTIONS[relPath] || [];
  const found = [];
  walkAst(parseSource(text), (node, ancestors) => {
    let value;
    if (node.type === 'Literal' && typeof node.value === 'string') value = node.value;
    else if (node.type === 'TemplateElement') value = node.value.cooked ?? '';
    else return;
    for (const color of colorsIn(value)) {
      if (allowed.includes(color)) continue;
      if (isBlackShadow(color) && hasBoxShadowAncestor(ancestors)) continue;
      found.push(color);
    }
  });
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
    const text = "const o = { p: 1, boxShadow: '0 8px 24px rgba(0,0,0,0.08)' };";
    expect(violationsIn('x.jsx', text)).toEqual([]);
  });

  it('la stessa ombra nera fuori da boxShadow (es. bgcolor) non è ammessa', () => {
    const text = "const o = { bgcolor: 'rgba(0,0,0,0.5)' };";
    expect(violationsIn('x.jsx', text)).toEqual(['rgba(0,0,0,0.5)']);
  });

  it('un\'ombra nera nel ramo di un ternario dentro boxShadow è ammessa in entrambi i rami', () => {
    const text = "const o = { boxShadow: isDark ? '0 10px 40px rgba(0,0,0,0.5)' : '0 10px 40px rgba(0,0,0,0.15)' };";
    expect(violationsIn('x.jsx', text)).toEqual([]);
  });

  it('un ternario con una variabile in un ramo e un\'ombra nell\'altro resta dentro boxShadow', () => {
    const text = "const o = { boxShadow: isDark ? shadowVar : '0 0 4px rgba(0,0,0,.2)' };";
    expect(violationsIn('x.jsx', text)).toEqual([]);
  });

  it('un attributo JSX dopo un boxShadow, su un altro elemento, non è dentro boxShadow', () => {
    const text = '<Foo sx={{ boxShadow: 1 }} />;\n<Box bgcolor="rgba(0,0,0,0.5)" />;';
    expect(violationsIn('x.jsx', text)).toEqual(['rgba(0,0,0,0.5)']);
  });

  it('un\'ombra assegnata a una variabile dopo un boxShadow non è dentro boxShadow: va scritta lì', () => {
    const text = "const o = { boxShadow: '0 8px 24px rgba(0,0,0,0.08)' };\nconst c = 'rgba(0,0,0,.5)';";
    expect(violationsIn('x.jsx', text)).toEqual(['rgba(0,0,0,.5)']);
  });

  it('bgcolor nello stesso oggetto di un boxShadow non è ammesso', () => {
    const text = "const o = { boxShadow: '0 8px 24px rgba(0,0,0,0.08)', bgcolor: 'rgba(0,0,0,0.5)' };";
    expect(violationsIn('x.jsx', text)).toEqual(['rgba(0,0,0,0.5)']);
  });

  it('un template literal dentro boxShadow resta ammesso', () => {
    const text = 'const o = { boxShadow: `0 10px 40px rgba(0,0,0,0.5)` };';
    expect(violationsIn('x.jsx', text)).toEqual([]);
  });

  it('un colore scritto nel pezzo statico di un template literal fuori da boxShadow non è ammesso', () => {
    const text = 'const o = { bgcolor: `${x} rgba(0,0,0,0.5)` };';
    expect(violationsIn('x.jsx', text)).toEqual(['rgba(0,0,0,0.5)']);
  });

  it('un array su più righe dentro boxShadow resta ammesso', () => {
    const text = "const o = { boxShadow: [\n  '0 1px 2px rgba(0,0,0,.1)',\n  '0 2px 4px rgba(0,0,0,.1)',\n].join(', ') };";
    expect(violationsIn('x.jsx', text)).toEqual([]);
  });

  it('un "??" prima del boxShadow, nello stesso oggetto, non confonde la sua ombra', () => {
    const text = "const o = { label: a ?? 'x', boxShadow: '0 8px 24px rgba(0,0,0,0.08)' };";
    expect(violationsIn('x.jsx', text)).toEqual([]);
  });

  it('un\'ombra restituita da una map dentro boxShadow resta ammessa', () => {
    const text = "const o = { boxShadow: list.map((s) => '0 0 4px rgba(0,0,0,.2)').join(', ') };";
    expect(violationsIn('x.jsx', text)).toEqual([]);
  });

  it('un commento con apostrofo prima di un boxShadow non confonde la guardia', () => {
    const text = "// L'ombra sotto la card\nconst o = { boxShadow: '0 8px 24px rgba(0,0,0,0.08)' };";
    expect(violationsIn('x.jsx', text)).toEqual([]);
  });

  it('un hex scritto in un commento non viene segnalato', () => {
    const text = "// colore vecchio #ff0000\nconst o = { boxShadow: '0 8px 24px rgba(0,0,0,0.08)' };";
    expect(violationsIn('x.jsx', text)).toEqual([]);
  });

  it('un\'ombra nera in un attributo JSX boxShadow (non dentro un oggetto) è ammessa', () => {
    const text = '<Box boxShadow="0 8px 24px rgba(0,0,0,0.08)" />;';
    expect(violationsIn('x.jsx', text)).toEqual([]);
  });

  it('un\'ombra nera dentro un boxShadow con la chiave tra virgolette è ammessa', () => {
    const text = "const o = { 'boxShadow': '0 8px 24px rgba(0,0,0,0.08)' };";
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
