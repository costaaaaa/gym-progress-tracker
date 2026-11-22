import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { API_BASE_URL } from '../../config';
import { samePlannedSets } from '../../utils/plannedSets';

const JSON_HEADERS = { 'Content-Type': 'application/json' };

// Le schede attive vanno per prime, l'ordine del server resta per le altre
const activeFirst = (records) => [...records].sort((a, b) => {
  if (a.is_active && !b.is_active) return -1;
  if (!a.is_active && b.is_active) return 1;
  return 0;
});

// Schede, piano e limiti dell'utente, e i comandi che li cambiano. Ogni comando manda la richiesta, mostra
// l'avviso e rilegge le schede. updatePlan, activatePlan, deletePlan, deleteDay, addExercise e deleteExercise
// restituiscono true se il server ha accettato, false se no; createPlan l'id della scheda creata o null;
// updateExercise e moveExercise non restituiscono nulla. `plansLoaded` diventa vero alla prima lettura riuscita.
// `notify` mostra un avviso (anche quello portato da un'altra schermata). Non sa nulla di come la pagina mostra i dati.
export default function usePlans() {
  const { t } = useTranslation();
  const [workoutPlans, setWorkoutPlans] = useState([]);
  const [plansLoaded, setPlansLoaded] = useState(false);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });
  // Piano, limiti e funzioni dell'utente (user/read.php). Se la lettura fallisce restano senza valori: nessun
  // tetto lato client, decide il server (limite accettato).
  const [account, setAccount] = useState({ loaded: false, tier: null, limits: null, features: [] });

  const notify = useCallback((message, severity) => setSnackbar({ open: true, message, severity }), []);
  const closeSnackbar = () => setSnackbar((prev) => ({ ...prev, open: false }));

  useEffect(() => {
    fetchWorkoutPlans();
    fetchAccount();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const fetchAccount = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}api/user/read.php`, { credentials: 'include' });
      const user = response.ok ? await response.json() : null;
      setAccount({
        loaded: true,
        tier: user?.tier ?? null,
        limits: user?.limits ?? null,
        features: Array.isArray(user?.features) ? user.features : [],
      });
    } catch {
      setAccount((prev) => ({ ...prev, loaded: true }));
    }
  };

  const fetchWorkoutPlans = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}api/workout/read_plans.php`, {
        method: 'GET',
        credentials: 'include'
      });
      const data = await response.json();

      if (data.records) {
        setWorkoutPlans(activeFirst(data.records));
        setPlansLoaded(true);
      }
    } catch (error) {
      console.error('Error fetching workout plans:', error);
      notify(t('plans.msg.load_error', { message: error.message }), 'error');
    }
  };

  // Obiettivo a cui tornerebbe la settimana eliminando la scheda attiva; null = non cambia o lettura fallita.
  // Senza scheda attiva, e senza un obiettivo scelto dall'utente, l'obiettivo della settimana torna a quello senza scheda
  const readGoalAfterDelete = useCallback(async () => {
    try {
      const response = await fetch(`${API_BASE_URL}api/user/read.php`, { credentials: 'include' });
      const user = response.ok ? await response.json() : null;
      if (user && user.weekly_goal == null && user.weekly_goal_default !== user.weekly_goal_without_plan) return user.weekly_goal_without_plan;
    } catch { /* il testo sull'obiettivo è solo un avviso in più */ }
    return null;
  }, []);

  const createPlan = async ({ name, description }, numDays) => {
    try {
      const response = await fetch(`${API_BASE_URL}api/workout/create_plan.php`, {
        method: 'POST',
        headers: JSON_HEADERS,
        body: JSON.stringify({ name, description })
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.message || t('plans.msg.create_error'));
      }

      const daysToCreate = Array.from({ length: numDays }, (_, i) => ({
        name: t('plans.day_default', { n: i + 1 }),
        exercises: []
      }));

      // Create workout days
      const daysResponse = await fetch(`${API_BASE_URL}api/workout/create_days.php`, {
        method: 'POST',
        headers: JSON_HEADERS,
        body: JSON.stringify({
          plan_id: data.plan.id,
          days: daysToCreate
        })
      });

      const daysData = await daysResponse.json();
      if (!daysResponse.ok) {
        throw new Error(daysData.message || t('plans.msg.create_days_error'));
      }

      fetchWorkoutPlans();
      return data.plan.id;
    } catch (error) {
      console.error('Error creating workout plan:', error);
      notify(error.message || t('plans.msg.create_error'), 'error');
      return null;
    }
  };

  const updatePlan = async (plan, { name, description }) => {
    try {
      const response = await fetch(`${API_BASE_URL}api/workout/update_plan.php`, {
        method: 'POST',
        headers: JSON_HEADERS,
        body: JSON.stringify({
          plan_id: plan.id,
          name,
          description,
          is_active: plan.is_active
        })
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.message || t('plans.msg.update_error'));
      }

      notify(t('plans.msg.updated'), 'success');
      fetchWorkoutPlans();
      return true;
    } catch (error) {
      console.error('Error updating workout plan:', error);
      notify(error.message || t('plans.msg.update_error'), 'error');
      return false;
    }
  };

  const activatePlan = async (planId) => {
    try {
      const response = await fetch(`${API_BASE_URL}api/workout/activate_plan.php`, {
        method: 'POST',
        headers: JSON_HEADERS,
        body: JSON.stringify({ plan_id: planId })
      });

      const data = await response.json();
      if (response.ok) {
        notify(t('plans.msg.activated'), 'success');
        fetchWorkoutPlans();
        return true;
      }
      throw new Error(data.message);
    } catch (error) {
      notify(error.message || t('plans.msg.activate_error'), 'error');
      return false;
    }
  };

  const deletePlan = async (planId) => {
    try {
      const response = await fetch(`${API_BASE_URL}api/workout/delete_plan.php`, {
        method: 'POST',
        headers: JSON_HEADERS,
        body: JSON.stringify({ plan_id: planId })
      });

      const data = await response.json();
      if (response.ok) {
        fetchWorkoutPlans();
        return true;
      }
      throw new Error(data.message);
    } catch (error) {
      notify(error.message || t('plans.msg.delete_plan_error'), 'error');
      return false;
    }
  };

  const deleteDay = async (day) => {
    try {
      const response = await fetch(`${API_BASE_URL}api/workout/delete_day.php`, {
        method: 'POST',
        headers: JSON_HEADERS,
        body: JSON.stringify({ day_id: day.id })
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.message || t('plans.msg.delete_day_error'));
      }
      notify(t('plans.msg.day_deleted'), 'success');
      fetchWorkoutPlans();
      return true;
    } catch (error) {
      notify(error.message || t('plans.msg.delete_day_error'), 'error');
      return false;
    }
  };

  // `exercise` arriva dalla ricerca esercizi (con planned_sets, rest e notes scelti nel dialog)
  const addExercise = async (dayId, exercise) => {
    try {
      // Non creiamo un nuovo esercizio, ma utilizziamo l'ID dell'esercizio esistente
      // Otteniamo l'ID dell'esercizio selezionato dall'autocomplete
      const selectedExerciseId = exercise.id;

      if (!selectedExerciseId) {
        throw new Error(t('plans.msg.invalid_exercise_id'));
      }

      // Aggiungiamo l'esercizio al giorno di allenamento
      const response = await fetch(`${API_BASE_URL}api/workout/add_exercise.php`, {
        method: 'POST',
        headers: JSON_HEADERS,
        body: JSON.stringify({
          day_id: dayId,
          exercise_id: selectedExerciseId, // Questo è l'ID dell'esercizio dalla tabella gym_exercises
          planned_sets: exercise.planned_sets,
          rest: parseInt(exercise.rest),
          notes: exercise.notes
        })
      });

      const data = await response.json();
      if (response.ok) {
        notify(t('plans.msg.exercise_added'), 'success');
        fetchWorkoutPlans();
        return true;
      }
      throw new Error(data.message);
    } catch (error) {
      notify(error.message || t('plans.msg.add_exercise_error'), 'error');
      return false;
    }
  };

  const deleteExercise = async ({ dayId, exercise }) => {
    try {
      const response = await fetch(`${API_BASE_URL}api/workout/delete_exercise.php`, {
        method: 'POST',
        headers: JSON_HEADERS,
        body: JSON.stringify({
          day_id: dayId,
          exercise_id: exercise.id
        })
      });

      const data = await response.json();
      if (response.ok) {
        notify(t('plans.msg.exercise_deleted'), 'success');
        fetchWorkoutPlans();
        return true;
      }
      throw new Error(data.message);
    } catch (error) {
      notify(error.message || t('plans.msg.delete_exercise_error'), 'error');
      return false;
    }
  };

  // Modifica di recupero, note e serie dell'esercizio `{ dayId, exercise }`. `onAnswered` parte appena il server ha
  // risposto, riuscito o no, prima della rilettura delle schede: chi chiama non deve aspettare anche quella.
  const updateExercise = async ({ dayId, exercise }, { plannedSets, rest, notes }, onAnswered) => {
    try {
      // Prepara i dati da inviare, con controlli di tipo
      const exerciseData = {
        day_id: dayId,
        exercise_id: exercise.id,
        planned_sets: plannedSets,
        rest: parseInt(rest) || 0,
        notes: notes || ''
      };

      // Notifica l'utente che stiamo salvando le modifiche
      notify(t('plans.msg.saving_changes'), 'info');

      const response = await fetch(`${API_BASE_URL}api/workout/update_exercise.php`, {
        method: 'POST',
        headers: JSON_HEADERS,
        body: JSON.stringify(exerciseData),
        credentials: 'include' // Assicura che i cookie di sessione vengano inviati
      });

      const data = await response.json();

      if (response.ok) {
        onAnswered();

        // Recupera i piani aggiornati
        const updatedPlansResponse = await fetch(`${API_BASE_URL}api/workout/read_plans.php`, {
          method: 'GET',
          credentials: 'include'
        });

        const updatedPlansData = await updatedPlansResponse.json();

        // Verifica che i dati recuperati contengano la modifica effettuata
        let modificaVerificata = false;

        if (updatedPlansData.records) {
          // Cerca l'esercizio modificato nei dati aggiornati
          updatedPlansData.records.forEach(plan => {
            if (plan.days) {
              plan.days.forEach(day => {
                if (day.id === dayId && day.exercises) {
                  day.exercises.forEach(ex => {
                    if (ex.id === exercise.id) {
                      // Verifica se i valori sono stati aggiornati correttamente
                      if (samePlannedSets(exerciseData.planned_sets, ex.planned_sets) &&
                          ex.rest === exerciseData.rest &&
                          (ex.notes || '') === (exerciseData.notes || '')) {
                        modificaVerificata = true;
                      }
                    }
                  });
                }
              });
            }
          });

          // Se la verifica è andata a buon fine, aggiorna i dati locali
          if (modificaVerificata) {
            setWorkoutPlans(activeFirst(updatedPlansData.records));
            notify(t('plans.msg.exercise_updated'), 'success');
          } else {
            console.error('ERRORE: La modifica non è stata trovata nei dati recuperati!');

            // Riprova il recupero dopo un timeout più lungo
            setTimeout(async () => {
              await fetchWorkoutPlans();
              notify(t('plans.msg.saved_reload'), 'warning');
            }, 2000);
          }
        } else {
          console.error('ERRORE: Nessun dato ricevuto nella risposta di recupero piani!');
          throw new Error(t('plans.msg.refetch_error'));
        }
      } else {
        throw new Error(data.message || t('plans.msg.edit_exercise_error'));
      }
    } catch (error) {
      console.error('Errore nella modifica dell\'esercizio:', error);
      notify(error.message || t('plans.msg.edit_exercise_error'), 'error');
      onAnswered();
    }
  };

  // Sposta un esercizio di un posto nel giorno, `direction` è 'up' o 'down'. Al primo e all'ultimo non fa nulla.
  // Riceve il giorno intero e non il suo id perché servono i suoi esercizi per riconoscere il primo e l'ultimo.
  const moveExercise = async (day, exercise, direction) => {
    const index = day.exercises.findIndex((e) => e.id === exercise.id);
    if (direction === 'up' ? index <= 0 : index >= day.exercises.length - 1) return;

    try {
      const response = await fetch(`${API_BASE_URL}api/workout/reorder_exercise.php`, {
        method: 'POST',
        headers: JSON_HEADERS,
        body: JSON.stringify({
          day_id: day.id,
          exercise_id: exercise.id,
          direction
        }),
        credentials: 'include'
      });

      const data = await response.json();

      if (response.ok) {
        notify(t('plans.msg.order_updated'), 'success');
        // Aggiungiamo un timeout per dare tempo al database di aggiornare i dati
        setTimeout(() => {
          fetchWorkoutPlans();
        }, 300);
      } else {
        throw new Error(data.message || t('plans.msg.server_error'));
      }
    } catch (error) {
      console.error(`Errore nel riordinamento (${direction === 'up' ? 'su' : 'giù'}):`, error);
      notify(error.message || t('plans.msg.move_error'), 'error');
    }
  };

  return {
    workoutPlans, plansLoaded, account, snackbar, closeSnackbar, notify,
    readGoalAfterDelete, createPlan, updatePlan, activatePlan, deletePlan, deleteDay,
    addExercise, deleteExercise, updateExercise, moveExercise,
  };
}
