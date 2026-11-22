import { useCallback, useEffect, useState } from 'react';
import { API_BASE_URL } from '../../config';

// Catalogo ed esercizi personali dell'utente, gli stessi dati che legge ExerciseDialog (exercise/read_all.php).
// `status` è 'loading', 'ready' o 'error'; con 'error', `message` è quello del server (vuoto se non è arrivato).
// `retry` rilegge. Una risposta senza `records` è un errore, salvo il 404 del catalogo vuoto: un errore di lettura non
// deve sembrare «nessun esercizio».
export default function useAllExercises() {
  const [state, setState] = useState({ status: 'loading', records: [], message: '' });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setState({ status: 'loading', records: [], message: '' });
    (async () => {
      let next;
      try {
        const response = await fetch(`${API_BASE_URL}api/exercise/read_all.php`, { method: 'GET', credentials: 'include' });
        const data = await response.json().catch(() => null);
        // read_all.php risponde 404 con un messaggio (e senza `success`) quando non c'è nessun esercizio: è un elenco vuoto
        const emptyCatalog = response.status === 404 && typeof data?.message === 'string' && data.success === undefined;
        if (response.ok && Array.isArray(data?.records)) next = { status: 'ready', records: data.records, message: '' };
        else if (emptyCatalog) next = { status: 'ready', records: [], message: '' };
        else next = { status: 'error', records: [], message: data?.message || '' };
      } catch {
        next = { status: 'error', records: [], message: '' };
      }
      if (!cancelled) setState(next);
    })();
    return () => { cancelled = true; };
  }, [attempt]);

  const retry = useCallback(() => setAttempt((n) => n + 1), []);
  return { ...state, retry };
}
