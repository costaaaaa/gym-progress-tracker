import { afterEach } from 'vitest';

// Tipo di puntatore nei test: con "fine" (mouse) il selettore di date è il campo da digitare, senza (telefono) è di
// sola lettura. Cambia window.matchMedia e lo rimette a fine test.
const original = window.matchMedia;

export const mockPointer = (fine) => {
  window.matchMedia = (query) => ({ ...original(query), matches: fine && query.includes('pointer: fine') });
};

afterEach(() => { window.matchMedia = original; });
