// Il fuoco dell'elemento è "da tastiera" (:focus-visible)? Per mouse e tocco il browser dice di no.
// Se il browser non conosce il selettore si risponde di sì: il caso prudente per chi usa la tastiera.
export const isKeyboardFocus = (element) => {
  if (!element) return true;
  try {
    return element.matches(':focus-visible');
  } catch {
    return true;
  }
};

// L'elemento che ha davvero il fuoco, o null se non ce l'ha nessuno (il browser lo lascia sul <body>
// quando l'elemento che l'aveva sparisce).
export const focusedElement = () => {
  const active = document.activeElement;
  return active && active !== document.body ? active : null;
};

// Porta alla vista un punto della pagina (per id) e gli dà il fuoco: per i collegamenti che puntano a un blocco già presente
export const scrollToAndFocus = (id) => {
  const target = document.getElementById(id);
  target?.scrollIntoView?.({ behavior: 'smooth', block: 'start' });
  target?.focus();
};
