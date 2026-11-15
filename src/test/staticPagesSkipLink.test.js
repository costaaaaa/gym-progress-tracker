// Pagine statiche in public/ (privacy, termini, 404): «Salta al contenuto» come primo elemento raggiungibile con Tab
// (2.4.1), visibile solo con il focus, che porta al <main>.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const publicDir = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'public');

const load = (name) => {
  const html = readFileSync(join(publicDir, `${name}.html`), 'utf8');
  return new DOMParser().parseFromString(html, 'text/html');
};

describe.each(['privacy', 'termini', '404'])('public/%s.html', (name) => {
  const doc = load(name);

  it('il primo link o bottone della pagina è «Salta al contenuto» e punta al <main>', () => {
    const first = doc.body.querySelector('a, button, input, select, textarea, [tabindex]');
    expect(first.textContent.trim()).toBe('Salta al contenuto');
    const target = doc.querySelector(first.getAttribute('href'));
    expect(target.tagName).toBe('MAIN');
    expect(target.getAttribute('tabindex')).toBe('-1');
  });

  it('il link sta fuori dallo schermo finché non ha il focus', () => {
    // Le regole del link stanno nel foglio comune delle pagine statiche
    const css = readFileSync(join(publicDir, 'pagine.css'), 'utf8');
    expect(css).toMatch(/\.skip\{[^}]*transform:translateY\(-200%\)/);
    expect(css).toMatch(/\.skip:focus\{[^}]*transform:none/);
  });
});
