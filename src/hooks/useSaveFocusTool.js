import { useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { saveFocusTool } from '../api/focusTools';

// Il solo punto che salva gli strumenti della serie: `save(tool, on)` torna `{ ok }`. A salvataggio riuscito l'account
// riceve solo il valore di quello strumento (per gli altri due, la loro chiave sopra l'elenco che ha già: con due
// salvataggi in volo la risposta più vecchia non deve riportare indietro l'altra, come in useSaveGroupVisibility).
// Senza un elenco nell'account si parte da quello intero restituito dal server.
export const useSaveFocusTool = () => {
  const { user, updateUser } = useAuth();
  const current = useRef(user?.focus_tools);
  current.current = user?.focus_tools;
  return async (tool, on) => {
    const res = await saveFocusTool(tool, on);
    if (!res.ok) return res;
    if (tool === 'rest_timer') {
      updateUser({ rest_timer_enabled: res.restTimerEnabled });
    } else {
      const merged = current.current ? { ...current.current, [tool]: res.focusTools[tool] } : { ...res.focusTools };
      current.current = merged;
      updateUser({ focus_tools: merged });
    }
    return res;
  };
};

export default useSaveFocusTool;
