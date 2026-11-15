import useMediaQuery from '@mui/material/useMediaQuery';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { usePickersTranslations } from '@mui/x-date-pickers/hooks';

// Puntatore preciso: selettore da tastiera sul campo (variante desktop). Altrimenti il campo è di sola lettura e apre un dialogo.
const DESKTOP_QUERY = '@media (pointer: fine)';

// DatePicker con il nome accessibile giusto su telefono: lì MUI mette al campo aria-label «Scegli la data…»,
// che sostituisce l'etichetta visibile (2.5.3, 4.1.2). Qui il nome comincia con l'etichetta e continua con il
// testo di MUI (che dice anche la data scelta). Su desktop quel testo è il nome del pulsante del calendario:
// resta com'è. Da usare dentro DateLocalization.
const LabeledDatePicker = ({ label, ...props }) => {
  const translations = usePickersTranslations();
  const isDesktop = useMediaQuery(DESKTOP_QUERY, { defaultMatches: true });
  const localeText = isDesktop ? undefined : {
    openDatePickerDialogue: (value, utils, formattedDate) => `${label}, ${translations.openDatePickerDialogue(value, utils, formattedDate)}`,
  };
  return <DatePicker label={label} desktopModeMediaQuery={DESKTOP_QUERY} localeText={localeText} {...props} />;
};

export default LabeledDatePicker;
