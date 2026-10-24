import { Button, Dialog, DialogTitle, DialogContent, DialogContentText, DialogActions } from '@mui/material';
import { useFocusColors } from './useFocusColors';

// Conferma d'uscita, uguale in Workout e Summary: cambiano solo i testi
export default function QuitDialog({ open, onClose, onConfirm, title, text, stayLabel, exitLabel, destructive = false }) {
  const { colors } = useFocusColors();
  return (
    <Dialog open={open} onClose={onClose}
      PaperProps={{ sx: { bgcolor: colors.bgCard, color: colors.text, borderRadius: '16px' } }}>
      <DialogTitle sx={{ color: colors.text }}>{title}</DialogTitle>
      <DialogContent>
        <DialogContentText sx={{ color: colors.textSecondary }}>{text}</DialogContentText>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} sx={{ color: colors.textSecondary }}>{stayLabel}</Button>
        <Button onClick={onConfirm} sx={{ color: destructive ? colors.primary : colors.text }}>{exitLabel}</Button>
      </DialogActions>
    </Dialog>
  );
}
