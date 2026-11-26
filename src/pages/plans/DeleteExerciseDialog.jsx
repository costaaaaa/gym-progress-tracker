import { useState } from 'react';
import { Box, Button, Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle } from '@mui/material';
import { useTranslation } from 'react-i18next';
import ButtonSpinner from '../../components/ButtonSpinner';

// Conferma di eliminazione di un esercizio da un giorno. `target` è `{ dayId, exercise }` e resta valorizzato
// finché il dialog si chiude. `onClose` serve per annullare; alla conferma `onDelete(target)` elimina e chiude chi
// lo usa.
const DeleteExerciseDialog = ({ open, target, onClose, onDelete }) => {
  const exercise = target?.exercise;
  const { t } = useTranslation();
  const [deleteExerciseLoading, setDeleteExerciseLoading] = useState(false);

  const handleConfirm = async () => {
    if (!exercise || !target.dayId) return;

    setDeleteExerciseLoading(true);
    try {
      await onDelete(target);
    } finally {
      setDeleteExerciseLoading(false);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      aria-labelledby="alert-dialog-title"
      aria-describedby="alert-dialog-description"
    >
      <DialogTitle id="alert-dialog-title">{t('plans.delete_exercise.title')}</DialogTitle>
      <DialogContent>
        <DialogContentText id="alert-dialog-description" sx={{ color: 'text.primary' }}>
          {t('plans.delete_exercise.text')}
          {exercise && (
            <Box sx={{ mt: 2, fontWeight: 'bold' }}>
              {t('plans.delete_exercise.name', { name: exercise.name })}
            </Box>
          )}
        </DialogContentText>
      </DialogContent>
      <DialogActions>
        <Button
          onClick={onClose}
          color="primary"
          disabled={deleteExerciseLoading}
        >
          {t('common.cancel')}
        </Button>
        <Button
          onClick={handleConfirm}
          color="error"
          variant="contained"
          disabled={deleteExerciseLoading}
          startIcon={deleteExerciseLoading ? <ButtonSpinner /> : undefined}
        >
          {deleteExerciseLoading ? t('plans.deleting') : t('common.delete')}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default DeleteExerciseDialog;
