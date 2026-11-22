import { useState, useEffect, useMemo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../context/AuthContext';
import { API_BASE_URL } from '../../config';
import { buildShareStats, historyRecords, muscleGroupsTitle } from '../../utils/shareCard';
import { muscleLabel } from '../../i18n/labels';
import { clockDate } from '../../utils/calendarDay';
import workoutSummaries from './workoutSummaries';

const newestFirst = (a, b) => clockDate(b.date) - clockDate(a.date);

// I dati e i comandi che l'elenco e la pagina di un allenamento hanno in comune: gli allenamenti (i più recenti per primi),
// volume, serie e record di ognuno (`summaries`, per id), `loading`, `loadFailed` (la lettura non è riuscita: diverso da
// «nessun allenamento»), `refresh` (rilegge), gli avvisi (`snackbar`, `notify`, `closeSnackbar`), e i comandi:
// previewDelete(id) chiede al server cosa si perderebbe (la risposta, o null se non arriva), moveWorkoutDate sposta la data
// in locale, shareStatsFor prepara la card da condividere. La scheda attiva e l'eliminazione con «Annulla» sono dell'elenco
// (useActivePlan, useUndoableWorkoutDelete). Non sa nulla di come le pagine mostrano i dati.
export default function useWorkoutHistory({ refreshKey = null } = {}) {
  const { t } = useTranslation();
  const { isLoggedIn, loading: authLoading } = useAuth();
  const [workouts, setWorkouts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });

  const notify = (message, severity) => setSnackbar({ open: true, message, severity });
  const closeSnackbar = () => setSnackbar((prev) => ({ ...prev, open: false }));

  useEffect(() => {
    if (authLoading) return;

    if (isLoggedIn) {
      fetchWorkoutHistory();
    } else {
      setLoading(false);
    }
  }, [isLoggedIn, authLoading]);

  useEffect(() => {
    if (refreshKey && isLoggedIn) {
      fetchWorkoutHistory();
    }
  }, [refreshKey, isLoggedIn]);

  const fetchWorkoutHistory = async () => {
    setLoading(true);
    setLoadFailed(false);
    try {
      const response = await fetch(`${API_BASE_URL}api/workout_history/read.php`, {
        method: 'GET',
        credentials: 'include'
      });
      const data = await response.json();
      // 404 = nessun allenamento registrato: lista vuota, non un errore
      if (!response.ok && response.status !== 404) {
        throw new Error(`HTTP ${response.status}`);
      }
      if (data.records && Array.isArray(data.records)) {
        const sortedWorkouts = data.records.sort(newestFirst);
        setWorkouts(sortedWorkouts);
      } else {
        setWorkouts([]);
      }
    } catch (error) {
      console.error('Error fetching workout history:', error);
      setLoadFailed(true);
      setWorkouts([]);
    } finally {
      setLoading(false);
    }
  };

  // Alla conferma il server dice cosa si perderebbe; se l'anteprima non arriva il dialogo resta quello base
  const previewDelete = useCallback((id) => fetch(`${API_BASE_URL}api/workout_history/delete.php`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id, preview: true }),
    credentials: 'include'
  })
    .then(response => (response.ok ? response.json() : null))
    .catch(() => null), []);

  const moveWorkoutDate = (workoutId, moved) => {
    setWorkouts(prev => prev.map(w => w.id === workoutId ? { ...w, ...moved } : w).sort(newestFirst));
    notify(t('history.date.updated'), 'success');
  };

  // Uno per lettura (e per spostamento di data), su tutti gli allenamenti: l'«Annulla» in attesa non rifà i conti
  const summaries = useMemo(() => workoutSummaries(workouts), [workouts]);

  const shareStatsFor = (workout) => buildShareStats({
    exercises: workout.exercises,
    date: workout.date,
    durationSec: workout.duration_seconds,
    title: muscleGroupsTitle(workout.exercises, muscleLabel),
    records: historyRecords(workouts, workout),
  });

  return {
    workouts, summaries, loading, loadFailed,
    snackbar, notify, closeSnackbar,
    refresh: fetchWorkoutHistory,
    previewDelete, moveWorkoutDate, shareStatsFor,
  };
}
