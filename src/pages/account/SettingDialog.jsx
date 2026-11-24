import { useId } from 'react';
import { Button, Dialog, DialogActions, DialogContent, DialogTitle } from '@mui/material';
import { useTranslation } from 'react-i18next';

// Finestra di un'impostazione: il titolo della riga (una volta sola, non si ripete dentro), il controllo in `children` e
// in fondo «Chiudi». Con `saving` (un salvataggio in corso) non si chiude né con «Chiudi» né con Esc né col clic fuori, così
// l'esito non arriva a finestra chiusa. «Chiudi» resta un pulsante normale (aria-disabled): un pulsante `disabled`
// perderebbe il fuoco.
const SettingDialog = ({ open, title, onClose, saving = false, children }) => {
  const { t } = useTranslation();
  const titleId = useId();
  const closeUnlessSaving = () => { if (!saving) onClose(); };

  return (
    <Dialog open={open} onClose={closeUnlessSaving} fullWidth maxWidth="xs" aria-labelledby={titleId}>
      <DialogTitle id={titleId}>{title}</DialogTitle>
      <DialogContent>{children}</DialogContent>
      <DialogActions>
        <Button onClick={closeUnlessSaving} aria-disabled={saving || undefined} sx={{ minHeight: 44, fontSize: 16 }}>{t('common.close')}</Button>
      </DialogActions>
    </Dialog>
  );
};

export default SettingDialog;
