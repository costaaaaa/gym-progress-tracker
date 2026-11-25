import { Button, Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle } from '@mui/material';
import { useTranslation } from 'react-i18next';

// Conferma di un'azione che non si annulla (eliminare una misurazione, uscire da un gruppo): titolo, testo,
// «Annulla» e il pulsante dell'azione in rosso pieno senza icona. Aperto quando `open` è vero; `onConfirm` parte
// al tocco di `cta` e la finestra si chiude con `onClose`.
const ConfirmDialog = ({ open, title, text, cta, onConfirm, onClose }) => {
  const { t } = useTranslation();
  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle>{title}</DialogTitle>
      <DialogContent><DialogContentText sx={{ color: 'text.primary' }}>{text}</DialogContentText></DialogContent>
      <DialogActions>
        <Button onClick={onClose} sx={{ fontSize: 16 }}>{t('common.cancel')}</Button>
        <Button color="error" variant="contained" onClick={onConfirm} sx={{ fontSize: 16 }}>{cta}</Button>
      </DialogActions>
    </Dialog>
  );
};

export default ConfirmDialog;
