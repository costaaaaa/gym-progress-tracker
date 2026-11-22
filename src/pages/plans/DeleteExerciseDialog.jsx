import { useState } from 'react';
import { Box, Button, Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle } from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import { useTranslation } from 'react-i18next';
import ButtonSpinner from '../../components/ButtonSpinner';

// Conferma di eliminazione di un esercizio da un giorno. `dayId` ed `exercise` restano valorizzati finché il
// dialog si chiude; `onDelete(dayId, esercizio)` elimina e il dialog si chiude comunque.
const DeleteExerciseDialog = ({ open, dayId, exercise, onClose, onDelete }) => {
  const { t } = useTranslation();
  const [deleteExerciseLoading, setDeleteExerciseLoading] = useState(false);

  const handleConfirm = async () => {
    if (!exercise || !dayId) return;

    setDeleteExerciseLoading(true);
    try {
      await onDelete(dayId, exercise);
    } finally {
      setDeleteExerciseLoading(false);
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
      <DialogTitle id="alert-dialog-title">{t('plans.delete_exercise.title')}</DialogTitle>
      <DialogContent>
        <DialogContentText id="alert-dialog-description">
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
          startIcon={deleteExerciseLoading ? <ButtonSpinner /> : <DeleteIcon />}
        >
          {deleteExerciseLoading ? t('plans.deleting') : t('common.delete')}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default DeleteExerciseDialog;
