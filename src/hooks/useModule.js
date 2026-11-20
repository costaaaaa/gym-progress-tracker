import { useAuth } from '../context/AuthContext';

// Moduli facoltativi che questa versione mostra nell'Account, nell'ordine della card. «Non attivo» è solo
// visualizzazione: i dati restano e il server continua ad aggiornarli. Il modulo `ai` esiste nell'account
// (salvato e restituito dalle API) ma qui non ha una riga.
export const MODULE_KEYS = ['body', 'recovery', 'levels', 'groups'];

// Un modulo è attivo se l'account non dice il contrario: un utente senza `modules` (copia vecchia in cache,
// risposta non ancora arrivata, server più vecchio) li ha tutti attivi, così niente sparisce e ricompare.
export const isModuleActive = (user, key) => user?.modules?.[key] !== false;

// Il solo punto che risponde a «questo modulo è attivo?»
export const useModule = (key) => isModuleActive(useAuth().user, key);

export default useModule;
