// Guardia: nessun borderRadius della scala scritto a mano fuori dal tema (issue #15). Restano scritti
// 0, '50%', i raggi sottili e i calcolati: non sono valori della scala, non li riguarda questa guardia.
// I file .css restano fuori (regex solo su .js/.jsx): App.css ha border-radius scritti a mano.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { relative } from 'node:path';
import { srcDir, walk, THEME_FILE } from '../test/sourceFiles';
import { radius } from './radius';

// File fuori dalla guardia: qui vive la scala stessa
const SKIPPED_FILES = ['theme/radius.js', THEME_FILE];

const SCALE_PX = Object.values(radius);
const SCALE_NUM = SCALE_PX.map((px) => px.replace('px', ''));
// Numeri sx che cadono nella scala: in sx un numero si moltiplica per theme.shape.borderRadius (16),
// quindi vale px × 16. Le frazioni sono gli stessi raggi scritti come frazione di 16 invece che in px.
const SX_SCALE_NUMBERS = [
  '0.5',   // 0.5 × 16 = 8px, radius.sm
  '0.625', // 0.625 × 16 = 10px, radius.md
  '0.75',  // 0.75 × 16 = 12px, radius.lg
  '0.875', // 0.875 × 16 = 14px, radius.xl
  '1',     // 1 × 16 = 16px, radius.xxl
];
const SCALE_NUMBERS = [...SCALE_NUM, ...SX_SCALE_NUMBERS];

// Cattura il testo grezzo di un valore (stringa compresa, non interpretata) a partire da "start",
// carattere per carattere: salta per intero le stringhe tra virgolette (gestendo l'escape), conta la
// profondità di parentesi/graffe annidate e si ferma quando "stop" dice che il carattere corrente, a
// profondità zero e fuori da una stringa, segna il confine del valore. Gestisce così anche il ramo di
// un ternario o un oggetto responsivo ({ xs: '8px', md: '12px' }), dove fermarsi alla prima "," o "}"
// del testo (senza contare la profondità) tronca il valore troppo presto.
function captureValue(text, start, stop) {
  let i = start;
  let depth = 0;
  let quote = null;
  while (i < text.length) {
    const c = text[i];
    if (quote) {
      if (c === '\\') { i += 2; continue; }
      if (c === quote) quote = null;
    } else if (c === '\'' || c === '"' || c === '`') {
      quote = c;
    } else if (c === '{' || c === '(' || c === '[') {
      depth++;
    } else if (c === '}' || c === ')' || c === ']') {
      if (depth === 0) break;
      depth--;
    } else if (depth === 0 && stop(c)) {
      break;
    }
    i++;
  }
  return text.slice(start, i);
}

const captureObjectValue = (text, start) => captureValue(text, start, (c) => c === ',');

// Stessa idea per il prop JSX borderRadius="12px" / borderRadius={...}: gli attributi JSX sono separati
// da spazi, non da virgole. Una stringa tra virgolette si prende per intero (si ferma da sola
// all'escape o alla virgoletta di chiusura); un'espressione tra graffe usa lo scanner comune, fermato
// solo dalla graffa di chiusura (il parametro "stop" non serve, ci pensa il bilanciamento delle graffe).
function captureJsxValue(text, start) {
  let i = start;
  while (text[i] === ' ') i++;
  if (text[i] === '"' || text[i] === '\'' || text[i] === '`') {
    const quote = text[i];
    let j = i + 1;
    while (j < text.length && text[j] !== quote) { if (text[j] === '\\') j++; j++; }
    return text.slice(i, j + 1);
  }
  if (text[i] === '{') {
    return captureValue(text, i + 1, () => false);
  }
  return '';
}

// Ogni occorrenza di border*Radius (sia come prop di un oggetto/sx, ":", sia come attributo JSX, "=",
// anche con la chiave tra virgolette, es. 'borderRadius': …), con il testo del suo valore ancora grezzo
// (stringa compresa, non interpretato).
function radiusExpressions(text) {
  const out = [];
  for (const m of text.matchAll(/['"]?border\w*Radius['"]?\s*([:=])/g)) {
    const start = m.index + m[0].length;
    out.push(m[1] === '=' ? captureJsxValue(text, start) : captureObjectValue(text, start));
  }
  return out;
}

// Tutte le stringhe tra virgolette dentro "expr" (anche più di una, es. nei due rami di un ternario),
// senza le virgolette: serve a trovare un valore della scala anche quando non è l'unico token della
// stringa, es. '0 0 12px 12px' o `${x} 12px`.
function quotedStrings(expr) {
  const out = [];
  for (let i = 0; i < expr.length; i++) {
    const c = expr[i];
    if (c === '\'' || c === '"' || c === '`') {
      let j = i + 1;
      while (j < expr.length && expr[j] !== c) { if (expr[j] === '\\') j++; j++; }
      out.push(expr.slice(i + 1, j));
      i = j;
    }
  }
  return out;
}

// I rami di valore di "expr": con un ternario "cond ? a : b" sono i valori dei due rami (il "?" e il
// primo ":" allo stesso livello la separano dalla condizione); senza ternario è l'espressione stessa.
// Ternari annidati non sono gestiti: nei sorgenti attuali non ce ne sono. Serve a non segnalare un
// numero della scala che è solo un pezzo di un'espressione più ampia (theme.spacing(1), 10 + x): il
// numero conta solo se è l'intero valore di un ramo, non una sua sottostringa.
function valueBranches(expr) {
  const q = expr.indexOf('?');
  if (q === -1) return [expr];
  const rest = expr.slice(q + 1);
  const c = rest.indexOf(':');
  return c === -1 ? [rest] : [rest.slice(0, c), rest.slice(c + 1)];
}

function scaleViolations(text) {
  const found = [];
  for (const expr of radiusExpressions(text)) {
    for (const str of quotedStrings(expr)) {
      for (const token of str.match(/\d+(?:\.\d+)?px/g) || []) {
        if (SCALE_PX.includes(token)) found.push(token);
      }
    }
    const branches = valueBranches(expr).map((b) => b.trim());
    for (const n of SCALE_NUMBERS) {
      if (branches.includes(n)) found.push(n);
    }
  }
  return found;
}

describe('guardia raggi: la regex', () => {
  it('trova un valore della scala, anche nel ramo di un ternario', () => {
    expect(scaleViolations("borderRadius: '12px',")).toEqual(['12px']);
    expect(scaleViolations('borderRadius: 999,')).toEqual(['999']);
    expect(scaleViolations("borderRadius: row.is_me ? '10px' : 0,")).toEqual(['10px']);
    expect(scaleViolations("borderRadius: fullScreen ? 0 : '16px',")).toEqual(['16px']);
  });

  it('non trova i raggi sottili, i calcolati, "50%", "0" o un token del tema', () => {
    expect(scaleViolations("borderRadius: '4px',")).toEqual([]);
    expect(scaleViolations("borderRadius: '50%',")).toEqual([]);
    expect(scaleViolations('borderRadius: 0,')).toEqual([]);
    expect(scaleViolations('borderRadius: 4,')).toEqual([]);
    expect(scaleViolations('borderRadius: radius.lg,')).toEqual([]);
    expect(scaleViolations('borderRadius: `${height / 2}px`,')).toEqual([]);
  });
});

describe('guardia raggi: varianti di scrittura', () => {
  it('trova anche le varianti border*Radius, non solo borderRadius', () => {
    expect(scaleViolations("borderTopLeftRadius: '12px',")).toEqual(['12px']);
  });

  it('trova il valore tra doppi apici o backtick, non solo tra apici singoli', () => {
    expect(scaleViolations('borderRadius: "12px",')).toEqual(['12px']);
    expect(scaleViolations('borderRadius: `12px`,')).toEqual(['12px']);
  });

  it('trova il prop JSX borderRadius="12px"', () => {
    expect(scaleViolations('<Box borderRadius="12px" />')).toEqual(['12px']);
  });

  it('trova il prop JSX borderRadius={12} e borderRadius={\'12px\'}, tra graffe', () => {
    expect(scaleViolations('<Box borderRadius={12} />')).toEqual(['12']);
    expect(scaleViolations("<Box borderRadius={'12px'} />")).toEqual(['12px']);
  });

  it('trova un valore della scala dentro un oggetto responsivo', () => {
    expect(scaleViolations("borderRadius: { xs: '8px', md: '12px' },")).toEqual(['8px', '12px']);
  });

  it('in sx il numero 1 vale 16px, come radius.xxl: va segnalato', () => {
    expect(scaleViolations('borderRadius: 1,')).toEqual(['1']);
  });
});

describe('guardia raggi: forme che sfuggono', () => {
  it('trova le frazioni sx che cadono nella scala (0.5, 0.625, 0.75, 0.875)', () => {
    expect(scaleViolations('borderRadius: 0.5,')).toEqual(['0.5']);
    expect(scaleViolations('borderRadius: 0.625,')).toEqual(['0.625']);
    expect(scaleViolations('borderRadius: 0.75,')).toEqual(['0.75']);
    expect(scaleViolations('borderRadius: 0.875,')).toEqual(['0.875']);
  });

  it('trova un valore della scala anche quando non è l\'unico token della stringa', () => {
    expect(scaleViolations("borderRadius: '0 0 12px 12px',")).toEqual(['12px', '12px']);
    expect(scaleViolations('borderRadius: `${x} 12px`,')).toEqual(['12px']);
  });

  it('trova border*Radius anche con la chiave tra virgolette', () => {
    expect(scaleViolations("'borderRadius': '12px',")).toEqual(['12px']);
    expect(scaleViolations('"borderTopLeftRadius": 8,')).toEqual(['8']);
  });

  it('non segnala un numero della scala che è solo un pezzo di un\'espressione', () => {
    // theme.spacing(1) non è "il numero 1": è una chiamata che produce un'altra unità, non va
    // segnalata per caso solo perché contiene la cifra "1".
    expect(scaleViolations('borderRadius: theme.spacing(1),')).toEqual([]);
    expect(scaleViolations('borderRadius: 10 + x,')).toEqual([]);
  });
});

describe('guardia raggi: la scala', () => {
  it('è l\'oggetto deciso con l\'utente, come nell\'app', () => {
    expect(radius).toEqual({ sm: '8px', md: '10px', lg: '12px', xl: '14px', xxl: '16px', pill: '999px' });
  });
});

describe('guardia raggi: i sorgenti', () => {
  it('nessun file sotto src/ (fuori dal tema) scrive a mano un borderRadius della scala', () => {
    const offenders = [];
    for (const file of walk(srcDir)) {
      const rel = relative(srcDir, file);
      if (SKIPPED_FILES.includes(rel)) continue;
      const violations = scaleViolations(readFileSync(file, 'utf8'));
      if (violations.length) offenders.push(`${rel}: ${violations.join(', ')}`);
    }
    expect(offenders).toEqual([]);
  });
});
