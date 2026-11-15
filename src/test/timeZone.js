/* global process */
import { afterEach, vi } from 'vitest';

// Fuso del browser nei test: cambia quello del processo e lo rimette a fine test.
const original = process.env.TZ;

export const setBrowserTimeZone = (zone) => { process.env.TZ = zone; };

afterEach(() => {
  if (original === undefined) delete process.env.TZ;
  else process.env.TZ = original;
});

// Fuso del browser e orologio fissati insieme: cambia il fuso, poi ferma solo `Date` a quella data e ora locali
// (gli argomenti di `new Date(anno, mese, ...)`, letti nel nuovo fuso). Il test che lo usa rimette l'orologio con
// vi.useRealTimers(); il fuso torna da solo a fine test.
export const pinLocalClock = (zone, ...localDate) => {
  setBrowserTimeZone(zone);
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(...localDate));
};
