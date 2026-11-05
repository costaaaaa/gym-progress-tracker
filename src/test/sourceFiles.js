// Supporto comune alle guardie del tema (colori, raggi): i file sorgente sotto src/ (.js/.jsx, test
// esclusi) e la loro scansione.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const srcDir = join(dirname(fileURLToPath(import.meta.url)), '..');

// Tutti i file .js/.jsx sotto src/ (test esclusi), scendendo nelle sottocartelle
const walk = (dir) => readdirSync(dir).flatMap((name) => {
  const path = join(dir, name);
  return statSync(path).isDirectory()
    ? walk(path)
    : /\.jsx?$/.test(name) && !/\.test\.jsx?$/.test(name) ? [path] : [];
});

// File fuori da entrambe le guardie: qui vivono i valori letterali della palette
export const THEME_FILE = 'context/ThemeModeContext.jsx';

// Una riga "percorso: valori" per ogni file (fuori da skippedFiles) in cui scan(testo, percorso)
// trova qualcosa; percorsi relativi a src/
export function sourceOffenders(scan, skippedFiles) {
  const offenders = [];
  for (const file of walk(srcDir)) {
    const rel = relative(srcDir, file);
    if (skippedFiles.includes(rel)) continue;
    const found = scan(readFileSync(file, 'utf8'), rel);
    if (found.length) offenders.push(`${rel}: ${found.join(', ')}`);
  }
  return offenders;
}
