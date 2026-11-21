import { API_BASE_URL } from '../config';
import { toolSettingsBody, toolValue } from '../utils/focusTools';

// Accende o spegne uno strumento della serie dell'account. Non lancia mai: { ok: true, saved } con la risposta del server
// (i valori che ha salvato), oppure { ok: false }.
export const saveFocusTool = async (tool, on) => {
  try {
    const response = await fetch(`${API_BASE_URL}api/user/update_settings.php`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(toolSettingsBody(tool, on)),
    });
    const data = await response.json().catch(() => null);
    if (!response.ok || data?.success !== true || toolValue(data, tool) === undefined) return { ok: false };
    return { ok: true, saved: data };
  } catch {
    return { ok: false };
  }
};
