import { useState, useRef } from 'react';
import { Typography, Grid, Button, Box, Alert, Snackbar } from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import ExerciseDialog from '../components/ExerciseDialog';
import { useTranslation } from 'react-i18next';
import { TITLE_FONT_FAMILY } from '../utils/fonts';
import LockedRow from '../components/LockedRow';
import usePlans from './plans/usePlans';
import PlanCard from './plans/PlanCard';
import ReadOnlyNotice, { readOnlyOnCard } from './plans/ReadOnlyNotice';
import NewPlanDialog from './plans/NewPlanDialog';
import EditPlanDialog from './plans/EditPlanDialog';
import DeletePlanDialog from './plans/DeletePlanDialog';
import DeleteDayDialog from './plans/DeleteDayDialog';
import DeleteExerciseDialog from './plans/DeleteExerciseDialog';
import EditExerciseDialog from './plans/EditExerciseDialog';

const WorkoutPlans = ({ isEmbedded = false }) => {
  const { t } = useTranslation();
  const {
    workoutPlans, account, snackbar, closeSnackbar, readGoalAfterDelete,
    createPlan, updatePlan, activatePlan, deletePlan, deleteDay,
    addExercise, deleteExercise, updateExercise, moveExercise,
  } = usePlans();
  const [expandedPlans, setExpandedPlans] = useState({});
  // Espansione inline dei dettagli del giorno (ex dialog)
  const [expandedDays, setExpandedDays] = useState({});
  const [openDialog, setOpenDialog] = useState(false);
  const [openExerciseDialog, setOpenExerciseDialog] = useState(false);
  const [selectedDayIndex, setSelectedDayIndex] = useState(null);
  const [selectedPlanIndex, setSelectedPlanIndex] = useState(null);

  // Un dialog si chiude subito e dimentica il suo bersaglio dopo 200 ms, a transizione finita
  const [openEditPlanDialog, setOpenEditPlanDialog] = useState(false);
  const [planToEdit, setPlanToEdit] = useState(null);
  const [openDeletePlanDialog, setOpenDeletePlanDialog] = useState(false);
  const [planToDelete, setPlanToDelete] = useState(null);
  const [dayToDelete, setDayToDelete] = useState(null);
  const [openDeleteExerciseDialog, setOpenDeleteExerciseDialog] = useState(false);
  const [exerciseToDelete, setExerciseToDelete] = useState(null); // { dayId, exercise }
  const [openEditExerciseDialog, setOpenEditExerciseDialog] = useState(false);
  const [exerciseToEdit, setExerciseToEdit] = useState(null); // { dayId, exercise }
  const closeEditTimer = useRef();

  const togglePlanExpansion = (planId) => {
    setExpandedPlans(prev => ({
      ...prev,
      [planId]: !prev[planId]
    }));
  };

  // Espande/collassa i dettagli inline di un giorno (esercizi, riordino, modifica, eliminazione)
  const toggleDayExpansion = (dayId) => {
    setExpandedDays(prev => ({
      ...prev,
      [dayId]: !prev[dayId]
    }));
  };

  const handleOpenEditPlanDialog = (plan) => {
    setPlanToEdit(plan);
    setOpenEditPlanDialog(true);
  };

  const handleCloseEditPlanDialog = () => {
    setOpenEditPlanDialog(false);
    setTimeout(() => setPlanToEdit(null), 200);
  };

  const handleOpenExerciseDialog = (planIndex, dayIndex) => {
    setSelectedPlanIndex(planIndex);
    setSelectedDayIndex(dayIndex);
    setOpenExerciseDialog(true);
  };

  const handleOpenDeletePlanDialog = (plan) => {
    setPlanToDelete(plan);
    setOpenDeletePlanDialog(true);
  };

  const handleCloseDeletePlanDialog = () => {
    setOpenDeletePlanDialog(false);
    setTimeout(() => setPlanToDelete(null), 200); // Piccolo ritardo per evitare flickering
  };

  const handleOpenDeleteExerciseDialog = (dayId, exercise) => {
    setExerciseToDelete({ dayId, exercise });
    setOpenDeleteExerciseDialog(true);
  };

  const handleCloseDeleteExerciseDialog = () => {
    setOpenDeleteExerciseDialog(false);
    setTimeout(() => setExerciseToDelete(null), 200);
  };

  const handleOpenEditExerciseDialog = (dayId, exercise) => {
    clearTimeout(closeEditTimer.current);
    setExerciseToEdit({ dayId, exercise });
    setOpenEditExerciseDialog(true);
  };

  const handleCloseEditExerciseDialog = () => {
    setOpenEditExerciseDialog(false);
    closeEditTimer.current = setTimeout(() => setExerciseToEdit(null), 200);
  };

  const isFree = account.tier === 'free';
  const readOnlyAbovePlans = workoutPlans.some((plan) => plan.read_only && !readOnlyOnCard(plan));
  const atPlanLimit = isFree && !!account.limits && workoutPlans.length >= account.limits.plans;

  return (
    <Box sx={{ p: isEmbedded ? 0 : 3 }}>
      {!isEmbedded && (
        <Typography variant="pageTitle" gutterBottom>
          {t('plans.page_title')}
        </Typography>
      )}

      <Box sx={{ display: 'flex', justifyContent: isEmbedded ? 'flex-end' : 'space-between', alignItems: 'center', mb: 3 }}>
        {!isEmbedded && (
          <Typography sx={{ fontFamily: TITLE_FONT_FAMILY, fontWeight: 700, fontSize: 20 }}>
            {t('plans.section_title')}
          </Typography>
        )}
        <Button
          variant="contained"
          startIcon={<AddIcon sx={{ color: "white" }} fontSize="small" />}
          onClick={() => setOpenDialog(true)}
          disabled={!account.loaded || atPlanLimit}
          sx={{ fontSize: 16, fontWeight: 600 }}
        >
          {t('plans.new')}
        </Button>
      </Box>
      {atPlanLimit && (
        <LockedRow>{t('plans.locked_plans', { used: workoutPlans.length, max: account.limits.plans })}</LockedRow>
      )}
      {readOnlyAbovePlans && <ReadOnlyNotice reason="plans_over_limit" limits={account.limits} isFree={isFree} />}

      <Grid container spacing={2.5}>
        {workoutPlans.map((plan, planIndex) => (
          <Grid item xs={12} md={6} key={plan.id}>
            <PlanCard
              plan={plan}
              expanded={!!expandedPlans[plan.id]}
              expandedDays={expandedDays}
              limits={account.limits}
              isFree={isFree}
              onToggle={() => togglePlanExpansion(plan.id)}
              onToggleDay={toggleDayExpansion}
              onEdit={handleOpenEditPlanDialog}
              onDelete={handleOpenDeletePlanDialog}
              onActivate={activatePlan}
              onDeleteDay={setDayToDelete}
              onAddExercise={(dayIndex) => handleOpenExerciseDialog(planIndex, dayIndex)}
              onEditExercise={handleOpenEditExerciseDialog}
              onDeleteExercise={handleOpenDeleteExerciseDialog}
              onMoveExercise={moveExercise}
            />
          </Grid>
        ))}
      </Grid>

      <NewPlanDialog
        open={openDialog}
        onClose={() => setOpenDialog(false)}
        onCreate={createPlan}
        dayLimit={account.limits?.days_per_plan}
        isFree={isFree}
      />

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
        onAdd={(dayIndex, exercise) => addExercise(workoutPlans[selectedPlanIndex].days[dayIndex].id, exercise)}
        dayIndex={selectedDayIndex}
        plansLink={isFree}
      />

      <DeletePlanDialog
        open={openDeletePlanDialog}
        plan={planToDelete}
        onClose={handleCloseDeletePlanDialog}
        onDelete={(plan) => deletePlan(plan.id)}
        loadGoalAfterDelete={readGoalAfterDelete}
      />

      <DeleteExerciseDialog
        open={openDeleteExerciseDialog}
        dayId={exerciseToDelete?.dayId ?? null}
        exercise={exerciseToDelete?.exercise ?? null}
        onClose={handleCloseDeleteExerciseDialog}
        onDelete={deleteExercise}
      />

      <EditExerciseDialog
        open={openEditExerciseDialog}
        dayId={exerciseToEdit?.dayId ?? null}
        exercise={exerciseToEdit?.exercise ?? null}
        onClose={handleCloseEditExerciseDialog}
        onSave={updateExercise}
      />

      <Snackbar
        open={snackbar.open}
        autoHideDuration={6000}
        onClose={closeSnackbar}
      >
        <Alert
          onClose={closeSnackbar}
          severity={snackbar.severity}
          sx={{ width: '100%' }}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default WorkoutPlans;
