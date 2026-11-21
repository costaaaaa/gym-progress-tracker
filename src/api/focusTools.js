import { API_BASE_URL } from '../config';
import { toolSettingsBody } from '../utils/focusTools';

// Accende o spegne uno strumento della serie dell'account. Non lancia mai: { ok: true, restTimerEnabled, focusTools }
// con i valori che il server ha salvato (focusTools è l'elenco intero), oppure { ok: false }.
export const saveFocusTool = async (tool, on) => {
  try {
    const response = await fetch(`${API_BASE_URL}api/user/update_settings.php`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(toolSettingsBody(tool, on)),
    });
    const data = await response.json().catch(() => null);
    if (!response.ok || data?.success !== true) return { ok: false };
    const saved = tool === 'rest_timer' ? typeof data.rest_timer_enabled === 'boolean' : typeof data.focus_tools?.[tool] === 'boolean';
    return saved ? { ok: true, restTimerEnabled: data.rest_timer_enabled, focusTools: data.focus_tools } : { ok: false };
  } catch {
    return { ok: false };
  }
};
