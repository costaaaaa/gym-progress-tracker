import { useState, useEffect, useCallback } from 'react';
import { API_BASE_URL } from '../../config';

// Le misure corporee dell'utente, dal server: `stats` (le righe, [] finché non arrivano), `loading`, `loadFailed` (l'ultima lettura
// non è riuscita), `consentRequired` (manca il consenso ai dati sulla salute: il server non manda righe) con `consentUpdated` (era
// stato dato a una versione precedente del testo) e `refresh` (rilegge). `save(payload)` crea una misurazione e, se riesce, rilegge:
// dà `{ ok: true }`, `{ ok: false, field, max, message }` se il server rifiuta il valore, o `{ ok: false, connection: true }` se la
// rete non risponde. `remove(id)` elimina una riga e, se riesce, rilegge: dà `{ ok }`. Non sa nulla di come la pagina mostra i dati.
export default function useBodyStats() {
  const [stats, setStats] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  const [consentRequired, setConsentRequired] = useState(false);
  const [consentUpdated, setConsentUpdated] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    setLoadFailed(false);
    try {
      const response = await fetch(`${API_BASE_URL}api/user_stats/read.php`, {
        credentials: 'include',
      });
      const data = await response.json();
      setConsentRequired(data.consent_required === true);
      setConsentUpdated(data.consent_updated === true);
      if (data.records) {
        setStats(data.records);
      }
    } catch (error) {
      console.error('Error fetching stats:', error);
      setLoadFailed(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const save = async (payload) => {
    try {
      const response = await fetch(`${API_BASE_URL}api/user_stats/create.php`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        credentials: 'include',
      });
      const result = await response.json();
      if (response.ok) {
        refresh();
        return { ok: true };
      }
      return { ok: false, field: result.field, max: result.max, message: result.message };
    } catch (error) {
      console.error('Error saving stats:', error);
      return { ok: false, connection: true };
    }
  };

  const remove = async (id) => {
    try {
      const response = await fetch(`${API_BASE_URL}api/user_stats/delete.php`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
        credentials: 'include',
      });
      if (response.ok) {
        refresh();
        return { ok: true };
      }
      return { ok: false };
    } catch (error) {
      console.error('Error deleting stat:', error);
      return { ok: false };
    }
  };

  return { stats, loading, loadFailed, consentRequired, consentUpdated, refresh, save, remove };
}
