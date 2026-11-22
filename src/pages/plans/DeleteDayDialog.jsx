import { useState } from 'react';
import { Box, Button, Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle } from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import { useTranslation } from 'react-i18next';
import ButtonSpinner from '../../components/ButtonSpinner';
import { savedDraftDayId } from '../../utils/focusDraft';

// Conferma di eliminazione di un giorno: aperto quando `day` è valorizzato. `onDelete(giorno)` elimina e il dialog
// si chiude comunque. `features` sono le funzioni dell'account.
const DeleteDayDialog = ({ day, onClose, onDelete, features }) => {
  const { t } = useTranslation();
  const [deleteDayLoading, setDeleteDayLoading] = useState(false);

  // Senza focus_session_edit (piano Gratis) un allenamento Focus salvato su questo browser su un giorno eliminato non
  // si potrebbe più registrare: si elimina il giorno solo dopo averlo salvato o scartato. Plus e Pro lo salvano
  // comunque. Finché user/read.php carica, o se fallisce, `features` è vuoto e il blocco vale anche per Plus e Pro
  // (scelta prudente). Una sessione in corso su un altro dispositivo da qui non si vede: limite accettato.
  const draftDayId = savedDraftDayId();
  const draftBlocksDelete = !!day && !features.includes('focus_session_edit')
    && draftDayId !== null && String(draftDayId) === String(day.id);

  const handleConfirm = async () => {
    if (!day) return;
    setDeleteDayLoading(true);
    try {
      await onDelete(day);
    } finally {
      setDeleteDayLoading(false);
      onClose();
    }
  };

  return (
    <Dialog
      open={!!day}
      onClose={() => !deleteDayLoading && onClose()}
      aria-labelledby="delete-day-title"
      aria-describedby="delete-day-description"
    >
      <DialogTitle id="delete-day-title">{t('plans.delete_day.title')}</DialogTitle>
      <DialogContent>
        <DialogContentText id="delete-day-description" component="div">
          {draftBlocksDelete ? t('plans.delete_day.in_progress') : (
            <>
              {t('plans.delete_day.text')}
              <Box sx={{ mt: 1.5 }}>{t('plans.delete_plan.history_kept')}</Box>
            </>
          )}
          {day && (
            <Box sx={{ mt: 2, fontWeight: 'bold' }}>{t('plans.delete_day.name', { name: day.name })}</Box>
          )}
        </DialogContentText>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} color="primary" disabled={deleteDayLoading}>{t('common.cancel')}</Button>
        <Button
          onClick={handleConfirm}
          color="error"
          variant="contained"
          disabled={deleteDayLoading || draftBlocksDelete}
          startIcon={deleteDayLoading ? <ButtonSpinner /> : <DeleteIcon />}
        >
          {deleteDayLoading ? t('plans.deleting') : t('common.delete')}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default DeleteDayDialog;
