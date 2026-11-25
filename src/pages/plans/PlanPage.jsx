import { useEffect, useRef, useState } from 'react';
import { Alert, Box, Button, CircularProgress, Grid, IconButton, Snackbar, Typography } from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import { Link as RouterLink, useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { usePageMeta } from '../../hooks/usePageMeta';
import ExerciseDialog from '../../components/ExerciseDialog';
import { ALIGN_TEXT, DANGER_TEXT, NEUTRAL_OUTLINED } from '../../utils/buttonStyles';
import ActiveBadge from './ActiveBadge';
import usePlans from './usePlans';
import useArrivalState from './useArrivalState';
import PlanDay from './PlanDay';
import ReadOnlyNotice, { readOnlyNoticeReason } from './ReadOnlyNotice';
import EditPlanDialog from './EditPlanDialog';
import DeletePlanDialog from './DeletePlanDialog';
import DeleteDayDialog from './DeleteDayDialog';
import DeleteExerciseDialog from './DeleteExerciseDialog';
import EditExerciseDialog from './EditExerciseDialog';

// Pagina di una scheda (/schede/:id): in lettura i giorni con tutti gli esercizi e «Inizia» per giorno; i comandi di
// modifica compaiono solo dopo «Modifica». Lo stato «Modifica» sta qui, non nell'indirizzo.
const PlanPage = () => {
  const { t } = useTranslation();
  const { id } = useParams();
  const navigate = useNavigate();
  const {
    workoutPlans, plansLoaded, account, snackbar, closeSnackbar, notify, readGoalAfterDelete,
    updatePlan, activatePlan, deletePlan, deleteDay, addExercise, deleteExercise, updateExercise, moveExercise,
  } = usePlans();
  const plan = workoutPlans.find((p) => String(p.id) === id);
  usePageMeta(plan?.name ?? t('nav.plans'), t('plans.meta.description'));

  // L'ingresso dopo la creazione porta con sé state.edit e l'avviso di riuscita: valgono una volta (useArrivalState)
  const { edit: enteredEditing } = useArrivalState(notify);
  const [editing, setEditing] = useState(enteredEditing);
  const focusDoneOnEntry = useRef(enteredEditing);
  const toggleRef = useRef(null);
  useEffect(() => {
    if (plan && focusDoneOnEntry.current) {
      focusDoneOnEntry.current = false;
      toggleRef.current?.focus();
    }
  }, [plan]);

  // Una scheda che non c'è (o non è dell'utente) riporta all'elenco, ma solo a schede caricate
  useEffect(() => {
    if (plansLoaded && !plan) navigate('/schede', { replace: true });
  }, [plansLoaded, plan, navigate]);

  // Annullando, un dialog si chiude subito e la scheda o l'esercizio su cui lavorava restano ancora 200 ms, a
  // dissolvenza finita; «Elimina giorno» e la conferma di «Elimina esercizio» lo dimenticano subito.
  const [openEditPlanDialog, setOpenEditPlanDialog] = useState(false);
  const [planToEdit, setPlanToEdit] = useState(null);
  const [openDeletePlanDialog, setOpenDeletePlanDialog] = useState(false);
  const [planToDelete, setPlanToDelete] = useState(null);
  const [dayToDelete, setDayToDelete] = useState(null);
  const [openDeleteExerciseDialog, setOpenDeleteExerciseDialog] = useState(false);
  const [exerciseToDelete, setExerciseToDelete] = useState(null); // { dayId, exercise }
  const [openEditExerciseDialog, setOpenEditExerciseDialog] = useState(false);
  const [exerciseToEdit, setExerciseToEdit] = useState(null); // { dayId, exercise }
  const [openExerciseDialog, setOpenExerciseDialog] = useState(false);
  const [selectedDayIndex, setSelectedDayIndex] = useState(null);
  const closeEditTimer = useRef();

  const handleOpenEditPlanDialog = () => {
    setPlanToEdit(plan);
    setOpenEditPlanDialog(true);
  };

  const handleCloseEditPlanDialog = () => {
    setOpenEditPlanDialog(false);
    setTimeout(() => setPlanToEdit(null), 200);
  };

  const handleOpenDeletePlanDialog = () => {
    setPlanToDelete(plan);
    setOpenDeletePlanDialog(true);
  };

  const handleCloseDeletePlanDialog = () => {
    setOpenDeletePlanDialog(false);
    setTimeout(() => setPlanToDelete(null), 200); // Piccolo ritardo per evitare flickering
  };

  // Eliminata la scheda si torna all'elenco, che mostra l'avviso (questa pagina si smonta)
  const handleDeletePlan = async (toDelete) => {
    const deleted = await deletePlan(toDelete.id);
    if (deleted) navigate('/schede', { replace: true, state: { notice: t('plans.msg.plan_deleted') } });
    return deleted;
  };

  const handleOpenDeleteExerciseDialog = (target) => {
    setExerciseToDelete(target);
    setOpenDeleteExerciseDialog(true);
  };

  const handleCloseDeleteExerciseDialog = () => {
    setOpenDeleteExerciseDialog(false);
    setTimeout(() => setExerciseToDelete(null), 200);
  };

  const handleConfirmDeleteExercise = async (target) => {
    try {
      await deleteExercise(target);
    } finally {
      setOpenDeleteExerciseDialog(false);
      setExerciseToDelete(null);
    }
  };

  const handleOpenEditExerciseDialog = (target) => {
    clearTimeout(closeEditTimer.current);
    setExerciseToEdit(target);
    setOpenEditExerciseDialog(true);
  };

  const handleCloseEditExerciseDialog = () => {
    setOpenEditExerciseDialog(false);
    closeEditTimer.current = setTimeout(() => setExerciseToEdit(null), 200);
  };

  const handleOpenExerciseDialog = (dayIndex) => {
    setSelectedDayIndex(dayIndex);
    setOpenExerciseDialog(true);
  };

  // Il Focus si apre con il giorno scelto già selezionato
  const handleStart = (day) => navigate('/focus', { state: { suggestedDayId: day.id } });

  const isFree = account.tier === 'free';
  const readOnly = !!plan?.read_only;
  const noticeReason = plan && readOnlyNoticeReason(plan);
  const active = !!plan?.is_active;

  return (
    <Box sx={{ pb: 3 }}>
      {plan ? (
        <>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
            <IconButton component={RouterLink} to="/schede" aria-label={t('nav.plans')} edge="start" sx={{ width: 44, height: 44, color: 'text.primary' }}>
              <ArrowBackIcon />
            </IconButton>
            <Typography variant="pageTitle" sx={{ flex: 1, minWidth: 0, overflowWrap: 'anywhere' }}>{plan.name}</Typography>
            <Button
              ref={toggleRef}
              variant="outlined"
              aria-pressed={editing}
              onClick={() => setEditing((on) => !on)}
              sx={{ ...NEUTRAL_OUTLINED, minHeight: 44, fontWeight: 600, flexShrink: 0, ...(editing && { bgcolor: 'action.selected' }) }}
            >
              {editing ? t('plans.edit_done') : t('plans.edit_mode')}
            </Button>
          </Box>

          <Box sx={{ mb: 2 }}>
            {active && <ActiveBadge />}
            {!active && !editing && (
              <Button variant="outlined" onClick={() => activatePlan(plan.id)} sx={{ ...NEUTRAL_OUTLINED, minHeight: 44, fontWeight: 600 }}>
                {t('plans.make_active')}
              </Button>
            )}
          </Box>

          {plan.description && (
            <Typography sx={{ fontSize: 16, color: 'text.secondary', lineHeight: 1.5, mb: 2 }}>{plan.description}</Typography>
          )}
          {noticeReason && <ReadOnlyNotice reason={noticeReason} limits={account.limits} isFree={isFree} />}

          <Grid container spacing={2.5}>
            {(plan.days || []).map((day, dayIndex) => (
              <Grid item xs={12} md={6} key={day.id}>
                <PlanDay
                  day={day}
                  editing={editing}
                  readOnly={readOnly}
                  canStart={active && (day.exercises?.length ?? 0) > 0}
                  canDelete={plan.days.length > 1}
                  onStart={handleStart}
                  onAddExercise={() => handleOpenExerciseDialog(dayIndex)}
                  onDeleteDay={setDayToDelete}
                  onEditExercise={handleOpenEditExerciseDialog}
                  onDeleteExercise={handleOpenDeleteExerciseDialog}
                  onMoveExercise={moveExercise}
                />
              </Grid>
            ))}
          </Grid>

          {editing && (
            <Box sx={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', gap: 1, mt: 3 }}>
              <Button variant="outlined" onClick={handleOpenEditPlanDialog} sx={{ ...NEUTRAL_OUTLINED, minHeight: 44, fontWeight: 600 }}>
                {t('plans.edit_details')}
              </Button>
              <Button onClick={handleOpenDeletePlanDialog} sx={{ ...DANGER_TEXT, ...ALIGN_TEXT, minHeight: 44 }}>
                {t('plans.delete_plan_action')}
              </Button>
            </Box>
          )}

          <EditPlanDialog
            open={openEditPlanDialog}
            plan={planToEdit}
            onClose={handleCloseEditPlanDialog}
            onSave={updatePlan}
          />

          <DeleteDayDialog
            day={dayToDelete}
            onClose={() => setDayToDelete(null)}
            onDelete={deleteDay}
            features={account.features}
          />

          <ExerciseDialog
            open={openExerciseDialog}
            onClose={() => setOpenExerciseDialog(false)}
            onAdd={(dayIndex, exercise) => addExercise(plan.days[dayIndex].id, exercise)}
            dayIndex={selectedDayIndex}
            plansLink={isFree}
          />

          <DeletePlanDialog
            open={openDeletePlanDialog}
            plan={planToDelete}
            onClose={handleCloseDeletePlanDialog}
            onDelete={handleDeletePlan}
            readGoalAfterDelete={readGoalAfterDelete}
          />

          <DeleteExerciseDialog
            open={openDeleteExerciseDialog}
            target={exerciseToDelete}
            onClose={handleCloseDeleteExerciseDialog}
            onDelete={handleConfirmDeleteExercise}
          />

          <EditExerciseDialog
            open={openEditExerciseDialog}
            target={exerciseToEdit}
            onClose={handleCloseEditExerciseDialog}
            onSave={updateExercise}
          />
        </>
      ) : (
        <Box sx={{ display: 'flex', justifyContent: 'center', p: 6 }}><CircularProgress /></Box>
      )}

      <Snackbar open={snackbar.open} autoHideDuration={6000} onClose={closeSnackbar}>
        <Alert onClose={closeSnackbar} severity={snackbar.severity} sx={{ width: '100%' }}>
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default PlanPage;
