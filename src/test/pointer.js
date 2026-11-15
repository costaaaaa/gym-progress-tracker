// Tipo di puntatore per i test: con "fine" (mouse) il selettore di date è il campo da digitare, senza (telefono) è di
// sola lettura. Ritorna la funzione che rimette il matchMedia di prima.
export const mockPointer = (fine) => {
  const real = window.matchMedia;
  window.matchMedia = (query) => ({ ...real(query), matches: fine && query.includes('pointer: fine') });
  return () => { window.matchMedia = real; };
};
