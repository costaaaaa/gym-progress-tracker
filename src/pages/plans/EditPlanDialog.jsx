import { useState } from 'react';
import { Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, TextField } from '@mui/material';
import { useTranslation } from 'react-i18next';
import ButtonSpinner from '../../components/ButtonSpinner';

const valuesOf = (plan) => ({ name: plan?.name ?? '', description: plan?.description || '' });

// Nome e descrizione di una scheda. `plan` resta valorizzato finché il dialog si chiude (i campi ripartono da lì
// a ogni scheda nuova); `onSave(scheda, valori)` restituisce true se il server ha accettato: allora il dialog si chiude.
const EditPlanDialog = ({ open, plan, onClose, onSave }) => {
  const { t } = useTranslation();
  const [values, setValues] = useState(() => valuesOf(plan));
  const [updatePlanLoading, setUpdatePlanLoading] = useState(false);

  // I campi ripartono dalla scheda appena cambiata, prima che i figli vengano disegnati
  const [lastPlan, setLastPlan] = useState(plan);
  if (plan !== lastPlan) {
    setLastPlan(plan);
    setValues(valuesOf(plan));
  }

  const handleSave = async () => {
    if (!values.name.trim() || !plan) return;

    setUpdatePlanLoading(true);
    try {
      if (await onSave(plan, values)) onClose();
    } finally {
      setUpdatePlanLoading(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>{t('plans.edit_dialog.title')}</DialogTitle>
      <DialogContent>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
          <TextField
            autoFocus
            label={t('plans.new_dialog.name')}
            type="text"
            fullWidth
            value={values.name}
            onChange={(e) => setValues({ ...values, name: e.target.value })}
          />
          <TextField
            label={t('plans.new_dialog.description')}
            type="text"
            fullWidth
            multiline
            rows={2}
            value={values.description}
            onChange={(e) => setValues({ ...values, description: e.target.value })}
          />
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={updatePlanLoading}>{t('common.cancel')}</Button>
        <Button
          onClick={handleSave}
          variant="contained"
          disabled={!values.name || updatePlanLoading}
          startIcon={updatePlanLoading ? <ButtonSpinner /> : null}
        >
          {updatePlanLoading ? t('plans.saving') : t('common.save')}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default EditPlanDialog;
