// Confronta due cartelle di screenshot immagine per immagine (pixel per pixel).
// Uso: node compare.mjs [cartellaA=before] [cartellaB=after]
// Esce con codice 1 se c'è almeno una differenza o un file mancante.
import { readdirSync, readFileSync, writeFileSync, mkdirSync, rmSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PNG } from 'pngjs';
import pixelmatch from 'pixelmatch';

const here = path.dirname(fileURLToPath(import.meta.url));
const [, , aName = 'before', bName = 'after'] = process.argv;
const dirA = path.resolve(here, aName);
const dirB = path.resolve(here, bName);
const diffDir = path.join(here, 'diff');

rmSync(diffDir, { recursive: true, force: true });
mkdirSync(diffDir, { recursive: true });

const pngsIn = (dir) => (existsSync(dir) ? readdirSync(dir).filter((f) => f.endsWith('.png')) : []);
const names = [...new Set([...pngsIn(dirA), ...pngsIn(dirB)])].sort();

const padTo = (img, w, h) => {
  const out = new PNG({ width: w, height: h });
  PNG.bitblt(img, out, 0, 0, img.width, img.height, 0, 0);
  return out;
};

let identical = 0;
let differing = 0;
let missing = 0;

for (const name of names) {
  const pa = path.join(dirA, name);
  const pb = path.join(dirB, name);
  if (!existsSync(pa) || !existsSync(pb)) {
    missing++;
    console.log(`MANCANTE  ${name}  (in ${existsSync(pa) ? dirB : dirA} non c'è)`);
    continue;
  }
  const a = PNG.sync.read(readFileSync(pa));
  const b = PNG.sync.read(readFileSync(pb));
  const w = Math.max(a.width, b.width);
  const h = Math.max(a.height, b.height);
  const sizeNote = a.width !== b.width || a.height !== b.height
    ? ` (dimensioni ${a.width}x${a.height} vs ${b.width}x${b.height})`
    : '';
  const diff = new PNG({ width: w, height: h });
  const n = pixelmatch(padTo(a, w, h).data, padTo(b, w, h).data, diff.data, w, h, { threshold: 0, includeAA: true });

  if (n === 0 && !sizeNote) {
    identical++;
    console.log(`identica  ${name}`);
  } else {
    differing++;
    console.log(`${n} pixel diversi  ${name}${sizeNote}`);
    writeFileSync(path.join(diffDir, name), PNG.sync.write(diff));
  }
}

console.log(`\n${names.length} file: ${identical} identici, ${differing} con differenze, ${missing} mancanti.`);
if (differing) console.log(`Immagini di differenza in ${diffDir}`);
process.exitCode = differing || missing ? 1 : 0;
