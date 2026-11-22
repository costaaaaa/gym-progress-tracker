import { useState } from 'react';
import { Box, Typography, Select, MenuItem } from '@mui/material';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../context/AuthContext';
import { saveSettings } from './saveSettings';

// Lingua dell'account: parte da `account.locale` e si salva appena si sceglie; se il salvataggio fallisce torna alla
// lingua di prima. `first`: è la prima riga della sua card, senza la linea sopra.
const LanguageSetting = ({ account, notify, first }) => {
  const { t } = useTranslation();
  const { updateUser } = useAuth();
  const [locale, setLocale] = useState(account?.locale || 'it');
  const [saving, setSaving] = useState(false);

  const handleChange = async (e) => {
    const previous = locale;
    const next = e.target.value;
    setLocale(next);
    setSaving(true);
    try {
      await saveSettings({ locale: next });
      updateUser({ locale: next });
      notify(t('account.language_saved', { lng: next }), 'success');
    } catch (error) {
      console.error('Errore aggiornamento lingua:', error);
      setLocale(previous);
      notify(t('account.language_error'), 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2, ...(first ? {} : { pt: 3, borderTop: '1px solid', borderColor: 'divider' }) }}>
      <Box>
        <Typography sx={{ fontSize: 16, fontWeight: 700 }}>{t('account.language')}</Typography>
        <Typography sx={{ fontSize: 16, color: 'text.secondary', mt: 0.5 }}>
          {t('account.language_help')}
        </Typography>
      </Box>
      <Select
        size="small"
        value={locale}
        disabled={saving}
        inputProps={{ 'aria-label': t('account.language') }}
        onChange={handleChange}
      >
        <MenuItem value="it">Italiano</MenuItem>
        <MenuItem value="en">English</MenuItem>
      </Select>
    </Box>
  );
};

export default LanguageSetting;
