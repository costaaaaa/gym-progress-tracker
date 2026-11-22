import { useState, useEffect, useMemo, useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import useUndoableDelete from '../../hooks/useUndoableDelete';
import { useAuth } from '../../context/AuthContext';
import { API_BASE_URL } from '../../config';
import { buildShareStats, historyRecords, muscleGroupsTitle } from '../../utils/shareCard';
import { muscleLabel } from '../../i18n/labels';
import { clockDate } from '../../utils/calendarDay';
import workoutSummaries from './workoutSummaries';

const newestFirst = (a, b) => clockDate(b.date) - clockDate(a.date);

// Allenamenti dell'utente (i più recenti per primi, senza quello in attesa di «Annulla»), volume, serie e record di ognuno
// (`summaries`, per id), avvisi, e i comandi: rileggere, spostare la data in locale, preparare la card da condividere.
// previewDelete(id) chiede al server cosa si perderebbe e restituisce la risposta, o null se non arriva. `loadFailed`: la
// lettura non è riuscita (diverso da «nessun allenamento»).
// Con `list` (l'elenco) c'è anche la scheda attiva, per «Registra allenamento passato», e l'eliminazione con «Annulla» di
// un allenamento tolto dalla sua pagina: arriva nello stato di navigazione (`deleted`) e si legge una volta sola.
// Non sa nulla di come le pagine mostrano i dati.
export default function useWorkoutHistory({ refreshKey = null, list = false } = {}) {
  const { t } = useTranslation();
  const location = useLocation();
  const navigate = useNavigate();
  const { isLoggedIn, loading: authLoading } = useAuth();
  const [workouts, setWorkouts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });
  const [activePlan, setActivePlan] = useState(null);
  const [planLoaded, setPlanLoaded] = useState(false);
  const [planReadFailed, setPlanReadFailed] = useState(false);

  const notify = (message, severity) => setSnackbar({ open: true, message, severity });
  const closeSnackbar = () => setSnackbar((prev) => ({ ...prev, open: false }));

  useEffect(() => {
    if (authLoading) return;

    if (isLoggedIn) {
      fetchWorkoutHistory();
      if (list) fetchActivePlan();
    } else {
      setLoading(false);
    }
  }, [isLoggedIn, authLoading, list]);

  useEffect(() => {
    if (refreshKey && isLoggedIn) {
      fetchWorkoutHistory();
    }
  }, [refreshKey, isLoggedIn]);

  const fetchActivePlan = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}api/workout/read_plans.php`);
      const data = await response.json();
      if (data.records) {
        const active = data.records.find(plan => plan.is_active);
        setActivePlan(active || null);
      } else {
        setPlanReadFailed(true);
      }
    } catch (error) {
      console.error('Error fetching active plan:', error);
      setPlanReadFailed(true);
    } finally {
      setPlanLoaded(true);
    }
  };

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

  // La riga sparisce subito; la richiesta al server parte solo allo scadere dell'«Annulla» (vedi useUndoableDelete)
  const { hiddenIds, pendingId, schedule: scheduleDelete, undo: undoDelete, holdProps: undoHoldProps } = useUndoableDelete({
    commit: async (id) => {
      const response = await fetch(`${API_BASE_URL}api/workout_history/delete.php`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
        credentials: 'include'
      });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.message || t('history.delete.error'));
      }
    },
    onError: (error) => notify(error.message, 'error'),
  });

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

  // Dall'arrivo con `deleted` l'allenamento sparisce subito e parte l'«Annulla»; l'indicazione si toglie dall'indirizzo
  // (il resto dello stato resta) perché non sopravviva a ricarica e tasto indietro
  const deletedOnArrival = list ? location.state?.deleted : undefined;
  useEffect(() => {
    if (deletedOnArrival === undefined) return;
    const { deleted, ...rest } = location.state;
    scheduleDelete(deleted);
    navigate({ pathname: location.pathname, search: location.search, hash: location.hash }, { replace: true, state: Object.keys(rest).length > 0 ? rest : null });
  }, [deletedOnArrival, location.state, location.pathname, location.search, location.hash, navigate, scheduleDelete]);

  const visibleWorkouts = useMemo(() => workouts.filter(w => !hiddenIds.includes(w.id)), [workouts, hiddenIds]);
  // Uno per lettura (e per spostamento di data), su tutti gli allenamenti: l'«Annulla» in attesa non rifà i conti
  const summaries = useMemo(() => workoutSummaries(workouts), [workouts]);

  const shareStatsFor = (workout) => buildShareStats({
    exercises: workout.exercises,
    date: workout.date,
    durationSec: workout.duration_seconds,
    title: muscleGroupsTitle(workout.exercises, muscleLabel),
    records: historyRecords(visibleWorkouts, workout),
  });

  return {
    workouts: visibleWorkouts, summaries, loading, loadFailed, activePlan, planLoaded, planReadFailed,
    snackbar, notify, closeSnackbar,
    refresh: fetchWorkoutHistory,
    hiddenIds, pendingId, undoDelete, undoHoldProps, previewDelete,
    moveWorkoutDate, shareStatsFor,
  };
}
