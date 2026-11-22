import { useState } from 'react';
import {
  Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, FormControl, InputLabel, MenuItem, Select, TextField
} from '@mui/material';
import { useTranslation } from 'react-i18next';
import LockedRow from '../../components/LockedRow';

const MAX_DAY_OPTIONS = 7; // giorni offerti al massimo nella nuova scheda

// «Nuova scheda». `onCreate(valori, giorni)` restituisce true se la scheda è stata creata: allora il dialog si
// chiude e riparte vuoto. `dayLimit` è il tetto di giorni per scheda dell'account (null se non si conosce).
const NewPlanDialog = ({ open, onClose, onCreate, dayLimit, isFree }) => {
  const { t } = useTranslation();
  const [newPlan, setNewPlan] = useState({
    name: '',
    description: ''
  });
  const [numDays, setNumDays] = useState(1);
  const maxDays = Math.min(MAX_DAY_OPTIONS, dayLimit ?? MAX_DAY_OPTIONS);

  const handleCreate = async () => {
    if (await onCreate(newPlan, numDays)) {
      onClose();
      setNewPlan({
        name: '',
        description: ''
      });
      setNumDays(1);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>{t('plans.new')}</DialogTitle>
      <DialogContent>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
          <TextField
            autoFocus
            label={t('plans.new_dialog.name')}
            type="text"
            fullWidth
            placeholder={t('plans.new_dialog.name_placeholder')}
            value={newPlan.name}
            onChange={(e) => setNewPlan({ ...newPlan, name: e.target.value })}
          />
          <TextField
            label={t('plans.new_dialog.description')}
            type="text"
            fullWidth
            multiline
            rows={2}
            placeholder={t('plans.new_dialog.description_placeholder')}
            value={newPlan.description}
            onChange={(e) => setNewPlan({ ...newPlan, description: e.target.value })}
          />
          <FormControl fullWidth>
            <InputLabel id="num-days-label">{t('plans.new_dialog.days')}</InputLabel>
            <Select
              labelId="num-days-label"
              value={numDays}
              label={t('plans.new_dialog.days')}
              onChange={(e) => setNumDays(parseInt(e.target.value, 10))}
            >
              {Array.from({ length: maxDays }, (_, i) => i + 1).map((num) => (
                <MenuItem key={num} value={num}>
                  {t('plans.new_dialog.days_option', { count: num })}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          {isFree && maxDays < MAX_DAY_OPTIONS && (
            <LockedRow sx={{ mb: 0 }}>{t('plans.locked_days', { max: maxDays })}</LockedRow>
          )}
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>{t('common.cancel')}</Button>
        <Button onClick={handleCreate} variant="contained" disabled={!newPlan.name}>
          {t('common.create')}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default NewPlanDialog;
