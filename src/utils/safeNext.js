// Percorso interno a cui tornare dopo login o registrazione (?next=/entra?codice=...).
// Solo percorsi dello stesso sito: niente URL esterni né "//dominio".
export const safeNext = (search) => {
  const next = new URLSearchParams(search).get('next');
  if (!next || !next.startsWith('/') || next.startsWith('//') || next.startsWith('/\\')) return '/';
  return next;
};
