// Supporto comune alle guardie del tema (colori, raggi): elenco dei file sorgente sotto src/,
// componenti e pagine (.js/.jsx, test esclusi). Non è un test: niente describe/it qui.
import { readdirSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

export const srcDir = join(dirname(fileURLToPath(import.meta.url)), '..');

export const walk = (dir) => readdirSync(dir).flatMap((name) => {
  const path = join(dir, name);
  return statSync(path).isDirectory()
    ? walk(path)
    : /\.jsx?$/.test(name) && !/\.test\.jsx?$/.test(name) ? [path] : [];
});

// File fuori da entrambe le guardie: qui vivono i token e la scala stessa
export const THEME_FILE = 'context/ThemeModeContext.jsx';
