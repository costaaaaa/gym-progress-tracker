import { useState, useEffect } from 'react';
import { Box, Button, Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle } from '@mui/material';
import { useTranslation } from 'react-i18next';
import ButtonSpinner from '../../components/ButtonSpinner';

// Conferma di eliminazione di una scheda. `plan` resta valorizzato finché il dialog si chiude; `onDelete(scheda)`
// elimina e il dialog si chiude comunque. Per una scheda attiva, `readGoalAfterDelete()` dice a quale obiettivo
// settimanale tornerebbe l'utente (null = non cambia).
const DeletePlanDialog = ({ open, plan, onClose, onDelete, readGoalAfterDelete }) => {
  const { t } = useTranslation();
  const [deletePlanLoading, setDeletePlanLoading] = useState(false);
  const [goalAfterDelete, setGoalAfterDelete] = useState(null);

  useEffect(() => {
    if (!open) return undefined;
    setGoalAfterDelete(null);
    if (!plan?.is_active) return undefined;
    // Chiudendo il dialog la risposta in volo non vale più: non deve comparire in quello aperto dopo
    let current = true;
    readGoalAfterDelete().then((goal) => {
      if (current) setGoalAfterDelete(goal);
    });
    return () => { current = false; };
  }, [open, plan, readGoalAfterDelete]);

  const handleConfirm = async () => {
    if (!plan) return;

    setDeletePlanLoading(true);
    try {
      await onDelete(plan);
    } finally {
      setDeletePlanLoading(false);
      onClose();
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      aria-labelledby="alert-dialog-title"
      aria-describedby="alert-dialog-description"
    >
      <DialogTitle id="alert-dialog-title">{t('plans.delete_plan.title')}</DialogTitle>
      <DialogContent>
        <DialogContentText id="alert-dialog-description" sx={{ color: 'text.primary' }} component="div">
          {t('plans.delete_plan.text')}
          <Box sx={{ mt: 1.5 }}>{t('plans.delete_plan.history_kept')}</Box>
          {goalAfterDelete !== null && (
            <Box sx={{ mt: 1.5 }}>{t('plans.delete_plan.goal_reset', { n: goalAfterDelete })}</Box>
          )}
          {plan && (
            <Box sx={{ mt: 2, fontWeight: 'bold' }}>
              {t('plans.delete_plan.name', { name: plan.name })}
            </Box>
          )}
        </DialogContentText>
      </DialogContent>
      <DialogActions>
        <Button
          onClick={onClose}
          color="primary"
          disabled={deletePlanLoading}
        >
          {t('common.cancel')}
        </Button>
        <Button
          onClick={handleConfirm}
          color="error"
          variant="contained"
          disabled={deletePlanLoading}
          startIcon={deletePlanLoading ? <ButtonSpinner /> : undefined}
        >
          {deletePlanLoading ? t('plans.deleting') : t('common.delete')}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default DeletePlanDialog;
