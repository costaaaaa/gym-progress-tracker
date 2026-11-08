// Percorso interno a cui tornare dopo login o registrazione (?next=/entra?codice=...).
// Solo percorsi dello stesso sito, anche come li legge il browser: ignora TAB e a capo
// e tratta "\" come "/", quindi "/<TAB>/dominio" diventerebbe "//dominio".
export const safeNext = (search) => {
  const next = new URLSearchParams(search).get('next');
  if (!next?.startsWith('/')) return '/';
  return new URL(next, window.location.origin).origin === window.location.origin ? next : '/';
};

// Login che poi torna alla pagina attuale, compresi parametri e ancora.
export const loginWithNext = ({ pathname, search, hash }) =>
  `/login?next=${encodeURIComponent(pathname + search + hash)}`;
