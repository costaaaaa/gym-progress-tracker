import { API_BASE_URL } from '../config';

// Salva la visibilità nei gruppi dell'account (oggetto parziale: cambiano solo le chiavi presenti, come i moduli).
// Non lancia mai: { ok: true, groupVisibility } con l'elenco completo aggiornato, oppure { ok: false }.
export const saveGroupVisibility = async (patch) => {
  try {
    const response = await fetch(`${API_BASE_URL}api/user/update_settings.php`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ group_visibility: patch }),
    });
    const data = await response.json().catch(() => null);
    if (!response.ok || data?.success !== true || !data.group_visibility) return { ok: false };
    return { ok: true, groupVisibility: data.group_visibility };
  } catch {
    return { ok: false };
  }
};
