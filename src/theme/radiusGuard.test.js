// Guardia: nessun borderRadius della scala scritto a mano fuori dal tema (issue #15). Restano scritti
// 0, '50%', i raggi sottili e i calcolati: non sono valori della scala, non li riguarda questa guardia.
// I file .css restano fuori (walk elenca solo .js/.jsx): App.css ha border-radius scritti a mano.
import { describe, it, expect } from 'vitest';
import { sourceOffenders, THEME_FILE } from '../test/sourceFiles';
import { parseSource, walkAst, keyNameOf, staticTextOf } from '../test/sourceAst';
import { radius } from './radius';

// File fuori dalla guardia: qui vive la scala stessa
const SKIPPED_FILES = ['theme/radius.js', THEME_FILE];

const SCALE_PX = Object.values(radius);
const SCALE_NUM = SCALE_PX.map((px) => px.replace('px', ''));
// Numeri sx che cadono nella scala: in sx un numero si moltiplica per theme.shape.borderRadius (16),
// quindi vale px × 16. Le frazioni sono gli stessi raggi scritti come frazione di 16 invece che in px.
// Sono segnalati anche fuori da sx (in uno style={{}} 1 vale 1px e 0.5 vale 0.5px): lì un raggio così
// si scrive come stringa ('1px'), che la guardia non tocca.
const SX_SCALE_NUMBERS = [
  '0.5',   // 0.5 × 16 = 8px, radius.sm
  '0.625', // 0.625 × 16 = 10px, radius.md
  '0.75',  // 0.75 × 16 = 12px, radius.lg
  '0.875', // 0.875 × 16 = 14px, radius.xl
  '1',     // 1 × 16 = 16px, radius.xxl
];
const SCALE_NUMBERS = [...SCALE_NUM, ...SX_SCALE_NUMBERS];

const PX_RE = /\d+(?:\.\d+)?px/g;
const RADIUS_KEY_RE = /^border\w*Radius$/;

// Scende dentro il valore di un borderRadius a caccia dei nodi letterali da controllare: un
// JSXExpressionContainer ({...} in JSX), entrambi i rami di un ternario o di un "??"/"||", i valori di
// un oggetto (con qualunque chiave: per un raggio è l'oggetto responsivo { xs: ..., md: ... }) e gli
// elementi di un array. Il resto (una chiamata come theme.spacing(1), un calcolo come 10 + x, un token
// del tema come radius.lg) non si controlla: non è un valore scritto a mano.
function* radiusLiterals(node) {
  if (!node) return;
  switch (node.type) {
    case 'JSXExpressionContainer':
      yield* radiusLiterals(node.expression);
      break;
    case 'ConditionalExpression':
      yield* radiusLiterals(node.consequent);
      yield* radiusLiterals(node.alternate);
      break;
    case 'LogicalExpression':
      yield* radiusLiterals(node.left);
      yield* radiusLiterals(node.right);
      break;
    case 'ObjectExpression':
      for (const prop of node.properties) yield* radiusLiterals(prop.value);
      break;
    case 'ArrayExpression':
      for (const el of node.elements) yield* radiusLiterals(el);
      break;
    case 'Literal':
      yield node;
      break;
    case 'TemplateLiteral':
      yield* node.quasis;
      break;
    default:
      break;
  }
}

function scaleViolationsOf(valueNode) {
  const found = [];
  for (const node of radiusLiterals(valueNode)) {
    if (typeof node.value === 'number') {
      if (SCALE_NUMBERS.includes(String(node.value))) found.push(String(node.value));
      continue;
    }
    for (const token of staticTextOf(node)?.match(PX_RE) || []) {
      if (SCALE_PX.includes(token)) found.push(token);
    }
  }
  return found;
}

// Ogni Property e ogni JSXAttribute con chiave border*Radius (identificatore o stringa)
function scaleViolations(text, fileName) {
  const found = [];
  walkAst(parseSource(text, fileName), (node) => {
    const key = keyNameOf(node);
    if (!key || !RADIUS_KEY_RE.test(key)) return;
    found.push(...scaleViolationsOf(node.value));
  });
  return found;
}

describe('guardia raggi: cosa trova', () => {
  it('trova un valore della scala, anche nel ramo di un ternario', () => {
    expect(scaleViolations("const o = { borderRadius: '12px' };")).toEqual(['12px']);
    expect(scaleViolations('const o = { borderRadius: 999 };')).toEqual(['999']);
    expect(scaleViolations("const o = { borderRadius: row.is_me ? '10px' : 0 };")).toEqual(['10px']);
    expect(scaleViolations("const o = { borderRadius: fullScreen ? 0 : '16px' };")).toEqual(['16px']);
  });

  it('non trova i raggi sottili, i calcolati, "50%", "0" o un token del tema', () => {
    expect(scaleViolations("const o = { borderRadius: '4px' };")).toEqual([]);
    expect(scaleViolations("const o = { borderRadius: '50%' };")).toEqual([]);
    expect(scaleViolations('const o = { borderRadius: 0 };')).toEqual([]);
    expect(scaleViolations('const o = { borderRadius: 4 };')).toEqual([]);
    expect(scaleViolations('const o = { borderRadius: radius.lg };')).toEqual([]);
    expect(scaleViolations('const o = { borderRadius: `${height / 2}px` };')).toEqual([]);
  });
});

describe('guardia raggi: varianti di scrittura', () => {
  it('trova anche le varianti border*Radius, non solo borderRadius', () => {
    expect(scaleViolations("const o = { borderTopLeftRadius: '12px' };")).toEqual(['12px']);
  });

  it('trova il valore tra doppi apici o backtick, non solo tra apici singoli', () => {
    expect(scaleViolations('const o = { borderRadius: "12px" };')).toEqual(['12px']);
    expect(scaleViolations('const o = { borderRadius: `12px` };')).toEqual(['12px']);
  });

  it('trova il prop JSX borderRadius="12px"', () => {
    expect(scaleViolations('<Box borderRadius="12px" />;')).toEqual(['12px']);
  });

  it('trova il prop JSX borderRadius={12} e borderRadius={\'12px\'}, tra graffe', () => {
    expect(scaleViolations('<Box borderRadius={12} />;')).toEqual(['12']);
    expect(scaleViolations("<Box borderRadius={'12px'} />;")).toEqual(['12px']);
  });

  it('trova un valore della scala dentro un oggetto responsivo', () => {
    expect(scaleViolations("const o = { borderRadius: { xs: '8px', md: '12px' } };")).toEqual(['8px', '12px']);
  });

  it('in sx il numero 1 vale 16px, come radius.xxl: va segnalato', () => {
    expect(scaleViolations('const o = { borderRadius: 1 };')).toEqual(['1']);
  });
});

describe('guardia raggi: valori annidati e chiavi insolite', () => {
  it('trova le frazioni sx che cadono nella scala (0.5, 0.625, 0.75, 0.875)', () => {
    expect(scaleViolations('const o = { borderRadius: 0.5 };')).toEqual(['0.5']);
    expect(scaleViolations('const o = { borderRadius: 0.625 };')).toEqual(['0.625']);
    expect(scaleViolations('const o = { borderRadius: 0.75 };')).toEqual(['0.75']);
    expect(scaleViolations('const o = { borderRadius: 0.875 };')).toEqual(['0.875']);
  });

  it('trova un valore della scala anche quando non è l\'unico token della stringa', () => {
    expect(scaleViolations("const o = { borderRadius: '0 0 12px 12px' };")).toEqual(['12px', '12px']);
    expect(scaleViolations('const o = { borderRadius: `${x} 12px` };')).toEqual(['12px']);
  });

  it('trova border*Radius anche con la chiave tra virgolette', () => {
    expect(scaleViolations("const o = { 'borderRadius': '12px' };")).toEqual(['12px']);
    expect(scaleViolations('const o = { "borderTopLeftRadius": 8 };')).toEqual(['8']);
    expect(scaleViolations("const o = { ['borderRadius']: 12 };")).toEqual(['12']);
  });

  it('non legge una chiave calcolata da una variabile, anche se si chiama borderRadius', () => {
    expect(scaleViolations('const o = { [borderRadius]: 12 };')).toEqual([]);
  });

  it('non segnala un numero della scala che è solo un pezzo di un\'espressione', () => {
    // theme.spacing(1) non è "il numero 1": è una chiamata, un nodo diverso da un Literal numerico,
    // non va segnalata per caso solo perché contiene la cifra "1". Stesso discorso per 10 + x.
    expect(scaleViolations('const o = { borderRadius: theme.spacing(1) };')).toEqual([]);
    expect(scaleViolations('const o = { borderRadius: 10 + x };')).toEqual([]);
  });

  it('trova un valore della scala dentro un oggetto responsivo con numeri misti', () => {
    expect(scaleViolations('const o = { borderRadius: { xs: 1, md: 0.75 } };')).toEqual(['1', '0.75']);
    expect(scaleViolations('const o = { borderRadius: { xs: radius.sm, md: 12 } };')).toEqual(['12']);
  });

  it('trova un valore della scala dentro un array responsivo (breakpoint array di sx)', () => {
    expect(scaleViolations('const o = { borderRadius: [8, radius.md, 12] };')).toEqual(['8', '12']);
  });

  it('scende in entrambi i lati di "??"/"||" e in un ternario annidato', () => {
    expect(scaleViolations('const o = { borderRadius: x ?? 12 };')).toEqual(['12']);
    expect(scaleViolations('const o = { borderRadius: x || 12 };')).toEqual(['12']);
    expect(scaleViolations('const o = { borderRadius: a ? (b ? 12 : 8) : 10 };')).toEqual(['12', '8', '10']);
  });

  it('un ramo stringa con un ":" dentro non confonde il ramo numerico dello stesso ternario', () => {
    expect(scaleViolations("const o = { borderRadius: isA ? 'a:b' : 12 };")).toEqual(['12']);
  });
});

describe('guardia raggi: file con un errore di sintassi', () => {
  it('ferma la guardia con il nome del file', () => {
    expect(() => scaleViolations('const o = {;', 'components/Rotto.jsx')).toThrow(/^components\/Rotto\.jsx: /);
  });
});

describe('guardia raggi: la scala', () => {
  it('è l\'oggetto deciso con l\'utente, come nell\'app', () => {
    expect(radius).toEqual({ sm: '8px', md: '10px', lg: '12px', xl: '14px', xxl: '16px', pill: '999px' });
  });
});

describe('guardia raggi: i sorgenti', () => {
  it('nessun file sotto src/ (fuori dal tema) scrive a mano un borderRadius della scala', () => {
    expect(sourceOffenders(scaleViolations, SKIPPED_FILES)).toEqual([]);
  });
});
