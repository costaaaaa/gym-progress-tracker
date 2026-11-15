import { LocalizationProvider } from '@mui/x-date-pickers';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { itIT, enUS } from '@mui/x-date-pickers/locales';
import { useTranslation } from 'react-i18next';
import { dateFnsLocale } from './format';

const DateLocalization = ({ children }) => {
  const { t, i18n } = useTranslation();
  const pickerLocale = i18n.language === 'en' ? enUS : itIT;
  // Il pulsante che cambia vista: in italiano la frase di MUI X è sbagliata («la vista dell'calendario»), quindi
  // si prende dai cataloghi, in entrambe le lingue (quella inglese è identica a MUI X)
  const localeText = {
    ...pickerLocale.components.MuiLocalizationProvider.defaultProps.localeText,
    calendarViewSwitchingButtonAriaLabel: (view) => (view === 'year' ? t('date_picker.switch_to_calendar') : t('date_picker.switch_to_year')),
  };
  return (
    <LocalizationProvider
      dateAdapter={AdapterDateFns}
      adapterLocale={dateFnsLocale()}
      localeText={localeText}
    >
      {children}
    </LocalizationProvider>
  );
};

export default DateLocalization;
