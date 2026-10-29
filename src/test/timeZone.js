/* global process */
import { afterEach } from 'vitest';

// Fuso del browser nei test: cambia quello del processo e lo rimette a fine test.
const original = process.env.TZ;

export const setBrowserTimeZone = (zone) => { process.env.TZ = zone; };

afterEach(() => {
  if (original === undefined) delete process.env.TZ;
  else process.env.TZ = original;
});
