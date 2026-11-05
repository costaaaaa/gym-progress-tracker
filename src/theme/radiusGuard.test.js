// Guardia: nessun borderRadius della scala scritto a mano fuori dal tema (issue #15). Restano scritti
// 0, '50%', i raggi sottili, i calcolati e i numeri sx che non cadono nella scala: non sono di questa
// guardia (vedi report).
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { radius } from './radius';

const srcDir = join(dirname(fileURLToPath(import.meta.url)), '..');

const walk = (dir) => readdirSync(dir).flatMap((name) => {
  const path = join(dir, name);
  return statSync(path).isDirectory()
    ? walk(path)
    : /\.jsx?$/.test(name) && !/\.test\.jsx?$/.test(name) ? [path] : [];
});

// File fuori dalla guardia: qui vive la scala stessa
const SKIPPED_FILES = ['theme/radius.js', 'context/ThemeModeContext.jsx'];

const SCALE_PX = ['8px', '10px', '12px', '14px', '16px', '999px'];
const SCALE_NUM = ['8', '10', '12', '14', '16', '999'];

// Cerca, nel pezzo di testo tra "borderRadius:" e la prossima virgola/parentesi di chiusura (così
// trova anche il ramo di un ternario), una stringa o un numero della scala scritti a mano.
export function scaleViolations(text) {
  const found = [];
  for (const m of text.matchAll(/borderRadius:([^,}]*)/g)) {
    const expr = m[1];
    for (const px of SCALE_PX) {
      if (new RegExp(`'${px}(?:[^']*)?'`).test(expr)) found.push(px);
    }
    for (const n of SCALE_NUM) {
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

describe('guardia raggi: la scala', () => {
  it('è l\'oggetto deciso con l\'utente, uguale all\'app mobile', () => {
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
