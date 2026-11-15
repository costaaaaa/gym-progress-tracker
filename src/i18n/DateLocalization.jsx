import { LocalizationProvider } from '@mui/x-date-pickers';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { itIT, enUS } from '@mui/x-date-pickers/locales';
import { useTranslation } from 'react-i18next';
import { dateFnsLocale } from './format';

// La frase di MUI X per il pulsante che cambia vista, in italiano, è sbagliata («la vista dell'calendario»)
const itLocaleText = {
  ...itIT.components.MuiLocalizationProvider.defaultProps.localeText,
  calendarViewSwitchingButtonAriaLabel: (view) => (view === 'year'
    ? 'Vista anno aperta, passa alla vista calendario'
    : 'Vista calendario aperta, passa alla vista anno'),
};

const DateLocalization = ({ children }) => {
  const { i18n } = useTranslation();
  return (
    <LocalizationProvider
      dateAdapter={AdapterDateFns}
      adapterLocale={dateFnsLocale()}
      localeText={i18n.language === 'en' ? enUS.components.MuiLocalizationProvider.defaultProps.localeText : itLocaleText}
    >
      {children}
    </LocalizationProvider>
  );
};

export default DateLocalization;
