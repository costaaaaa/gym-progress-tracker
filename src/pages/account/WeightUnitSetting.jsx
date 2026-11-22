import { useState } from 'react';
import { Box, Typography, Select, MenuItem } from '@mui/material';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../context/AuthContext';
import { DEFAULT_WEIGHT_UNIT, isWeightUnit } from '../../utils/weightUnit';
import { saveSettings } from './saveSettings';

// Unità di peso dell'account: parte da `account.weight_unit` (kg se manca) e si salva appena si sceglie; se il
// salvataggio fallisce torna all'unità di prima.
const WeightUnitSetting = ({ account, notify }) => {
  const { t } = useTranslation();
  const { updateUser } = useAuth();
  const [weightUnit, setWeightUnit] = useState(isWeightUnit(account?.weight_unit) ? account.weight_unit : DEFAULT_WEIGHT_UNIT);
  const [saving, setSaving] = useState(false);

  const handleChange = async (e) => {
    const previous = weightUnit;
    const next = e.target.value;
    setWeightUnit(next);
    setSaving(true);
    try {
      await saveSettings({ weight_unit: next });
      updateUser({ weight_unit: next });
      notify(t('account.weight_unit_saved'), 'success');
    } catch (error) {
      console.error('Errore aggiornamento unità di peso:', error);
      setWeightUnit(previous);
      notify(t('account.weight_unit_error'), 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2 }}>
      <Box>
        <Typography sx={{ fontSize: 16, fontWeight: 700 }}>{t('account.weight_unit')}</Typography>
        <Typography sx={{ fontSize: 16, color: 'text.secondary', mt: 0.5 }}>
          {t('account.weight_unit_help')}
        </Typography>
      </Box>
      <Select
        size="small"
        value={weightUnit}
        disabled={saving}
        inputProps={{ 'aria-label': t('account.weight_unit') }}
        onChange={handleChange}
      >
        <MenuItem value="kg">{t('units.metric')}</MenuItem>
        <MenuItem value="lb">{t('units.imperial')}</MenuItem>
      </Select>
    </Box>
  );
};

export default WeightUnitSetting;
