import { useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { saveModules } from '../api/modules';

// Moduli facoltativi che questa versione mostra nell'Account, nell'ordine della card, con la pagina di oggi di ciascuno
// (dove porta «Apri»). È l'unico elenco: le chiavi derivano da qui. «Non attivo» è solo visualizzazione: i dati restano
// e il server continua ad aggiornarli. Il modulo `ai` esiste nell'account (salvato e restituito dalle API) ma qui
// non ha una riga.
export const MODULE_PATHS = {
  body: '/dashboard?tab=body',
  recovery: '/dashboard?tab=muscles',
  levels: '/profilo',
  groups: '/gruppi',
};
export const MODULE_KEYS = Object.keys(MODULE_PATHS);

// Un modulo è attivo se l'account non dice il contrario: un utente senza `modules` (copia vecchia in cache,
// risposta non ancora arrivata, server più vecchio) li ha tutti attivi, così niente sparisce e ricompare.
export const isModuleActive = (user, key) => user?.modules?.[key] !== false;

// Il solo punto che risponde a «questo modulo è attivo?»
export const useModule = (key) => isModuleActive(useAuth().user, key);

// Il solo punto che salva i moduli: `save(patch)` torna `{ ok, modules }` come saveModules. A salvataggio riuscito
// l'account riceve solo le chiavi di `patch` (a modulo già visto da una risposta più recente): con due salvataggi
// in volo, una risposta vecchia che arriva per ultima non riporta indietro l'altro modulo.
export const useSaveModules = () => {
  const { user, updateUser } = useAuth();
  const current = useRef(user?.modules);
  current.current = user?.modules;
  return async (patch) => {
    const res = await saveModules(patch);
    if (res.ok) {
      const merged = { ...current.current };
      Object.keys(patch).forEach((key) => { merged[key] = res.modules[key]; });
      current.current = merged;
      updateUser({ modules: merged });
    }
    return res;
  };
};

export default useModule;
