import { visuallyHidden } from '@mui/utils';
import LabeledDatePicker from '../../components/LabeledDatePicker';
import DateLocalization from '../../i18n/DateLocalization';
import SettingOutcome from './SettingOutcome';

// Il titolo della finestra dice già a cosa serve il campo: l'etichetta resta (è il suo nome accessibile) ma non si vede.
// La tacca del bordo non si tocca: il tema la tiene già chiusa, e toglierla alzerebbe il bordo di 5 px sopra il campo,
// dove la finestra lo taglia. La riga d'aiuto, che MUI disegna più piccola di 16 px, si porta a 16.
const FIELD_STYLE = {
  '& .MuiInputLabel-root': visuallyHidden,
  '& .MuiFormHelperText-root': { fontSize: 16 },
};

// Corpo della finestra di un campo con la data (data di nascita, inizio allenamento): il campo (la sua etichetta, uguale
// al titolo della finestra, non si vede) col suo aiuto e sotto
// l'esito di un rifiuto del server (`outcomeError`). `error` è l'errore di validazione, scritto al posto dell'aiuto e
// letto col campo; `inputProps` e le altre proprietà (limiti, viste, formato) vanno al selettore. Il salvataggio sta nel
// piede della finestra (SettingDialog con onSave).
const DateSettingBody = ({ label, value, onChange, help, error, outcomeError, inputRef, inputProps, ...picker }) => (
  <>
    <DateLocalization>
      <LabeledDatePicker
        label={label}
        value={value}
        onChange={onChange}
        slotProps={{
          textField: {
            fullWidth: true,
            size: 'small',
            sx: FIELD_STYLE,
            // undefined (non false) lascia a MUI X il suo errore di validazione (data fuori da minDate/maxDate)
            error: error ? true : undefined,
            inputRef,
            // MUI X ignora autoComplete di textField e lo mette a "off": passa solo da inputProps
            ...(inputProps && { inputProps }),
            helperText: error || help,
          },
        }}
        {...picker}
      />
    </DateLocalization>
    <SettingOutcome error={outcomeError} />
  </>
);

export default DateSettingBody;
