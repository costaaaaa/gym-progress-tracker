import { useState, useEffect, useCallback } from 'react';
import { API_BASE_URL } from '../../config';
import { totalSets, weeklyTotal } from '../../utils/weeklySets';

const NO_SETS = { week: {}, previous_to_date: {}, previous_total: 0 };

// I dati della settimana dei Progressi, dalla dashboard del server: `stats` (null finché non arrivano) con `volumeKg` (kg, senza
// riscaldamento), `setsTotal`, il confronto con la settimana scorsa (`previousToDate`: allo stesso punto, `previousTotal`: intera),
// `sets` (serie per muscolo, `week` e `previous_to_date`), `recovery` e `basic` (il piano Gratis: solo i totali, senza confronto);
// poi `loading`, `loadFailed` (la lettura non è riuscita: diverso da «settimana senza allenamenti», che è tutto a zero) e
// `refresh` (rilegge). Un server più vecchio che non manda un blocco vale zero. Non sa nulla di come le pagine mostrano i dati.
export default function useWeeklyStats() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    setLoadFailed(false);
    try {
      const res = await fetch(`${API_BASE_URL}api/workout_stats/dashboard.php`, { credentials: 'include' });
      const body = res.ok ? await res.json() : null;
      if (!body?.success) throw new Error('dashboard');
      const sets = body.weekly_sets || NO_SETS;
      setStats({
        volumeKg: body.weekly_volume?.total_weight ?? 0,
        setsTotal: weeklyTotal(sets),
        previousToDate: totalSets(sets.previous_to_date),
        previousTotal: sets.previous_total || 0,
        sets,
        recovery: body.recovery || {},
        basic: body.detail === 'basic',
      });
    } catch (error) {
      console.error('Errore nel caricamento dei dati della settimana:', error);
      setStats(null);
      setLoadFailed(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  return { stats, loading, loadFailed, refresh };
}
