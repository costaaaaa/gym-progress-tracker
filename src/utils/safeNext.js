// Percorso interno a cui tornare dopo login o registrazione (?next=/entra?codice=...).
// Restituisce il percorso come lo legge il browser, che ignora TAB e a capo, tratta "\"
// come "/" e risolve "." e "..": "/./<TAB>/dominio" diventa "//dominio", cioè un altro sito.
export const safeNext = (search) => {
  const next = new URLSearchParams(search).get('next');
  if (!next?.startsWith('/')) return '/';
  const url = new URL(next, window.location.origin);
  const path = url.pathname + url.search + url.hash;
  return url.origin === window.location.origin && !path.startsWith('//') ? path : '/';
};

// Login che poi torna alla pagina attuale, compresi parametri e ancora.
export const loginWithNext = ({ pathname, search, hash }) =>
  `/login?next=${encodeURIComponent(pathname + search + hash)}`;
