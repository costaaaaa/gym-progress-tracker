// Guardia: nessun borderRadius della scala scritto a mano fuori dal tema (issue #15). Restano scritti
// 0, '50%', i raggi sottili, i calcolati e i numeri sx che non cadono nella scala: non sono di questa
// guardia (vedi report). I file .css restano fuori (regex solo su .js/.jsx): App.css ha ancora alcuni
// border-radius a mano, vedi report.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { relative } from 'node:path';
import { srcDir, walk, THEME_FILE } from './sourceFiles';
import { radius } from './radius';

// File fuori dalla guardia: qui vive la scala stessa
const SKIPPED_FILES = ['theme/radius.js', THEME_FILE];

const SCALE_PX = Object.values(radius);
const SCALE_NUM = SCALE_PX.map((px) => px.replace('px', ''));
// In sx un numero si moltiplica per theme.shape.borderRadius (16): 1 vale quindi 16px, come radius.xxl.
// Fuori da sx (es. in uno style={{}} letterale) 1 varrebbe invece 1px: oggi non c'è nessun caso così nei
// sorgenti (vedi report), quindi aggiungerlo ai numeri cercati non crea falsi positivi.
const SX_ONE_IS_XXL = '1';

// Isola il valore che segue un "borderXxxRadius:" (anche nelle varianti come borderTopLeftRadius),
// carattere per carattere, fino alla virgola o alla chiusura di parentesi/graffa allo stesso livello:
// gestisce così anche il ramo di un ternario o un oggetto responsivo ({ xs: '8px', md: '12px' }), dove
// fermarsi alla prima "," o "}" del testo (senza contare la profondità) tronca il valore troppo presto.
function captureObjectValue(text, start) {
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
    } else if (c === ',' && depth === 0) {
      break;
    }
    i++;
  }
  return text.slice(start, i);
}

// Stessa idea per il prop JSX borderRadius="12px" / borderRadius={...}: gli attributi JSX sono separati
// da spazi, non da virgole, quindi si cattura solo la stringa o l'espressione graffata che segue.
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
    let depth = 0;
    let quote = null;
    let j = i;
    while (j < text.length) {
      const c = text[j];
      if (quote) {
        if (c === '\\') { j += 2; continue; }
        if (c === quote) quote = null;
      } else if (c === '\'' || c === '"' || c === '`') {
        quote = c;
      } else if (c === '{') {
        depth++;
      } else if (c === '}') {
        depth--;
        if (depth === 0) { j++; break; }
      }
      j++;
    }
    return text.slice(i, j);
  }
  return '';
}

// Ogni occorrenza di border*Radius (sia come prop di un oggetto/sx, ":" , sia come attributo JSX, "="),
// con il testo del suo valore ancora grezzo (stringa compresa, non interpretato).
function radiusExpressions(text) {
  const out = [];
  for (const m of text.matchAll(/border\w*Radius\s*([:=])/g)) {
    const start = m.index + m[0].length;
    out.push(m[1] === '=' ? captureJsxValue(text, start) : captureObjectValue(text, start));
  }
  return out;
}

function scaleViolations(text) {
  const found = [];
  for (const expr of radiusExpressions(text)) {
    for (const px of SCALE_PX) {
      if (new RegExp(`['"\`]${px}(?:[^'"\`]*)?['"\`]`).test(expr)) found.push(px);
    }
    for (const n of [...SCALE_NUM, SX_ONE_IS_XXL]) {
      if (new RegExp(`(?<![\\w.'"])${n}(?![\\w.])`).test(expr)) found.push(n);
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

describe('guardia raggi: forme che oggi sfuggono (giro di correzioni 1)', () => {
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

  it('trova un valore della scala dentro un oggetto responsivo', () => {
    expect(scaleViolations("borderRadius: { xs: '8px', md: '12px' },")).toEqual(['8px', '12px']);
  });

  it('in sx il numero 1 vale 16px, come radius.xxl: va segnalato', () => {
    expect(scaleViolations('borderRadius: 1,')).toEqual(['1']);
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
