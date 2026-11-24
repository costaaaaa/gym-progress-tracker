import { useId } from 'react';
import { Button, Dialog, DialogActions, DialogContent, DialogTitle } from '@mui/material';
import { useTranslation } from 'react-i18next';

// Finestra di un'impostazione: il titolo della riga (una volta sola, non si ripete dentro), il controllo in `children` e
// in fondo «Chiudi». Con `busy` (un salvataggio in corso) non si chiude né con «Chiudi» né con Esc né col clic fuori, così
// l'esito non arriva a finestra chiusa. «Chiudi» resta un pulsante normale (aria-disabled): un pulsante `disabled`
// perderebbe il fuoco.
const SettingDialog = ({ open, title, onClose, busy = false, children }) => {
  const { t } = useTranslation();
  const titleId = useId();
  const close = () => { if (!busy) onClose(); };

  return (
    <Dialog open={open} onClose={close} fullWidth maxWidth="xs" aria-labelledby={titleId}>
      <DialogTitle id={titleId}>{title}</DialogTitle>
      <DialogContent>{children}</DialogContent>
      <DialogActions>
        <Button onClick={close} aria-disabled={busy || undefined} sx={{ minHeight: 44 }}>{t('common.close')}</Button>
      </DialogActions>
    </Dialog>
  );
};

export default SettingDialog;
