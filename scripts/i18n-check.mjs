// Controlla le traduzioni: chiavi presenti in una lingua sola, {{variabili}} e <tag> diversi,
// chiavi scritte nel codice (t('…'), i18nKey="…", label: '…') che non esistono nei JSON.
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const load = (lang) => JSON.parse(readFileSync(new URL(`../src/i18n/${lang}.json`, import.meta.url)));
const [base, ...others] = ['it', 'en'];
const ref = load(base);
const tokens = (text) => [...text.matchAll(/\{\{\s*(\w+)\s*\}\}|<\/?(\w+)>/g)].map((m) => m[0].replace(/\s/g, '')).sort().join(' ');

let problems = 0;
const report = (msg) => {
  problems += 1;
  console.error(msg);
};

for (const lang of others) {
  const dict = load(lang);
  for (const key of Object.keys(ref)) {
    if (!(key in dict)) report(`${lang}: manca "${key}"`);
    else if (tokens(ref[key]) !== tokens(dict[key])) report(`${lang}: "${key}" ha variabili o tag diversi da ${base}`);
    else if (!dict[key].trim()) report(`${lang}: "${key}" è vuota`);
  }
  for (const key of Object.keys(dict)) {
    if (!(key in ref)) report(`${lang}: "${key}" non esiste in ${base}`);
  }
}

const srcDir = new URL('../src/', import.meta.url).pathname;
const walk = (dir) => readdirSync(dir).flatMap((name) => {
  const path = join(dir, name);
  return statSync(path).isDirectory() ? walk(path) : /\.jsx?$/.test(name) ? [path] : [];
});
const known = (key) => key in ref || `${key}_one` in ref || `${key}_other` in ref;
const keyPattern = /(?:\bt\(\s*|i18nKey=)['"]([a-z_]+\.[\w.]+)['"]|label: '([a-z_]+\.[\w.]+)'/g;
for (const file of walk(srcDir)) {
  for (const m of readFileSync(file, 'utf8').matchAll(keyPattern)) {
    const key = m[1] || m[2];
    if (!known(key)) report(`${file.replace(srcDir, 'src/')}: chiave "${key}" non tradotta`);
  }
}

// Messaggi del server (backend/lang/*.php): stesse chiavi e stessi {segnaposto}, e ogni
// t_server('…') del backend deve esistere in italiano
const phpDir = new URL('../backend/', import.meta.url).pathname;
const loadPhp = (lang) => {
  const text = readFileSync(join(phpDir, `lang/${lang}.php`), 'utf8');
  return Object.fromEntries([...text.matchAll(/^\s*'([\w.]+)' => ([\s\S]*?),$/gm)].map((m) => [m[1], m[2]]));
};
const phpTokens = (text) => [...text.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort().join(' ');
const phpRef = loadPhp(base);
for (const lang of others) {
  const dict = loadPhp(lang);
  for (const key of Object.keys(phpRef)) {
    if (!(key in dict)) report(`backend ${lang}: manca "${key}"`);
    else if (phpTokens(phpRef[key]) !== phpTokens(dict[key])) report(`backend ${lang}: "${key}" ha segnaposto diversi da ${base}`);
  }
  for (const key of Object.keys(dict)) {
    if (!(key in phpRef)) report(`backend ${lang}: "${key}" non esiste in ${base}`);
  }
}
const walkPhp = (dir) => readdirSync(dir).flatMap((name) => {
  const path = join(dir, name);
  return statSync(path).isDirectory() ? walkPhp(path) : name.endsWith('.php') ? [path] : [];
});
for (const file of walkPhp(phpDir)) {
  for (const m of readFileSync(file, 'utf8').matchAll(/t_server\('([\w.]+)'/g)) {
    if (!(m[1] in phpRef)) report(`${file.replace(phpDir, 'backend/')}: chiave "${m[1]}" non tradotta`);
  }
}

if (problems) {
  console.error(`\n${problems} problemi nelle traduzioni`);
  process.exit(1);
}
console.log(`Traduzioni OK (${Object.keys(ref).length} chiavi web, ${Object.keys(phpRef).length} del server)`);
