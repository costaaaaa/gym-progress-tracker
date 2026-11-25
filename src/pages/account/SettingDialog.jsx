import { useId } from 'react';
import { Button, Dialog, DialogActions, DialogContent, DialogTitle } from '@mui/material';
import { useTranslation } from 'react-i18next';

// Finestra di un'impostazione: il titolo della riga (una volta sola, non si ripete dentro), il controllo in `children` e
// in fondo «Chiudi». Un campo che si conferma (`onSave`) ha invece «Annulla» e «Salva». Con `saving` (un salvataggio in
// corso) non si chiude né con «Chiudi» o «Annulla» né con Esc né col clic fuori, così l'esito non arriva a finestra
// chiusa, e «Salva» non parte una seconda volta. I pulsanti restano normali (aria-disabled): un pulsante `disabled`
// perderebbe il fuoco.
const SettingDialog = ({ open, title, onClose, onSave, saving = false, children }) => {
  const { t } = useTranslation();
  const titleId = useId();
  const closeUnlessSaving = () => { if (!saving) onClose(); };
  const saveUnlessSaving = () => { if (!saving) onSave(); };

  return (
    <Dialog open={open} onClose={closeUnlessSaving} fullWidth maxWidth="xs" aria-labelledby={titleId}>
      <DialogTitle id={titleId}>{title}</DialogTitle>
      <DialogContent>{children}</DialogContent>
      <DialogActions>
        <Button onClick={closeUnlessSaving} aria-disabled={saving || undefined} sx={{ minHeight: 44, fontSize: 16 }}>{onSave ? t('common.cancel') : t('common.close')}</Button>
        {onSave && (
          <Button variant="contained" onClick={saveUnlessSaving} aria-disabled={saving || undefined} sx={{ minHeight: 44, fontSize: 16 }}>{t('common.save')}</Button>
        )}
      </DialogActions>
    </Dialog>
  );
};

export default SettingDialog;
