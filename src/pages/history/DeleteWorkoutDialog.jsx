import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Typography, Button, Dialog, DialogActions, DialogContent, DialogTitle } from '@mui/material';
import { achievementLabel } from '../../i18n/labels';

// Conferma dell'eliminazione, con ciò che si perde (lo chiede previewDelete(id)). Aperto quando `workout` c'è.
// Punti, streak e traguardi sono del modulo Livelli: con `showLevels` falso non si mostrano.
const DeleteWorkoutDialog = ({ workout, onClose, onConfirm, previewDelete, showLevels, weightUnit }) => {
  const { t } = useTranslation();
  const [preview, setPreview] = useState(null);

  useEffect(() => {
    if (!workout) return undefined;
    let cancelled = false;
    previewDelete(workout.id).then(data => { if (!cancelled && data?.success) setPreview(data); });
    return () => { cancelled = true; };
  }, [workout, previewDelete]);

  const handleClose = () => {
    onClose();
    setPreview(null);
  };

  const handleConfirm = () => {
    // Mentre il dialog si chiude il pulsante è ancora cliccabile, ma l'allenamento non c'è più
    if (!workout) return;
    onConfirm(workout);
    setPreview(null);
  };

  return (
    <Dialog open={!!workout} onClose={handleClose}>
      <DialogTitle>{t('history.delete.title')}</DialogTitle>
      <DialogContent>
        {t('history.delete.body')}
        {showLevels && preview?.xp_removed > 0 && (
          <Typography variant="body2" sx={{ mt: 1.5 }}>{t('history.delete.lose_xp', { xp: preview.xp_removed })}</Typography>
        )}
        {showLevels && preview && preview.streak_before !== preview.streak_after && (
          <Typography variant="body2" sx={{ mt: 0.5 }}>
            {t('history.streak_change', { from: preview.streak_before, to: preview.streak_after })}
          </Typography>
        )}
        {(showLevels ? (preview?.achievements_removed ?? []) : []).map(key => (
          <Typography key={key} variant="body2" sx={{ mt: 0.5 }}>
            {t('history.delete.lose_achievement', { label: achievementLabel(key, undefined, weightUnit) })}
          </Typography>
        ))}
        {workout?.health_written && (
          <Typography variant="body2" sx={{ mt: 1.5 }}>{t('history.delete.health_note')}</Typography>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose}>{t('common.cancel')}</Button>
        <Button onClick={handleConfirm} color="error" variant="contained">{t('history.delete.confirm')}</Button>
      </DialogActions>
    </Dialog>
  );
};

export default DeleteWorkoutDialog;
