// index.html: il tema scelto va applicato prima che parta React, o con sistema scuro la pagina parte bianca.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const html = readFileSync(join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'index.html'), 'utf8');
const head = html.slice(html.indexOf('<head>'), html.indexOf('</head>'));

describe('index.html', () => {
  it('carica /tema.js nel <head>, esterno e senza defer (CSP: niente script inline)', () => {
    expect(head).toMatch(/<script src="\/tema\.js"><\/script>/);
  });

  it('dipinge di scuro lo sfondo prima di React quando il tema è scuro', () => {
    expect(head).toMatch(/html\[data-theme="dark"\]\s*\{[^}]*background:\s*#0a0a0b/);
  });
});
