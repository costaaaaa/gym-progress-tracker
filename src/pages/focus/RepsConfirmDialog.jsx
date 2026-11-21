import { Dialog, DialogTitle, DialogActions, Button } from '@mui/material';
import { useTranslation } from 'react-i18next';
import { useFocusColors } from './useFocusColors';
import { radius } from '../../theme/radius';

// Conferma delle ripetizioni insolite (vedi repsNeedConfirm), per la serie in corso e per la correzione di una fatta
export default function RepsConfirmDialog({ open, reps, onClose, onConfirm }) {
  const { t } = useTranslation();
  const { colors } = useFocusColors();
  return (
    <Dialog open={open} onClose={onClose}
      PaperProps={{ sx: { bgcolor: colors.bgCard, color: colors.text, borderRadius: radius.xxl } }}>
      <DialogTitle sx={{ color: colors.text }}>{t('record.confirm_reps', { reps: parseInt(reps, 10) })}</DialogTitle>
      <DialogActions>
        <Button onClick={onClose} sx={{ color: colors.textSecondary }}>{t('record.fix')}</Button>
        <Button onClick={onConfirm} sx={{ color: colors.text }}>{t('record.confirm_yes')}</Button>
      </DialogActions>
    </Dialog>
  );
}
