import { useId, useState } from 'react';
import { Box, Typography, Button, Grid, Alert, Snackbar, Card, CardActionArea } from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import { Link as RouterLink, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { usePageMeta } from '../hooks/usePageMeta';
import { TITLE_FONT_FAMILY } from '../utils/fonts';
import LockedRow from '../components/LockedRow';
import usePlans from './plans/usePlans';
import useArrivalState from './plans/useArrivalState';
import PlanListCard from './plans/PlanListCard';
import ReadOnlyNotice, { readOnlyNoticeReason } from './plans/ReadOnlyNotice';
import NewPlanDialog from './plans/NewPlanDialog';

// Pagina «Schede» (/schede): l'elenco compatto, una card per scheda che porta alla sua pagina (/schede/:id).
const Plans = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  usePageMeta(t('nav.plans'), t('plans.meta.description'));
  const { workoutPlans, account, snackbar, closeSnackbar, notify, createPlan } = usePlans();
  useArrivalState(notify);
  const [openDialog, setOpenDialog] = useState(false);
  const allExercisesId = useId();

  // Creata la scheda si va alla sua pagina con «Modifica» già acceso, per aggiungere subito gli esercizi; l'avviso
  // di riuscita va con lei, perché questa schermata si smonta
  const handleCreate = async (values, numDays) => {
    const id = await createPlan(values, numDays);
    if (id === null) return false;
    navigate(`/schede/${id}`, { state: { edit: true, notice: t('plans.msg.created') } });
    return true;
  };

  const isFree = account.tier === 'free';
  const readOnlyAbovePlans = workoutPlans.some((plan) => readOnlyNoticeReason(plan) === 'plans_over_limit');
  const atPlanLimit = isFree && !!account.limits && workoutPlans.length >= account.limits.plans;

  return (
    <Box sx={{ pb: 3 }}>
      {/* Il titolo sta alla stessa distanza dalla barra delle pagine senza pulsante: la riga è alta 44 px (pulsante compreso) con il
          titolo al centro, e il margine negativo toglie la metà di (44 − 32,7 px di titolo) */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 2, mb: 3, minHeight: 44, mt: '-5.66px' }}>
        <Typography variant="pageTitle">{t('nav.plans')}</Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon sx={{ color: 'white' }} fontSize="small" />}
          onClick={() => setOpenDialog(true)}
          disabled={!account.loaded || atPlanLimit}
          sx={{ fontSize: 16, fontWeight: 600, py: 0, minHeight: 44 }}
        >
          {t('plans.new')}
        </Button>
      </Box>
      {atPlanLimit && (
        <LockedRow>{t('plans.locked_plans', { used: workoutPlans.length, max: account.limits.plans })}</LockedRow>
      )}
      {readOnlyAbovePlans && <ReadOnlyNotice reason="plans_over_limit" limits={account.limits} isFree={isFree} />}

      <Grid container spacing={2.5}>
        {workoutPlans.map((plan) => (
          <Grid item xs={12} md={6} key={plan.id}>
            <PlanListCard plan={plan} />
          </Grid>
        ))}
      </Grid>

      {/* In fondo anche senza schede: l'elenco di tutti gli esercizi si apre sempre da qui */}
      <Card sx={{ mt: 2.5 }}>
        <CardActionArea
          component={RouterLink}
          to="/schede/esercizi"
          aria-labelledby={`${allExercisesId}-title`}
          aria-describedby={`${allExercisesId}-hint`}
          sx={{ minHeight: 64, p: 2.5, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2 }}
        >
          <Box>
            <Typography id={`${allExercisesId}-title`} sx={{ fontFamily: TITLE_FONT_FAMILY, fontWeight: 700, fontSize: 16 }}>
              {t('plans.exercises.title')}
            </Typography>
            <Typography id={`${allExercisesId}-hint`} sx={{ mt: 0.5, fontSize: 16, color: 'text.secondary' }}>
              {t('plans.exercises.hint')}
            </Typography>
          </Box>
          <ChevronRightIcon sx={{ color: 'text.secondary', flexShrink: 0 }} />
        </CardActionArea>
      </Card>

      <NewPlanDialog
        open={openDialog}
        onClose={() => setOpenDialog(false)}
        onCreate={handleCreate}
        dayLimit={account.limits?.days_per_plan}
        isFree={isFree}
      />

      <Snackbar open={snackbar.open} autoHideDuration={6000} onClose={closeSnackbar}>
        <Alert onClose={closeSnackbar} severity={snackbar.severity} sx={{ width: '100%' }}>
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default Plans;
