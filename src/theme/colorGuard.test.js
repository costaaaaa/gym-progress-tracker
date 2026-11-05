// Guardia: nessun colore scritto a mano (hex o rgb/rgba/hsl) fuori dal tema (issue #15). I valori
// ammessi sono i file che disegnano su canvas con palette propria, e le ombre nere dentro boxShadow
// (sono ombre, non palette).
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const srcDir = join(dirname(fileURLToPath(import.meta.url)), '..');

const walk = (dir) => readdirSync(dir).flatMap((name) => {
  const path = join(dir, name);
  return statSync(path).isDirectory()
    ? walk(path)
    : /\.jsx?$/.test(name) && !/\.test\.jsx?$/.test(name) ? [path] : [];
});

// File interi fuori dalla guardia: disegnano su canvas con template propri (vedi issue #15)
const SKIPPED_FILES = [
  'utils/shareCard.js',
  'utils/renderShareCard.js',
  'utils/celebrate.js',
  'context/ThemeModeContext.jsx', // qui vivono i token
];

// Valori ammessi solo in questo file: scacchiera di anteprima e card su canvas
const FILE_EXCEPTIONS = {
  'components/ShareCardDialog.jsx': ['#8a8a8a', '#6f6f6f', '#0a0a0b'],
};

export const HEX_RE = /#(?:[0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{4}|[0-9a-fA-F]{3})\b/g;
export const FUNC_RE = /\b(?:rgba?|hsla?)\([^)]*\)/g;

// Ombre nere dentro boxShadow: ammesse ovunque, non sono un colore di palette
export const isBlackShadow = (value) => /^rgba?\(\s*0\s*,\s*0\s*,\s*0\s*[,)]/.test(value);

function violationsIn(relPath, text) {
  if (SKIPPED_FILES.includes(relPath)) return [];
  const allowed = FILE_EXCEPTIONS[relPath] || [];
  const found = [];
  for (const re of [HEX_RE, FUNC_RE]) {
    for (const match of text.matchAll(re)) {
      const value = match[0];
      if (allowed.includes(value) || isBlackShadow(value)) continue;
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
