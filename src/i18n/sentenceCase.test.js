// I testi dell'app sono in "sentence case": maiuscola solo a inizio frase e sui nomi propri, mai Title Case né tutto maiuscolo.
import { describe, it, expect } from 'vitest';
import it_ from './it.json';
import en from './en.json';

// Nomi propri e sigle che restano maiuscoli anche a metà frase.
const NOMI_PROPRI = new Set([
  'LiftIndex', 'Focus', 'Premium', 'Apple', 'Salute', 'Health', 'Connect', 'Google', 'iPhone', 'Android', 'iOS',
  'Epley', 'English', 'Italian', 'Monday', 'Wednesday', 'Sunday', 'I',
  'PR', 'PRs', '1RM', 'RPE', 'XP', 'ID', 'JSON',
]);

// Fuori ticket: testo del cartoncino (canvas) e segnaposto del codice gruppo.
const ESCLUSE = [/^share\.card\./, /^groups\.code\.placeholder$/];

const appiattisci = (obj, prefisso = '', out = {}) => {
  for (const [k, v] of Object.entries(obj)) {
    const chiave = prefisso ? `${prefisso}.${k}` : k;
    if (v && typeof v === 'object') appiattisci(v, chiave, out);
    else if (typeof v === 'string') out[chiave] = v;
  }
  return out;
};

// Toglie segnaposto, tag e simboli iniziali (emoji, "+"), così la prima parola vera conta come inizio frase.
const pulisci = (testo) => testo.replace(/\{\{[^}]*\}\}/g, 'x').replace(/<[^>]+>/g, '').replace(/^[^\p{L}\p{N}]+/u, '');

const maiuscoleSbagliate = (valore) => {
  const testo = pulisci(valore);
  const trovate = [];
  for (const m of testo.matchAll(/[\p{L}\p{N}]+/gu)) {
    const parola = m[0];
    if (!/^\p{Lu}/u.test(parola) || NOMI_PROPRI.has(parola)) continue;
    const prima = testo.slice(0, m.index).replace(/[\s«“"'(¡¿]+$/u, '');
    const inizioFrase = prima === '' || /[.!?:]$/.test(prima) || /\n\s*$/.test(testo.slice(0, m.index));
    if (!inizioFrase) trovate.push(parola);
  }
  return trovate;
};

const tuttoMaiuscolo = (valore) => {
  const testo = pulisci(valore);
  if (NOMI_PROPRI.has(testo)) return false;
  const lettere = testo.match(/\p{L}/gu) || [];
  return lettere.length >= 2 && lettere.every((l) => l === l.toUpperCase() && l !== l.toLowerCase());
};

const errori = (lingua) => Object.entries(appiattisci(lingua))
  .filter(([chiave]) => !ESCLUSE.some((re) => re.test(chiave)))
  .filter(([, valore]) => maiuscoleSbagliate(valore).length > 0 || tuttoMaiuscolo(valore))
  .map(([chiave, valore]) => `${chiave}: ${JSON.stringify(valore)}`);

describe('testi: sentence case', () => {
  it('in italiano nessuna parola a metà frase inizia con la maiuscola e nessun testo è tutto maiuscolo', () => {
    expect(errori(it_)).toEqual([]);
  });

  it('in inglese nessuna parola a metà frase inizia con la maiuscola e nessun testo è tutto maiuscolo', () => {
    expect(errori(en)).toEqual([]);
  });
});
