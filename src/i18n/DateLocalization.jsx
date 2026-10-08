import { LocalizationProvider } from '@mui/x-date-pickers';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { itIT, enUS } from '@mui/x-date-pickers/locales';
import { useTranslation } from 'react-i18next';
import { dateFnsLocale } from './format';

const DateLocalization = ({ children }) => {
  const { i18n } = useTranslation();
  const pickerLocale = i18n.language === 'en' ? enUS : itIT;
  return (
    <LocalizationProvider
      dateAdapter={AdapterDateFns}
      adapterLocale={dateFnsLocale()}
      localeText={pickerLocale.components.MuiLocalizationProvider.defaultProps.localeText}
    >
      {children}
    </LocalizationProvider>
  );
};

export default DateLocalization;
