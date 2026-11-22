import { useState, useEffect, useMemo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import useUndoableDelete from '../../hooks/useUndoableDelete';
import { useAuth } from '../../context/AuthContext';
import { API_BASE_URL } from '../../config';
import { buildShareStats, historyRecords, muscleGroupsTitle } from '../../utils/shareCard';
import { muscleLabel } from '../../i18n/labels';
import { clockDate } from '../../utils/calendarDay';

const newestFirst = (a, b) => clockDate(b.date) - clockDate(a.date);

// Allenamenti dell'utente (i più recenti per primi), scheda attiva, avvisi, e i comandi: rileggere, eliminare con
// «Annulla», spostare la data in locale, preparare la card da condividere. previewDelete(id) chiede al server cosa
// si perderebbe e restituisce la risposta, o null se non arriva. Non sa nulla di come la pagina mostra i dati.
export default function useWorkoutHistory({ refreshKey = null } = {}) {
  const { t } = useTranslation();
  const { isLoggedIn, loading: authLoading } = useAuth();
  const [workouts, setWorkouts] = useState([]);
  const [loading, setLoading] = useState(true);
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
      fetchActivePlan();
    } else {
      setLoading(false);
    }
  }, [isLoggedIn, authLoading]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (refreshKey && isLoggedIn) {
      fetchWorkoutHistory();
    }
  }, [refreshKey, isLoggedIn]); // eslint-disable-line react-hooks/exhaustive-deps

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
    try {
      const response = await fetch(`${API_BASE_URL}api/workout_history/read.php`, {
        method: 'GET',
        credentials: 'include'
      });
      const data = await response.json();
      // 404 = nessun allenamento registrato: lista vuota, non un errore
      if (!response.ok && response.status !== 404) {
        throw new Error(data.message || t('history.load_error'));
      }
      if (data.records && Array.isArray(data.records)) {
        const sortedWorkouts = data.records.sort(newestFirst);
        setWorkouts(sortedWorkouts);
      } else {
        setWorkouts([]);
      }
    } catch (error) {
      console.error('Error fetching workout history:', error);
      setSnackbar({
        open: true,
        message: t('history.load_error_detail', { message: error.message || t('history.unknown_error') }),
        severity: 'error'
      });
      setWorkouts([]);
    } finally {
      setLoading(false);
    }
  };

  // La riga sparisce subito; la richiesta al server parte solo allo scadere dell'«Annulla» (vedi useUndoableDelete)
  const { hiddenIds, pendingId, schedule: deleteWorkout, undo: undoDelete, holdProps: undoHoldProps } = useUndoableDelete({
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

  const visibleWorkouts = useMemo(() => workouts.filter(w => !hiddenIds.includes(w.id)), [workouts, hiddenIds]);

  const buildShareCard = (workout) => buildShareStats({
    exercises: workout.exercises,
    date: workout.date,
    durationSec: workout.duration_seconds,
    title: muscleGroupsTitle(workout.exercises, muscleLabel),
    records: historyRecords(visibleWorkouts, workout),
  });

  return {
    visibleWorkouts, loading, activePlan, planLoaded, planReadFailed,
    snackbar, notify, closeSnackbar,
    refresh: fetchWorkoutHistory,
    hiddenIds, pendingId, deleteWorkout, undoDelete, undoHoldProps, previewDelete,
    moveWorkoutDate, buildShareCard,
  };
}
