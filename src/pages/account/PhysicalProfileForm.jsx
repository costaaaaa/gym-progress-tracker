import { useState } from 'react';
import { Box, Typography, Button, FormControl, InputLabel, Select, MenuItem, Grid } from '@mui/material';
import { Save as SaveIcon } from '@mui/icons-material';
import { format, parseISO, startOfToday } from 'date-fns';
import { useTranslation } from 'react-i18next';
import LabeledDatePicker from '../../components/LabeledDatePicker';
import DateLocalization from '../../i18n/DateLocalization';
import { oldestBirthDate, youngestBirthDate, isInvalidBirthDate } from '../../utils/birthDate';
import useFocusField from '../../hooks/useFocusField';
import { saveSettings } from './saveSettings';

// Profilo fisico: data di nascita, sesso e inizio degli allenamenti, con la validazione e il salvataggio. Parte dai valori
// di `account`; età e anni di esperienza si ricalcolano con la risposta del server.
const PhysicalProfileForm = ({ account, notify }) => {
  const { t } = useTranslation();
  const [age, setAge] = useState(account?.age || '');
  const [gender, setGender] = useState(account?.gender || '');
  const [experienceYears, setExperienceYears] = useState(account?.experience_years || '');
  const [birthDate, setBirthDate] = useState(() => (account?.birth_date ? parseISO(account.birth_date) : null));
  const [birthDateError, setBirthDateError] = useState('');
  const { fieldRef, focusField } = useFocusField();
  const [trainingStartDate, setTrainingStartDate] = useState(() => (account?.training_start_date ? parseISO(account.training_start_date) : null));
  const [updatingProfile, setUpdatingProfile] = useState(false);

  const handleUpdateProfile = async () => {
    if (birthDate && isInvalidBirthDate(birthDate)) {
      setBirthDateError(t('birth_date.error_invalid'));
      focusField('birthDate');
      return;
    }
    setUpdatingProfile(true);
    try {
      // Data di nascita e sesso si inviano solo se compilati: il server non li accetta vuoti
      const data = await saveSettings({
        ...(birthDate ? { birth_date: format(birthDate, 'yyyy-MM-dd') } : {}),
        ...(gender ? { gender } : {}),
        training_start_date: trainingStartDate ? format(trainingStartDate, 'yyyy-MM-01') : null
      });

      // Aggiorna i valori calcolati restituiti dal server
      if (data.age !== undefined) setAge(data.age);
      if (data.experience_years !== undefined) setExperienceYears(data.experience_years);

      notify(t('account.profile.saved'), 'success');
    } catch (error) {
      console.error('Errore aggiornamento profilo:', error);
      notify(t('account.profile.error'), 'error');
    } finally {
      setUpdatingProfile(false);
    }
  };

  return (
    <Box>
      <Typography sx={{ fontSize: 16, fontWeight: 700, mb: 1.5 }}>{t('account.physical_profile')}</Typography>
      <DateLocalization>
        <Grid container spacing={2} alignItems="flex-start">
          <Grid item xs={12} sm={6}>
            <LabeledDatePicker
              label={t('account.birth_date')}
              value={birthDate}
              onChange={(newValue) => { setBirthDate(newValue); setBirthDateError(''); }}
              minDate={oldestBirthDate()}
              maxDate={youngestBirthDate()}
              slotProps={{
                textField: {
                  fullWidth: true,
                  size: 'small',
                  // undefined (non false) lascia a MUI X il suo errore di validazione (data fuori da minDate/maxDate)
                  error: birthDateError ? true : undefined,
                  inputRef: fieldRef('birthDate'),
                  // MUI X ignora autoComplete di textField e lo mette a "off": passa solo da inputProps
                  inputProps: { autoComplete: 'bday' },
                  helperText: birthDateError || (age ? t('account.age_current', { age }) : t('account.age_auto'))
                }
              }}
            />
          </Grid>
          <Grid item xs={12} sm={6}>
            <FormControl fullWidth size="small">
              <InputLabel id="gender-label">{t('account.gender')}</InputLabel>
              <Select
                labelId="gender-label"
                value={gender}
                label={t('account.gender')}
                onChange={(e) => setGender(e.target.value)}
              >
                <MenuItem value="M">{t('account.gender_m')}</MenuItem>
                <MenuItem value="F">{t('account.gender_f')}</MenuItem>
                <MenuItem value="O">{t('account.gender_o')}</MenuItem>
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={12}>
            <LabeledDatePicker
              label={t('account.training_start')}
              value={trainingStartDate}
              onChange={(newValue) => setTrainingStartDate(newValue)}
              views={['year', 'month']}
              format="MM/yyyy"
              openTo="month"
              minDate={birthDate || undefined}
              maxDate={startOfToday()}
              slotProps={{
                textField: {
                  fullWidth: true,
                  size: 'small',
                  helperText: experienceYears ? t('account.experience', { years: experienceYears }) : t('account.training_start_hint')
                }
              }}
            />
          </Grid>
        </Grid>
      </DateLocalization>
      <Button
        variant="contained"
        startIcon={<SaveIcon />}
        onClick={handleUpdateProfile}
        disabled={updatingProfile}
        sx={{ fontSize: 16, mt: 2 }}
      >
        {updatingProfile ? t('focus.saving') : t('account.save_profile')}
      </Button>
    </Box>
  );
};

export default PhysicalProfileForm;
