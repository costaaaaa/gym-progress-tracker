import { API_BASE_URL } from '../config';

// Salva i moduli dell'account (oggetto parziale: cambiano solo le chiavi presenti). Con `{ chosen: true }` chiude
// anche la schermata «Cosa ti interessa?» (modules_chosen: true, nella stessa richiesta; un oggetto vuoto non si manda).
// Non lancia mai: { ok: true, modules } con l'elenco completo aggiornato, oppure { ok: false }.
export const saveModules = async (patch, { chosen = false } = {}) => {
  try {
    const response = await fetch(`${API_BASE_URL}api/user/update_settings.php`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        ...(Object.keys(patch).length > 0 && { modules: patch }),
        ...(chosen && { modules_chosen: true }),
      }),
    });
    const data = await response.json().catch(() => null);
    if (!response.ok || data?.success !== true || !data.modules) return { ok: false };
    return { ok: true, modules: data.modules };
  } catch {
    return { ok: false };
  }
};
