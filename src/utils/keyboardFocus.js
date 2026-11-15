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
