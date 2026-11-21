import { API_BASE_URL } from '../config';

// Salva i moduli dell'account (oggetto parziale: cambiano solo le chiavi presenti). Con `{ chosen: true }` chiude
// anche la schermata «Cosa ti interessa?» (modules_chosen: true, nella stessa richiesta; un oggetto vuoto non si manda).
// Con `{ offerAnswer: { key, accepted } }` risponde alla proposta di un modulo (il server attiva il modulo se accettata).
// Non lancia mai: { ok: true, modules, moduleOffer } con l'elenco completo aggiornato e la proposta di adesso (chiave o
// null), oppure { ok: false }.
export const saveModules = async (patch, { chosen = false, offerAnswer = null } = {}) => {
  try {
    const response = await fetch(`${API_BASE_URL}api/user/update_settings.php`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        ...(Object.keys(patch).length > 0 && { modules: patch }),
        ...(chosen && { modules_chosen: true }),
        ...(offerAnswer && { module_offer_answer: offerAnswer }),
      }),
    });
    const data = await response.json().catch(() => null);
    if (!response.ok || data?.success !== true || !data.modules) return { ok: false };
    return { ok: true, modules: data.modules, moduleOffer: data.module_offer ?? null };
  } catch {
    return { ok: false };
  }
};
