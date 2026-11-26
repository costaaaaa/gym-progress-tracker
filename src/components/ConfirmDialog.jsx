import { Button, Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle } from '@mui/material';
import { useTranslation } from 'react-i18next';

// Conferma di un'azione che non si annulla (eliminare una misurazione, uscire da un gruppo, rimuovere un membro): titolo,
// testo, «Annulla» e il pulsante dell'azione in rosso pieno senza icona. Aperto quando `open` è vero; `onConfirm` parte al
// tocco di `cta` e la finestra si chiude con `onClose`. Mentre si chiude (`open` falso, dissolvenza in corso) un secondo
// tocco su `cta` non rilancia l'azione; i pulsanti non si spengono, per non cambiare colore durante la dissolvenza.
const ConfirmDialog = ({ open, title, text, cta, onConfirm, onClose }) => {
  const { t } = useTranslation();
  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle>{title}</DialogTitle>
      <DialogContent><DialogContentText sx={{ color: 'text.primary' }}>{text}</DialogContentText></DialogContent>
      <DialogActions>
        <Button onClick={onClose} sx={{ fontSize: 16 }}>{t('common.cancel')}</Button>
        <Button color="error" variant="contained" onClick={open ? onConfirm : undefined} sx={{ fontSize: 16 }}>{cta}</Button>
      </DialogActions>
    </Dialog>
  );
};

export default ConfirmDialog;
