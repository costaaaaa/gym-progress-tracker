import { useState, useEffect, useMemo, useCallback } from 'react';
import { API_BASE_URL } from '../../config';
import { buildExerciseSeries, analyzeExercise, withCatalog } from '../../utils/progressOverview';

// I dati dei Progressi per esercizio, in comune tra l'elenco e la pagina di un esercizio: `analyzed` (un elemento per
// esercizio allenato, con serie di sessioni, stato e variazione, nome e muscolo dal catalogo), `catalog` (id -> esercizio,
// per la ricerca), `loading`, `loadFailed` (la lettura non è riuscita: diverso da «nessun allenamento») e `refresh`
// (rilegge). Non sa nulla di come le pagine mostrano i dati.
export default function useExerciseProgress() {
  const [catalog, setCatalog] = useState({});
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    setLoadFailed(false);
    try {
      const [exRes, histRes] = await Promise.all([
        fetch(`${API_BASE_URL}api/exercise/read_all.php`, { credentials: 'include' }),
        fetch(`${API_BASE_URL}api/workout_history/read.php`, { credentials: 'include' }),
      ]);
      if (!exRes.ok) throw new Error('exercises');
      const exData = await exRes.json();
      const byId = {};
      (exData.records || []).forEach((ex) => { byId[String(ex.id)] = ex; });
      setCatalog(byId);

      // 404 = nessun allenamento registrato, non un errore di connessione
      if (histRes.status === 404) {
        setRecords([]);
      } else if (!histRes.ok) {
        throw new Error('history');
      } else {
        const histData = await histRes.json();
        setRecords(Array.isArray(histData.records) ? histData.records : []);
      }
    } catch (error) {
      console.error('Errore nel caricamento dei progressi:', error);
      setRecords([]);
      setLoadFailed(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const analyzed = useMemo(() => {
    const now = Date.now();
    const items = Object.values(buildExerciseSeries(records)).map((serie) => analyzeExercise(serie, now));
    return withCatalog(items, catalog);
  }, [records, catalog]);

  return { analyzed, catalog, loading, loadFailed, refresh };
}
