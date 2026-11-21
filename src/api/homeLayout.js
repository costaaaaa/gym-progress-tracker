import { API_BASE_URL } from '../config';

// Salva il layout della Home (elenco completo `[{ key, hidden, large }]`). Non lancia mai: { ok: true, layout } con
// il layout confermato dal server, oppure { ok: false }.
export const saveHomeLayout = async (layout) => {
  try {
    const response = await fetch(`${API_BASE_URL}api/user/update_settings.php`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ home_layout: layout }),
    });
    const data = await response.json().catch(() => null);
    if (!response.ok || data?.success !== true || !Array.isArray(data.home_layout)) return { ok: false };
    return { ok: true, layout: data.home_layout };
  } catch {
    return { ok: false };
  }
};
