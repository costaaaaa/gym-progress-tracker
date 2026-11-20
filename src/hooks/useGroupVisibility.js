import { useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { saveGroupVisibility } from '../api/groupVisibility';

// Un dato è mostrato nei gruppi se l'account non dice il contrario: senza `group_visibility` (copia vecchia in cache,
// risposta non ancora arrivata) è tutto mostrato, come per i moduli.
export const isGroupShown = (user, key) => user?.group_visibility?.[key] !== false;

// Il solo punto che salva la visibilità nei gruppi: `save(patch)` torna `{ ok, groupVisibility }` come
// saveGroupVisibility. A salvataggio riuscito l'account riceve solo le chiavi di `patch`, sopra quelle che ha già:
// con due salvataggi in volo, la risposta più vecchia (che arriva per ultima) ha l'altra chiave ancora com'era e
// non deve riportarla indietro (stessa forma di useSaveModules). Senza un elenco nell'account si parte da quello
// intero restituito dal server.
export const useSaveGroupVisibility = () => {
  const { user, updateUser } = useAuth();
  const current = useRef(user?.group_visibility);
  current.current = user?.group_visibility;
  return async (patch) => {
    const res = await saveGroupVisibility(patch);
    if (res.ok) {
      const merged = current.current ? { ...current.current } : { ...res.groupVisibility };
      Object.keys(patch).forEach((key) => { merged[key] = res.groupVisibility[key]; });
      current.current = merged;
      updateUser({ group_visibility: merged });
    }
    return res;
  };
};

export default useSaveGroupVisibility;
