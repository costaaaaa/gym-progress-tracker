import { useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { saveFocusTool } from '../api/focusTools';
import { accountPatch } from '../utils/focusTools';

// Il solo punto che salva gli strumenti della serie: `save(tool, on)` torna `{ ok }`. A salvataggio riuscito l'account
// riceve solo la modifica di quello strumento (vedi accountPatch); la copia tenuta qui segue i salvataggi in volo.
export const useSaveFocusTool = () => {
  const { user, updateUser } = useAuth();
  const current = useRef(user);
  current.current = user;
  return async (tool, on) => {
    const res = await saveFocusTool(tool, on);
    if (!res.ok) return res;
    const patch = accountPatch(current.current, tool, res.saved);
    current.current = { ...current.current, ...patch };
    updateUser(patch);
    return res;
  };
};

export default useSaveFocusTool;
