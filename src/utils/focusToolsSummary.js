import { FOCUS_TOOLS, toolsOnCount } from './focusTools';

// Quanti strumenti della serie sono accesi, come testo da mostrare: «Nessuno acceso» a zero, altrimenti «2 accesi su 3».
// `t` è la funzione di traduzione, `user` l'account (stessa forma di focusTools.js). Prima dell'allenamento e in Account
// la riga dice la stessa cosa.
export const focusToolsSummary = (t, user) => {
  const onCount = toolsOnCount(user);
  return onCount === 0 ? t('focus.tools.none_on') : t('focus.tools.count', { count: onCount, total: FOCUS_TOOLS.length });
};
